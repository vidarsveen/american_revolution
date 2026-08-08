#!/usr/bin/env python3
"""
Validate a chapter script against its generated timings.

    python tools/check-script.py american-revolution/chapter-1775-04-19

The thing most likely to break silently is a cue pinned to a word that is no
longer in the sentence — the player falls back to the start of the beat and the
visual just fires early, which is easy to miss by ear. This catches that, plus
unknown cue verbs and references to places, routes, people or images that do
not exist.

Exits non-zero if anything is broken. Notes are advisory.
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The cue vocabulary comes from engine/verbs.json, which engine/stage.js also
# reads. It used to be copied by hand into this file, so adding a verb to one
# and not the other meant a chapter validated clean and then silently did
# nothing in the browser.
MANIFEST_PATH = os.path.join(ROOT, "engine", "verbs.json")

try:
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        MANIFEST = json.load(fh)
except FileNotFoundError:
    raise SystemExit(f"missing {MANIFEST_PATH} — it is the source of truth for cue verbs")

VERB_SPEC = MANIFEST["verbs"]
VERBS = set(VERB_SPEC)
REF_TYPES = MANIFEST.get("refTypes", {})

problems: list[str] = []
notes: list[str] = []


def norm(s: str) -> str:
    """Match the engine's normalisation: strip accents-insensitively? No —
    keep letters and digits only, lowercase. Norwegian æøå are letters."""
    return "".join(
        c for c in unicodedata.normalize("NFC", str(s)).lower()
        if c.isalnum()
    )


SOUND_LIB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "sound", "library.js")


def builtin_effects() -> set[str]:
    """
    The effect names sound/library.js synthesises.

    A pack does not have to ship a single audio file — the default library
    builds every effect from an oscillator — so validating a `sound` reference
    against the pack's sound.json alone rejects every name that actually
    works. Read from the catalogue itself so the two cannot drift: adding an
    effect there is enough to be able to name it in a script.
    """
    try:
        with open(SOUND_LIB, encoding="utf-8") as fh:
            src = fh.read()
    except OSError:
        return set()
    start = src.find("const CATALOGUE = {")
    if start < 0:
        return set()
    end = src.find("export const EFFECTS", start)
    block = src[start:end if end > 0 else len(src)]
    return set(re.findall(r"^\s{2}(\w+):\s*\{\s*kind:", block, re.M))


def check_sound_manifest(pack_dir: str) -> None:
    """content/<pack>/sound.json — one entry per recorded effect, or no file."""
    path = os.path.join(pack_dir, "sound.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    for name, entry in manifest.items():
        if not isinstance(entry, dict) or not entry.get("file"):
            problems.append(f"sound.json {name}: no 'file' — drop the entry and the synthesised effect is used")
            continue
        for field in ("licence", "credit"):
            if not entry.get(field):
                problems.append(f"sound.json {name}: no '{field}'")
        if not os.path.exists(os.path.join(pack_dir, entry["file"])):
            problems.append(f"sound.json {name}: '{entry['file']}' is not on disk")
    print(f"sound.json: {len(manifest)} recorded effect(s)")


# Verbs that draw themselves in over time, and the layer a clear wipes. A
# route drawing itself is the most visible thing the map does, so a route that
# cannot finish is the most visible way for a chapter to look broken.
ANIMATED = {"route.draw": ("routes", 2.6), "converge": ("routes", 3.2)}
CLEARS = {"route.clear": "routes"}


def cue_time(cue, beat, timing_beat, lang):
    """When a cue actually fires, in scene seconds. None if unknowable."""
    if timing_beat is None:
        return None
    start = timing_beat.get("start", 0.0)
    on = cue.get("on", "start")
    if isinstance(on, dict):
        on = on.get(lang)
    if not isinstance(on, str):
        return None
    if on == "start":
        return start
    if on == "end":
        return start + timing_beat.get("dur", 0.0)
    if on.startswith("t:"):
        return start + float(on[2:] or 0)
    if on.startswith("pct:"):
        return start + float(on[4:] or 0) * timing_beat.get("dur", 0.0)
    if on.startswith("word:"):
        wanted, _, nth = on[5:].partition("#")
        want = int(nth) if nth.isdigit() else 1
        seen = 0
        for w in timing_beat.get("words", []):
            if norm(w["w"]) == norm(wanted):
                seen += 1
                if seen == want:
                    return w["t"]
        return start
    return start


def check_animations_finish(chapter, timings, langs):
    """
    Every march must have time to reach its destination.

    The engine rebuilds the stage from scratch on a scene change — that is how
    seeking stays correct — so anything still drawing when the scene ends is
    not paused, it is erased. The same goes for a `route.clear` in a later
    beat. Neither shows up as an error: the line simply stops partway and the
    picture is quietly wrong, which is how "the British march out of Boston"
    spent months stopping two thirds of the way to Concord. It was anchored to
    the end of the last beat of its scene, leaving 3.15 s of gap for 4.5 s of
    animation.

    Nothing about that is visible in the script. It only shows up if you
    multiply the numbers out, so the numbers get multiplied out here.
    """
    problems = []
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            st = tm["scenes"].get(scene["id"])
            if not st:
                continue
            by_id = {b["id"]: b for b in st.get("beats", [])}
            events = []
            for beat in scene["beats"]:
                tb = by_id.get(beat["id"])
                for cue in beat.get("cues", []):
                    at = cue_time(cue, beat, tb, lang)
                    if at is not None:
                        events.append((at, cue, beat["id"]))
            events.sort(key=lambda e: e[0])

            for i, (at, cue, bid) in enumerate(events):
                spec = ANIMATED.get(cue["do"])
                if not spec:
                    continue
                layer, default_over = spec
                over = float(cue.get("over", default_over))
                # The scene ending wipes the stage just as surely as a clear.
                deadline = st.get("dur", 0.0)
                for at2, cue2, _ in events[i + 1:]:
                    if CLEARS.get(cue2["do"]) == layer:
                        deadline = min(deadline, at2)
                        break
                room = deadline - at
                if room < over - 0.05:
                    what = cue.get("id") or cue.get("to") or cue["do"]
                    problems.append(
                        f"{bid}: '{lang}' {cue['do']} '{what}' animates for {over:.1f}s "
                        f"but is wiped after {room:.1f}s — it would stop "
                        f"{100 * max(0.0, room) / over:.0f}% of the way there")
    return problems


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    rel = sys.argv[1]
    pack = rel.split("/")[0]
    path = os.path.join(ROOT, "content", rel + ".json")
    if not os.path.exists(path):
        print(f"error: no chapter at {path}", file=sys.stderr)
        return 2

    with open(path, encoding="utf-8") as fh:
        chapter = json.load(fh)

    pack_dir = os.path.join(ROOT, "content", pack)
    people_path = os.path.join(pack_dir, "people.json")
    people = set()
    if os.path.exists(people_path):
        with open(people_path, encoding="utf-8") as fh:
            people = {p["id"] for p in json.load(fh)}

    places = set(chapter.get("places", {}))
    routes = set(chapter.get("routes", {}))
    media_path = os.path.join(pack_dir, "media.json")
    media = set()
    if os.path.exists(media_path):
        with open(media_path, encoding="utf-8") as fh:
            media = set(json.load(fh))
    quotes = set(chapter.get("quotes", {}))

    # Region names come from whatever GeoJSON the chapter declares, so a typo
    # in "Massachusetts" fails here rather than drawing nothing in the browser.
    regions = set()
    rel = chapter.get("regions")
    if rel:
        rp = os.path.join(ROOT, "content", pack, rel)
        if os.path.exists(rp):
            with open(rp, encoding="utf-8") as fh:
                geo = json.load(fh)
            regions = {(f.get("properties") or {}).get("name")
                       for f in geo.get("features", [])}
            regions.discard(None)
        else:
            problems.append(f"chapter declares regions '{rel}' but {rp} does not exist")

    sounds = set()
    sp = os.path.join(ROOT, "content", pack, "sound.json")
    if os.path.exists(sp):
        with open(sp, encoding="utf-8") as fh:
            sounds = set(json.load(fh))

    # What each reference type in the manifest points at, and what to call it
    # when it is missing.
    global REF_POOLS
    REF_POOLS = {
        "place":  (places, "place"),
        "route":  (routes, "route"),
        "person": (people, "person"),
        "media":  (media, "image"),
        "quote":  (quotes, "quote"),
        # The pack's recorded effects, plus everything the shipped library can
        # synthesise. A pack that records nothing still has a full palette.
        "sound":  (set(sounds) | builtin_effects(), "sound"),
        "region": (regions, "region"),
    }

    # A pack may ship recorded sound effects instead of using the synthesised
    # ones in sound/library.js. Same shape as media.json, same rule: a file
    # with no licence and no credit does not go in a build. Absent by design —
    # the default library is synthetic and has nothing to attribute.
    check_sound_manifest(pack_dir)

    langs = sorted({l for s in chapter["scenes"] for b in s["beats"]
                    for l in (b.get("say") or {})})

    timings = {}
    for lang in langs:
        tp = os.path.join(pack_dir, f"timing.{lang}.json")
        if os.path.exists(tp):
            with open(tp, encoding="utf-8") as fh:
                timings[lang] = json.load(fh)
        else:
            notes.append(f"no timing.{lang}.json yet — run tools/narrate.py --lang {lang}")

    n_beats = n_cues = n_word = 0

    for scene in chapter["scenes"]:
        sid = scene["id"]
        for beat in scene["beats"]:
            bid = beat["id"]
            n_beats += 1

            if not bid.startswith(sid + "."):
                notes.append(f"{bid}: id does not start with its scene id '{sid}'")

            for lang in langs:
                text = (beat.get("say") or {}).get(lang, "").strip()
                if not text:
                    problems.append(f"{bid}: no '{lang}' text")
                elif len(text) > 320:
                    notes.append(f"{bid}: '{lang}' beat is {len(text)} chars — long to hold on one picture")

            for cue in beat.get("cues", []) or []:
                n_cues += 1
                verb = cue.get("do")
                if verb not in VERBS:
                    problems.append(f"{bid}: unknown cue verb '{verb}'")

                # Reference integrity, driven by the manifest: any argument
                # whose declared type is a reference must name something that
                # exists. Adding a verb with a `place` argument gets this check
                # for free, which is the point of the manifest.
                spec = VERB_SPEC.get(verb) or {}
                for arg, adef in (spec.get("args") or {}).items():
                    atype = adef.get("type", "")
                    base = atype[:-2] if atype.endswith("[]") else atype
                    value = cue.get(arg)

                    if adef.get("required") and value in (None, "", [], {}):
                        problems.append(f"{bid}: {verb} is missing required '{arg}'")
                        continue
                    if base not in REF_TYPES or value is None:
                        continue

                    pool, what = REF_POOLS[base]
                    wanted = value if atype.endswith("[]") else [value]
                    if atype.endswith("[]") and not isinstance(value, list):
                        problems.append(f"{bid}: {verb} '{arg}' should be a list")
                        continue
                    for ref in wanted:
                        if ref not in pool:
                            hint = ""
                            if base == "media" and not pool:
                                hint = " (no media.json — run tools/fetch-media.py)"
                            problems.append(
                                f"{bid}: {verb} -> unknown {what} '{ref}'{hint}")

                # the important one: does the anchor word actually get spoken?
                on = cue.get("on", "start")
                # A bare string anchors every language; a {no, en} pair lets the
                # languages differ, which they must whenever the anchor is not a
                # proper noun ("syttisju" vs "seventy-seven").
                per_lang = on if isinstance(on, dict) else {l: on for l in langs}
                for lang in langs:
                    spec = per_lang.get(lang)
                    if spec is None:
                        problems.append(f"{bid}: cue has no '{lang}' anchor")
                        continue
                    if not isinstance(spec, str):
                        problems.append(f"{bid}: anchor must be a string, got {spec!r}")
                        continue
                    if spec.startswith("word:"):
                        if lang == langs[0]:
                            n_word += 1
                        wanted, _, nth = spec[5:].partition("#")
                        want = int(nth) if nth.isdigit() else 1
                        target = norm(wanted)
                        text = (beat.get("say") or {}).get(lang, "")
                        hits = [w for w in re.findall(r"[^\s]+", text) if norm(w) == target]
                        if len(hits) < want:
                            problems.append(
                                f"{bid}: '{lang}' cue anchored to word '{wanted}'"
                                f"{f' #{want}' if want > 1 else ''} but that text has "
                                f"{len(hits)} — the visual would fire at the start of the beat")
                            continue
                        # and against what was actually spoken
                        tm = timings.get(lang)
                        if tm:
                            tb = next((b for b in tm["scenes"].get(sid, {}).get("beats", [])
                                       if b["id"] == bid), None)
                            if tb and len([w for w in tb["words"] if norm(w["w"]) == target]) < want:
                                problems.append(
                                    f"{bid}: '{lang}' word '{wanted}' is in the text but was not "
                                    f"recorded as spoken — re-run tools/narrate.py")
                    elif spec not in ("start", "end") and not re.fullmatch(r"(t|pct):[\d.]+", spec):
                        problems.append(f"{bid}: unrecognised '{lang}' anchor '{spec}'")

    problems.extend(check_animations_finish(chapter, timings, langs))

    # totals
    print(f"{len(chapter['scenes'])} scenes, {n_beats} beats, {n_cues} cues "
          f"({n_word} pinned to words), languages: {', '.join(langs)}")
    for lang, tm in timings.items():
        total = sum(s["dur"] for s in tm["scenes"].values())
        missing = [b["id"] for s in chapter["scenes"] for b in s["beats"]
                   if not any(x["id"] == b["id"]
                              for x in tm["scenes"].get(s["id"], {}).get("beats", []))]
        m, sec = divmod(int(round(total)), 60)
        print(f"  {lang}: {m}:{sec:02d} of audio, voice {tm.get('voice')}"
              + (f", MISSING {len(missing)} beats" if missing else ""))
        for b in missing:
            problems.append(f"{b}: no timing for '{lang}' — re-run tools/narrate.py")

    if notes:
        print(f"\nnotes ({len(notes)}):")
        for n in notes:
            print(f"  - {n}")
    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1

    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
