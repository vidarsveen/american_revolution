#!/usr/bin/env python3
"""
The picture rhythm of a chapter, printed.

    .venv/Scripts/python.exe tools/check-pictures.py
    .venv/Scripts/python.exe tools/check-pictures.py italy-wine/chapter-1-piemonte

CLAUDE.md says this in as many words and there has never been a way to do it:

    The rhythm is a property of the whole chapter, not of a beat. Print it --
    one line per scene, which pictures and for how long -- before deciding
    anything is missing.

Deciding "there should be more pictures" by scrolling a JSON file is how a
chapter ends up with Franklin's Join, or Die over the line about thirteen
colonies. So this prints what is actually there: every plate, how long it
holds in seconds, and what share of the chapter's wall-clock has any picture
on screen at all.

It reports and never fails a build. Whether a beat deserves a picture is an
editorial judgement; the tool's job is to make sure nobody has to watch the
whole chapter to find the candidates.

WHAT THE NUMBERS MEAN

`cover` is the share of the chapter with a plate up. There is no correct
value, but there is a difference in kind:

  a map story with pictures in it     roughly 15-30%
  a picture story with a map in it    roughly 45-70%

A subject decides which it is. The American Revolution is a map story: where
the militia stood and which road the column took is the content, and a plate
is an interruption you pay for. Italian wine is a picture story: the map says
which region and then has nothing more to add, while a hillside in October
says the thing the sentence is about.

Getting that backwards is a real defect in both directions -- a wine chapter
carried by a map is dull, and a battle carried by plates hides the ground the
battle was fought on.

THE OTHER HALF OF THE QUESTION is not here, and cannot be: `cover` is how much
of the chapter has a picture up, and the natural companion -- how much of the
FRAME the map is left with once the caption, the transport and a card have had
their share -- needs rectangles from a browser. tools/check-overlap.py measures
it and prints it per chapter. Measured there: the map keeps 68-77% of its host
at rest, which is rather more than the "roughly 40% is spoken for" this repo had
been repeating from three part-measurements added together.
"""

from __future__ import annotations

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scriptlib import occupancy   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def beat_times(pack, chapter_id, lang):
    """{beat id: (start, dur)} from the recorded timing, which is the only
    place the real durations live -- a beat carries no duration of its own."""
    t = load(os.path.join(ROOT, "content", pack,
                          f"timing.{chapter_id}.{lang}.json"))
    if not t:
        return {}
    out = {}
    scenes = t.get("scenes", t)
    for sid, scene in (scenes.items() if isinstance(scenes, dict) else []):
        for b in (scene.get("beats") if isinstance(scene, dict) else scene) or []:
            out[b["id"]] = (b.get("start", 0.0), b.get("dur", 0.0))
    return out


def report(pack, chapter_id, lang="no"):
    ch = load(os.path.join(ROOT, "content", pack, f"{chapter_id}.json"))
    if not ch:
        print(f"  no chapter {chapter_id}")
        return
    times = beat_times(pack, chapter_id, lang)
    if not times:
        print(f"  no timing for '{lang}' — run tools/narrate.py")
        return

    media = load(os.path.join(ROOT, "content", pack, "media.json")) or {}
    timing = load(os.path.join(ROOT, "content", pack,
                               f"timing.{chapter_id}.{lang}.json")) or {}
    occ = occupancy(ch, timing, lang)
    total = 0.0
    shown = 0.0
    lines = []

    for scene in ch["scenes"]:
        beats = scene["beats"]
        so = occ.get(scene["id"])
        if not so:
            continue
        total += so["dur"]
        # The walk is scriptlib.occupancy(), shared with check-script.py,
        # check-cover.py and review-pictures.py. Four copies of it existed and
        # each decided show-from-hide by reading the verb's NAME; one of them
        # read four real hide-verbs as shows. This one also gains real cue
        # times rather than placing every picture at its beat's start.
        shots = [(sp["id"], sp["end"] - sp["start"]) for sp in so["spans"]
                 if sp["channel"] == "plate"]
        shown += sum(d for _i, d in shots)

        kinds = {s[0]: (media.get(s[0], {}) or {}).get("kind", "?") for s in shots}
        desc = ", ".join(
            f"{mid}{'*' if kinds.get(mid) == 'made' else ''} {secs:.0f}s"
            for mid, secs in shots) or "—"
        lines.append(f"    {scene['id']:<4} {len(beats):>2} beats  "
                     f"{so['dur']:>5.0f}s   {desc}")

    pct = 100.0 * shown / total if total else 0.0
    shape = ("picture story" if pct >= 45 else
             "map story" if pct <= 30 else "mixed")
    print(f"  {chapter_id}   {total / 60:.0f}:{total % 60:02.0f}   "
          f"cover {pct:.0f}%  ({shape})")
    for ln in lines:
        print(ln)
    return pct


def main() -> int:
    args = sys.argv[1:]
    if args:
        targets = [a.split("/", 1) for a in args]
    else:
        targets = []
        for f in sorted(glob.glob(os.path.join(ROOT, "content", "*",
                                               "chapter-*.json"))):
            pack = os.path.basename(os.path.dirname(f))
            targets.append([pack, os.path.basename(f)[:-5]])

    last = None
    for pack, cid in targets:
        if pack != last:
            print(f"\n{pack}")
            last = pack
        report(pack, cid)
    print("\n  * = generated or drawn (kind: made)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
