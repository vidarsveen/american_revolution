"""How much of a chapter has nothing on screen at all?

Not "no plate". A chart, a stat deck, a compare or a fact card is a picture
too, and a beat with one of those is not blank. But a chapter that declares
`ground: none` has no map underneath either, so a stretch with none of them is
the backdrop and the caption and nothing else — which is what "there's a black
background, we can't have it like that" was reporting.

A report, not a gate. Some silence is deliberate: the beat that lands after a
chart has been read is meant to breathe. What this answers is *how much* and
*where*, so the answer is an editing decision and not a guess.

    python tools/check-blank.py beer/chapter-1-fire-ting
"""
import io
import json
import sys

# Each visual is tracked on its OWN channel. The first version of this tool
# folded them into one flag, so `stat.clear` — which takes down a number deck
# while a picture is still on screen behind it — read as the screen going
# blank, and it reported three gaps that a viewer never sees.
CHANNELS = {
    "plate":   (("plate",),   ("plate.hide",)),
    "deck":    (("stat.",),   ("stat.clear",)),
    "chart":   (("chart.", "compare"), ("chart.clear",)),
    "card":    (("fact", "quote"), ("fact.clear", "quote.clear")),
}


def main(ref, lang="no"):
    pack, chapter = ref.split("/", 1)
    base = f"content/{pack}"
    ch = json.load(io.open(f"{base}/{chapter}.json", encoding="utf-8"))
    tm = json.load(io.open(f"{base}/timing.{chapter}.{lang}.json", encoding="utf-8"))
    cues = {b["id"]: [c["do"] for c in b.get("cues", [])]
            for sc in ch["scenes"] for b in sc["beats"]}

    blank = total = 0.0
    gaps = []
    for sc in ch["scenes"]:
        t = tm["scenes"].get(sc["id"])
        if not t:
            continue
        # Anything standing at the end of a scene is wiped by the scene change
        # (see CLAUDE.md, "a scene change wipes the stage"), so each scene
        # starts with nothing up — the same state the engine is in.
        up = {k: False for k in CHANNELS}
        for b in t["beats"]:
            dur = b["dur"] + b.get("gapAfter", 0)
            total += dur
            done = cues.get(b["id"], [])
            for name, (shows, hides) in CHANNELS.items():
                if any(c in hides for c in done):
                    up[name] = False
                if any(c.startswith(shows) and c not in hides for c in done):
                    up[name] = True
            if not any(up.values()):
                blank += dur
                if dur >= 5:
                    say = next((x["say"][lang] for s2 in ch["scenes"]
                                for x in s2["beats"] if x["id"] == b["id"]), "")
                    gaps.append((dur, sc["id"], b["id"], say[:54]))

    pct = blank / total * 100 if total else 0
    print(f"{ref} [{lang}]  nothing on screen "
          f"{int(blank)//60}:{int(blank) % 60:02d} of "
          f"{int(total)//60}:{int(total) % 60:02d}  = {pct:.0f}%")
    for d, s, b, say in sorted(gaps, reverse=True)[:10]:
        print(f"  {s:4} {b:10} {d:5.1f}s  {say}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], *sys.argv[2:]))
