#!/usr/bin/env python
"""Is the scene change actually hidden by the thing built to hide it?

THE BUG THIS EXISTS FOR

`engine/transition.js` dims the stage and names the new scene, and the whole
point of the dim is that the map's cut to somewhere else happens behind it.
It did not. `onScene()` called `mapScene()` and the player called
`rebuildTo()` at t=0, while the veil was still fully transparent and had
1200 ms of fading still to do -- so the cut was the FIRST thing you saw, and
the device meant to cover it arrived afterwards. The veil was also .82
opaque, so even once it had arrived the change showed through it.

Reading the code does not catch this: both halves are correct on their own
and the ordering is one line apart. Reading a class name does not catch it
either -- `is-on` is present the whole time. The only thing that answers it
is the computed opacity of the veil at the instant the picture changes.

WHAT IT MEASURES

It drives a real scene turn in the real app, samples the veil's effective
opacity every 100 ms, and watches the stage for the frame where the picture
actually changes. Then one assertion: at that moment the veil must be opaque.

Needs a server (tools/serve.py) and the chapter's timing files.
"""
from __future__ import annotations
import argparse, os, sys
from playwright.sync_api import sync_playwright

# The veil has to be all the way there, not nearly: .82 was "nearly" and it
# showed. A little slack for sub-pixel compositing, and nothing more.
OPAQUE = 0.99
SAMPLE_MS = 100
WINDOW_MS = 3000

DRIVE = """
async () => {
  const S = await import('./engine/story.js');
  const p = S.getPlayer();
  if (!p) return 'no player';
  // A card only appears when the chapter is RUNNING -- a seek into a scene is
  // you looking for something, not the scene beginning. So say so, the way
  // rolling off the end of scene 0's audio would.
  await p.goToScene(0, { autoplay: false, at: Math.max(0, (p.chapter.scenes[0].dur || 10) - 2) });
  p.playing = true;
  p.goToScene(1, { autoplay: false, at: 0 });   // NOT awaited: we watch it happen
  return 'ok';
}
"""

# Effective opacity of the veil, and a cheap fingerprint of the picture under
# it. The fingerprint only has to CHANGE when the stage is rebuilt.
PROBE = """
() => {
  const wipe = document.querySelector('.scene-wipe');
  const veil = document.querySelector('.scene-wipe__veil');
  let o = 0;
  if (wipe && veil) {
    const a = Number(getComputedStyle(wipe).opacity);
    const b = Number(getComputedStyle(veil).opacity);
    o = (getComputedStyle(wipe).visibility === 'hidden') ? 0 : a * b;
  }
  const stage = document.querySelector('.story__stage');
  const marks = document.querySelectorAll(
    '.story-mk, .story-ring, .atlas-place, .story-place').length;
  const title = document.querySelector('.scene-wipe__title')?.textContent || '';
  return { o, marks, title, html: (stage?.innerHTML || '').length };
}
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    # check-all.py runs its own server on a random port and says where.
    default_url = os.environ.get("LAB_BASE", "http://127.0.0.1:8000").rstrip("/") + "/index.html"
    ap.add_argument("--url", default=default_url)
    ap.add_argument("--chapter", type=int, default=0)
    ap.add_argument("--pack", default="american-revolution")
    a = ap.parse_args()

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 393, "height": 852},
                                locale="nb-NO")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(a.url, wait_until="networkidle")
        # The front door: index.html opens on the subject chooser now, so the
        # story does not exist until one is picked.
        page.wait_for_selector(f'.subject[data-pack="{a.pack}"]', timeout=30_000)
        page.click(f'.subject[data-pack="{a.pack}"]')
        page.wait_for_function(
            "() => !!document.querySelector('#story-map') && !document.querySelector('.boot')",
            timeout=30_000)
        page.wait_for_timeout(1200)
        if a.chapter:
            page.evaluate("(i) => document.querySelectorAll('.cover__chapter')[i]?.click()",
                          a.chapter)
            page.wait_for_timeout(1500)
        page.evaluate("() => document.querySelector('.story__cover')?.classList.remove('is-on')")
        page.wait_for_timeout(400)

        got = page.evaluate(DRIVE)
        if got != "ok":
            print(f"could not drive the app: {got}")
            return 2

        samples = []
        for i in range(WINDOW_MS // SAMPLE_MS + 1):
            samples.append((i * SAMPLE_MS, page.evaluate(PROBE)))
            page.wait_for_timeout(SAMPLE_MS)
        browser.close()

    base = samples[0][1]
    changed_at = next((t for t, s in samples
                       if s["html"] != base["html"] or s["marks"] != base["marks"]), None)
    peak = max(s["o"] for _, s in samples)
    carded = any(s["title"] for _, s in samples)

    print(f"  card shown        : {'yes' if carded else 'NO'}")
    print(f"  veil peak opacity : {peak:.3f}")
    if changed_at is None:
        print("  stage rebuilt     : never — the probe is testing air")
        return 1
    at = dict(samples)[changed_at]["o"]
    print(f"  stage rebuilt at  : ~{changed_at} ms, veil at {at:.3f}")

    bad = False
    if not carded:
        print("    FAIL no title card ran, so nothing was covering anything")
        bad = True
    if peak < OPAQUE:
        print(f"    FAIL the veil never reaches opaque (peak {peak:.3f}) — "
              "the change shows through it")
        bad = True
    if at < OPAQUE:
        print(f"    FAIL the picture changed while the veil was at {at:.3f} — "
              "the cut is in front of the device built to hide it")
        bad = True
    print("\nThe scene change is covered." if not bad else "\nPROBLEMS — see above.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
