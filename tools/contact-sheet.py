"""Every picture in a course on one sheet, cropped the way a phone shows them.

    python tools/contact-sheet.py beer
    python tools/contact-sheet.py beer --chapter chapter-2-overgjaer

WHY THIS EXISTS. `tools/check-picture.py` measures one failure mode — a
picture whose lower frame is blank paper — and it measures it well. It cannot
see a beer served in a wine glass, or a picture that was cut off halfway down
and filled with black. Both shipped, and both were reported by a person.

That was not a gap in the checks. It was a gap in the process: fourteen
pictures were accepted on the strength of a number, and four of them were
never looked at. Two were wrong.

The honest fix is not another metric. It was tried: the sharpest full-width
step in a picture does not separate a stitched seam from a table edge (a good
picture scored 72, a bad one 17), and a flat dark band at the bottom does not
separate a cut-off image from a dark room (the cut-off one scored HIGHER than
seven good pictures). Some things about a picture are only visible to
somebody looking at it.

So this makes looking cheap. One sheet, in reading order, cropped to the
slice a phone actually shows, with the caption band marked — because a
picture is judged inside that crop and not as the square file on disk.
"""

import argparse
import io
import json
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("needs pillow: .venv/Scripts/python.exe -m pip install pillow")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scriptlib as S                                        # noqa: E402

ROOT = S.ROOT
CONTENT = S.CONTENT

CELL_W = 190                       # wide enough to judge, narrow enough to fit
COLS = 5
PAD = 8
LABEL_H = 16
HOST_W, HOST_H = 390, 734          # the map host inside a 390x844 phone
CAPTION_FRACTION = 0.22            # roughly what the caption box covers


def visible_crop(im):
    """The slice a phone shows under object-fit: cover — same maths as
    tools/check-picture.py, and the same reason: judging the file rather than
    the crop forgives a fault nobody sees and condemns one that is cut away."""
    w, h = im.size
    want, have = HOST_W / HOST_H, w / h
    if have > want:
        keep = int(h * want)
        return im.crop(((w - keep) // 2, 0, (w - keep) // 2 + keep, h))
    keep = int(w / want)
    return im.crop((0, (h - keep) // 2, w, (h - keep) // 2 + keep))


def order_for(pack, chapter_id=None):
    """Picture ids in the order a viewer meets them, then anything unused."""
    seen, out = set(), []
    for f in sorted(os.listdir(os.path.join(CONTENT, pack))):
        if not (f.startswith("chapter-") and f.endswith(".json")):
            continue
        if chapter_id and f[:-5] != chapter_id:
            continue
        ch = S.load_json(os.path.join(CONTENT, pack, f)) or {}
        for scene in ch.get("scenes", []):
            for beat in scene.get("beats", []):
                for cue in beat.get("cues", []):
                    if cue["do"] == "plate.show" and cue.get("id") not in seen:
                        seen.add(cue["id"])
                        out.append((cue["id"], f"{f[:-5].split('-')[1]} {scene['id']}"))
    if chapter_id:
        return out            # one chapter means that chapter, not the pack
    media = S.load_json(os.path.join(CONTENT, pack, "media.json")) or {}
    for mid in sorted(media):
        if mid not in seen:
            out.append((mid, "unused"))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pack")
    ap.add_argument("--chapter", default=None)
    ap.add_argument("--cols", type=int, default=COLS)
    args = ap.parse_args(argv)

    media = S.load_json(os.path.join(CONTENT, args.pack, "media.json")) or {}
    items = order_for(args.pack, args.chapter)
    cells = []
    for mid, where in items:
        spec = media.get(mid) or {}
        f = spec.get("file") or spec.get("src")
        if not f:
            continue
        path = os.path.join(CONTENT, args.pack,
                            f if "/" in f or os.sep in f else os.path.join("media", f))
        if not os.path.exists(path):
            continue
        cells.append((mid, where, path))
    if not cells:
        raise SystemExit(f"no pictures found for {args.pack}")

    cell_h = int(CELL_W * HOST_H / HOST_W)
    cols = max(1, args.cols)
    rows = (len(cells) + cols - 1) // cols
    W = cols * (CELL_W + PAD) + PAD
    H = rows * (cell_h + LABEL_H + PAD) + PAD
    sheet = Image.new("RGB", (W, H), (24, 22, 19))
    draw = ImageDraw.Draw(sheet)

    for i, (mid, where, path) in enumerate(cells):
        c, r = i % cols, i // cols
        x = PAD + c * (CELL_W + PAD)
        y = PAD + r * (cell_h + LABEL_H + PAD)
        im = visible_crop(Image.open(path).convert("RGB")).resize(
            (CELL_W, cell_h), Image.LANCZOS)
        sheet.paste(im, (x, y))
        # Where the caption sits. A picture is judged with the words on it.
        band = int(cell_h * (1 - CAPTION_FRACTION))
        draw.line([(x, y + band), (x + CELL_W, y + band)], fill=(220, 190, 120), width=1)
        draw.text((x + 2, y + cell_h + 2), f"{mid}  ({where})", fill=(214, 208, 196))

    out = os.path.join(ROOT, "shots", "contact")
    os.makedirs(out, exist_ok=True)
    name = f"{args.pack}{'-' + args.chapter if args.chapter else ''}.png"
    dest = os.path.join(out, name)
    sheet.save(dest)
    print(f"{len(cells)} pictures, in the order a viewer meets them")
    print(f"  the gold line is where the caption starts")
    print(f"  -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
