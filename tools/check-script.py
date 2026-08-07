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

# Every verb the engine implements. Adding one here without implementing it in
# engine/stage.js will pass this check and fail silently in the browser, so
# these two lists have to be kept honest together.
VERBS = {
    "map.flyTo", "map.fitRoute", "map.fitPlaces", "map.time", "map.mood", "map.flash",
    "route.draw", "route.clear",
    "marker.show", "marker.hide", "marker.clear",
    "place.highlight", "place.clear",
    "converge",
    "portrait.show", "portrait.hide",
    "image.show", "image.hide",
    "quote.show", "quote.hide",
    "stat.show", "stat.clear",
    "caption.note",
    "hold", "pause",
}

problems: list[str] = []
notes: list[str] = []


def norm(s: str) -> str:
    """Match the engine's normalisation: strip accents-insensitively? No —
    keep letters and digits only, lowercase. Norwegian æøå are letters."""
    return "".join(
        c for c in unicodedata.normalize("NFC", str(s)).lower()
        if c.isalnum()
    )


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

                # reference integrity
                if verb == "map.flyTo" and cue.get("to") not in places:
                    problems.append(f"{bid}: map.flyTo -> unknown place '{cue.get('to')}'")
                if verb in ("route.draw", "map.fitRoute") and cue.get("id") not in routes:
                    problems.append(f"{bid}: {verb} -> unknown route '{cue.get('id')}'")
                if verb == "portrait.show" and cue.get("id") not in people:
                    problems.append(f"{bid}: portrait.show -> unknown person '{cue.get('id')}'")
                # An empty manifest used to make these checks vanish, which is
                # exactly when they matter most — the cue then silently does
                # nothing in the browser.
                if verb == "image.show" and cue.get("id") not in media:
                    problems.append(
                        f"{bid}: image.show -> '{cue.get('id')}' is not in media.json"
                        + ("" if media else " (no media.json — run tools/fetch-media.py)"))
                if verb == "quote.show" and cue.get("id") not in quotes:
                    problems.append(f"{bid}: quote.show -> '{cue.get('id')}' is not in the chapter's quotes block")
                if verb in ("marker.show", "marker.hide", "place.highlight") and cue.get("at") not in places:
                    problems.append(f"{bid}: {verb} -> unknown place '{cue.get('at')}'")
                if verb == "map.fitPlaces":
                    for pid in cue.get("places", []) or []:
                        if pid not in places:
                            problems.append(f"{bid}: map.fitPlaces -> unknown place '{pid}'")
                if verb == "converge":
                    if cue.get("to") not in places:
                        problems.append(f"{bid}: converge -> unknown target place '{cue.get('to')}'")
                    if not (cue.get("from") or []):
                        problems.append(f"{bid}: converge has no 'from' places")
                    for pid in cue.get("from", []) or []:
                        if pid not in places:
                            problems.append(f"{bid}: converge -> unknown origin place '{pid}'")

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
