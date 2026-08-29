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
    # The pin has a keyline and survives a weak fill; nothing carries a march,
    # an arrow or a front, which are strokes in this colour and nothing else.
    "fill/ground":   (3.0,  "WCAG 2.2 1.4.11 — the colour every stroke is drawn in"),
    # The caption carries the words when the audio does not (rule 3), so it is
    # body text and takes the body-text number. Measured on the UNSAID ink,
    # which is most of every line at any instant.
    "caption/veil":  (4.5,  "WCAG 2.2 AA — the caption is a reading surface"),
}

# THE COLOUR EVERY STROKE IS DRAWN IN, read off the page rather than off a
# screenshot. A march, an arrow and a front are one-pixel-ish strokes with
# antialiasing on both edges, so a sampled pixel is a blend of the colour and
# the ground and cannot answer this. The palette publishes what it decided on
# :root as --f-<side>, which IS the colour, so ask that.
FILLS_JS = """
() => {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const probe = document.createElement('span');
  probe.style.display = 'none';
  root.appendChild(probe);
  const resolve = (value) => {
    probe.style.color = 'rgb(1, 2, 3)';
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const out = {
    ground: resolve(cs.getPropertyValue('--atlas-land').trim() || '#f4ecd8'),
    fills: [],
  };
  for (const name of root.style) {
    if (!name.startsWith('--f-') || name.endsWith('-wash')) continue;
    const value = root.style.getPropertyValue(name).trim();
    if (value) out.fills.push({ id: name.slice(4), colour: resolve(value) });
  }
  probe.remove();
  return out;
}
"""

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
# Which subject to open. With more than one pack shipped, index.html shows the
# chooser first and no map is ever created -- the probe then reads toScreen off
# null. `?emne=` is how a headless driver says which subject it came for; it is
# the same parameter the chooser writes when a person picks one.
PACK = None


def app_url(base, hash_part=""):
    q = f"?emne={PACK}" if PACK else ""
    return f"{base}/index.html{q}{hash_part}"


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


def plate_beat(pack, chapter_ref):
    """A beat with a picture up, for the caption's hard case.

    The caption is --paper-veil with a backdrop blur, so what its ink is read
    against is whatever is BEHIND it — and the worst case is a full-frame
    picture, not the map. Measuring only the pack's contrast beat measures the
    easy one. Picks the second beat of the first plate span that lasts more than
    one beat: the second, because the first is the beat the plate fades in on
    and the veil would be sampled mid-dissolve.
    """
    if not chapter_ref:
        return None
    pack_id, _, cid = chapter_ref.partition("/")
    path = ROOT / "content" / pack_id / f"{cid}.json"
    if not path.exists():
        return None
    chapter = json.loads(path.read_text(encoding="utf-8"))
    for scene in chapter.get("scenes", []):
        beats = scene.get("beats", [])
        open_at = None
        for i, b in enumerate(beats):
            for cue in b.get("cues", []):
                if cue["do"] == "plate.show":
                    open_at = i
                elif cue["do"] == "plate.hide":
                    open_at = None
            if open_at is not None and i > open_at and (b.get("say") or {}):
                return b["id"]
    return None


def packs_on_disk():
    listed = ROOT / "content" / "packs.json"
    if listed.exists():
        return json.loads(listed.read_text(encoding="utf-8"))
    return sorted(d.name for d in (ROOT / "content").iterdir()
                  if d.is_dir() and not d.name.startswith("_"))

CHECKS: dict = {}

# THE CAPTION IS A READING SURFACE, and rule 3 says it carries the words when
# the audio does not — so it has to pass as one. The ink is --ink-soft until a
# word is spoken and --ink after, and the box is --paper-veil with a backdrop
# blur, which means its background is the PICTURE behind it and changes beat by
# beat. That is why this is measured on pixels and not computed from tokens:
# BACKLOG.md has carried "3.91 against AA 4.5" for weeks, and the tokens alone
# give 5.58 over the brightest plate. Neither number was measured on the thing.
#
# Sampling: in the gap BETWEEN two words on the same line, which is background
# with ink either side of it, and failing that the box's own side padding. Not
# a ring around the glyph like a map label — the lines are snug enough that
# above and below is the next line of text.
CAPTION_JS = """
() => {
  const box = document.querySelector('.captions');
  if (!box) return null;
  const r = box.getBoundingClientRect();
  if (!r.width || parseFloat(getComputedStyle(box).opacity) < 0.5) return null;
  const spans = [...box.querySelectorAll('.captions__line span')]
    .map((el) => ({
      el,
      said: el.classList.contains('is-said') || el.classList.contains('is-now'),
      color: getComputedStyle(el).color,
      r: el.getBoundingClientRect(),
    }))
    .filter((s) => s.r.width > 2 && s.r.height > 2);
  const out = { box: { x: r.left, y: r.top, w: r.width, h: r.height }, words: [] };
  for (let i = 0; i < spans.length; i += 1) {
    const s = spans[i], n = spans[i + 1];
    const spots = [];
    if (n && Math.abs(n.r.top - s.r.top) < 2 && n.r.left - s.r.right > 5) {
      spots.push([(s.r.right + n.r.left) / 2, s.r.top + s.r.height / 2]);
    }
    spots.push([r.left + 6, s.r.top + s.r.height / 2]);
    spots.push([r.right - 6, s.r.top + s.r.height / 2]);
    out.words.push({ text: s.el.textContent.trim().slice(0, 18),
                     said: s.said, color: s.color, spots });
  }
  return out;
}
"""

SEEK_JS = """
async ([beatId, offset, chapterId]) => {
  const S = await import('/engine/story.js');

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
  let at = offset, sceneIndex = 0, found = false;
  ch.scenes.forEach((s, i) => {
    for (const b of s.beats) if (b.id === beatId) {
      at = b.start + offset; sceneIndex = i; found = true;
    }
  });
  await p.goToScene(sceneIndex, { autoplay: false, at });
  S.storyInvalidate();
  await new Promise(r => setTimeout(r, 900));
  return { chapter: ch.id, beat: found ? beatId : null, at };
}
"""


# What the STORY stage is showing right now: the place names and the pins the
# chapter has put on the map.
#
# These were never measured. `measure()` reads `.place` and `.mk__body`, which
# are Explore's classes, on Explore's page — and only american-revolution has
# an events.json for Explore to draw. So three of the four packs reported "no
# samples" for label and marker contrast and exited 0, while the story stage
# they actually ship went unmeasured. The story stage draws `.atlas-place` and
# `.atlas-pin`, from map/index.js.
OVERLAY_JS = """
() => {
  const host = document.querySelector('#story-map');
  if (!host) return { labels: [], markers: [] };
  const box = host.getBoundingClientRect();
  // The CENTRE inside the map, not the whole box. `.atlas-place` is
  // white-space: nowrap with the text running to the right of its anchor, so
  // a town near the right edge legitimately overhangs — requiring the whole
  // rect inside threw away most of the labels on a 390 px screen and reported
  // "no samples" on a map covered in names.
  const inside = (r) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return cx > box.left + 8 && cx < box.right - 8
        && cy > box.top + 8 && cy < box.bottom - 8;
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none'
        && parseFloat(cs.opacity) >= 0.3;
  };
  const out = { labels: [], markers: [] };

  for (const el of host.querySelectorAll('.atlas-place')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !shown(el) || !inside(r)) continue;
    out.labels.push({ name: el.textContent.trim(), x: r.left, y: r.top,
                      w: r.width, h: r.height,
                      color: getComputedStyle(el).color });
  }
  // The dot, not the chip: the chip is a halo-coloured plate with its own
  // border, and what has to stand out from the ground is the coloured disc
  // that says which side this is.
  for (const el of host.querySelectorAll('.atlas-pin i')) {
    const pin = el.closest('.atlas-pin');
    const r = el.getBoundingClientRect();
    if (!r.width || !shown(pin) || !inside(r)) continue;
    const cs = getComputedStyle(el);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

    /* WHERE THE GROUND IS, decided here rather than in Python.
       The Python side used to sample one point at cx + w * 1.4 — about
       15 px to the RIGHT of an 11 px dot — and a pin is a dot followed by
       a chip, so that sample landed INSIDE the pin's own opaque plate and
       scored the marker against itself. It read 3.27 and passed. The moment
       labels learned to flip left, that same sample finally hit real ground
       and the true number turned out to be 2.94, which fails.

       So: eight points on a ring outside the dot, and anything that falls in
       the pin's own box is discarded. The pin's box is known HERE and is not
       knowable from a screenshot, which is why this moved. */
    const box = pin.getBoundingClientRect();
    const rad = r.width * 1.4;
    const ground = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const gx = cx + Math.cos(a) * rad, gy = cy + Math.sin(a) * rad;
      if (gx >= box.left - 2 && gx <= box.right + 2
       && gy >= box.top - 2 && gy <= box.bottom + 2) continue;
      if (!inside({ left: gx, right: gx, top: gy, bottom: gy,
                    width: 1, height: 1 })) continue;
      ground.push([gx, gy]);
    }
    out.markers.push({ x: cx, y: cy, w: r.width,
                       color: cs.backgroundColor, ring: cs.borderTopColor,
                       ground });
  }
  return out;
}
"""


COLONIES_JS = """
async () => {
  const M = await import('/engine/scenes/map.js');
  const map = M.getStoryMap();
  // A chapter with `ground: none` mounts no map surface, so there is no map
  // instance either — and there are no regions to compare. Checked BEFORE
  // touching it: the guard further down was on the host element, which is one
  // line too late to stop map.redraw() throwing.
  if (!map) return [];
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
  hide.textContent = '.atlas-place, .atlas-pin { visibility: hidden !important; }';
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

def measure_labels(labels, px, where: str, tight: bool = False):
    """Ink against the ground it sits on, for whichever overlay drew it.

    Two overlays draw place names — Explore's `.place` and the story stage's
    `.atlas-place` — and until this was split out only the first was ever
    measured. `where` is what the report calls them, so a failure says which
    picture it came from.

    `tight` samples two pixels off the box instead of a whole line-height,
    which is what the story stage needs: that map carries a mood wash and a
    vignette, its region names sit at region centres, and a sample fifteen
    pixels away was landing in the Atlantic.

    READ THE NOTE ON WHY THE STORY NUMBERS ARE ADVISORY, below, before
    treating either as a pass or a fail.
    """
    out = []
    for lb in labels[:8]:
        ink = parse_rgb(lb["color"])
        if tight:
            spots = [(lb["x"] - 2, lb["y"] + lb["h"] / 2),
                     (lb["x"] + lb["w"] + 2, lb["y"] + lb["h"] / 2),
                     (lb["x"] + lb["w"] / 2, lb["y"] - 2),
                     (lb["x"] + lb["w"] / 2, lb["y"] + lb["h"] + 2)]
            ring = [g for g in (px(x, y, 2) for x, y in spots) if g is not None]
        else:
            # A label's background varies along its length, so take the worst
            # case: a ring just outside the glyph box, where the halo has
            # faded out.
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
        out.append(("label/ground", f"{where} {lb['name'][:22]}", ratio(ink, worst)))
    return out


def measure_caption(cap, px, where: str):
    """The caption's ink against the box it is written in.

    Only the UNSAID words. They are the ones at --ink-soft, and they are most
    of every line at any instant — a sentence is mostly not spoken yet, which
    is the whole reason the caption was moved off --ink-faint once already.
    """
    if not cap:
        return []
    out = []
    for w in cap["words"]:
        if w["said"]:
            continue
        ink = parse_rgb(w["color"])
        grounds = [g for g in (px(x, y, 2) for x, y in w["spots"]) if g is not None]
        if not grounds:
            continue
        worst = min(grounds, key=lambda g: ratio(ink, g))
        out.append(("caption/veil", f"{where} '{w['text']}'", ratio(ink, worst)))
    return out


def measure_markers(markers, px, where: str):
    # A pin is a coloured disc inside a near-white ring. 1.4.11 asks whether
    # the component is distinguishable from what is adjacent to it, and on a
    # dark map it is the ring that does that work, not the fill — so score
    # the stronger of the two boundaries the pin actually presents.
    #
    # The GROUND points come from the browser, not from arithmetic here: a
    # single guessed offset landed inside the pin's own chip and scored the
    # marker against itself for as long as pins only ever pointed right. See
    # the comment beside `ground` in STORY_JS. The worst honest sample wins,
    # because a pin has to stand out from all of the ground it sits on and not
    # just from the most flattering side of it.
    out = []
    for mk in markers[:6]:
        offered = mk.get("ground") or [[mk["x"] + mk["w"] * 1.4, mk["y"]]]
        grounds = [g for g in (px(x, y, 3) for x, y in offered) if g is not None]
        if not grounds:
            continue
        fill = parse_rgb(mk["color"])
        ring = composite(parse_rgba(mk["ring"]), fill)
        # The MEDIAN of the ring, not its worst pixel. Barbaresco's dot sits
        # beside the Tanaro, and one of eight probes lands in the river: gold
        # against water scores 1.54 and would fail the pack on a line of blue
        # two pixels wide. The median is the ground the pin actually sits on.
        # (Worst-of-eight was tried first and is recorded here because it is
        # the tempting answer: strictness that measures an artefact is not
        # strictness, it is noise, and noise is what gets a check skipped.)
        scores = sorted(max(ratio(fill, g), ratio(ring, g)) for g in grounds)
        out.append(("marker/ground", where, scores[len(scores) // 2]))
    return out


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

    results += measure_labels(geom["labels"], px, "explore")
    results += measure_markers(geom["markers"], px, "explore pin")
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
            page.goto(app_url(base, "#/kart"), wait_until="networkidle")
            # Wait for the GROUND, not for a timer. The basemap level is
            # fetched from inside the first draw, so "network idle" can happen
            # before the land exists — and a screenshot taken then samples
            # water everywhere and reports land and sea as identical.
            page.wait_for_function(
                "async () => (await import('/js/map.js')).getMap()?.ready() === true",
                timeout=20000)
            page.wait_for_timeout(900)

            # A NEIGHBOURING LABEL IS NOT GROUND. This is the third time the
            # same mistake has been found in this file: the ground was once
            # sampled inside the pin's own chip, and once 15 px right of a dot
            # that had a chip there — and here, one line-height above a
            # `.place` name, which on this map is where the ATLAS draws its
            # region names. Explore paints both label systems at once
            # (js/map.js: period names as `.place` pins, colony names through
            # map.regions), they do not declutter against each other, and
            # "Carolinaene" sits a line under "Nord-Carolina".
            #
            # Measured, on the same frame, dark: the sample ring read 1.67
            # against the glyphs of the atlas label and 4.83 against the ground
            # once they were taken off. That is the same 4.83 the region behind
            # it always scored — so the number was never about legibility, it
            # was about which pixels got called ground. run_story() has hidden
            # `.atlas-place` before ITS ground read since it was written, with
            # this reasoning attached; the Explore run simply never did, and
            # got away with it while the atlas type was two points smaller.
            #
            # `.place` stays visible: it is what measure_labels() is here to
            # measure. Only the other overlay's names go.
            page.add_style_tag(content=".atlas-place{visibility:hidden !important}")
            page.wait_for_timeout(400)

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

    It measures the stage's LABELS and PINS at the same beat too, on a shot
    taken before the names are hidden for the region pass. That is not an
    extra: `measure()` reads Explore's `.place` and `.mk__body`, and only
    american-revolution ships an events.json for Explore to draw — so three
    packs out of four reported "no samples" for label and marker contrast
    while their story stage, the thing the app actually is, had never been
    looked at.
    """
    if not CHECKS.get("chapter") or not CHECKS["beat"][0]:
        return [], ["pack.json declares no checks.contrast chapter/beat, so the "
                    "story stage cannot be sampled at all"], None
    geo = CHECKS.get("areas")
    pairs = adjacent_colonies(geo) if geo and geo.exists() else []

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
            page.goto(app_url(base), wait_until="networkidle")
            page.wait_for_function(
                # See check-scene-plate.py: the map host is not a readiness
                # signal once a chapter can declare it has no ground.
                "() => !!document.querySelector('.story__stage') "
                "&& !document.querySelector('.boot')",
                timeout=20000)
            page.evaluate("() => document.querySelector('.story__cover')"
                          "?.classList.remove('is-on')")
            page.wait_for_function(
                "async () => (await import('/engine/scenes/map.js')).getStoryMap()?.ready() === true",
                timeout=20000)
            page.wait_for_timeout(900)
            chapter_id = (CHECKS.get("chapter") or "").split("/")[-1]
            landed = page.evaluate(SEEK_JS, [*CHECKS["beat"], chapter_id])
            page.wait_for_timeout(400)
            shots.mkdir(parents=True, exist_ok=True)

            if landed.get("beat") is None:
                errors.append(
                    f"pack.json names checks.contrast.beat "
                    f"'{CHECKS['beat'][0]}', which is not in {chapter_id} — "
                    f"the sample was taken at the start of scene 0 instead")

            # The stage as a viewer sees it, names and pins included. Taken
            # BEFORE the region pass hides them, because hiding them is what
            # the region pass needs and reading them is what this needs.
            over_shot = shots / f"story-{theme}.png"
            page.screenshot(path=str(over_shot))
            over_img = Image.open(over_shot)
            overlay = page.evaluate(OVERLAY_JS)

            def over_px(x, y, r=6):
                return median_patch(over_img, int(x * 2), int(y * 2), r)

            # WHY THE STORY LABELS ARE ADVISORY AND THE PINS ARE NOT.
            #
            # `label/ground` asks a WCAG question — ink against background —
            # and that question only means something when the ink sits
            # directly on the ground. Explore's `.place` does.
            # `.atlas-place` does not: it carries an opaque halo,
            # `rgba(252,247,235,.96)` repeated seven times
            # (css/atlas.css:158), so what the letters are read against is the
            # halo and not the map. Measured both ways on all four packs, the
            # story labels score 1.0–2.8 — and that number is neither a pass
            # nor a fail, it is the wrong measurement: two pixels off the box
            # is past the halo and on the mood wash, and the letters
            # themselves are never sampled at all.
            #
            # The honest assertion for a haloed label is whether the halo is
            # actually opaque where the glyphs are, which is a different
            # measurement and belongs with the type and label pass that owns
            # `.atlas-place` anyway. So the numbers are TAKEN and PRINTED —
            # nobody can say "no samples" again — and they do not gate a
            # build until the method is calibrated against the real thing.
            #
            # THE STORY PINS ARE GATED, AND THE RING IS WHY.
            #
            # `measure_markers` scores max(fill, ring) on the argument that a
            # pin presents two boundaries and the stronger one is what you see.
            # That argument was sound and the ring was not doing it: the border
            # was `--atlas-halo`, which is near-white on light ground and
            # near-black on dark, so it was always about the same value as the
            # ground. Measured against `--atlas-land`: 1.11 light, 2.15 dark.
            # It separated nothing, and the fills alone do not clear 3:1 on the
            # three packs whose factions are hue-derived — 2.19-2.68 — because
            # core/palette.js picks a fill lightness against no contrast target
            # at all. A dark-red dot on dark-olive ground read as a smudge.
            #
            # The ring is `--atlas-ink` now, which is the opposite of the
            # ground by definition in both themes: 14.54 and 8.13. Every pack
            # clears with room (6.01 worst), so this is gated rather than
            # advisory. It is also what a printed map does — a coloured disc
            # with a dark keyline.
            #
            # None of this was visible until pins learned to flip to the left
            # of their anchor. Before that the "ground" was sampled 15 px RIGHT
            # of the dot, inside the pin's own opaque chip, so a pin was scored
            # against its own plate and read 3.27.
            #
            # STILL OWED, and not by this file: the FILLS remain low-contrast
            # on the hue-derived packs. The ring carries the pin; nothing
            # carries a march, an arrow or a front, which are strokes in the
            # same colours. That is the colour pass. See BACKLOG.md.
            caption = page.evaluate(CAPTION_JS)
            story_results = (
                measure_labels(overlay["labels"], over_px,
                               "story", tight=True)
                + measure_markers(overlay["markers"], over_px, "story pin")
                + measure_caption(caption, over_px, "caption"))
            story_results = [
                (("label/ground~story" if p == "label/ground" else p), w, v)
                for p, w, v in story_results]

            # The palette itself, which no screenshot can answer: see FILLS_JS.
            # Read while the chapter's own pack is published on :root — a
            # second pack has different sides, and engine/story.js republishes
            # them per chapter.
            palette = page.evaluate(FILLS_JS)
            ground = parse_rgb(palette["ground"])
            for f in palette["fills"]:
                rgb = parse_rgb(f["colour"])
                if ground is None or rgb is None:
                    continue
                # `tone:` is a palette ROLE — gold is the look-here colour
                # whatever the subject is — and those four are hand-tuned
                # tokens shared with the DOM. Measured and printed, not gated:
                # moving them moves every red in the app, which is a design
                # decision and not a checker's.
                pair = "fill/ground~tone" if f["id"].startswith("tone-")                     else "fill/ground"
                story_results.append((pair, f["id"], ratio(rgb, ground)))

            # THE CAPTION'S HARD CASE, which the contrast beat is not: a
            # full-frame picture behind the blur instead of the map. Seek a
            # second time, sample only the caption, and keep whichever of the
            # two frames scored worse. Costs one seek and one screenshot.
            plate_at = plate_beat(PACK, CHECKS.get("chapter"))
            if plate_at:
                page.evaluate(SEEK_JS, [plate_at, 2.5, chapter_id])
                page.wait_for_timeout(700)
                plate_shot = shots / f"caption-{theme}.png"
                page.screenshot(path=str(plate_shot))
                plate_img = Image.open(plate_shot)
                cap2 = page.evaluate(CAPTION_JS)
                story_results += measure_caption(
                    cap2,
                    lambda x, y, r=2: median_patch(plate_img, int(x * 2),
                                                   int(y * 2), r),
                    "caption over a picture")
                # …and back, because everything below samples the first frame.
                page.evaluate(SEEK_JS, [*CHECKS["beat"], chapter_id])
                page.wait_for_timeout(500)

            spots = page.evaluate(COLONIES_JS)
            page.wait_for_timeout(400)

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
        results, blocs = list(story_results), 0
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
        if pairs and not blocs and not any(r[0] == "colony/colony" for r in results):
            # A note, not a page error. Whether this is a defect depends on
            # whether the pack claims colony/colony is measurable, and only
            # main() knows that — a pack whose beat legitimately shows three
            # regions that do not touch is not broken, it is ungated, and
            # main() says so far more usefully than an exception would.
            print(f"  (no adjacent pair of named areas was on screen at "
                  f"{CHECKS['beat'][0]} +{CHECKS['beat'][1]:.1f}s — either the "
                  f"beat draws none, the ones it draws do not touch, or their "
                  f"region.show cues are anchored to a word that lands later)")
        return results, errors, shot
    finally:
        srv.shutdown()


# ------------------------------------------------------------ what to expect
#
# "no samples" used to print and exit 0, and that is how this tool came to be
# measuring ONE assertion on ONE pack. check-all.py ran it with no --pack, the
# fallback is packs[0], content/packs.json[0] became "roman-empire" when the
# order changed, and three of its four lines read "no samples" — silently, for
# months, from the tool that exists BECAUSE the map was unreadable and nobody
# could point at a number.
#
# A measurement that found nothing to measure is not a pass. But it is not
# automatically a failure either: roman-empire ships no Explore events, and
# norway-1940 draws no named areas at all, so demanding every measurement from
# every pack would produce four permanent red lines that mean nothing.
#
# So each pack DECLARES what it can be held to, and anything declared that
# comes back empty fails and says which sample it could not take. The
# declaration belongs in the pack — `checks.contrast.expect` in pack.json is
# read first, and a pack that says nothing falls back to the table here. That
# fallback is a stopgap, not the design: content/*/pack.json is where "this
# subject has no pins" belongs, next to the beat that says where to point the
# camera. Moving these four lines there is a content edit, and it should be
# made.
# WHAT EACH PACK IS HELD TO — and `marker/ground` is not on three of these
# lists, deliberately, with a date on it.
#
# `marker/ground` in this table means EXPLORE's pins. Only american-revolution
# ships an events.json, so only it has any. The STORY stage's pins are measured
# for every pack — that is new — and reported as `marker/ground~story` outside
# this table, because they currently fail: 2.19-2.68 in at least one theme on
# the three packs whose factions are hue-derived, against a 3:1 floor. That is
# core/palette.js choosing a fill lightness against no contrast target at all,
# it predates the measurement, and fixing it moves every artifact colour in
# three packs. It belongs to the colour pass. The numbers print loudly on every
# run and `--strict` gates them today.
#
# So two packs below are gated on nothing, and the tool says so out loud each
# time. That is worse than a gate and much better than the false PASS this
# table used to record, which came from sampling the ground INSIDE the pin.
EXPECT_DEFAULT = {
    "american-revolution": ["land/water", "label/ground", "marker/ground",
                            "colony/colony", "fill/ground", "caption/veil"],
    # Its contrast beat is now s5.b2 — the Langhe, with Barolo and Barbaresco
    # pinned — which is the frame the readability complaint is about. The pins
    # are measured and printed; they are not a gate until the palette pass.
    "italy-wine": ["marker/ground", "fill/ground", "caption/veil"],
    # No pools.areas — this subject draws no named administrative areas, only
    # the fjord and the pins in it.
    "norway-1940": ["marker/ground", "fill/ground", "caption/veil"],
    "roman-empire": ["marker/ground", "colony/colony", "fill/ground",
                     "caption/veil"],
}

# Why a measurement is not asked of a pack. Printed instead of the number, so
# the report says what it is not measuring and why, rather than going quiet.
WHY_NOT = {
    "land/water": "Explore-only, and its probes are authored at this subject's "
                  "coordinates — only american-revolution has both",
    "label/ground": "Explore-only. The story stage's labels are haloed, which is "
                    "not a WCAG ink-on-ground case — their numbers are printed "
                    "below as advisory",
    "marker/ground": "the beat this pack points the camera at shows no pins",
    "fill/ground": "the palette publishes no --f-* on this pack, which means no "
                   "faction was ever resolved",
    "caption/veil": "no caption was on screen at this pack's contrast beat, or "
                    "every word of it had already been spoken",
    "colony/colony": "no two named areas that share a border are on screen at "
                     "this pack's contrast beat (norway-1940 declares no "
                     "pools.areas at all)",
}


def expectations(pack: str) -> list[str]:
    mf = ROOT / "content" / pack / "pack.json"
    manifest = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
    declared = ((manifest.get("checks") or {}).get("contrast") or {}).get("expect")
    if declared is not None:
        return list(declared)
    return EXPECT_DEFAULT.get(pack, list(THRESHOLDS))


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

    global CHECKS, PACK
    packs = packs_on_disk()
    pack = args.pack or (packs[0] if packs else None)
    if not pack:
        print("no packs in content/ — nothing to check", file=sys.stderr)
        return 2
    PACK = pack

    # A course being PLANNED has an outline and a pack.json and no chapters at
    # all, which is a legitimate state and not an empty measurement. `?emne=`
    # opens it, nothing loads because there is nothing to load, and the probe
    # then reads `toScreen` off a null map — the same crash the note above
    # records for the chooser, arriving by a different road. Say so and stop;
    # there is no picture yet to have a contrast.
    if not sorted((ROOT / "content" / pack).glob("chapter-*.json")):
        print(f"pack: {pack}   no chapters yet — nothing on screen to sample")
        return 0

    CHECKS = pack_checks(pack)
    expect = expectations(pack)
    print(f"pack: {pack}   expects: {', '.join(expect) or 'NOTHING'}")
    if not expect:
        # Said out loud every run. A pack held to no measurement at all is the
        # state this whole file was written to make impossible to reach
        # quietly — it just cannot be fixed from inside a checker.
        print(f"  !! '{pack}' is gated on no measurement at all. Point "
              f"checks.contrast.beat in content/{pack}/pack.json at a beat "
              f"that shows pins or two adjacent named areas, and declare "
              f"checks.contrast.expect beside it.")

    if args.strict:
        THRESHOLDS["land/water"] = (12.0, THRESHOLDS["land/water"][1])

    themes = ["light", "dark"] if args.theme == "both" else [args.theme]
    failed = False

    for theme in themes:
        # Explore is a second browser boot and only american-revolution has an
        # events.json for it to draw. Skip it when nothing it measures is
        # expected, rather than spending a minute to report "no samples".
        if "land/water" in expect:
            results, errors, shot = run(theme, args.width, args.height, args.shots)
        else:
            results, errors, shot = [], [], None
        story, story_errors, story_shot = run_story(
            theme, args.width, args.height, args.shots)
        results += story
        errors += story_errors
        shot = shot or story_shot
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
                if pair in expect:
                    failed = True
                    print(f"\n  {pair}: NO SAMPLES on '{pack}'   [FAIL]")
                    print(f"    {pack} declares this measurable and nothing was "
                          f"found to measure. Either the beat pack.json points "
                          f"the camera at no longer shows it, or it should come "
                          f"out of checks.contrast.expect.")
                else:
                    print(f"\n  {pair}: not measured on '{pack}' — "
                          f"{WHY_NOT.get(pair, 'not declared in expect')}")
                continue
            worst = min(r[2] for r in rows)
            ok = worst >= threshold
            failed |= not ok
            print(f"\n  {pair}   worst {worst:5.2f}  need {threshold:.2f}   "
                  f"[{'PASS' if ok else 'FAIL'}]")
            print(f"    {basis}")
            for _, label, val in sorted(rows, key=lambda r: r[2])[:4]:
                print(f"    {' ' if val >= threshold else '!'} {val:5.2f}  {label}")

        tone_adv = [r for r in results if r[0] == "fill/ground~tone"]
        if tone_adv:
            print("")
            print("  the four palette ROLES against the ground (ADVISORY — "
                  "hand-tuned tokens shared with the DOM; see run_story)")
            for _, label, val in sorted(tone_adv, key=lambda r: r[2])[:4]:
                print(f"    {' ' if val >= 3.0 else '!'} {val:5.2f}  {label}")

        # Measured, printed, not gated — see the note in run_story().
        labels_adv = [r for r in results if r[0] == "label/ground~story"]
        if labels_adv:
            print("")
            print("  label/ground on the story stage (ADVISORY — a haloed "
                  "label is not a WCAG ink-on-ground case; see run_story)")
            for _, label, val in sorted(labels_adv, key=lambda r: r[2])[:5]:
                print(f"      {val:5.2f}  {label}")

    print()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
