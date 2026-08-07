#!/usr/bin/env python3
"""
Turn a chapter script into narration audio plus a timing file.

    python tools/narrate.py --chapter american-revolution/chapter-1775-04-19
    python tools/narrate.py ... --lang en --voice en-GB-RyanNeural
    python tools/narrate.py ... --only s3          # re-record one scene
    python tools/narrate.py ... --force            # ignore the cache
    python tools/narrate.py ... --engine openai    # needs OPENAI_API_KEY

What it produces, per language:

    content/<pack>/audio/<lang>/<scene>.mp3     one gapless file per scene
    content/<pack>/timing.<lang>.json           beat offsets and per-word times

Why per-word times matter: the player pins visual cues to words in the script
("when he says Concord, fly the map to Concord"), so nothing is hand-timed and
the cues survive a rewrite or a change of voice.

Beats are synthesised individually, cached by a hash of their text, decoded to
PCM, padded with their `gapAfter` silence and concatenated once. Going through
PCM rather than stitching MP3s avoids the per-file encoder padding that would
otherwise accumulate into a noticeable drift by the end of a long scene.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".narrate-cache")
SAMPLE_RATE = 24000


# ----------------------------------------------------------------------------
# Small helpers
# ----------------------------------------------------------------------------

def die(msg: str) -> "None":
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        die(f"{tool} not found on PATH (needed to build the scene audio)")
    return path


def run(cmd: list) -> None:
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        die(f"{cmd[0]} failed:\n{res.stderr[-1500:]}")


def wav_duration(path: str) -> float:
    with wave.open(path, "rb") as w:
        return w.getnframes() / float(w.getframerate())


def text_of(field, lang: str) -> str:
    if field is None:
        return ""
    if isinstance(field, str):
        return field
    return field.get(lang) or field.get("no") or field.get("en") or ""


def beat_hash(text: str, voice: str, rate: str) -> str:
    return hashlib.sha256(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:16]


# ----------------------------------------------------------------------------
# Voice backends
# ----------------------------------------------------------------------------

class Backend:
    """Synthesise one beat. Returns (mp3_bytes, words | None)."""

    name = "?"
    gives_word_times = False

    async def synth(self, text: str, voice: str, rate: str):
        raise NotImplementedError


class EdgeBackend(Backend):
    """Microsoft Edge's voices. Free, no key, and it reports word boundaries."""

    name = "edge"
    gives_word_times = True

    async def synth(self, text, voice, rate):
        import edge_tts

        # edge-tts 7.x reports sentence boundaries unless you ask for words.
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
        audio = bytearray()
        words = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "w": chunk["text"],
                    # offsets arrive in 100-nanosecond ticks
                    "t": round(chunk["offset"] / 1e7, 3),
                    "d": round(chunk["duration"] / 1e7, 3),
                })
        return bytes(audio), words


class OpenAIBackend(Backend):
    """
    OpenAI's voices sound better but return no word timings, so word anchors
    are estimated by spreading the measured duration across the words in
    proportion to their length. Good to roughly a fifth of a second, and every
    word is flagged `approx` so nothing pretends otherwise.
    """

    name = "openai"
    gives_word_times = False

    async def synth(self, text, voice, rate):
        from openai import AsyncOpenAI

        if not os.environ.get("OPENAI_API_KEY"):
            die("OPENAI_API_KEY is not set")
        client = AsyncOpenAI()
        res = await client.audio.speech.create(
            model="gpt-4o-mini-tts", voice=voice, input=text, response_format="mp3"
        )
        return res.read(), None


BACKENDS = {"edge": EdgeBackend, "openai": OpenAIBackend}


def approximate_words(text: str, duration: float) -> list:
    """Spread a duration across words by length. Used only when the backend
    gives us nothing better."""
    tokens = [w for w in text.split() if w.strip()]
    if not tokens:
        return []
    weights = [max(1, len(t)) for t in tokens]
    total = sum(weights)
    out, cursor = [], 0.0
    for tok, weight in zip(tokens, weights):
        span = duration * weight / total
        out.append({
            "w": tok.strip(".,:;!?—–\"'()"),
            "t": round(cursor, 3),
            "d": round(span, 3),
            "approx": True,
        })
        cursor += span
    return out


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

async def synth_beats(chapter, lang, voice, rate, backend, only, force):
    """Synthesise every beat that is missing or has changed. Returns
    {beat_id: {mp3, wav, dur, words}}."""
    cache_dir = os.path.join(CACHE, lang)
    os.makedirs(cache_dir, exist_ok=True)

    jobs = []
    for scene in chapter["scenes"]:
        if only and scene["id"] not in only:
            continue
        for beat in scene["beats"]:
            text = text_of(beat.get("say"), lang).strip()
            if not text:
                die(f"{beat['id']} has no text for language '{lang}'")
            jobs.append((beat, text))

    made = {}
    fresh = 0
    for i, (beat, text) in enumerate(jobs, 1):
        h = beat_hash(text, voice, rate)
        mp3 = os.path.join(cache_dir, f"{beat['id']}.{h}.mp3")
        meta = os.path.join(cache_dir, f"{beat['id']}.{h}.json")
        wav = os.path.join(cache_dir, f"{beat['id']}.{h}.wav")

        if force or not (os.path.exists(mp3) and os.path.exists(meta)):
            audio, words = await backend.synth(text, voice, rate)
            with open(mp3, "wb") as fh:
                fh.write(audio)
            with open(meta, "w", encoding="utf-8") as fh:
                json.dump(words, fh)
            if os.path.exists(wav):
                os.remove(wav)
            fresh += 1
            print(f"  [{i:3}/{len(jobs)}] {beat['id']:10} {len(audio)/1024:5.0f} KB  synthesised")
        else:
            print(f"  [{i:3}/{len(jobs)}] {beat['id']:10} {'':10} cached")

        if not os.path.exists(wav):
            run(["ffmpeg", "-v", "error", "-y", "-i", mp3,
                 "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "wav", wav])

        with open(meta, encoding="utf-8") as fh:
            words = json.load(fh)
        dur = wav_duration(wav)
        if not words:
            words = approximate_words(text, dur)
        made[beat["id"]] = {"mp3": mp3, "wav": wav, "dur": dur, "words": words}

    print(f"  {fresh} synthesised, {len(jobs) - fresh} from cache")
    return made


def build_scene(scene, made, out_mp3, default_gap):
    """Concatenate a scene's beats through PCM with their silences, then encode
    once. Returns the beat table with absolute offsets."""
    beats, cursor = [], 0.0
    inputs, filters, labels = [], [], []

    for i, beat in enumerate(scene["beats"]):
        rec = made[beat["id"]]
        gap = float(beat.get("gapAfter", default_gap))
        inputs += ["-i", rec["wav"]]
        filters.append(f"[{i}:a]apad=pad_dur={gap}[a{i}]")
        labels.append(f"[a{i}]")
        beats.append({
            "id": beat["id"],
            "start": round(cursor, 3),
            "dur": round(rec["dur"], 3),
            "gapAfter": gap,
            # word times are stored absolute within the scene, so the player can
            # compare them straight against audio.currentTime
            "words": [
                {**w, "t": round(cursor + w["t"], 3)} for w in rec["words"]
            ],
        })
        cursor += rec["dur"] + gap

    graph = ";".join(filters) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[out]"
    os.makedirs(os.path.dirname(out_mp3), exist_ok=True)
    run(["ffmpeg", "-v", "error", "-y", *inputs,
         "-filter_complex", graph, "-map", "[out]",
         "-c:a", "libmp3lame", "-b:a", "48k", "-ac", "1", "-ar", str(SAMPLE_RATE),
         out_mp3])

    return beats, round(cursor, 3)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--chapter", required=True,
                    help="e.g. american-revolution/chapter-1775-04-19")
    ap.add_argument("--lang", default="no")
    ap.add_argument("--voice", help="overrides the chapter's voice for this language")
    ap.add_argument("--rate", help="e.g. -10%% for a calmer read")
    ap.add_argument("--engine", default="edge", choices=sorted(BACKENDS))
    ap.add_argument("--only", nargs="*", metavar="SCENE",
                    help="scene ids to rebuild, e.g. --only s3 s4")
    ap.add_argument("--gap", type=float, default=0.6,
                    help="default silence after a beat, seconds (default 0.6)")
    ap.add_argument("--force", action="store_true", help="ignore the cache")
    args = ap.parse_args()

    need("ffmpeg")

    pack = args.chapter.split("/")[0]
    path = os.path.join(ROOT, "content", args.chapter + ".json")
    if not os.path.exists(path):
        die(f"no chapter at {path}")
    with open(path, encoding="utf-8") as fh:
        chapter = json.load(fh)

    voice = args.voice or (chapter.get("voice") or {}).get(args.lang)
    if not voice:
        die(f"no voice for language '{args.lang}' — pass --voice")
    rate = args.rate or chapter.get("rate", "+0%")
    backend = BACKENDS[args.engine]()

    print(f"chapter : {chapter['id']}")
    print(f"language: {args.lang}   voice: {voice}   rate: {rate}   engine: {backend.name}")
    if not backend.gives_word_times:
        print("  ! this engine returns no word timings; word anchors will be")
        print("    estimated from word length and flagged `approx` in the output.")
    print()

    only = set(args.only) if args.only else None
    made = asyncio.run(synth_beats(chapter, args.lang, voice, rate, backend, only, args.force))

    # Merge into any existing timing file so --only does not wipe other scenes.
    timing_path = os.path.join(ROOT, "content", pack, f"timing.{args.lang}.json")
    timing = {"lang": args.lang, "voice": voice, "rate": rate,
              "engine": backend.name, "scenes": {}}
    if os.path.exists(timing_path) and only:
        with open(timing_path, encoding="utf-8") as fh:
            timing = json.load(fh)
        timing.update(voice=voice, rate=rate, engine=backend.name)

    print("\nbuilding scenes:")
    total = 0.0
    for scene in chapter["scenes"]:
        if only and scene["id"] not in only:
            total += timing["scenes"].get(scene["id"], {}).get("dur", 0.0)
            continue
        rel = f"audio/{args.lang}/{scene['id']}.mp3"
        out = os.path.join(ROOT, "content", pack, rel)
        beats, dur = build_scene(scene, made, out, args.gap)
        timing["scenes"][scene["id"]] = {"audio": rel, "dur": dur, "beats": beats}
        total += dur
        size = os.path.getsize(out) / 1024
        print(f"  {scene['id']:4} {dur:6.1f}s  {size:6.0f} KB  {len(beats):2} beats  {rel}")

    with open(timing_path, "w", encoding="utf-8") as fh:
        json.dump(timing, fh, ensure_ascii=False, indent=1)

    mins, secs = divmod(int(round(total)), 60)
    words = sum(len(b["words"]) for s in timing["scenes"].values() for b in s["beats"])
    print(f"\ntotal   : {mins}:{secs:02d}  ({words} words timed)")
    print(f"timing  : {os.path.relpath(timing_path, ROOT)}")


if __name__ == "__main__":
    main()
