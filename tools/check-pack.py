"""Does the app actually find everything this course declares?

Every other check in this repo reads a course the way a PERSON would: it opens
the file it expects, by the name it expects. The app does not. The app reads
`pack.json` and fetches only what that file lists — so a pool that is sitting
right there on disk, correctly written, correctly referenced from a chapter,
is never loaded if one line in `pack.json` is missing.

That is not hypothetical. The beer course's music bed was silent for a week.
`sound.json` was on disk, the bed was in it, the chapter asked for it by name,
and `tools/check-script.py` passed the chapter clean — because it opened
`sound.json` directly. `pack.json` never declared the pool, so the app never
fetched the file, and there is no error for a sound that was never asked for.
It was reported as "I have not heard any background music", and it took an
afternoon to find because every tool said the course was fine.

So this one resolves a course the way `engine/script.js`, `engine/pack.js`,
`core/entries.js` and `engine/surfaces/sound.js` resolve it, and reports the
gap in BOTH directions:

  · declared and not there   - the app fetches, fails, and falls back to empty
  · there and not declared   - the app never looks, and nothing says so

Plus the other half of the same question, which nothing asked before: does a
declared chapter have a recording, and does a declared picture have a file?
A course can list a chapter that was never narrated and every check in the
repo will call it good.

    python tools/check-pack.py            # every course
    python tools/check-pack.py beer       # one
    python tools/check-pack.py --strict   # exit 1 on warnings too
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# The pools engine/script.js fetches by a FIXED name, and what breaks when the
# fetch comes back empty. The wording matters: a person reading this needs to
# know what they would see, not which module was involved.
FIXED_POOLS = {
    "terms": "a tapped word opens nothing",
    "topics": "a tapped topic opens nothing",
    "placeNotes": "a place has no note behind it",
    "people": "a portrait card comes up blank",
}

# engine/surfaces/sound.js reads this one, and it is the pool that has actually
# been forgotten. A missing sound falls back to the synthesised library — but
# only for names the library HAS. A course's own bed or effect has no fallback,
# so the result is silence with nothing in the console.
SOUND_POOL = "sound"

# js/ reads these for Explore. A story-only course does not need them.
MAP_POOLS = ("places", "routes", "areas", "events", "episodes")

# A pool file that is present and NOT declared is the bug above. These are the
# names worth guessing at, because they are the ones a course actually grows.
GUESSABLE = tuple(FIXED_POOLS) + (SOUND_POOL,) + MAP_POOLS

# engine/script.js line 44 fetches media.json by convention, NOT through pools.
# So `pools.media` is decorative: point it somewhere else and the app ignores
# you. Worth saying out loud rather than leaving as a trap.
HARDCODED = {"media": "media.json"}

SURFACES = os.path.join(ROOT, "engine", "surfaces")


def load(path, default=None):
    try:
        return json.load(io.open(path, encoding="utf-8"))
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as e:
        # Naming the file and the line. The compiler used to die on a malformed
        # pool with a Python traceback ending in `unhashable type: 'dict'`,
        # which says nothing about which of a course's twelve files is wrong.
        raise ValueError(f"{os.path.relpath(path, ROOT)} is not valid JSON: "
                         f"line {e.lineno}, {e.msg}") from None


def registered():
    """Every course id content/packs.json actually lists."""
    d = load(os.path.join(CONTENT, "packs.json"), [])
    lst = d if isinstance(d, list) else d.get("packs", [])
    # A plain list of ids today; tolerate objects in case it ever grows fields.
    return {p if isinstance(p, str) else (p.get("id") or p.get("dir"))
            for p in lst}


def entry_pools(manifest):
    """The pools core/entries.js will ask for, given what the pack declares."""
    declared = manifest.get("entries")
    if isinstance(declared, dict):
        return {(spec.get("from") or kind): kind
                for kind, spec in declared.items() if isinstance(spec, dict)}
    return {}


def check(pack, strict=False):
    d = os.path.join(CONTENT, pack)
    rel = os.path.relpath(d, ROOT)
    fails, warns = [], []
    manifest = load(os.path.join(d, "pack.json"))
    if manifest is None:
        return [f"{rel}: no pack.json"], []

    pools = manifest.get("pools") or {}
    wanted = dict(FIXED_POOLS)
    wanted.update({name: f"a {kind} lookup opens nothing"
                   for name, kind in entry_pools(manifest).items()})
    wanted[SOUND_POOL] = ("every sound this course brought with it is silent, "
                          "with nothing in the console")

    # ---- declared, and not there -------------------------------------------
    for name, relpath in pools.items():
        if name.startswith("//"):
            continue
        if not os.path.exists(os.path.join(d, relpath)):
            fails.append(f"{rel}: pack.json declares pool '{name}' at "
                         f"'{relpath}', and there is no such file — the app "
                         f"fetches it, fails, and carries on with nothing")
        if name in HARDCODED and relpath != HARDCODED[name]:
            warns.append(f"{rel}: pack.json points pool '{name}' at "
                         f"'{relpath}', but the app always reads "
                         f"'{HARDCODED[name]}' — that line does nothing")

    # ---- there, and not declared -------------------------------------------
    # This is the one that bit. Look for a file the engine WOULD read if the
    # course had said so, and say what the silence would look like.
    for name in GUESSABLE:
        if name in pools:
            continue
        for cand in (f"{name}.json", os.path.join("geo", f"{name}.json")):
            if os.path.exists(os.path.join(d, cand)):
                why = wanted.get(name, "the app never loads it")
                fails.append(f"{rel}: '{cand}' is there and pack.json does not "
                             f"declare it under `pools`, so the app never "
                             f"fetches it — {why}. Add \"{name}\": \"{cand}\".")
                break

    # ---- a chapter that was never recorded ---------------------------------
    langs = [k for k in (manifest.get("voices") or {}) if k in ("no", "en")]
    for ch in manifest.get("chapters") or []:
        cid = ch.get("id")
        if not cid or ch.get("planned"):
            continue
        if not os.path.exists(os.path.join(d, f"{cid}.json")):
            fails.append(f"{rel}: pack.json lists chapter '{cid}' and there is "
                         f"no {cid}.json — it is on the front door and opens "
                         f"nothing")
            continue
        for lang in langs:
            t = os.path.join(d, f"timing.{cid}.{lang}.json")
            if not os.path.exists(t):
                fails.append(f"{rel}: chapter '{cid}' has no {lang} recording "
                             f"(timing.{cid}.{lang}.json) — it plays on a "
                             f"timer with no voice. Run tools/narrate.py.")
                continue
            timing = load(t, {})
            for sid, scene in (timing.get("scenes") or {}).items():
                audio = scene.get("audio")
                if audio and not os.path.exists(os.path.join(d, audio)):
                    fails.append(f"{rel}: chapter '{cid}' {lang} scene {sid} "
                                 f"names {audio}, which is not there")

    # ---- a picture that was declared and never rendered --------------------
    media = load(os.path.join(d, "media.json"), {}) or {}
    if isinstance(media, dict):
        for mid, spec in media.items():
            if not isinstance(spec, dict):
                continue
            f = spec.get("file") or spec.get("src")
            if not f:
                continue
            p = os.path.join(d, f if os.path.sep in f or "/" in f
                             else os.path.join("media", f))
            if not os.path.exists(p):
                fails.append(f"{rel}: media.json declares picture '{mid}' as "
                             f"'{f}', and there is no such file — the plate "
                             f"comes up empty")

    # ---- a surface that does not exist -------------------------------------
    for s in manifest.get("surfaces") or []:
        if not os.path.exists(os.path.join(SURFACES, f"{s}.js")):
            fails.append(f"{rel}: pack.json declares surface '{s}', and "
                         f"engine/surfaces/{s}.js does not exist")

    # ---- and is the course on the front door at all? -----------------------
    if pack not in registered():
        fails.append(f"{rel}: content/packs.json does not list this course, so "
                     f"it does not appear in the app and no check sees it. "
                     f"Add it there.")

    return fails, warns


def main(argv):
    strict = "--strict" in argv
    named = [a for a in argv if not a.startswith("-")]
    packs = named or sorted(
        p for p in os.listdir(CONTENT)
        if os.path.exists(os.path.join(CONTENT, p, "pack.json")))

    total_f = total_w = 0
    for pack in packs:
        try:
            fails, warns = check(pack, strict)
        except ValueError as e:
            fails, warns = [str(e)], []
        total_f += len(fails)
        total_w += len(warns)
        mark = "FAIL" if fails else ("warn" if warns else "ok")
        print(f"{pack:20} {mark}")
        for m in fails:
            print(f"  FAIL: {m}")
        for m in warns:
            print(f"  warn: {m}")

    print()
    if total_f:
        print(f"{total_f} thing(s) a course declares that the app cannot find.")
        return 1
    if total_w and strict:
        print(f"{total_w} warning(s), and --strict.")
        return 1
    print("Every course finds everything it declares.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
