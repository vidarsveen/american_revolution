#!/usr/bin/env python3
"""
try-openrouter.py — put one prompt through several models and look, or listen.

This is the shopping tool, not the production one. It exists to answer the
question no blog post can: which picture model, which voice, which bed, for
THIS course, in Norwegian, on a phone. It writes the candidates side by side
under shots/openrouter/ so they can be compared, and it prints what each call
cost.

    python tools/try-openrouter.py check                 # key + credit balance
    python tools/try-openrouter.py models                # what is available
    python tools/try-openrouter.py image --id bygg-aker  # a real beer prompt
    python tools/try-openrouter.py speech                # Norwegian, four voices
    python tools/try-openrouter.py music                 # a bed
    python tools/try-openrouter.py month                 # what this has spent

THE KEY. Put it in a file called .env at the repo root, one line:

    OPENROUTER_API_KEY=sk-or-v1-...

.env is gitignored. An environment variable of the same name wins over it, so a
shell export still works. The key is never printed, only its last four
characters — a tool that echoes a secret into a terminal has put it in
scrollback, in screenshots and in every transcript of the session.

COST. Every call appends to .foundry/ledger.jsonl and prints the provider's own
`usage.cost` rather than an estimate of it. This is the smallest possible
version of the spend ledger, and it is here from the first call rather than
added afterwards, because the point of the exercise is knowing what a course
costs before committing to making forty of them.

Standard library only, deliberately: this repo has three virtualenvs already
and a shopping tool is not worth a fourth dependency.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

# The Windows console is cp1252 and swallows every Norwegian vowel, which made
# the first speech run look like the TEXT was broken when only the echo of it
# was. The payload was always correct UTF-8 on the wire.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shots", "openrouter")
LEDGER = os.path.join(ROOT, ".foundry", "ledger.jsonl")
API = "https://openrouter.ai/api/v1"


def die(msg):
    print(f"\n  ! {msg}\n", file=sys.stderr)
    sys.exit(1)


# ----------------------------------------------------------------------------
# The key
# ----------------------------------------------------------------------------

def load_key():
    """Environment first, then .env. Never returned to the terminal in full."""
    key = os.environ.get("OPENROUTER_API_KEY")
    if key:
        return key.strip(), "environment"
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                name, _, value = line.partition("=")
                if name.strip() == "OPENROUTER_API_KEY":
                    value = value.strip().strip('"').strip("'")
                    if value:
                        return value, ".env"
    die("no OPENROUTER_API_KEY.\n"
        "    Put it in a file called .env at the repo root, one line:\n"
        "      OPENROUTER_API_KEY=sk-or-v1-...\n"
        "    .env is gitignored. Or export it in your shell.")


def masked(key):
    return f"...{key[-4:]}" if len(key) > 8 else "(short)"


# ----------------------------------------------------------------------------
# HTTP
# ----------------------------------------------------------------------------

def call(path, payload=None, key=None, raw=False, timeout=300, soft=False):
    """POST when there is a payload, else GET. `raw` returns bytes, not JSON.

    `soft` raises instead of exiting, so one bad model in a comparison does not
    throw away the models that worked — which is the whole point of running
    four of them in one go.
    """
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data,
                                 method="POST" if data else "GET")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    # OpenRouter asks callers to identify themselves, and it is how a run shows
    # up on the model's usage page — which is where you find out what actually
    # served the request when a route has more than one provider behind it.
    req.add_header("HTTP-Referer", "https://github.com/vidarsveen/american_revolution")
    req.add_header("X-Title", "Fortell")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read()
            if raw:
                # The speech endpoint answers with audio bytes and puts the only
                # handle on the cost in a header. Without carrying it out of
                # here the ledger silently under-reports the voice, which is the
                # largest per-chapter cost there is.
                return body, res.headers.get("X-Generation-Id")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:700]
        try:
            detail = json.loads(detail)["error"]["message"]
        except Exception:
            pass
        if soft:
            raise RuntimeError(f"HTTP {e.code}: {detail}")
        die(f"HTTP {e.code} on {path}\n    {detail}")
    except urllib.error.URLError as e:
        if soft:
            raise RuntimeError(str(e.reason))
        die(f"could not reach OpenRouter: {e.reason}")


def record(kind, model, cost, note, files):
    """One line per call. The only number worth keeping is the provider's own."""
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    with open(LEDGER, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({
            "t": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "kind": kind, "model": model, "cost": cost,
            "note": note, "files": [os.path.relpath(f, ROOT) for f in files],
        }) + "\n")


def money(x):
    return "—" if x is None else f"${x:.4f}"


def written(path, blob):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(blob)
    return path


def slug(model):
    return re.sub(r"[^a-z0-9]+", "-", model.lower()).strip("-")


def sniff(blob, fallback="bin"):
    """Trust the bytes, not the label. Lyria answers `format: wav` and sends an
    MP3 — the file downloaded fine, would not open, and looked like a broken
    model until the first sixteen bytes were read.
    """
    if blob[:3] == b"ID3" or blob[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    if blob[:4] == b"RIFF":
        return "wav"
    if blob[:4] == b"OggS":
        return "ogg"
    if blob[4:8] == b"ftyp":
        return "m4a"
    if blob[:4] == b"fLaC":
        return "flac"
    return fallback


def wav(pcm, rate=24000, channels=1, width=2):
    """Put a WAV header on raw PCM. Stdlib `wave` wants a file, so: in memory."""
    import io
    import wave as wavemod
    buf = io.BytesIO()
    with wavemod.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(width)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


# ----------------------------------------------------------------------------
# Prompts from the pack, so a comparison is against what actually shipped
# ----------------------------------------------------------------------------

# Copied from tools/gen-image.py rather than imported: that module's name has a
# hyphen in it and importing it costs an importlib dance for two constants. If
# gen-image.py's version of these ever changes, this comparison stops being
# like-for-like — which is the same drift `--accept` guards against there.
SAFE_BOTTOM = ("composition: the subject sits in the upper two thirds of the frame, "
               "the lower quarter is plain empty surface with nothing important in it")

RATIO = {"square": "1:1", "portrait": "3:4", "wide": "16:9"}


def closest_ratio(message, want):
    """Pull `Accepted: 1:1, 4:3, ...` out of a rejection and pick the nearest
    shape to the one asked for. Returns None if the error was about something
    else — a wrong guess here would silently render the wrong crop.
    """
    m = re.search(r"Accepted:\s*([0-9:,\s]+)", message)
    if not m or "aspect_ratio" not in message:
        return None
    opts = [o.strip() for o in m.group(1).split(",") if ":" in o]

    def val(r):
        a, b = r.split(":")
        return float(a) / float(b)

    try:
        target = val(want)
        return min(opts, key=lambda o: abs(val(o) - target))
    except (ValueError, ZeroDivisionError):
        return None


def pack_prompt(pack, pid):
    path = os.path.join(ROOT, "content", pack, "image-prompts.json")
    if not os.path.exists(path):
        die(f"no image-prompts.json for pack '{pack}'")
    with open(path, encoding="utf-8") as fh:
        specs = json.load(fh)
    if pid not in specs:
        ids = [k for k in specs if not k.startswith("//")]
        die(f"no picture '{pid}' in {pack}. Some that exist:\n    "
            + ", ".join(ids[:14]))
    spec = specs[pid]
    text = spec["prompt"] + ((", " + spec["style"]) if spec.get("style") else "")
    if spec.get("safeBottom", True):
        text += ", " + SAFE_BOTTOM
    return text, spec.get("aspect", "square"), spec


# ----------------------------------------------------------------------------
# Commands
# ----------------------------------------------------------------------------

def cmd_check(args, key, how):
    print(f"key     : {masked(key)}  (from {how})")
    res = call("/credits", key=key)
    d = res.get("data", res)
    total, used = d.get("total_credits"), d.get("total_usage")
    line = f"credits : bought {money(total)}, used {money(used)}"
    if isinstance(total, (int, float)) and isinstance(used, (int, float)):
        line += f", left {money(total - used)}"
    print(line)
    if os.path.exists(LEDGER):
        rows = [json.loads(l) for l in open(LEDGER, encoding="utf-8") if l.strip()]
        spent = sum(r.get("cost") or 0 for r in rows)
        print(f"ledger  : {len(rows)} calls from this tool, {money(spent)}")
    print("\nready.  python tools/try-openrouter.py image --id bygg-aker")


def cmd_models(args, key, how):
    for mod in ("image", "speech", "audio"):
        res = call(f"/models?output_modalities={mod}", key=key)
        rows = [m for m in res.get("data", [])
                if not args.grep or args.grep in m["id"]]
        print(f"\n=== {mod} ({len(rows)}) ===")
        for m in sorted(rows, key=lambda m: m["id"]):
            per = (m.get("pricing") or {}).get("image")
            price = ""
            try:
                if per and float(per) > 0:
                    price = f"${float(per):.4f}/image"
            except (TypeError, ValueError):
                pass
            print(f"  {m['id']:<48} {price}")


IMAGE_DEFAULT = [
    "google/gemini-3.1-flash-image",   # the workhorse the plan costs against
    "google/gemini-3-pro-image",       # Nano Banana Pro, the expensive one
    "black-forest-labs/flux.2-pro",    # full-size version of what runs locally
    "qwen/qwen-image-3",               # the cheap end, about a third of a cent
]


def cmd_image(args, key, how):
    if args.id:
        prompt, aspect, spec = pack_prompt(args.pack, args.id)
        name = args.id
        title = (spec.get("title") or {}).get("no", "")
        print(f"picture : {args.id}   {title}")
    else:
        if not args.prompt:
            die('give --id <picture from the pack> or --prompt "..."')
        prompt, aspect, name = args.prompt, args.aspect, "adhoc"
    print(f"aspect  : {aspect} ({RATIO.get(aspect, '1:1')})")
    print(f"prompt  : {prompt[:150]}{'...' if len(prompt) > 150 else ''}\n")

    total = 0.0
    for model in args.models:
        t0 = time.time()
        print(f"  {model:<40} ", end="", flush=True)
        want = RATIO.get(aspect, "1:1")
        payload = {"model": model, "prompt": prompt, "aspect_ratio": want}
        if args.n != 1:
            payload["n"] = args.n
        try:
            res = call("/images", payload, key=key, soft=True)
        except RuntimeError as e:
            # Every provider takes a different set of aspect ratios and says so
            # in the rejection. Reading it back beats keeping a table per model
            # that goes stale — and a comparison that drops a model because of
            # a shape it never offered is not a comparison of the models.
            alt = closest_ratio(str(e), want)
            if not alt:
                print(f"failed — {e}")
                continue
            print(f"[{want}->{alt}] ", end="", flush=True)
            payload["aspect_ratio"] = alt
            try:
                res = call("/images", payload, key=key, soft=True)
            except RuntimeError as e2:
                print(f"failed — {e2}")
                continue
        cost = (res.get("usage") or {}).get("cost")
        total += cost or 0
        files = []
        for i, item in enumerate(res.get("data", []), 1):
            b64 = item.get("b64_json")
            if not b64:
                continue
            ext = (item.get("media_type") or "image/png").split("/")[-1]
            ext = {"jpeg": "jpg", "svg+xml": "svg"}.get(ext, ext)
            files.append(written(os.path.join(
                OUT, "image", name, f"{slug(model)}-{i}.{ext}"),
                base64.b64decode(b64)))
        print(f"{money(cost)}  {time.time() - t0:5.1f}s  {len(files)} file(s)")
        record("image", model, cost, name, files)

    print(f"\n  total {money(total)}")
    print(f"  in    shots/openrouter/image/{name}/")
    if args.id:
        shipped = os.path.join("content", args.pack, "media", f"{args.id}.jpg")
        if os.path.exists(os.path.join(ROOT, shipped)):
            print(f"  vs    {shipped}   (what ships today)")


# The opening of beer chapter one. A real sentence, with the numbers written
# the way they are spoken, because that is what the voice will have to read.
NORSK = ("Øl er fire ting. Vann, korn, humle og gjær. "
         "Tre av dem kan du veie opp på en kjøkkenvekt. "
         "Den fjerde er i live. Det er hele kurset i én setning.")

# Every provider names its voices differently and most of them REQUIRE one, so
# a model on its own is not a runnable request. Worth knowing before reading
# this list: nothing in OpenRouter's speech catalogue has a Norwegian voice.
# The names are tagged -en, en-US, es, fr, de, ja. The only candidates for
# Norwegian are the ones whose voices carry no language at all and infer it
# from the text — Gemini's mythological names are the clearest case.
SPEECH_DEFAULT = [
    ("google/gemini-3.1-flash-tts-preview", "Charon"),    # language-agnostic
    ("google/gemini-3.1-flash-tts-preview", "Algieba"),   # a second read
    ("minimax/speech-2.8-hd", "male-qn-qingse"),          # multilingual, unlisted ids
    ("deepgram/aura-2", "aura-2-thalia-en"),              # English voice, Norwegian text
]


def generation_cost(gid, key, tries=6):
    """What a call actually cost, from OpenRouter's own record of it.

    The record is written a moment after the response, so a lookup that fires
    immediately gets a 404 and reports free. Same family as every other bug in
    this repo where a number was read too soon after the thing that produced it.
    """
    if not gid:
        return None
    for i in range(tries):
        try:
            res = call(f"/generation?id={gid}", key=key, soft=True)
            d = res.get("data", res)
            for field in ("total_cost", "usage", "cost"):
                if isinstance(d.get(field), (int, float)):
                    return d[field]
            return None
        except RuntimeError:
            time.sleep(0.6 * (i + 1))
    return None


def cmd_speech(args, key, how):
    text = args.text or NORSK
    total = 0.0
    print(f"text    : {text[:120]}{'...' if len(text) > 120 else ''}")
    print("language: inferred from the text. Surviving Norwegian is the test.\n")
    # --voices sweeps several voices of ONE model, which is the question you
    # actually have once a model is chosen: not "which engine" but "which read".
    if args.models and args.voices:
        jobs = [(args.models[0], v) for v in args.voices]
    elif args.models:
        jobs = [(m, args.voice) for m in args.models]
    else:
        jobs = SPEECH_DEFAULT
    for model, voice in jobs:
        t0 = time.time()
        print(f"  {model:<38} {str(voice or '-'):<20} ", end="", flush=True)
        # Gemini answers raw PCM only, and raw PCM will not play in anything.
        # Wrapping it in a 44-byte WAV header is the whole fix; without it the
        # file downloads fine and looks like a broken model.
        fmt = "pcm" if "gemini" in model else "mp3"
        payload = {"model": model, "input": text, "response_format": fmt}
        if voice:
            payload["voice"] = voice
        # Gemini TTS takes plain-language direction on HOW to read. It is the
        # only prosody control that exists here — SSML is not an option, the
        # way it is not an option with edge-tts either.
        if args.instructions:
            payload["instructions"] = args.instructions
        try:
            blob, gid = call("/audio/speech", payload, key=key, raw=True, soft=True)
        except RuntimeError as e:
            print(f"failed — {e}")
            continue
        ext = "mp3"
        if fmt == "pcm":
            blob, ext = wav(blob, args.rate), "wav"
        ext = sniff(blob, ext)
        path = written(os.path.join(
            OUT, "speech", f"{slug(model)}--{slug(voice or 'default')}.{ext}"), blob)
        cost = generation_cost(gid, key)
        per_1k = f"{money(cost / len(text) * 1000)}/1k chars" if cost else ""
        total += cost or 0
        print(f"{money(cost):>9}  {time.time() - t0:5.1f}s  "
              f"{len(blob) / 1024:6.0f} KB   {per_1k}")
        record("speech", model, cost, f"{voice}: {len(text)} chars", [path])
    print(f"\n  total {money(total)} for {len(text)} characters")
    print("  in shots/openrouter/speech/ — listen on the phone, not the laptop.")


def cmd_voices(args, key, how):
    res = call("/models?output_modalities=speech", key=key)
    for m in sorted(res.get("data", []), key=lambda m: m["id"]):
        if args.grep and args.grep not in m["id"]:
            continue
        v = m.get("supported_voices") or []
        if isinstance(v, dict):
            v = list(v)
        print(f"\n{m['id']}  ({len(v)} voices)")
        if v:
            print("   " + ", ".join(str(x) for x in v[:30]))


BED = ("extremely slow and sparse solo acoustic guitar, nylon strings, "
       "around 45 bpm, warm and dry, no percussion, no vocals, "
       "no melody that draws attention to itself, a single figure repeating "
       "with long gaps between phrases, recorded close in a small wooden room")


def stream_audio(model, prompt, key):
    """Lyria refuses a non-streamed request outright — `Audio output requires
    stream: true`. So the audio arrives as base64 fragments across server-sent
    events and has to be stitched back together. Returns (bytes, format, cost).
    """
    payload = {"model": model, "modalities": ["audio"], "stream": True,
               "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request(f"{API}/chat/completions",
                                 data=json.dumps(payload).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "text/event-stream")
    req.add_header("HTTP-Referer", "https://github.com/vidarsveen/american_revolution")
    req.add_header("X-Title", "Fortell")

    parts, fmt, cost, seen = [], None, None, []
    try:
        with urllib.request.urlopen(req, timeout=600) as res:
            for raw in res:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                body = line[5:].strip()
                if body == "[DONE]":
                    break
                try:
                    ev = json.loads(body)
                except json.JSONDecodeError:
                    continue
                seen.append(ev)
                if ev.get("usage", {}).get("cost") is not None:
                    cost = ev["usage"]["cost"]
                for ch in ev.get("choices", []):
                    slot = ch.get("delta") or ch.get("message") or {}
                    audio = slot.get("audio") or {}
                    if audio.get("format"):
                        fmt = audio["format"]
                    if audio.get("data"):
                        parts.append(audio["data"])
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"HTTP {e.code}: {detail}")

    if not parts:
        # Keep the events rather than guess at the shape next time.
        path = written(os.path.join(OUT, "music", f"{slug(model)}-events.json"),
                       json.dumps(seen[:40], indent=2).encode())
        raise RuntimeError(f"no audio in the stream — {len(seen)} events kept in "
                           f"{os.path.relpath(path, ROOT)}")
    return base64.b64decode("".join(parts)), (fmt or "wav"), cost


def cmd_music(args, key, how):
    prompt = args.prompt or BED
    print(f"prompt  : {prompt[:150]}{'...' if len(prompt) > 150 else ''}\n")
    total = 0.0
    for model in args.models:
        t0 = time.time()
        print(f"  {model:<40} ", end="", flush=True)
        try:
            blob, fmt, cost = stream_audio(model, prompt, key)
        except RuntimeError as e:
            print(f"failed — {e}")
            continue
        total += cost or 0
        path = written(os.path.join(
            OUT, "music", f"{slug(model)}.{sniff(blob, fmt)}"), blob)
        print(f"{money(cost)}  {time.time() - t0:5.1f}s  "
              f"{len(blob) / 1024:6.0f} KB  {os.path.basename(path)}")
        record("music", model, cost, prompt[:40], [path])
    print(f"\n  total {money(total)}")
    print("  in    shots/openrouter/music/")


def cmd_month(args, key, how):
    if not os.path.exists(LEDGER):
        die("nothing spent through this tool yet")
    rows = [json.loads(l) for l in open(LEDGER, encoding="utf-8") if l.strip()]
    by = {}
    for r in rows:
        slot = by.setdefault(r["kind"], [0, 0.0])
        slot[0] += 1
        slot[1] += r.get("cost") or 0
    print()
    for kind, (n, c) in sorted(by.items()):
        print(f"  {kind:<10} {n:4d} calls   {money(c)}")
    total = sum(r.get("cost") or 0 for r in rows)
    print(f"  {'total':<10} {len(rows):4d} calls   {money(total)}")
    print("\n  Calls showing nothing are ones the API returned no cost for.")
    print("  `check` reads the true balance from OpenRouter itself.")


# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="does the key work, and what is left on it")
    p = sub.add_parser("models", help="what is available, by modality")
    p.add_argument("--grep", help="only ids containing this")

    p = sub.add_parser("image", help="one prompt through several picture models")
    p.add_argument("--pack", default="beer")
    p.add_argument("--id", help="a picture id from the pack's image-prompts.json")
    p.add_argument("--prompt", help="or an ad-hoc prompt")
    p.add_argument("--aspect", default="portrait", choices=sorted(RATIO))
    p.add_argument("-n", type=int, default=1, help="candidates per model")
    p.add_argument("--models", nargs="*", default=IMAGE_DEFAULT)

    p = sub.add_parser("speech", help="one paragraph through several voices")
    p.add_argument("--text", help="defaults to the opening of beer chapter one")
    p.add_argument("--voice", help="required by most providers; see `voices`")
    p.add_argument("--voices", nargs="*", help="sweep these voices of one model")
    p.add_argument("--instructions", help="how to read it, in plain language")
    p.add_argument("--rate", type=int, default=24000, help="PCM sample rate for Gemini")
    p.add_argument("--models", nargs="*", help="default: a Norwegian shortlist")

    p = sub.add_parser("voices", help="what voices each speech model takes")
    p.add_argument("--grep")

    p = sub.add_parser("music", help="a bed prompt through the music models")
    p.add_argument("--prompt")
    p.add_argument("--models", nargs="*", default=["google/lyria-3-clip-preview"])

    sub.add_parser("month", help="what this tool has spent")

    args = ap.parse_args()
    key, how = load_key()
    {"check": cmd_check, "models": cmd_models, "image": cmd_image,
     "speech": cmd_speech, "voices": cmd_voices, "music": cmd_music,
     "month": cmd_month}[args.cmd](args, key, how)


if __name__ == "__main__":
    main()
