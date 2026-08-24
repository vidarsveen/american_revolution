#!/usr/bin/env python
"""Does one picture ever REPLACE another without a dissolve?

THE BUG THIS EXISTS FOR

`plate.hide` and `plate.show` can land on the same instant -- three beats of
the wine chapter write "replace this picture" exactly that way. `showPlate()`
decided whether to cross-dissolve by asking whether the container still had
`is-on`, and `hidePlate()` had just removed it. So the replacement took the
hard-cut branch: measured at s0.b3, `druer-kasse` at scale 1.100 and full
opacity in one 80 ms sample, `dal-avstengt` at scale 1.000 and full opacity in
the next, with the ghost at 0 throughout. The picture snapped back to its
opening framing and swapped source inside one frame, in full view -- "at the
end of that one it is basically rescaling, for a microsecond".

The engine has had a ghost element for carrying the outgoing picture the whole
time. It simply never ran.

WHAT IT MEASURES, AND THE MISTAKE IT MADE FIRST

The first version of this check looked for a jump in SCALE on one image, and
passed cleanly on the bug it was written for -- because it excluded samples
where the source changed, which is the only moment this can happen. A check
that cannot see the defect it was built for is worse than no check, so it now
asks the question the right way round:

    when the picture changes, was there a window in which BOTH were on screen?

That is what a dissolve is, and nothing else produces it.

Needs a server (tools/serve.py).
"""
from __future__ import annotations
import argparse, json, os, pathlib, sys
from playwright.sync_api import sync_playwright

SAMPLE_MS = 70
SPAN_MS = 2600
# Both pictures visibly present at once. A dissolve holds this for about a
# second; a cut never reaches it on any frame.
BOTH = 0.12

PLAY_FROM = """
async ([bid, off]) => {
  const S = await import('./engine/story.js');
  const p = S.getPlayer(), ch = S.getChapter();
  let at = off, si = 0, found = false;
  ch.scenes.forEach((s, i) => s.beats.forEach((b) => {
    if (b.id === bid) { at = b.start + off; si = i; found = true; }
  }));
  if (!found) return 'no beat ' + bid;
  await p.goToScene(si, { autoplay: false, at });
  await p.play();
  return 'ok';
}
"""

PROBE = """
() => {
  const root = document.querySelector('.stage-plate');
  if (!root) return null;
  const img = root.querySelector('.plate__img');
  const gh = root.querySelector('.plate__ghost');
  const cs = getComputedStyle(root);
  const on = cs.visibility === 'hidden' ? 0 : Number(cs.opacity);
  const f = (n) => (n.getAttribute('src') || '').split('/').pop();
  return {
    on,
    img: f(img), imgOp: on * Number(getComputedStyle(img).opacity),
    gho: f(gh),  ghOp: on * Number(getComputedStyle(gh).opacity),
  };
}
"""


def plate_beats(pack, chapter):
    d = json.loads(pathlib.Path(f"content/{pack}/{chapter}.json").read_text(encoding="utf-8"))
    out = []
    for s in d["scenes"]:
        for b in s["beats"]:
            cues = [c.get("do") for c in b.get("cues", [])]
            if "plate.show" in cues:
                out.append(b["id"])
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", default="italy-wine")
    ap.add_argument("--chapter", default="chapter-1-piemonte")
    base = os.environ.get("LAB_BASE", "http://127.0.0.1:8000").rstrip("/")
    ap.add_argument("--url", default=base + "/index.html")
    a = ap.parse_args()

    beats = plate_beats(a.pack, a.chapter)
    problems, replacements = [], 0
    with sync_playwright() as pw:
        # The clock only advances while the audio does, so a chapter that will
        # not autoplay measures nothing at all -- the first run of this sat on
        # one frame for two seconds and reported everything perfect.
        browser = pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])

        def fresh():
            """A new page per beat, and it has to be.

            Reusing one page means seeking backwards between beats, and a media
            element reports where it IS, not where it was told to go -- so the
            clock ran on the old position and the beat's cues were applied by
            the REBUILD instead of live. Which made this bench report a hard
            cut on three beats that dissolve perfectly, the mirror image of the
            mistake it was written to catch."""
            pg = browser.new_page(viewport={"width": 393, "height": 852}, locale="nb-NO")
            pg.goto(a.url, wait_until="networkidle")
            pg.wait_for_selector(f'.subject[data-pack="{a.pack}"]', timeout=30_000)
            pg.click(f'.subject[data-pack="{a.pack}"]')
            pg.wait_for_function(
                "() => !!document.querySelector('#story-map') && !document.querySelector('.boot')",
                timeout=30_000)
            pg.wait_for_timeout(1200)
            pg.evaluate("() => document.querySelector('.story__cover')?.classList.remove('is-on')")
            return pg

        for bid in beats:
            page = fresh()
            got = page.evaluate(PLAY_FROM, [bid, -0.7])
            if got != "ok":
                problems.append(f"{bid}: {got}")
                continue
            prev, swapped, dissolved = None, None, False
            trace = []
            for _ in range(SPAN_MS // SAMPLE_MS):
                s = page.evaluate(PROBE)
                page.wait_for_timeout(SAMPLE_MS)
                if not s:
                    continue
                # Kept so a failure is diagnosable instead of mysterious.
                trace.append(f"on={s['on']:.2f} {s['img'][:18]:18s} {s['imgOp']:.2f}"
                             f"  ghost {s['gho'][:18]:18s} {s['ghOp']:.2f}")
                # Both pictures on screen at once: a dissolve is happening.
                if s["gho"] and s["gho"] != s["img"]                         and min(s["imgOp"], s["ghOp"]) > BOTH:
                    dissolved = True
                # The picture was replaced while the plate was on screen.
                if (prev and prev["img"] and s["img"] != prev["img"]
                        and prev["on"] > 0.5):
                    swapped = (prev["img"], s["img"])
                prev = s
            if swapped:
                replacements += 1
                if not dissolved:
                    nl = chr(10)
                    tail = nl.join("           " + t for t in trace[-8:])
                    problems.append(
                        f"{bid}: {swapped[0]} -> {swapped[1]} with no dissolve"
                        f" -- the picture was cut, not replaced" + nl + tail)
            page.close()
        browser.close()

    print(f"  plate beats walked : {len(beats)} in {a.pack}/{a.chapter}")
    print(f"  replacements seen  : {replacements}")
    for p in problems:
        print(f"    FAIL {p}")
    ok = "Every replacement dissolved." if not problems else "PROBLEMS -- see above."
    print("")
    print(ok)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
