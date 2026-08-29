#!/usr/bin/env python3
"""
Generate a music bed, and make it loop.

    .venv-moss/Scripts/python.exe tools/gen-music.py beer --list
    .venv-moss/Scripts/python.exe tools/gen-music.py beer bedBrew --candidates 3
    .venv-moss/Scripts/python.exe tools/gen-music.py beer --accept bedBrew=2

Prompts live in content/<pack>/music-prompts.json, versioned with the pack, so
"what did we ask for" survives the person who asked — the same rule as
image-prompts.json and sound-prompts.json.


WHY THIS EXISTS AT ALL
----------------------

The synthesised beds in sound/library.js are Karplus-Strong drones. They were
reported twice: "the background music is terrible, and it goes up and down in
volume", and then "the music in the background is a guitar that doesn't sound
right". The second one is precise — a plucked-string synth is an imitation of
an instrument, and a bad imitation is worse than no instrument.

Free music libraries were tried first and failed on their own terms. The CC0
game-loop packs are written with soft synths and sound it; public-domain
classical on archive.org is a licence minefield where most recordings state no
licence at all and the ones that do are usually non-commercial.


THE MODEL
---------

ACE-Step v1-3.5B. Apache 2.0 on the WEIGHTS, not just the code, so an accepted
bed carries no restriction and the build stays commercially usable — the same
bar MOSS-SoundEffect and FLUX.2-klein-4B clear. Measured on an RTX 4060 Laptop
(8 GB): 60 s of audio in 18 s, 6.82 GB peak, with cpu_offload on and
torch_compile off. No dtype surgery, unlike MOSS.

Four things that cost time and are not obvious:

  · The pipeline keeps its OWN checkpoint cache under ~/.cache/ace-step and
    ignores the huggingface one, so leaving `checkpoint_dir` unset downloads a
    second 7.8 GB copy of the same bytes. CKPT below points at its cache.
  · Windows will not create a symlink without Developer Mode, and
    huggingface_hub symlinks every file into the snapshot — so the download
    dies on a 639-byte config.json after fetching 7.8 GB. HF_HUB_DISABLE_SYMLINKS.
  · torch_compile needs Triton, which is Linux-only.
  · torchaudio.save() now routes through TorchCodec, a second binary
    dependency for writing a WAV. Patched to the stdlib below.


THE LOOP, WHICH IS THE HALF THE LICENCE HAS NOTHING TO DO WITH
--------------------------------------------------------------

A four-minute song is not a bed. What a chapter needs is twenty to forty
seconds that joins itself invisibly, and a generated piece has a beginning and
an end: measured on the first four, the join sat around -13 dB where under -40
is inaudible, so each would click audibly every time round.

The fix is the one sound/library.js already uses for synthesised loops, applied
to a file: generate LONGER than the loop, then fold the overhang back over the
head with an equal-power crossfade. That makes the join seamless by
construction rather than by luck. On top of it, `--accept` searches for the
loop length whose fold is most musical — the length at which the material
after the cut most resembles the material at the start — so the crossfade has
the least work to do.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import sys
import time
import wave

os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

MODEL = "ACE-Step/ACE-Step-v1-3.5B"
LICENCE = "Apache-2.0"
CREDIT = ("Generated with ACE-Step v1-3.5B (ACE Studio / StepFun). "
          "Apache 2.0.")
SOURCE = f"https://huggingface.co/{MODEL}"

# Generated longer than the loop so the fold has real material to work with,
# and searched inside that window.
# SIX SECONDS, not two. The crossfade is what makes the join seamless, and on
# sparse music a short one still reads as an EVENT even when the sample-level
# click is gone: measured on the first three candidates, a 2 s fold took the
# discontinuity to -33..-40 dB and the ear still hears the phrase change. Six
# seconds of overlap on a bed that plays a few notes and then rests is simply
# two quiet passages sounding at once, which is what a fade is for.
SEAM = 6.0
LOOP_MIN, LOOP_MAX = 20.0, 40.0


def pack_dir(pack: str) -> str:
    return os.path.join(ROOT, "content", pack)


def load_prompts(pack: str) -> dict:
    p = os.path.join(pack_dir(pack), "music-prompts.json")
    if not os.path.exists(p):
        raise SystemExit(f"no {os.path.relpath(p, ROOT)}")
    with open(p, encoding="utf-8") as fh:
        return {k: v for k, v in json.load(fh).items() if not k.startswith("_")}


# ------------------------------------------------------------------
# WAV, with the standard library
# ------------------------------------------------------------------

def write_wav(path: str, x, sr: int) -> None:
    import torch
    y = x.detach().to("cpu").float().clamp(-1, 1)
    if y.dim() == 1:
        y = y.unsqueeze(0)
    ch = y.shape[0]
    pcm = (y.transpose(0, 1).reshape(-1) * 32767).to(torch.int16).numpy().tobytes()
    with wave.open(path, "wb") as fh:
        fh.setnchannels(ch)
        fh.setsampwidth(2)
        fh.setframerate(int(sr))
        fh.writeframes(pcm)


def read_wav(path: str):
    import torch
    with wave.open(path, "rb") as fh:
        sr, ch, n = fh.getframerate(), fh.getnchannels(), fh.getnframes()
        raw = fh.readframes(n)
    x = torch.frombuffer(bytearray(raw), dtype=torch.int16).float() / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).transpose(0, 1)
    else:
        x = x.unsqueeze(0)
    return x, sr


# ------------------------------------------------------------------
# Generate
# ------------------------------------------------------------------

def build_pipeline():
    import torch
    import torchaudio
    # The pipeline calls this with `sample_rate=` as a keyword and adds
    # `format=` and `backend=`, so the replacement has to take the rate from
    # either position and ignore the rest.
    def _save(path, tensor, sample_rate=None, **kw):
        write_wav(str(path), tensor, sample_rate or kw.get("sr") or 48000)

    torchaudio.save = _save
    from acestep.pipeline_ace_step import ACEStepPipeline
    cands = sorted(glob.glob(os.path.expanduser(
        "~/.cache/ace-step/checkpoints/models--ACE-Step--ACE-Step-v1-3.5B/snapshots/*")))
    if not cands:
        raise SystemExit("no ACE-Step checkpoint cached — see this file's header")
    return ACEStepPipeline(checkpoint_dir=cands[-1], dtype="bfloat16",
                           torch_compile=False, cpu_offload=True,
                           overlapped_decode=True)


def generate(pack: str, mid: str, spec: dict, n: int, seed0: int) -> int:
    outdir = os.path.join(ROOT, "sound-candidates", "_music", pack, mid)
    os.makedirs(outdir, exist_ok=True)
    pipe = build_pipeline()
    dur = float(spec.get("source_seconds", 90))
    print(f"{mid}  {dur:.0f}s source, {n} candidate(s)")
    files = []
    for i in range(n):
        seed = seed0 + i
        dest = os.path.join(outdir, f"{i + 1:02d}-seed{seed}.wav")
        t0 = time.time()
        pipe(format="wav", audio_duration=dur, prompt=spec["prompt"],
             lyrics="[instrumental]", infer_step=int(spec.get("steps", 40)),
             guidance_scale=float(spec.get("guidance", 7.5)),
             scheduler_type="euler", cfg_type="apg", omega_scale=10.0,
             manual_seeds=str(seed), save_path=dest)
        files.append(os.path.basename(dest))
        print(f"  [{i + 1}/{n}] {os.path.basename(dest)}  {time.time() - t0:.0f}s")
    with open(os.path.join(outdir, "_run.json"), "w", encoding="utf-8") as fh:
        json.dump({"prompt": spec["prompt"], "files": files,
                   "source_seconds": dur, "model": MODEL}, fh,
                  ensure_ascii=False, indent=1)
    print(f"\nListen, then: tools/gen-music.py {pack} --accept {mid}=<n>")
    return 0


# ------------------------------------------------------------------
# Loop
# ------------------------------------------------------------------

def best_loop(x, sr: int) -> tuple[float, float]:
    """(loop seconds, how well the fold matches) — searched, not guessed.

    For each candidate length L the fold takes the SEAM seconds after L and
    lays them over the SEAM seconds at the start. The join is seamless either
    way, because the crossfade guarantees it; what the search buys is the fold
    being MUSICAL — the overhang sounding like the opening it is laid over,
    rather than a different chord arriving underneath it.
    """
    mono = x.mean(0)
    seam = int(SEAM * sr)
    head = mono[:seam]
    best, best_err = LOOP_MIN, float("inf")
    step = int(0.05 * sr)
    for start in range(int(LOOP_MIN * sr), int(LOOP_MAX * sr) + 1, step):
        if start + seam > len(mono):
            break
        err = float((mono[start:start + seam] - head).pow(2).mean().sqrt())
        if err < best_err:
            best_err, best = err, start / sr
    peak = float(mono.abs().max()) or 1e-9
    return best, 20 * math.log10(max(best_err / peak, 1e-9))


def fold_loop(x, sr: int, seconds: float):
    """Cut at `seconds` and fold the overhang back with an equal-power fade."""
    import torch
    n = int(seconds * sr)
    seam = min(int(SEAM * sr), n)
    out = x[:, :n].clone()
    w = torch.linspace(0, 1, seam)
    for c in range(out.shape[0]):
        tail = x[c, n:n + seam]
        if len(tail) < seam:
            break
        out[c, :seam] = out[c, :seam] * torch.sqrt(w) + tail * torch.sqrt(1 - w)
    return out


def accept(pack: str, mid: str, index: int) -> int:
    outdir = os.path.join(ROOT, "sound-candidates", "_music", pack, mid)
    run_path = os.path.join(outdir, "_run.json")
    if not os.path.exists(run_path):
        raise SystemExit(f"no candidates for {mid} — generate first")
    with open(run_path, encoding="utf-8") as fh:
        run = json.load(fh)
    spec = load_prompts(pack).get(mid)
    if not spec:
        raise SystemExit(f"{mid} is not in music-prompts.json")
    if run["prompt"] != spec["prompt"]:
        raise SystemExit("the candidates were made from a different prompt than "
                         "music-prompts.json carries now. Re-render first.")
    files = run["files"]
    if not 1 <= index <= len(files):
        raise SystemExit(f"pick 1..{len(files)}")
    src = os.path.join(outdir, files[index - 1])

    x, sr = read_wav(src)
    seconds, err_db = best_loop(x, sr)
    loop = fold_loop(x, sr, seconds)

    # Mono: a bed is ducked to sit under a voice and nobody localises it, and
    # stereo doubles a file the service worker precaches.
    loop = loop.mean(0, keepdim=True)

    dest_dir = os.path.join(pack_dir(pack), "sound")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{mid}.wav")
    write_wav(dest, loop, sr)

    # A preview of the loop played three times round, which is the only way to
    # judge a join by ear — one pass never crosses it.
    import torch
    prev = torch.cat([loop, loop, loop], dim=1)
    prev_path = os.path.join(outdir, f"loop-x3-{mid}.wav")
    write_wav(prev_path, prev, sr)
    print(f"  three times round for listening: {os.path.relpath(prev_path, ROOT)}")

    entry = {
        "file": f"sound/{mid}.wav",
        "title": spec.get("title", {"no": mid, "en": mid}),
        "description": spec.get("description", ""),
        "tags": spec.get("tags", []),
        "reuse": spec.get("reuse", "generic"),
        "kind": "music",
        "duration": round(seconds, 2),
        "licence": LICENCE,
        "credit": CREDIT,
        "source": SOURCE,
        "prompt": spec["prompt"],
        "sampleRate": sr,
        "loop": {"seconds": round(seconds, 2), "seam": SEAM,
                 "foldMatchDb": round(err_db, 1),
                 "from": f"{run['source_seconds']:.0f}s source, {files[index - 1]}"},
    }
    man_path = os.path.join(pack_dir(pack), "sound.json")
    man = {}
    if os.path.exists(man_path):
        with open(man_path, encoding="utf-8") as fh:
            man = json.load(fh)
    man[mid] = entry
    with open(man_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(man, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    size = os.path.getsize(dest)
    print(f"accepted {files[index - 1]}  ->  {os.path.relpath(dest, ROOT)}")
    print(f"  loop {seconds:.2f}s, fold match {err_db:.0f} dB, "
          f"{size / 1e6:.1f} MB mono {sr} Hz")
    print(f"  wrote the entry into {os.path.relpath(man_path, ROOT)}")
    print(f"  licence: {LICENCE} — {CREDIT}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pack")
    ap.add_argument("effect", nargs="?")
    ap.add_argument("--candidates", type=int, default=3)
    ap.add_argument("--seed", type=int, default=100)
    ap.add_argument("--accept", metavar="ID=N")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    prompts = load_prompts(a.pack)
    if a.list:
        for k, v in prompts.items():
            print(f"{k:<16}{v.get('source_seconds', 90):>4.0f}s   {v['prompt'][:60]}")
        return 0
    if a.accept:
        mid, _, n = a.accept.partition("=")
        return accept(a.pack, mid, int(n or 1))
    if not a.effect:
        ap.print_help()
        return 2
    if a.effect not in prompts:
        raise SystemExit(f"{a.effect} is not in music-prompts.json")
    return generate(a.pack, a.effect, prompts[a.effect], a.candidates, a.seed)


if __name__ == "__main__":
    sys.exit(main())
