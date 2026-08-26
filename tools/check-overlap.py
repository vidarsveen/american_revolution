#!/usr/bin/env python3
"""
Do two things the reader is meant to read land on top of each other?

    python tools/check-overlap.py                      # every pack, Norwegian
    python tools/check-overlap.py italy-wine --lang no,en
    python tools/check-overlap.py --baseline           # rewrite the ratchet

Needs a server: tools/serve.py, or LAB_BASE.

THE DEFECT CLASS, and it has bitten three times

CLAUDE.md: "Two overlays anchored to the same edge will fight, and the later one
wins." The stats deck and the caption box were both anchored to the transport,
and the caption sits on a higher layer — so every number a chapter showed was
drawn BEHIND it. Invisible rather than missing, which is why it survived so
long. `.ov-deck--mid` was `top: 32%` and nothing else, so a quote card landed on
the caption 31 times and on the transport 6.

Those were found by a harness that measured 646 frames pairwise and was then
thrown away, and its last finding — "the remaining 30 are portrait cards
reaching down out of the top deck" — has sat in BACKLOG.md unreproducible ever
since. A measurement nobody can re-run is a story, not a number. So this is that
harness, committed.

WHAT IT MEASURES

At every beat of every chapter it seeks, settles, and takes the rectangle and
the EFFECTIVE opacity — display, visibility and every ancestor's opacity folded
in — of each element the reader is meant to read. Two of them sharing more than
`MIN_AREA` square pixels while both are effectively visible is an overlap.

Effective opacity, not a class name: `.ov-fact` had no hidden state in the
stylesheet at all, so four separate "fixes" that removed a class changed nothing
a viewer could see and every probe that asked the DOM about classes reported
success.

The sampled walk (the default) and the exhaustive one found the same five pairs
with the same counts on the four packs that ship — 395 frames against 571, two
and three quarter minutes against five and a half.

IT IS A RATCHET, NOT A GATE

The known overlaps are listed in BASELINE below with the count each was measured
at. Anything new fails; anything that gets better prints as a win and asks you
to lower the number. A clean gate would have meant fixing thirty frames of
portrait card before this could be committed at all, and then the class would
have gone on being unguarded in the meantime.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
VIEWPORT = (390, 844)

# What the reader is meant to read. Not every box on the stage: a positioning
# wrapper covers the frame and hides nothing, and the decks themselves are
# bands rather than ink. These are the things with words in them.
WATCH = [
    ".captions",
    ".transport",
    ".ov-fact__card",
    ".ov-quote__card",
    ".ov-portrait__card",
    ".ov-image__card",
    ".ov-compare",
    ".ov-stat",
    ".ov-note",
    ".atlas__credit",
]

# Below this, two rounded corners are touching and nobody can see it.
MIN_AREA = 400

# WHICH BEATS ARE WORTH A SEEK, and this is the difference between a check
# people run and one they skip. Every beat of every chapter is 571 seeks and
# ten and a half minutes on top of check-all — which roughly doubles it, and
# CLAUDE.md's argument against the old five-command list was that it is a list
# people run four fifths of. So: the first beat of every scene, which catches
# anything overlapping CONSTANTLY (the licence credit under the caption was in
# all 50 frames of the wine chapter, and one frame would have found it), plus
# every beat where a card arrives or leaves, which is when two of them can
# meet. `--all-beats` still does the exhaustive walk, and the baseline numbers
# below were measured with it.
CARD_VERBS = {
    "portrait.show", "portrait.hide", "quote.show", "quote.hide",
    "image.show", "image.hide", "fact.show", "fact.hide", "stat.show",
    "stat.clear", "compare.show", "compare.clear", "note.show",
    "plate.show", "plate.hide",
}

# WHAT IS KNOWN TO OVERLAP, and how many beat-frames it was measured at.
# Raise nothing here without a reason written beside it; lower it when a fix
# lands. `python tools/check-overlap.py --baseline` prints the block to paste.
# Measured across 571 beat-frames, four packs, Norwegian, at the middle of every
# beat. Two families, and they are different problems:
#
#   THE CREDIT against a card (11 frames). The map's licence chip is bottom
#   right and a card in the lower deck can cross it. It used to overlap the
#   CAPTION in all 50 frames of the wine chapter instead, which was worse and
#   is fixed — engine/captions.js publishes --caption-reach now. What is left
#   is brief: the chip is clear in 560 of 571 frames.
#
#   TWO CARDS on each other (3 frames). The top deck starts at the same line as
#   the mid deck's band and grows downwards with no bound, so a portrait can
#   hang into a centred quote. BACKLOG.md recorded this as "30 of 646" from a
#   harness that no longer existed.
#
# A FIX FOR THE SECOND WAS TRIED AND MEASURED WORSE, which is why it is written
# down here rather than attempted again from scratch: publishing the top deck's
# reach and starting the mid band below it shrinks that band, and a tall quote
# card then overflows it in BOTH directions — 5 pairs became 7, with the quote
# landing on the caption in 6 frames and the transport in 3. The band is
# bounded top and bottom and centres its content; making it shorter is not the
# move. What is left is capping how far a portrait may hang, and that is a
# decision about how big a face is allowed to be.
BASELINE = {
    ".atlas__credit|.ov-fact__card": 6,
    ".atlas__credit|.ov-portrait__card": 4,
    ".atlas__credit|.ov-quote__card": 1,
    ".ov-compare|.ov-portrait__card": 1,
    ".ov-portrait__card|.ov-quote__card": 2,
}


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def packs_on_disk():
    listed = load(os.path.join(CONTENT, "packs.json"))
    if listed:
        return listed
    return sorted(d for d in os.listdir(CONTENT)
                  if os.path.isdir(os.path.join(CONTENT, d))
                  and not d.startswith("_"))


def beats_to_probe(pack, chapter_id, every):
    """{scene index: [beat id, ...]} — see CARD_VERBS for why not all of them."""
    ch = load(os.path.join(CONTENT, pack, f"{chapter_id}.json")) or {}
    want = {}
    for i, scene in enumerate(ch.get("scenes", [])):
        ids = []
        for j, beat in enumerate(scene.get("beats", [])):
            if every or j == 0 or any(c.get("do") in CARD_VERBS
                                      for c in beat.get("cues", [])):
                ids.append(beat["id"])
        want[i] = ids
    return want


def chapters_of(pack):
    d = os.path.join(CONTENT, pack)
    return sorted(f[:-5] for f in os.listdir(d)
                  if f.startswith("chapter-") and f.endswith(".json"))


BOOT = r"""
async ([pack, chapterId, lang]) => {
  const S = await import('./engine/story.js');
  window.__ov = { S };
  if (S.getChapter() && S.getChapter().lang !== lang) await S.storySetLang(lang);
  if (chapterId && S.getChapter()?.id !== chapterId) {
    const n = document.querySelectorAll('[data-chapter]').length;
    for (let i = 0; i < n; i += 1) {
      if (S.getChapter()?.id === chapterId) break;
      document.querySelectorAll('[data-chapter]')[i]?.click();
      await new Promise(r => setTimeout(r, 1400));
    }
  }
  document.querySelector('.story__cover')?.classList.remove('is-on');
  await new Promise(r => setTimeout(r, 600));
  const ch = S.getChapter();
  if (!ch) return null;
  return {
    id: ch.id, lang: ch.lang,
    scenes: ch.scenes.map((s) => ({
      id: s.id,
      beats: s.beats.map((b) => ({ id: b.id, start: b.start, dur: b.dur })),
    })),
  };
}
"""

PROBE = r"""
async (a) => {
  const S = window.__ov.S;
  const p = S.getPlayer();
  await p.goToScene(a.scene, { autoplay: false, at: a.t });
  p.rebuildTo(a.t);
  await new Promise(r => setTimeout(r, a.settle));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  /* Effective opacity: display, visibility and every ancestor's opacity folded
     in. A class name tells you what the author intended; this tells you what
     the viewer sees. `.ov-fact` had no hidden state in the stylesheet at all,
     and four "fixes" that removed a class changed nothing on screen. */
  const eff = (node) => {
    let o = 1;
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= Number(cs.opacity);
      if (!o) return 0;
    }
    return o;
  };

  const out = [];
  for (const sel of a.watch) {
    for (const el of document.querySelectorAll(sel)) {
      const o = eff(el);
      if (o < 0.15) continue;              // a fade-out nobody is reading
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      out.push({ sel, o: Math.round(o * 100) / 100,
                 x: r.left, y: r.top, w: r.width, h: r.height });
    }
  }
  return out;
}
"""


def overlaps(boxes, min_area):
    out = []
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            if a["sel"] == b["sel"]:
                continue
            ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
            oy = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
            if ox <= 0 or oy <= 0 or ox * oy < min_area:
                continue
            key = "|".join(sorted((a["sel"], b["sel"])))
            out.append((key, round(ox * oy)))
    return out


def run(base, pack, chapter_id, lang, settle, found, seen, every=False):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": VIEWPORT[0],
                                            "height": VIEWPORT[1]},
                                  reduced_motion="reduce")
        page = ctx.new_page()
        page.goto(f"{base}/index.html?emne={pack}", wait_until="networkidle")
        page.wait_for_function(
            "() => !!document.querySelector('.story') && !document.querySelector('.boot')",
            timeout=20000)
        plan = page.evaluate(BOOT, [pack, chapter_id, lang])
        if not plan:
            print(f"  {pack}/{chapter_id} {lang}: no chapter")
            ctx.close(); browser.close()
            return 0
        frames = 0
        want = beats_to_probe(pack, chapter_id, every)
        for si, scene in enumerate(plan["scenes"]):
            for beat in scene["beats"]:
                if beat["id"] not in want.get(si, []):
                    continue
                # The middle of the beat: the entry animations have landed and
                # nothing has begun to leave.
                t = (beat.get("start") or 0) + (beat.get("dur") or 0) / 2
                boxes = page.evaluate(PROBE, {"scene": si, "t": t,
                                              "settle": settle, "watch": WATCH})
                frames += 1
                for key, area in overlaps(boxes, MIN_AREA):
                    found[key] = found.get(key, 0) + 1
                    worst = seen.get(key)
                    if not worst or area > worst[0]:
                        seen[key] = (area, f"{plan['id']} {beat['id']} {lang}")
        ctx.close(); browser.close()
        return frames


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("packs", nargs="*", help="default: every pack")
    ap.add_argument("--lang", default="no")
    ap.add_argument("--url", default=os.environ.get("LAB_BASE",
                                                    "http://localhost:8000").rstrip("/"))
    ap.add_argument("--settle", type=int, default=140)
    ap.add_argument("--all-beats", action="store_true",
                    help="every beat, not just scene starts and card beats")
    ap.add_argument("--baseline", action="store_true",
                    help="print the BASELINE block for what was just measured")
    args = ap.parse_args()

    packs = args.packs or packs_on_disk()
    langs = [l.strip() for l in args.lang.split(",") if l.strip()]
    found: dict[str, int] = {}
    seen: dict[str, tuple] = {}
    frames = 0
    for pack in packs:
        for cid in chapters_of(pack):
            for lang in langs:
                frames += run(args.url, pack, cid, lang, args.settle, found,
                              seen, args.all_beats)
                print(f"  {pack}/{cid} {lang}: {frames} frames so far")

    print(f"\n{frames} beat-frames measured, {len(found)} overlapping pair(s)")
    for key in sorted(found):
        area, where = seen[key]
        print(f"  {found[key]:>4}x  {key}   worst {area} px² at {where}")

    if args.baseline:
        print("\nBASELINE = {")
        for key in sorted(found):
            print(f'    "{key}": {found[key]},')
        print("}")
        return 0

    bad = False
    for key, n in sorted(found.items()):
        allowed = BASELINE.get(key, 0)
        if n > allowed:
            bad = True
            print(f"\n  FAIL: {key} overlaps in {n} frames, baseline {allowed}")
            print(f"        worst {seen[key][0]} px² at {seen[key][1]}")
    for key, allowed in sorted(BASELINE.items()):
        n = found.get(key, 0)
        if n < allowed:
            print(f"\n  BETTER: {key} is down to {n} from {allowed} — lower the "
                  f"baseline in {os.path.basename(__file__)}")
    if bad:
        return 1
    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
