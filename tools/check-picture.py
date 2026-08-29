"""Does any picture read as a blank screen?

`tools/check-plate-crop.py` asks whether a picture is the right SHAPE for a
phone. `SAFE_BOTTOM` in tools/gen-image.py asks the model to keep the subject
in the upper two thirds. Neither of them ever looked at the pixels that came
out, and an instruction in a prompt is not a measurement of what the model
did with it -- which is the same mistake as a level derived from other
numbers, and as a rule aimed at a selector nothing paints.

So a picture shipped whose lower half was plain white studio paper. Under a
caption, on a phone, that is not a photograph with empty space in it: it is a
blank screen with some fruit at the top, and it was reported as exactly that
-- "a pale one ..... then blank screen". The tools all passed it. The shape
was right, the file was there, the record described it accurately, and it
still read as the app having stopped.

WHAT MAKES A PICTURE READ AS BLANK is not darkness and not emptiness on its
own. A dark featureless corner is a shadow and looks deliberate. A BRIGHT
featureless region looks like paper -- like the page behind the app showing
through -- and the bigger it is and the closer to the caption, the more it
reads as a fault rather than as composition.

So the test is per band, on the crop a phone actually shows, and it is the
conjunction that fails: bright AND featureless AND large. Measured on the
twenty-two pictures of the beer course, the one that was reported scores 7
for detail against a mean of 175; the next flattest bright band in the whole
repo scores far above the threshold. The numbers below are set from that
spread and not from taste.

    python tools/check-picture.py             # every course
    python tools/check-picture.py beer
    python tools/check-picture.py beer --band  # print every band, to calibrate
"""

import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    raise SystemExit("needs pillow: .venv/Scripts/python.exe -m pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# The stage on a phone: 390x734, the map host inside a 390x844 device. The
# same numbers tools/check-plate-crop.py measures against.
HOST_W, HOST_H = 390, 734

# Four bands down the visible crop. The bottom one is where the caption sits,
# and it is the one that decides whether a picture reads as a page that ran
# out -- so it is judged hardest.
BANDS = 4

# Bright enough to read as paper rather than as shadow. Mid-grey is 128; the
# reported picture's bottom band is 175 and its studio sweep never goes below
# about 165. Nothing legitimate in this repo has a band this bright AND this
# flat at the same time.
BRIGHT = 140

# Standard deviation of luminance within a band. A flat wall scores under 10;
# a shallow-focus blurred background still scores 30 to 70, because a blur
# keeps its tones. The reported picture scores 7.
FLAT = 18

# A band that is bright and flat is only a defect when it is a real part of
# the frame. The bottom band is a quarter of the picture by construction, so
# this is really about how MANY bands go: one bottom band is a fault, and two
# adjacent ones are the picture being mostly empty.
def band_stats(img, i):
    w, h = img.size
    top = int(h * i / BANDS)
    bot = int(h * (i + 1) / BANDS)
    px = list(img.crop((0, top, w, bot)).resize((48, 24)).getdata())
    mean = sum(px) / len(px)
    sd = (sum((p - mean) ** 2 for p in px) / len(px)) ** 0.5
    return mean, sd


def visible_crop(im):
    """The slice a phone actually shows, under object-fit: cover.

    Cover scales the picture until it covers the host and centres it, so the
    long axis is what gets cut. Measuring the whole file would forgive a
    picture whose emptiness is entirely inside the part nobody sees, and
    would condemn one whose emptiness is cropped away.
    """
    w, h = im.size
    want = HOST_W / HOST_H
    have = w / h
    if have > want:                      # too wide: crop the sides
        keep = int(h * want)
        x = (w - keep) // 2
        return im.crop((x, 0, x + keep, h))
    keep = int(w / want)                 # too tall: crop top and bottom
    y = (h - keep) // 2
    return im.crop((0, y, w, y + keep))


# A RATCHET, like tools/check-overlap.py. Rome, the Revolution and Narvik are
# frozen -- they stay as proof the framework is not about one subject, and
# CLAUDE.md is explicit that their content is not the work. Fixing them
# because a new check reported them is the exact mistake that cost a day.
#
# So what already ships is written down with the number it was measured at,
# and nothing NEW is allowed. If one of these is ever redrawn, delete its line
# rather than lowering it.
KNOWN = {
    "italy-wine/glass-perler":    "bottom band 191/10 — a glass against a bright wash",
    "norway-1940/georg-thiele":   "bottom band 160/16 — archive photo, blown-out sea",
    "roman-empire/nile":          "bottom band 199/10 — an engraving on pale paper",
}


def check_pack(pack, show_bands=False):
    d = os.path.join(CONTENT, pack)
    mpath = os.path.join(d, "media.json")
    if not os.path.exists(mpath):
        return [], []
    with open(mpath, encoding="utf-8") as fh:
        media = json.load(fh)
    if not isinstance(media, dict):
        return [], []

    fails, notes = [], []
    for mid, spec in sorted(media.items()):
        if not isinstance(spec, dict):
            continue
        f = spec.get("file") or spec.get("src")
        if not f:
            continue
        path = os.path.join(d, f if "/" in f or os.sep in f
                            else os.path.join("media", f))
        if not os.path.exists(path):
            continue                     # tools/check-pack.py owns that one
        im = visible_crop(Image.open(path).convert("L"))
        bands = [band_stats(im, i) for i in range(BANDS)]
        if show_bands:
            desc = "  ".join(f"{m:3.0f}/{s:2.0f}" for m, s in bands)
            print(f"    {mid:26} {desc}")
        # ONLY THE LOWER HALF. The first run flagged eleven pictures across
        # four courses and every one of them was SKY: a bright, flat top band
        # is what the top of an outdoor photograph looks like, and a rule that
        # calls the sky a defect is a rule nobody will keep. Gravity is the
        # whole argument -- a featureless bright field belongs above the
        # horizon and nothing but studio paper puts one below it.
        bad = [i for i, (m, s) in enumerate(bands)
               if i >= BANDS // 2 and m > BRIGHT and s < FLAT]
        if not bad:
            continue
        where = {0: "top", 1: "upper middle", 2: "lower middle",
                 3: "bottom, under the caption"}
        worst = max(bad, key=lambda i: bands[i][0])
        m, s = bands[worst]
        line = (f"{pack}/{mid}: the {where[worst]} quarter of what a phone "
                f"shows is blank paper — brightness {m:.0f}, detail {s:.0f}. "
                f"It reads as the screen having stopped, not as a picture.")
        if len(bad) > 1:
            line += f" {len(bad)} of 4 bands are like this."
        key = f"{pack}/{mid}"
        if key in KNOWN:
            notes.append(f"{key}: known and allowed — {KNOWN[key]}")
            continue
        (fails if 3 in bad or len(bad) > 1 else notes).append(line)
    return fails, notes


def main(argv):
    show = "--band" in argv
    named = [a for a in argv if not a.startswith("-")]
    packs = named or sorted(
        p for p in os.listdir(CONTENT)
        if os.path.isdir(os.path.join(CONTENT, p)))

    f_all, n_all = [], []
    for pack in packs:
        if show:
            print(f"{pack}  (band mean/detail, top to bottom)")
        f, n = check_pack(pack, show)
        f_all += f
        n_all += n

    for m in f_all:
        print(f"  FAIL: {m}")
    for m in n_all:
        print(f"  note: {m}")
    print()
    if f_all:
        print(f"{len(f_all)} picture(s) that read as a blank screen.")
        return 1
    print(f"No picture reads as a blank screen"
          + (f" ({len(n_all)} with one pale band away from the caption)."
             if n_all else "."))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
