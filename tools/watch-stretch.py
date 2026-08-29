"""Play a stretch forward and say what is actually on the stage, second by second.

Every other check here SEEKS, and a seek applies cues instantly -- so a picture
that is fading, a timer that has not fired yet, and a plate wiped by the
previous scene's clear are all invisible to it. This one presses play and
watches, which is the only way to answer "and after that a blank page for ten
seconds".

    python tools/watch-stretch.py beer/chapter-1-fire-ting s3
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LAB_BASE", "http://localhost:8000")
ref = sys.argv[1]
scene = sys.argv[2] if len(sys.argv) > 2 else "all"
pack, chapter = ref.split("/")
out = os.path.join("shots", "stretch")
os.makedirs(out, exist_ok=True)

READ = """
() => {
  // Read the elements the app ACTUALLY builds. The first version of this probe
  // asked for `.caption` and `.plate img`, got nothing, and reported a clean
  // stage for a hundred seconds -- a bench that passes because it is looking
  // at the wrong page. engine/surfaces/plate.js builds `.stage-plate` with a
  // `.plate__img` inside it; engine/captions.js writes `.captions__line`.
  const op = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return 0;
      const v = parseFloat(s.opacity);
      if (!Number.isNaN(v)) o *= v;
    }
    return Number(o.toFixed(2));
  };
  return {
    // BOTH images. A cross-dissolve fades the outgoing picture out on the
    // ghost <img> while the incoming one fades in on the main <img>, so at
    // the middle of the dissolve each is at about half and NEITHER is above
    // a naive threshold -- which made this probe report one empty second in
    // the middle of a perfectly good handover, and disagree with the static
    // model for no reason. Measured at 100 ms through that dissolve: img
    // 0.4 on the new picture, ghost 0.6 on the old, and a full frame the
    // whole way through.
    plate: op('.stage-plate') * Math.max(
      document.querySelector('.plate__img')?.currentSrc ? op('.plate__img') : 0,
      document.querySelector('.plate__ghost')?.currentSrc ? op('.plate__ghost') : 0),
    deck:  op('.ov-deck .ov-stat, .ov-stat'),
    chart: op('.ov-compare, .ov-chart'),
    card:  op('.ov-fact, .ov-quote'),
    cap:   (document.querySelector('.captions__line')?.innerText || '').slice(0, 44),
  };
}
"""

with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = br.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.goto(f"{BASE}/index.html?emne={pack}", wait_until="networkidle")
    page.wait_for_timeout(2500)
    btn = page.query_selector(".story__cover button") or page.query_selector(".story__cover")
    if btn:
        btn.click()
    page.wait_for_timeout(1500)
    # PLAY into the scene, do not seek to it: the defect being looked for only
    # exists while playing forward.
    page.evaluate("""async (sid) => {
        const S = await import('/engine/story.js');
        const p = S.getPlayer(), ch = S.getChapter();
        const i = sid === 'all' ? 0 : ch.scenes.findIndex((s) => s.id === sid);
        await p.goToScene(i, { autoplay: true });
    }""", scene)
    page.wait_for_timeout(1200)
    blanks = 0
    for t in range(0, 40 if scene != "all" else 700):
        st = page.evaluate(READ)
        empty = max(st["plate"], st["deck"], st["chart"], st["card"]) < 0.1
        blanks += empty
        if empty:
            print(f"  {t // 60}:{t % 60:02d}  NOTHING ON THE STAGE  "
                  f"{st['cap'][:42]}")
        if empty:
            page.screenshot(path=os.path.join(out, f"blank-{t:03d}.png"))
        page.wait_for_timeout(1000)
        here = page.evaluate("""async () => {
            const S = await import('/engine/story.js');
            const p = S.getPlayer(), ch = S.getChapter();
            return { id: ch.scenes[p.sceneIndex]?.id,
                     done: p.sceneIndex >= ch.scenes.length - 1
                           && p.now() >= (S.getChapter().scenes.length ? 0 : 0)
                           && !!document.querySelector('.ending, .end-card') };
        }""")
        if scene != "all" and here["id"] != scene:
            break
        if scene == "all" and here["done"]:
            break
        cur = here["id"]
    print(f"\n{blanks} second(s) with nothing on the stage")
    ctx.close(); br.close()
