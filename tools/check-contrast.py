#!/usr/bin/env python3
"""
check-contrast.py — measure what the map actually renders, in both themes.

The map was unreadable for a long time and nobody could point at a number,
only at a feeling. This samples real pixels from a real browser and turns the
question into a pass/fail:

  * land vs water      — can you tell the sea from the shore at all?
  * label vs ground    — can you read a place name where it actually sits?
  * marker vs ground   — does an event pin stand out from what is behind it?
  * colony vs colony   — can you tell two colonies that share a border apart?

WCAG governs text (4.5:1 AA) and UI components (3:1). There is no standard
for "land vs water", so that threshold is stated as a project rule, not
dressed up as one.

    python tools/check-contrast.py
    python tools/check-contrast.py --theme dark
"""
from __future__ import annotations

import argparse
import http.server
import json
import socket
import socketserver
import sys
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

# (name, lat, lon, kind) — well inside their feature at the default Explore
# framing, so a small camera change cannot flip a probe to the wrong side.
PROBES = [
    ("open Atlantic", 38.0, -69.0, "water"),
    ("Chesapeake", 37.6, -76.1, "water"),
    ("inland Virginia", 38.2, -79.6, "land"),
    ("Pennsylvania", 40.9, -77.8, "land"),
]

# land/water is deliberately NOT a WCAG ratio. WCAG contrast is a function of
# luminance alone, and land/water on this basemap differ mostly in HUE:
# measured pixels are land (238,234,227) vs water (234,242,236) — a ratio of
# 1.01, and plainly different to the eye. Scoring that with luminance would
# repeat exactly the mistake sepia() made. So it uses CIE76 dE*ab instead.
THRESHOLDS = {
    # 12 was the authored-basemap target that the old raster Explore mode
    # could not honestly reach — 8.0 was its ceiling, and pushing it further
    # only worked by saturating the modern interstate network until it blazed
    # yellow across a 1775 map. Explore draws its own ground now, so both
    # modes are held to the real number and --strict has nothing left to do.
    "land/water":    (12.0, "project rule, CIE76 dE — 2.3 is just-noticeable, 12 is obvious"),
    "label/ground":  (4.5,  "WCAG 2.2 AA, normal-size text"),
    "marker/ground": (3.0,  "WCAG 2.2 1.4.11, non-text contrast (measured at the pin's ring)"),
    # Measured on the wash as it lands on the ground, not on the colour the
    # palette asked for. Those are very different numbers: thirteen tints that
    # were 13 dE apart in the token came out 4 apart once laid over olive land
    # at the alpha the wash used, which is "the same colour" to anyone not
    # holding them side by side. Only the rendered pixel settles it.
    "colony/colony": (10.0, "project rule, CIE76 dE between neighbours sharing a border"),
}

GEOM_JS = """
async (probes) => {
  const M = await import('/js/map.js');
  const map = M.getMap();
  const rect = document.getElementById('map').getBoundingClientRect();
  const out = { probes: [], labels: [], markers: [] };

  for (const p of probes) {
    const [x, y] = map.toScreen(p[1], p[2]);
    out.probes.push({ name: p[0], kind: p[3],
                      x: rect.left + x, y: rect.top + y });
  }
  for (const el of document.querySelectorAll('.place')) {
    const r = el.getBoundingClientRect();
    if (!r.width || parseFloat(getComputedStyle(el).opacity) < 0.3) continue;
    out.labels.push({ name: el.textContent.trim(), x: r.left, y: r.top,
                      w: r.width, h: r.height, color: getComputedStyle(el).color });
  }
  for (const el of document.querySelectorAll('.mk__body')) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    out.markers.push({ x: r.left + r.width / 2, y: r.top + r.height / 2,
                       w: r.width, color: getComputedStyle(el).backgroundColor,
                       ring: getComputedStyle(el).borderTopColor });
  }
  return out;
}
"""


# The chapter and the beat that puts every named area on screen at once, and
# the file whose shared vertices say which areas border each other. Both come
# from content/<pack>/pack.json — `checks.contrast` and `pools.areas` — because
# which beat shows the whole map is a fact about a script, not about a checker.
# The check is about the picture, so it is taken from the real thing rather
# than from a fixture.
def pack_checks(pack):
    mf = ROOT / "content" / pack / "pack.json"
    manifest = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
    spot = (manifest.get("checks") or {}).get("contrast") or {}
    chapter = spot.get("chapter")
    areas = (manifest.get("pools") or {}).get("areas")
    return {
        "chapter": f"{pack}/{chapter}" if chapter else None,
        "beat": (spot.get("beat"), float(spot.get("at", 3.0))),
        "areas": ROOT / "content" / pack / areas if areas else None,
    }


def packs_on_disk():
    listed = ROOT / "content" / "packs.json"
    if listed.exists():
        return json.loads(listed.read_text(encoding="utf-8"))
    return sorted(d.name for d in (ROOT / "content").iterdir()
                  if d.is_dir() and not d.name.startswith("_"))

CHECKS: dict = {}

COLONIES_JS = """
async ([beatId, offset, chapterId]) => {
  const S = await import('/engine/story.js');
  const M = await import('/engine/scenes/map.js');

  // Open the chapter the PACK named, rather than whichever one the cover
  // opened by itself. This assumed the default chapter, which was true for
  // exactly as long as there was one pack — and then quietly sampled the
  // American Revolution while claiming to measure Rome.
  if (chapterId && S.getChapter()?.id !== chapterId) {
    // Re-query on every pass. Opening a chapter re-renders the cover, so a
    // list of buttons captured once is a list of detached nodes after the
    // first click — and clicking those does nothing at all, silently.
    const n = document.querySelectorAll('[data-chapter]').length;
    for (let i = 0; i < n; i += 1) {
      if (S.getChapter()?.id === chapterId) break;
      document.querySelectorAll('[data-chapter]')[i]?.click();
      await new Promise(r => setTimeout(r, 1600));
    }
    document.querySelector('.story__cover')?.classList.remove('is-on');
    await new Promise(r => setTimeout(r, 800));
  }

  const p = S.getPlayer(), ch = S.getChapter();
  // Find the SCENE the beat is in, not scene zero. This was hardcoded to 0,
  // which worked for exactly as long as every pack's sample beat happened to
  // be in the first scene — and silently sampled the wrong scene the moment
  // one was not. tools/shoot.py learned the same lesson: derive the index
  // from the beat id, because the two drift.
  let at = offset, sceneIndex = 0;
  ch.scenes.forEach((s, i) => {
    for (const b of s.beats) if (b.id === beatId) { at = b.start + offset; sceneIndex = i; }
  });
  await p.goToScene(sceneIndex, { autoplay: false, at });
  S.storyInvalidate();
  await new Promise(r => setTimeout(r, 900));

  const map = M.getStoryMap();
  // Take the names off the map before measuring it. Sampling beside a label
  // to dodge its halo is guesswork on a phone, where Rhode Island is eight
  // pixels wide and "beside" is already Connecticut — the three of them came
  // back as one colour that way. With the labels hidden the centre of the
  // region is the region.
  // A stylesheet rule, not an inline style: the map re-runs its label pass on
  // every draw and writes element.style.visibility itself, so an inline hide
  // survives exactly until the next frame. An !important author rule outranks
  // the inline declaration the map writes.
  const hide = document.createElement('style');
  hide.textContent = '.atlas-place { visibility: hidden !important; }';
  document.head.appendChild(hide);
  map.redraw();
  await new Promise(r => setTimeout(r, 200));

  const host = document.querySelector('#story-map').getBoundingClientRect();
  return map.regions.all()
    .filter((r) => r.centre)
    .map((r) => {
      const [x, y] = map.toScreen(r.centre[0], r.centre[1]);
      return { name: r.name, x: host.left + x, y: host.top + y,
               // What the chapter ASKED for, so the checker can tell a
               // deliberate single bloc from two areas that collided.
               faction: r.faction ?? null,
               vary: r.vary !== false,
               on: x > 0 && y > 0 && x < host.width && y < host.height };
    })
    .filter((r) => r.on);
}
"""


def adjacent_colonies(path: Path):
    """
    Which areas share a border, read off the geometry itself.

    Whether a given pair is REQUIRED to be distinguishable is a separate
    question, decided at sampling time from what the chapter actually drew —
    see the `vary` filter in run_story(). Adjacency is geometry; the rule is
    not.

    No point-in-polygon and no geometry library: since the borders are
    simplified as a network, two colonies that share a border share the very
    coordinates along it. Anything else is not a shared border — which is the
    property the build is there to guarantee, so testing for it here also
    tests that the build still holds.
    """
    import json

    def vertices(geom):
        groups = (geom["coordinates"] if geom["type"] == "MultiPolygon"
                  else [geom["coordinates"]])
        return {(x, y) for g in groups for ring in g for x, y in ring}

    data = json.loads(path.read_text(encoding="utf-8"))
    feats = data.get("features", [])
    verts = {f["properties"]["name"]: vertices(f["geometry"]) for f in feats}
    names = list(verts)
    pairs = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if len(verts[a] & verts[b]) >= 2:
                pairs.append((a, b))
    return pairs


# ---------------------------------------------------------------- colour

def _lin(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb) -> float:
    r, g, b = (_lin(c) for c in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b) -> float:
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _lab(rgb):
    """sRGB -> CIE L*a*b* (D65)."""
    r, g, b = (_lin(c) for c in rgb[:3])
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.00000
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else (7.787 * t + 16 / 116)
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(a, b) -> float:
    """CIE76 dE*ab — sees hue and chroma, which a luminance ratio cannot."""
    la, lb = _lab(a), _lab(b)
    return sum((x - y) ** 2 for x, y in zip(la, lb)) ** 0.5


def median_patch(img: Image.Image, x: int, y: int, r: int = 6):
    """
    Median, not mean: the grain layer is noise and would drag a mean.

    Returns None when the patch would fall outside the image. PIL.crop()
    happily pads out-of-bounds regions with black, which scored an offscreen
    sample as pure black and produced both a false FAIL (light) and a false
    PASS (dark) before this guard existed.
    """
    if x - r < 0 or y - r < 0 or x + r >= img.width or y + r >= img.height:
        return None
    box = img.crop((x - r, y - r, x + r + 1, y + r + 1)).convert("RGB")
    px = list(box.getdata())
    if not px:
        return None
    return tuple(sorted(p[i] for p in px)[len(px) // 2] for i in range(3))


def parse_rgb(s: str):
    inner = s[s.index("(") + 1:s.index(")")]
    parts = inner.replace("/", " ").replace(",", " ").split()
    return tuple(int(float(v)) for v in parts[:3])


def parse_rgba(s: str):
    inner = s[s.index("(") + 1:s.index(")")]
    parts = inner.replace("/", " ").replace(",", " ").split()
    rgb = tuple(int(float(v)) for v in parts[:3])
    return rgb, (float(parts[3]) if len(parts) > 3 else 1.0)


def composite(fg, bg):
    """Flatten a semi-transparent colour over an opaque one."""
    (r, g, b), a = fg
    return tuple(round(c * a + d * (1 - a)) for c, d in zip((r, g, b), bg))


# ---------------------------------------------------------------- server

def serve(root: Path):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(root), **k)

        def log_message(self, *a):
            pass

    probe = socket.socket()
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
    probe.close()

    srv = socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}"


# ---------------------------------------------------------------- measure

def measure(page, img: Image.Image, dpr: float):
    geom = page.evaluate(GEOM_JS, PROBES)

    def px(x, y, r=6):
        return median_patch(img, int(x * dpr), int(y * dpr), r)

    results = []

    waters = [p for p in geom["probes"] if p["kind"] == "water"]
    lands = [p for p in geom["probes"] if p["kind"] == "land"]
    for w in waters:
        for l in lands:
            wc, lc = px(w["x"], w["y"]), px(l["x"], l["y"])
            if wc is None or lc is None:
                continue
            results.append((
                "land/water",
                f"{l['name']} / {w['name']}",
                delta_e(lc, wc),
            ))

    # A label's background varies along its length, so take the worst case:
    # sample a ring just outside the glyph box, where the halo has faded out.
    for lb in geom["labels"][:8]:
        ink = parse_rgb(lb["color"])
        ring = [
            g for g in (
                px(lb["x"] + lb["w"] * fx, lb["y"] + lb["h"] * fy, 4)
                for fx in (-0.25, 0.5, 1.25)
                for fy in (-0.9, 1.9)
            ) if g is not None
        ]
        if not ring:
            continue
        worst = min(ring, key=lambda g: ratio(ink, g))
        results.append(("label/ground", lb["name"][:22], ratio(ink, worst)))

    # A pin is a coloured disc inside a near-white ring. 1.4.11 asks whether
    # the component is distinguishable from what is adjacent to it, and on a
    # dark map it is the ring that does that work, not the fill — so score
    # the stronger of the two boundaries the pin actually presents.
    for mk in geom["markers"][:6]:
        ground = px(mk["x"] + mk["w"] * 1.4, mk["y"], 4)
        if ground is None:
            continue
        fill = parse_rgb(mk["color"])
        ring = composite(parse_rgba(mk["ring"]), fill)
        results.append((
            "marker/ground", "event pin",
            max(ratio(fill, ground), ratio(ring, ground)),
        ))

    return results


def run(theme: str, width: int, height: int, shots: Path):
    srv, base = serve(ROOT)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
                color_scheme=theme,
                reduced_motion="reduce",
            )
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"{base}/index.html#/kart", wait_until="networkidle")
            # Wait for the GROUND, not for a timer. The basemap level is
            # fetched from inside the first draw, so "network idle" can happen
            # before the land exists — and a screenshot taken then samples
            # water everywhere and reports land and sea as identical.
            page.wait_for_function(
                "async () => (await import('/js/map.js')).getMap()?.ready() === true",
                timeout=20000)
            page.wait_for_timeout(900)

            shots.mkdir(parents=True, exist_ok=True)
            shot = shots / f"contrast-{theme}.png"
            page.screenshot(path=str(shot))
            results = measure(page, Image.open(shot), dpr=2)

            ctx.close()
            browser.close()
        return results, errors, shot
    finally:
        srv.shutdown()


def run_story(theme: str, width: int, height: int, shots: Path):
    """
    Measure the story stage, which the Explore-mode run never reaches.

    Same idea, different page: boot the chapter, seek to the beat that puts all
    thirteen colonies on screen, and sample each one where its own name sits.
    """
    geo = CHECKS.get("areas")
    if not geo or not geo.exists() or not CHECKS.get("chapter") or not CHECKS["beat"][0]:
        return [], [], None
    pairs = adjacent_colonies(geo)

    srv, base = serve(ROOT)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
                color_scheme=theme,
                reduced_motion="reduce",
            )
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"{base}/index.html", wait_until="networkidle")
            page.wait_for_function(
                "() => !!document.querySelector('#story-map') && !document.querySelector('.boot')",
                timeout=20000)
            page.evaluate("() => document.querySelector('.story__cover')"
                          "?.classList.remove('is-on')")
            page.wait_for_function(
                "async () => (await import('/engine/scenes/map.js')).getStoryMap()?.ready() === true",
                timeout=20000)
            page.wait_for_timeout(900)
            chapter_id = (CHECKS.get("chapter") or "").split("/")[-1]
            spots = page.evaluate(COLONIES_JS,
                                  [*CHECKS["beat"], chapter_id])
            page.wait_for_timeout(400)

            shots.mkdir(parents=True, exist_ok=True)
            shot = shots / f"colonies-{theme}.png"
            page.screenshot(path=str(shot))
            img = Image.open(shot)

            # Small radius on purpose. Rhode Island is a handful of pixels
            # across at phone width, and a patch wide enough to be comfortable
            # would average in its neighbours and report them as identical.
            seen = {}
            drawn = {sp['name']: sp for sp in spots}
            for sp in spots:
                patch = median_patch(img, int(sp["x"] * 2), int(sp["y"] * 2), 2)
                if patch is not None:
                    seen[sp["name"]] = patch

            ctx.close()
            browser.close()

        # Which neighbouring pairs are REQUIRED to be distinguishable.
        #
        # Two areas the chapter drew as one deliberate bloc are not a defect:
        # `vary: false` says "this shot is about the side, not the areas", and
        # Antony's five eastern provinces are supposed to read as one thing.
        # Two areas on the same side with `vary` ON are the opposite case —
        # thirteen colonies the reader has to tell apart — and there a
        # collision IS the defect. Nothing about that can be read off the
        # geometry; it is what the chapter asked the map to draw.
        results, blocs = [], 0
        for a, b in pairs:
            if a not in seen or b not in seen:
                continue
            fa, fb = drawn.get(a, {}), drawn.get(b, {})
            same_side = fa.get("faction") is not None and fa.get("faction") == fb.get("faction")
            if same_side and not (fa.get("vary") and fb.get("vary")):
                blocs += 1
                continue
            results.append(("colony/colony", f"{a} / {b}",
                            delta_e(seen[a], seen[b])))
        if blocs:
            print(f"  ({blocs} neighbouring pair(s) drawn as one bloc on purpose "
                  f"— vary: false — and not compared)")
        if not results and not blocs:
            errors.append("no colonies were on screen at the sampled beat")
        return results, errors, shot
    finally:
        srv.shutdown()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", default=None,
                    help="which pack to sample; default is the first in content/packs.json")
    ap.add_argument("--theme", choices=["light", "dark", "both"], default="both")
    ap.add_argument("--width", type=int, default=390)
    ap.add_argument("--height", type=int, default=844)
    ap.add_argument("--shots", type=Path, default=ROOT / "shots" / "contrast")
    ap.add_argument("--strict", action="store_true",
                    help="hold land/water to the authored-basemap target (dE 12)")
    args = ap.parse_args()

    global CHECKS
    packs = packs_on_disk()
    pack = args.pack or (packs[0] if packs else None)
    if not pack:
        print("no packs in content/ — nothing to check", file=sys.stderr)
        return 2
    CHECKS = pack_checks(pack)
    print(f"pack: {pack}")

    if args.strict:
        THRESHOLDS["land/water"] = (12.0, THRESHOLDS["land/water"][1])

    themes = ["light", "dark"] if args.theme == "both" else [args.theme]
    failed = False

    for theme in themes:
        results, errors, shot = run(theme, args.width, args.height, args.shots)
        story, story_errors, _ = run_story(theme, args.width, args.height, args.shots)
        results += story
        errors += story_errors
        head = f"  {theme.upper()}  ({args.width}x{args.height})   {shot}"
        print(f"\n{'=' * len(head)}\n{head}\n{'=' * len(head)}")

        if errors:
            failed = True
            print("  page errors:")
            for e in errors:
                print(f"    ! {e}")

        for pair, (threshold, basis) in THRESHOLDS.items():
            rows = [r for r in results if r[0] == pair]
            if not rows:
                print(f"\n  {pair}: no samples")
                continue
            worst = min(r[2] for r in rows)
            ok = worst >= threshold
            failed |= not ok
            print(f"\n  {pair}   worst {worst:5.2f}  need {threshold:.2f}   "
                  f"[{'PASS' if ok else 'FAIL'}]")
            print(f"    {basis}")
            for _, label, val in sorted(rows, key=lambda r: r[2])[:4]:
                print(f"    {' ' if val >= threshold else '!'} {val:5.2f}  {label}")

    print()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
