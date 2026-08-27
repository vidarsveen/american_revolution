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

The sampled walk (the default) and the exhaustive one found the same pairs with
the same counts on the four packs that ship — 395 frames against 571, and three
minutes against six.

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

# WHAT IS KNOWN TO OVERLAP, per pack, and how many beat-frames each was
# measured at. Raise nothing here without a reason beside it; lower it when a
# fix lands. `--baseline` prints the block to paste.
#
# MEASURED AFTER THE PROBE LEARNED TO WAIT. The first numbers in this table were
# 6, 4, 1, 1 and 2 and they did not reproduce — two runs of the same command
# disagreed on two pairs — because a seek REPLAYS the cues and every card
# entering the beat fades in again over --t-enter. Measured 140 ms later, a card
# is mid-fade and its opacity crosses the threshold in one run and not the next.
# The probe now waits until nothing is moving; two consecutive runs agree
# exactly, and the numbers below are from that.
#
# Two families, and they are different problems:
#
#   THE CREDIT against a card (11 frames of 395). The map's licence chip is
#   bottom right and a card in the lower deck can cross it. It used to overlap
#   the CAPTION in all 50 frames of the wine chapter instead, which was worse
#   and is fixed — engine/captions.js publishes --caption-reach now.
#
#   TWO CARDS on each other (4 frames). The top deck starts at the same line as
#   the mid deck's band and grows downwards with no bound, so a portrait can
#   hang into a centred quote. BACKLOG.md recorded this as "30 of 646" from a
#   harness that no longer existed.
#
# A FIX FOR THE SECOND WAS TRIED AND MEASURED WORSE, which is why it is written
# down here rather than attempted again from scratch: publishing the top deck's
# reach and starting the mid band below it shrinks a band that is bounded at
# both ends and centres its content, so a tall quote card then overflowed it in
# BOTH directions — the quote landed on the caption in 6 frames and the
# transport in 3. What is left is capping how far a face may hang, and that is a
# decision about how big a face is allowed to be.
#
# KEYED BY PACK, because the tool takes a pack argument. Keyed by pair alone,
# `check-overlap.py italy-wine` compared the wine chapter against every pack's
# numbers and cheerfully announced that the Revolution's portrait overlap had
# been fixed. A ratchet that reports a win for something it did not measure is
# worse than no ratchet.
BASELINE = {
    "american-revolution": {
        ".atlas__credit|.ov-fact__card": 2,
        ".atlas__credit|.ov-portrait__card": 2,
        ".ov-compare|.ov-portrait__card": 1,
        ".ov-portrait__card|.ov-quote__card": 1,
    },
    # 1 -> 3 when chapter two arrived. Not a regression in the layout: the
    # wine course now ships close-in geometry for Tuscany as well as the
    # Langhe, so the long OSM attribution is on screen in a second chapter's
    # fact-card beats too. Letting the chip WRAP instead of running the width
    # of the screen was tried and measured worse — two short lines are taller,
    # and the extra height cost more overlap than the width saved.
    "italy-wine": {
        ".atlas__credit|.ov-fact__card": 3,
    },
    "norway-1940": {
        ".atlas__credit|.ov-fact__card": 3,
        ".atlas__credit|.ov-portrait__card": 2,
        ".atlas__credit|.ov-quote__card": 1,
        ".ov-portrait__card|.ov-quote__card": 1,
    },
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

  /* AND WHAT IS LEFT OF THE MAP. The stage is a map with furniture over it,
     and the furniture is not small: a caption, a transport, a deck and
     sometimes a card. "Roughly 40% of the frame is spoken for before the map
     draws anything" has been asserted in BACKLOG.md three times from three
     different measurements of PARTS. This measures the whole. */
  const host = document.querySelector('#story-map');
  const hr = host ? host.getBoundingClientRect() : null;
  const plate = [...document.querySelectorAll('.plate, .stage-plate, .plate__fig')]
    .find((el) => eff(el) > 0.5 && el.getBoundingClientRect().height > 40);

  /* WAIT UNTIL NOTHING IS MOVING, and this is not optional. A seek REPLAYS the
     cues, so every card entering this beat animates in again from the moment
     of the seek, over --t-enter (900 ms). Measured 140 ms later, a card is
     mid-fade: its opacity is under the threshold in one run and over it in the
     next, and its box has not settled either. Two consecutive runs of this
     tool disagreed by two frames on two different pairs before this loop
     existed, which is the "read too close to the thing that produced it"
     failure CLAUDE.md records three times over. */
  const snapshot = () => {
    const rows = [];
    for (const sel of a.watch) {
      for (const el of document.querySelectorAll(sel)) {
        const o = eff(el);
        if (o < 0.15) continue;            // a fade-out nobody is reading
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        rows.push({ sel, o: Math.round(o * 100) / 100,
                    x: Math.round(r.left), y: Math.round(r.top),
                    w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return rows;
  };
  const sig = (rows) => rows.map((r) => `${r.sel}${r.o}${r.x},${r.y},${r.w},${r.h}`)
    .sort().join('|');

  let out = snapshot();
  let was = sig(out), still = 0;
  for (let i = 0; i < 20 && still < 2; i += 1) {
    await new Promise(r => setTimeout(r, 90));
    out = snapshot();
    const now = sig(out);
    still = now === was ? still + 1 : 0;
    was = now;
  }
  return { boxes: out, plate: !!plate,
           host: hr ? { x: hr.left, y: hr.top, w: hr.width, h: hr.height } : null };
}
"""


def map_share(host, boxes, cell=10):
    """The share of the map host no overlay is sitting on.

    Rasterised on a 10 px grid rather than added up: the boxes overlap each
    other, and a sum of areas would charge the same pixel twice — which is how
    "40% is spoken for" came to be asserted from three separate measurements of
    parts. A grid cell is counted once however many things are on it.
    """
    if not host or host["w"] < 10 or host["h"] < 10:
        return None
    cols = max(1, int(host["w"] // cell))
    rows = max(1, int(host["h"] // cell))
    taken = set()
    for b in boxes:
        x0 = max(0, int((b["x"] - host["x"]) // cell))
        x1 = min(cols, int((b["x"] + b["w"] - host["x"]) // cell) + 1)
        y0 = max(0, int((b["y"] - host["y"]) // cell))
        y1 = min(rows, int((b["y"] + b["h"] - host["y"]) // cell) + 1)
        for gy in range(y0, y1):
            for gx in range(x0, x1):
                taken.add((gx, gy))
    return 1.0 - len(taken) / float(cols * rows)


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


def run(base, pack, chapter_id, lang, settle, found, seen, shares, every=False):
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
                got = page.evaluate(PROBE, {"scene": si, "t": t,
                                            "settle": settle, "watch": WATCH})
                boxes = got["boxes"]
                frames += 1
                share = map_share(got.get("host"), boxes)
                if share is not None:
                    shares.setdefault(f"{pack}/{chapter_id}", []).append(
                        (share, bool(got.get("plate")), beat["id"]))
                for pair, area in overlaps(boxes, MIN_AREA):
                    key = (pack, pair)
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
    shares: dict[str, list] = {}
    frames = 0
    for pack in packs:
        for cid in chapters_of(pack):
            for lang in langs:
                frames += run(args.url, pack, cid, lang, args.settle, found,
                              seen, shares, args.all_beats)
                print(f"  {pack}/{cid} {lang}: {frames} frames so far")

    # WHAT THE MAP IS LEFT WITH. check-pictures.py prints `cover` — the share of
    # a chapter with a picture up — and this is the other half of that question:
    # of the frame the map is drawn in, how much can you still see? Printed and
    # never gated, because how much map a subject needs is a property of the
    # subject: the wine course wanting less of it than the Revolution is the
    # right answer, not a defect.
    if shares:
        print("\nwhat is left of the map, per chapter "
              "(share of the map host no overlay is sitting on):")
        for ref in sorted(shares):
            rows = shares[ref]
            clear = sorted(s for s, plated, _ in rows if not plated)
            plated = [s for s, p, _ in rows if p]
            med = clear[len(clear) // 2] if clear else None
            worst = min(rows, key=lambda r: r[0])
            head = "—" if med is None else f"{100 * med:3.0f}%"
            tail = (f", {len(plated)} of {len(rows)} frames behind a picture"
                    if plated else "")
            print(f"  {ref:<38} {head} median with no picture up, "
                  f"worst {100 * worst[0]:3.0f}% at {worst[2]}{tail}")

    print(f"\n{frames} beat-frames measured, {len(found)} overlapping pair(s)")
    for pack, pair in sorted(found):
        area, where = seen[(pack, pair)]
        print(f"  {found[(pack, pair)]:>4}x  {pair}   worst {area} px² at {where}")

    if args.baseline:
        print("\nBASELINE = {")
        for pack in packs:
            rows = {pair: n for (p, pair), n in found.items() if p == pack}
            if not rows:
                continue
            print(f'    "{pack}": {{')
            for pair in sorted(rows):
                print(f'        "{pair}": {rows[pair]},')
            print("    },")
        print("}")
        return 0

    bad = False
    for (pack, pair), n in sorted(found.items()):
        allowed = BASELINE.get(pack, {}).get(pair, 0)
        if n > allowed:
            bad = True
            print(f"\n  FAIL: {pack} {pair} overlaps in {n} frames, "
                  f"baseline {allowed}")
            print(f"        worst {seen[(pack, pair)][0]} px² at "
                  f"{seen[(pack, pair)][1]}")
    # Only for the packs actually measured — see the note on BASELINE.
    for pack in packs:
        for pair, allowed in sorted(BASELINE.get(pack, {}).items()):
            n = found.get((pack, pair), 0)
            if n < allowed:
                print(f"\n  BETTER: {pack} {pair} is down to {n} from {allowed}"
                      f" — lower the baseline in {os.path.basename(__file__)}")
    if bad:
        return 1
    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
