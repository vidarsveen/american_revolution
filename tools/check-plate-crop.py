#!/usr/bin/env python3
"""
How much of each picture does a phone actually show?

    python tools/check-plate-crop.py            # every pack
    python tools/check-plate-crop.py beer

THE ONE QUESTION: a plate fills the stage with `object-fit: cover`, and the
stage on a phone is TALL. So a wide picture is cropped to a narrow slice of
itself. How narrow?

Measured at 390x734, which is the map host inside a 390x844 phone:

    wide      1152x640    30% of its width
    square    1024x1024   53% of its width
    portrait   896x1152   68% of its width

Thirty per cent. A picture of four things in a row shows one and a bit of
them, which is exactly how it was reported: "when you show the four
ingredients, I only see two of them on mobile".

tools/gen-image.py's own header says square by default, NOT 16:9, because the
stage is mobile-first and portrait — and then eight of one course's pictures
were authored `wide` anyway, because a wide frame is what a still life looks
like on the laptop it was reviewed on. A note in a docstring did not survive
contact with somebody choosing an aspect. A number that fails a build does.

WHAT THIS DOES NOT KNOW is the only thing that finally matters: whether the
thing being said is inside the visible slice. A landscape cropped to 30% is
still a landscape; a row of four cropped to 30% is a lie. So the threshold is
deliberately generous and the report prints the picture's `claims` beside the
number — because a claim that counts ("four malts", "two beers") is the one
that cannot survive a crop, and a person reading the line will see it.

IT GATES ON GENERATED PICTURES AND ONLY REPORTS ARCHIVE ONES, and the
difference is whether anything can be done. A generated picture can be
re-rendered portrait for nine seconds of GPU. A painting from 1775 is the shape
it is; the only lever there is `"fit": "contain"`, which letterboxes it, and
that is a judgement about a specific picture rather than a rule — the whole
frame of a plan of Boston is the information, and the whole frame of a battle
scene is not. Thirty-odd archive pictures across the three frozen courses sit
under the floor, and failing a build on them would make this a check people
skip.

THAT NUMBER HAS A CAUSE WORTH KNOWING. tools/fetch-media.py already letterboxes
anything far from the stage ratio — and its stage ratio is 16/9, a LANDSCAPE
frame. The phone stage is 0.53. So the fit every archive picture was given was
decided against a shape the app has never drawn on a phone. See BACKLOG.md; it
is not fixed here, because relabelling frozen courses is not this file's
business.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("pillow is not installed in this venv — pip install pillow")

ROOT = Path(__file__).resolve().parent.parent

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

# The map host inside a 390x844 phone, which is what tools/check-legible.py
# and tools/check-overlap.py both measure against. One number, one place.
STAGE_W, STAGE_H = 390, 734
STAGE_AR = STAGE_W / STAGE_H

# Below this, a picture is a slice rather than a picture. 0.45 sits between
# `square` (0.53, fine) and `wide` (0.30, not), which is where the cliff
# actually is — there is no aspect in between that anyone authors.
FLOOR = 0.45

# Words in a `claims` line that mean the picture is COUNTING something. A crop
# takes things out of frame, and a claim that counts is the one that breaks.
COUNTING = ("two ", "three ", "four ", "five ", "six ", "both ", "each ",
            "side by side", "in a row", "one above")


def visible_fraction(w: int, h: int, fit: str) -> float:
    """Share of the picture's own area a viewer sees at phone size."""
    if fit == "contain":
        return 1.0                      # letterboxed: all of it, smaller
    ar = w / h
    return STAGE_AR / ar if ar > STAGE_AR else ar / STAGE_AR


def check_pack(pack: str) -> tuple[list[str], list[str]]:
    bad, notes = [], []
    folder = ROOT / "content" / pack
    mf = folder / "media.json"
    if not mf.exists():
        return bad, notes
    media = json.loads(mf.read_text(encoding="utf-8"))
    if not isinstance(media, dict):
        return bad, notes
    rows = []
    for mid, m in sorted(media.items()):
        if mid.startswith("//") or not isinstance(m, dict) or not m.get("file"):
            continue
        path = folder / "media" / m["file"]
        if not path.exists():
            bad.append(f"{pack}/{mid}: {m['file']} is in media.json and not on disk")
            continue
        with Image.open(path) as im:
            w, h = im.size
        vis = visible_fraction(w, h, m.get("fit", "cover"))
        claims = (m.get("claims") or "").lower()
        counts = any(word in claims for word in COUNTING)
        rows.append((vis, mid, w, h, m.get("fit", "cover"), counts,
                     m.get("claims") or "", m.get("kind", "made")))

    for vis, mid, w, h, fit, counts, claims, kind in sorted(rows):
        under = vis < FLOOR
        gated = kind != "archive"
        mark = (("FAIL" if gated else "arch") if under
                else ("note" if counts and vis < 0.75 else "ok  "))
        print(f"  {mark} {mid:<22} {w}x{h:<5} {fit:<8} {vis*100:3.0f}% visible")
        if under and not gated:
            notes.append(f"{pack}/{mid}: archive, {vis*100:.0f}% visible on a phone. "
                         f"Cannot be re-rendered; `fit: contain` is the only lever, and "
                         f"whether this picture wants its whole frame is a judgement "
                         f"about this picture.")
        elif under:
            bad.append(f"{pack}/{mid}: a phone shows {vis*100:.0f}% of it "
                       f"({w}x{h} under `cover` on a {STAGE_W}x{STAGE_H} stage). "
                       f"It is generated — re-render it portrait.")
        elif counts and vis < 0.75:
            notes.append(f"{pack}/{mid}: {vis*100:.0f}% visible and it COUNTS — "
                         f"“{claims[:90]}”")
    return bad, notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("packs", nargs="*", help="default: every pack in content/")
    args = ap.parse_args()
    packs = args.packs or sorted(
        d.name for d in (ROOT / "content").iterdir()
        if d.is_dir() and not d.name.startswith("_"))

    problems, notes = [], []
    print(f"stage {STAGE_W}x{STAGE_H}, floor {FLOOR*100:.0f}%")
    for pack in packs:
        if not (ROOT / "content" / pack / "media.json").exists():
            continue
        print(f"\n{pack}")
        b, n = check_pack(pack)
        problems += b
        notes += n

    if notes:
        print(f"\nnotes ({len(notes)}) — a crop takes things out of frame:")
        for n in notes:
            print(f"  - {n}")
    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1
    print("\nEvery picture keeps enough of itself on a phone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
