#!/usr/bin/env python3
"""
When the narration names a place, can the viewer see that place's name?

    .venv/Scripts/python.exe tools/check-legible.py
    .venv/Scripts/python.exe tools/check-legible.py italy-wine/chapter-1-piemonte
    .venv/Scripts/python.exe tools/check-legible.py --lang en --strict
    .venv/Scripts/python.exe tools/check-legible.py --selftest

CLAUDE.md says the "does the picture show the thing being said" question
cannot be automated, and about the SEMANTIC half that is still true: no tool
reads a sentence. The SPATIAL half is mechanical, and this is it. A name that
is off the edge of a 390 px phone, or underneath a fact card, is not showing
the thing being said either -- and that failure needs no judgement at all,
only a rectangle.

THE DEFECT THIS EXISTS FOR

Measured at 390x844 on italy-wine chapter-1-piemonte, scene s5, over the line
"Barolo ligger sørvest for Alba. Barbaresco ligger nordøst":

    Barbaresco   anchor x=363 of 390, label 374 -> 455
                 65 px of 80 hanging off the right edge
    Barolo       label 39 -> 94, y 528 -> 555 -- on screen, and entirely
                 inside .ov-fact__card at 12 -> 189, y 514 -> 597

Two different faults with the same symptom (you cannot read the name), and
they want different fixes, so the report tells them apart:

    CLIPPED   the label crosses the edge of the frame it is drawn in. Not the
              viewport: the map host is 110 px shorter than the screen and
              clips its own overflow, so a name can be comfortably inside the
              window and cut in half by the map. Every clipping ancestor is
              folded in and the report says which one did it.
    COVERED   something painted above the map sits on the name
    MISSING   the cue named the place and there is no readable name at all,
              and the report says which of the three reasons it was: nothing
              was ever drawn, the map placed the name and then dropped it in a
              collision, or the map could not fit it beside its anchor at all
    PLATED    a picture fills the whole frame, so the map is not on screen.
              Counted apart and printed as a bare list, never mixed in with
              the faults: pre-staging the map behind a plate is correct, and a
              line POINTING at the map from behind one is not, and only a
              human can tell which -- the same shape as check-script.py's list
              of plates over a region.show.

Both defects above reproduce exactly against the tree at the time of writing,
and neither does against the working tree an hour later, because both were
being fixed while this was built. That is the fix landing, not the tool
breaking: run it against `git archive HEAD` unpacked into a scratch tree and
served by tools/serve.py to get a defect back.

WHAT IT DRIVES

The real app, in a real browser, at a phone viewport. For every cue that
NAMES a place it seeks to the instant that cue fires, waits for the camera and
the overlay pass, and measures getBoundingClientRect() on the label the map
actually drew.

WHICH CUES NAME A PLACE -- read, never hardcoded

The list comes out of engine/verbs.json: every verb that is not a `.hide` or
a `.clear` and declares an argument of type `place`, `place[]` or `region[]`.
That is the manifest's whole point. CLAUDE.md records what hardcoding costs:
`marker.show kind` and `place.highlight tone` sat in chapters for months being
read by nobody, because the checker knew a list of verb NAMES and nothing
about their arguments. A verb added tomorrow that points at a place is checked
here the day it is declared, with no edit to this file. The derived list is
printed at the top of every run so you can see what was actually asked.

WHICH OVERLAYS COUNT AS COVERING -- derived, not a guessed selector list

Not `.ov-fact__card, .ov-stats, .captions, ...`. A hand-kept list of selectors
is the same defect one layer up: add an overlay, forget the list, and the tool
reports clean. Instead a grid of points is sampled across the label's own
rectangle and `document.elementsFromPoint()` -- the browser's own answer to
"what is painted here, topmost first" -- is walked down to the label. Anything
found ABOVE the label counts as covering it when all three hold:

  * it is outside the map host. The map's own atmosphere (.atlas__mood,
    .atlas__vignette, .atlas__grain) is appended after the label overlay and
    so paints above it, by design, and the label's own styling is built to be
    read through it. A card mounted by engine/scenes/overlays.js is not.
  * it actually paints: a background colour with alpha, a background image, a
    backdrop-filter, or a replaced element. A transparent positioning wrapper
    has a rectangle over the whole screen and hides nothing.
  * effective opacity x that paint alpha is >= 0.25. Reading `.is-on` off a
    node is not a visibility check -- CLAUDE.md's `.ov-fact` bug was reported
    fixed four times running by probes that asked the DOM what class it had.
    `display`, `visibility` and every ancestor's opacity are folded in, the
    way dev/turn-lab.js and dev/engine-lab.js do it.

Hit testing honours `pointer-events`, and half these overlays set it to none,
so a stylesheet forcing `pointer-events: auto` everywhere is injected first.
Hit order is then reverse paint order, which is exactly the question. This
changes no layout. The selectors that actually turned up are printed with the
findings, so the derivation can be checked against what a human would have
guessed.

Text painted over a label by an overlay with NO background of its own would be
missed. Nothing in this app does that today; it is the known blind spot.

ONE PAGE PER CHAPTER, NOT ONE PER BEAT -- and why that is safe here

tools/check-plate.py reloads for every beat, because its question is about
whether a cue applied live or by rebuild, and that turns on the audio element's
seek semantics: a media element reports where it IS, not where it was told to
go. Label geometry does not. It is a pure function of the rebuilt stage, and
`rebuildTo()` wipes the stage and replays from the top of the scene every time,
so nothing accumulates between probes -- that is rule 1, and if it were false
here the engine would be broken, not this tool. Verified rather than assumed:
`--verify` re-measures a spread of probes on a page booted from scratch for
each one and prints any label whose rectangle moved. 0 of 8 disagreed, and one
page is roughly forty times faster.

WHAT DOES NOT SURVIVE A SEEK, AND HAD TO BE HANDLED

Seeking uses the app's own seek path, `goToScene(i, {autoplay: false, at: t})`,
so the caption box is rendered for the beat being measured. It has to be: the
caption is one of the things that can sit on a name. But goToScene rebuilds
with `soft`, which FADES the outgoing picture over 0.9 s instead of cutting
it -- and removing `is-on` a second time does not cancel a CSS transition that
is already running. So a probe measured 180 ms later was looking at the
PREVIOUS beat's plate at 0.8 opacity, and reported every name under it as
covered. That is precisely the "silently measuring the previous beat" failure,
and it did happen here before it was caught. Two answers, both kept: a hard
rebuild after the soft one (the app's own scrub path), and then a wait until a
fingerprint of everything painted over the map stops changing. The fingerprint
names nothing, so an overlay added later with a slower fade needs no edit.

`page.click()` is not used anywhere. The pointer-events override makes hit
testing follow paint order, which is the whole point -- and a side effect is
that `.sheet-backdrop`, inert in the real app, starts swallowing real clicks.
Synthetic `node.click()` does not hit-test, so the two never meet.

ONE ENGINE QUIRK THE TOOL CORRECTS FOR

`place.highlight` centres the camera on the place -- but engine/surfaces/map.js
skips that under `instant`, so a SEEK to a highlight lands on a different
camera than PLAYING to it does. The camera is deliberately outside the stage
signature dev/engine-lab.html compares (CLAUDE.md says so, and map-lab measures
it instead), so this is not caught anywhere. It matters here, because the
camera decides where the label is: measured on the seek camera, a highlight
would be judged against a frame no viewer ever sees. So the tool re-applies the
centring itself, exactly as a forward play would have left it, and counts how
often it mattered. `--no-camera-fix` turns that off and measures the raw seek
frame, which is a different and also interesting question.

IT REPORTS, AND NEVER FAILS

Exit 0 whatever it finds. Existing content is going to be rewritten, and a
check that blocks a commit on prose that is already known to be in flight
teaches people to skip the check. `--strict` exits 1, so this can be gated the
day the content is clean -- which is the point at which a regression here is
worth stopping a build for.

Needs a server (tools/serve.py -- NOT `python -m http.server`, see CLAUDE.md)
and the chapter's timing files. LAB_BASE overrides the URL, as in the other
browser-driven tools; if nothing is listening it starts its own.
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import sys
import threading
from importlib import util as _importlib_util
from pathlib import Path
from urllib.request import urlopen

# The Windows console is cp1252 and raises on an arrow or a dash. Same line as
# tools/check-all.py:36, same reason.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:                                     # pragma: no cover
    pass

ROOT = Path(__file__).resolve().parent.parent

# The viewport the defect was measured at. A phone, and the narrow one --
# every clipping fault is a fault about width first.
VIEWPORT = (390, 844)

# How much of a label has to be under something before you cannot read it.
# A name grazed at one corner is still a name; a quarter of it gone is not.
COVER_BAD = 0.25
# A rectangle that pokes a pixel over the edge is sub-pixel rounding.
CLIP_BAD = 2.0


# ------------------------------------------------------------------
# The vocabulary, from the manifest and nowhere else
# ------------------------------------------------------------------

def naming_verbs(manifest: dict) -> dict:
    """{verb: [(argument, 'place'|'region', is_list)]} for every verb that
    POINTS AT a named thing. Derived from the declared argument types, so a
    verb added to engine/verbs.json tomorrow is checked tomorrow.

    `.hide` and `.clear` are dropped: `marker.hide at: boston` names Boston
    only to take it off the map, and asking whether you can read a name that
    is being removed is not a question."""
    out = {}
    for name, spec in (manifest.get("verbs") or {}).items():
        if name.rsplit(".", 1)[-1] in ("hide", "clear"):
            continue
        for arg, a in (spec.get("args") or {}).items():
            t = a.get("type", "")
            base, is_list = (t[:-2], True) if t.endswith("[]") else (t, False)
            if base in ("place", "region"):
                out.setdefault(name, []).append((arg, base, is_list))
    return out


# ------------------------------------------------------------------
# The page-side measurement
# ------------------------------------------------------------------

INSTALL = r"""
() => {
window.__leg = (() => {
  // The map's own root. Everything inside it -- the canvas, the label
  // overlay, and the atmosphere layers appended after it -- is the map, not
  // something laid on top of it. querySelector on a list returns the first in
  // DOCUMENT order, so this resolves to the outermost of them.
  const MAPSEL = '#story-map, .stage-map, .atlas';

  /* Effective opacity: display, visibility and every ancestor's opacity folded
     in. Asking a node what class it has tells you what the author intended;
     this tells you what the viewer sees. */
  function eff(node) {
    let o = 1;
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= Number(cs.opacity);
      if (!o) return 0;
    }
    return o;
  }

  /* Does this element put ink on the screen, or is it a transparent box that
     merely has a rectangle? A positioning wrapper covers the whole viewport
     and hides nothing. */
  function paintAlpha(el) {
    const cs = getComputedStyle(el);
    if (/^(IMG|CANVAS|VIDEO|SVG|PICTURE)$/.test(el.tagName)) return 1;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return 1;
    if (cs.backdropFilter && cs.backdropFilter !== 'none') return 1;
    if (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') return 1;
    const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
    if (!m) return 0;
    const p = m[1].split(',').map(Number);
    return p.length > 3 ? p[3] : 1;
  }

  const describe = (el) => {
    const c = (el.className && typeof el.className === 'string')
      ? el.className.trim().split(/\s+/)[0] : '';
    return c ? '.' + c : el.tagName.toLowerCase();
  };

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  /* Where the label is allowed to be. Not the viewport: the map lives in a
     host 110 px shorter than the screen with `overflow: hidden`, and a name
     pushed past the bottom of that host is cut off by it while its
     getBoundingClientRect still says it is comfortably inside the window.
     onScreen() lets a pin sit 120 px outside the host before it hides it, so
     this is a real gap and not a theoretical one. Every clipping ancestor is
     folded in, so it stays right if the shell is ever re-nested. */
  function clipBox(node) {
    let box = { l: 0, t: 0, r: window.innerWidth, b: window.innerHeight, by: 'viewport' };
    for (let n = node.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflow === 'visible' && cs.overflowX === 'visible'
          && cs.overflowY === 'visible') continue;
      const r = n.getBoundingClientRect();
      if (r.left > box.l || r.top > box.t || r.right < box.r || r.bottom < box.b) {
        box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top),
                r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom),
                by: describe(n) };
      }
    }
    return box;
  }

  /* Walk down from the top of the stack until the label is reached. Anything
     above it that paints is covering it. */
  function coverAt(x, y, label, host) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el === label || label.contains(el) || el.contains(label)) return null;
      if (host && host.contains(el)) continue;   // the map's own atmosphere
      if (paintAlpha(el) * eff(el) >= 0.25) return el;
    }
    return null;
  }

  /* Coverage measured on the label's own rectangle, by sampling. Sampling
     rather than rectangle arithmetic because it composes two overlapping
     cards for free, and because elementsFromPoint is the only thing that
     knows the real paint order. */
  function measure(node) {
    const host = document.querySelector(MAPSEL);
    const hr = host ? host.getBoundingClientRect() : null;
    const r = node.getBoundingClientRect();
    const box = clipBox(node);
    const cols = Math.max(5, Math.min(15, Math.round(r.width / 8)));
    const rows = 3;
    let hits = 0, total = 0, bleed = 0;
    const by = new Map();
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = r.left + ((i + 0.5) / cols) * r.width;
        const y = r.top + ((j + 0.5) / rows) * r.height;
        total += 1;
        // Outside the clip box the label is not covered, it is cut off, and
        // that is a different fault with a different fix.
        if (x < box.l || y < box.t || x >= box.r || y >= box.b) continue;
        const el = coverAt(x, y, node, host);
        if (el) {
          hits += 1;
          by.set(describe(el), (by.get(describe(el)) || 0) + 1);
          // A picture that fills the frame is not an overlay sitting ON the
          // name -- it is the map not being on screen at all. Different
          // finding, different fix, so it is counted apart.
          const er = el.getBoundingClientRect();
          if (hr && er.width * er.height >= 0.92 * hr.width * hr.height
              && er.left <= hr.left + 4 && er.right >= hr.right - 4) bleed += 1;
        }
      }
    }
    const off = {
      left: Math.max(0, box.l - r.left), right: Math.max(0, r.right - box.r),
      top: Math.max(0, box.t - r.top), bottom: Math.max(0, r.bottom - box.b),
    };
    let edge = null;
    for (const k of ['right', 'left', 'bottom', 'top']) {
      if (off[k] > (edge ? off[edge] : 0)) edge = k;
    }
    return {
      rect: { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height },
      text: (node.textContent || '').trim(),
      opacity: eff(node),
      cover: total ? hits / total : 0,
      plated: total ? bleed / total : 0,
      coverBy: [...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, n / total]),
      offEdge: edge, offPx: edge ? off[edge] : 0,
      clipBy: box.by, clipW: box.r - box.l,
      viewport: [window.innerWidth, window.innerHeight],
    };
  }

  /* Which node carries the NAME of this thing.

     Matched on the TEXT the live map says it drew for that id, not on where
     the node sits. Position was the first attempt and it was wrong within the
     hour: the map keys its overlay nodes by an id it does not expose, so the
     node was found by comparing its inline transform against toScreen(), and
     a pin that FLIPS to the other side of its anchor to avoid the edge is no
     longer at its anchor. The label a name-legibility tool is looking for is,
     by definition, the one with the name in it; where the map chose to put it
     is the answer, not the key.

     Ties are broken by distance from the anchor, so two places that really do
     share a name still resolve to the nearer one. */
  function nodeFor(map, kind, ref, lang) {
    const pickI18n = (f) => (f && (f[lang] ?? f.no ?? f.en)) || null;
    let anchor = null;
    const sels = [];                 // [selector, how, [acceptable text]]

    if (kind === 'place') {
      const p = window.__leg.places[ref];
      if (!p || !p.coords) return { why: 'unknown place' };
      anchor = map.toScreen(p.coords[0], p.coords[1]);
      const mk = map.markers.get('mk:' + ref);
      const st = map.places.get('place:' + ref);
      if (mk && mk.label) sels.push(['.atlas-pin b', 'pin', [norm(mk.label)]]);
      if (st && st.name) {
        sels.push(['.atlas-place:not(.atlas-place--region)', 'standing', [norm(st.name)]]);
      }
      if (!sels.length) {
        return { why: mk ? 'a pin, carrying no name'
                         : 'nothing on the map names this place', anchor };
      }
    } else {
      const spec = map.regions.get('region:' + ref);
      if (!spec) return { why: 'region.show resolved to nothing' };
      anchor = spec.centre ? map.toScreen(spec.centre[0], spec.centre[1]) : null;
      // declutter() may have swapped the full name for the atlas short form
      // rather than dropping it, so both count as the name being readable.
      const want = [pickI18n(spec.label), pickI18n(spec.short), spec.name]
        .filter(Boolean).map(norm);
      sels.push(['.atlas-place--region', 'region', want]);
    }

    let best = null, bestD = Infinity, via = null;
    for (const [sel, how, want] of sels) {
      for (const n of document.querySelectorAll(sel)) {
        if (!want.includes(norm(n.textContent))) continue;
        const r = n.getBoundingClientRect();
        const d = anchor
          ? Math.hypot((r.left + r.right) / 2 - anchor[0], (r.top + r.bottom) / 2 - anchor[1])
          : 0;
        if (d < bestD) { bestD = d; best = n; via = how; }
      }
      if (best) break;   // a pin outranks the standing name it replaced
    }
    if (!best) return { why: 'no label drawn', anchor };
    return { node: best, via, anchor };
  }

  /* Is the picture over the map still moving?

     A fixed settle is not enough and a long one is unaffordable at ~2400
     probes. resetPlate() FADES the outgoing picture over 0.9 s when the
     rebuild is soft, and removing `is-on` again does not cancel a transition
     that is already running -- so a probe measured 180 ms later is looking at
     the previous beat's plate at 0.8 opacity and reports every name under it
     as covered. That happened, and it is exactly the "silently measuring the
     previous beat" failure a bench is supposed to be built against.

     So: a fingerprint of what is painted over the map, sampled until two
     consecutive samples agree. Nothing is named -- it is every painting
     element outside the map host, which is the same derivation the coverage
     test uses -- so a future overlay with a slower fade needs no edit here. */
  function rest() {
    const host = document.querySelector(MAPSEL);
    const out = [];
    for (const n of document.querySelectorAll('body *')) {
      if (host && (host.contains(n) || n.contains(host))) continue;
      const r = n.getBoundingClientRect();
      if (r.width * r.height < 400) continue;
      const a = paintAlpha(n) * eff(n);
      if (a >= 0.02) out.push(describe(n) + ':' + a.toFixed(2)
                              + ':' + Math.round(r.left) + ',' + Math.round(r.top));
    }
    return out.join('|');
  }

  return { eff, measure, nodeFor, describe, rest, places: {}, api: null, map: null };
})();
}
"""

# The one probe. Seeks, settles, and measures every place named at that instant.
PROBE = r"""
async (a) => {
  const L = window.__leg;
  const p = L.api.getPlayer();
  const map = L.map;
  if (!p || !map) return { error: 'no player or map' };

  // The app's own seek path. When the scene has not changed this skips the
  // audio swap entirely and goes straight to rebuildTo + onTick, so the
  // caption is rendered for the beat being measured -- which it must be,
  // because the caption box is one of the things that can sit on a name.
  await p.goToScene(a.scene, { autoplay: false, at: a.t });
  // ...and then rebuild HARD. goToScene rebuilds with `soft`, which fades the
  // outgoing plate over 950 ms instead of cutting it -- so a probe measured
  // 180 ms later is looking at the PREVIOUS probe's picture, and every name
  // under it reads as covered. That is the "measuring the previous beat"
  // failure this tool was warned about, and it did happen: barolo at s5.b2
  // was reported behind a plate that belongs to a scene four beats earlier.
  // A hard rebuild is the app's own scrub path (Player.seek), and rule 1 says
  // the end state is identical -- only the pixels in between differ.
  p.rebuildTo(a.t);

  // place.highlight centres the camera, and engine/surfaces/map.js skips that
  // under `instant` -- so a seek lands on a camera a forward play never
  // shows. Put it back, or the label is judged against a frame nobody sees.
  let fixed = false;
  if (a.centreOn) {
    const pl = L.places[a.centreOn];
    if (pl && pl.coords) { map.setView(pl.coords[0], pl.coords[1]); fixed = true; }
  }

  await map.settled();
  // region.show resolves its geometry through a fetch, so the spec can arrive
  // after the cue. Wait for the ones this probe is about, and no longer.
  const wantRegions = a.refs.filter((r) => r.kind === 'region').map((r) => r.ref);
  for (let i = 0; i < 60 && wantRegions.some((n) => !map.regions.get('region:' + n)); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise((r) => setTimeout(r, a.settle));
  // Two frames: syncOverlay runs inside the draw, and declutter() runs at the
  // end of it. One frame can land mid-pass.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // ...and then wait for the overlays to stop moving. See rest().
  let was = L.rest(), still = 0;
  for (let i = 0; i < 16 && still < 1; i++) {
    await new Promise((r) => setTimeout(r, 90));
    const now = L.rest();
    still = (now === was) ? still + 1 : 0;
    was = now;
  }
  await new Promise((r) => setTimeout(r, 30));

  const out = [];
  for (const ref of a.refs) {
    const got = L.nodeFor(map, ref.kind, ref.ref, a.lang);
    if (!got.node) {
      out.push({ ...ref, verdict: 'MISSING', why: got.why, anchor: got.anchor || null });
      continue;
    }
    const m = L.measure(got.node);
    if (m.opacity < 0.05) {
      // The node is there and nobody can see it. Two different reasons, and
      // they want different fixes, so they are told apart by whether the map
      // ever positioned it: declutter() hides a label it HAS placed, while
      // placePin() gives up before writing a transform when the name will not
      // fit on any side of its anchor.
      const holder = got.node.closest('.atlas-pin') || got.node;
      out.push({ ...ref, verdict: 'MISSING', anchor: got.anchor, via: got.via, text: m.text,
                 why: holder.style.transform
                   ? 'drawn, then hidden — it collided with a name that outranked it'
                   : 'no room for the name on any side of its anchor, so the map hid it' });
      continue;
    }
    let verdict = 'ok';
    if (m.offPx > a.clipBad) verdict = 'CLIPPED';
    else if (m.plated >= a.coverBad) verdict = 'PLATED';
    else if (m.cover >= a.coverBad) verdict = 'COVERED';
    out.push({ ...ref, verdict, via: got.via, anchor: got.anchor, ...m });
  }
  return { rows: out, cameraFixed: fixed, camera: map.camera() };
}
"""


# ------------------------------------------------------------------
# Booting
# ------------------------------------------------------------------

BOOT_LANG = r"""
async (lang) => {
  const S = await import('./engine/story.js');
  window.__leg.api = S;
  if (S.getChapter() && S.getChapter().lang !== lang) await S.storySetLang(lang);
  return S.getChapter() ? S.getChapter().lang : null;
}
"""

PLAN = r"""
async () => {
  const S = window.__leg.api;
  /* The HANDLE, not the surface, and that is deliberate.

     The module moved to engine/surfaces/map.js, and importing THAT from here
     would put map/index.js, map/basemap.js and their Path2D machinery into
     the graph of a pack that has no map at all -- silently, with everything
     still working, which is the one measurable payoff of the surface
     refactor gone. engine/scenes/map.js goes through the surface registry
     and answers null when this pack asked for no map, which is the correct
     answer rather than an error. See that file's own header. */
  const M = await import('./engine/scenes/map.js');
  window.__leg.map = M.getStoryMap();
  const ch = S.getChapter();
  if (!ch) return null;
  const places = {};
  for (const [k, v] of Object.entries(ch.places || {})) {
    places[k] = { coords: v.coords, label: v.label === undefined ? true : v.label };
  }
  window.__leg.places = places;
  return {
    id: ch.id, lang: ch.lang, places,
    scenes: ch.scenes.map((s) => ({
      id: s.id, dur: s.dur,
      beats: s.beats.map((b) => ({ id: b.id, text: b.text, start: b.start, dur: b.dur })),
      cues: s.cues.map((c) => JSON.parse(JSON.stringify(c))),
    })),
  };
}
"""

# Hit testing honours pointer-events, and half the overlays set it to none.
# With it forced on everywhere the hit order IS the paint order, which is the
# question. Changes no layout.
PE_CSS = "*, *::before, *::after { pointer-events: auto !important; }"


def open_app(page, url, pack, chapter_index, lang):
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_selector(f'.subject[data-pack="{pack}"]', timeout=30_000)
    # node.click(), not a mouse click. The pointer-events override below makes
    # hit testing follow paint order, which is the point -- and a side effect
    # is that `.sheet-backdrop`, normally inert, starts swallowing real clicks.
    # A synthetic click does not hit-test at all, so the two never interact.
    page.evaluate("(s) => document.querySelector(s)?.click()",
                  f'.subject[data-pack="{pack}"]')
    page.wait_for_function(
        "() => !!document.querySelector('#story-map') && !document.querySelector('.boot')",
        timeout=30_000)
    page.wait_for_timeout(900)
    page.evaluate(INSTALL)
    page.add_style_tag(content=PE_CSS)
    page.evaluate(BOOT_LANG, lang)
    if chapter_index:
        page.evaluate("(i) => document.querySelector(`[data-chapter=\"${i}\"]`)?.click()",
                      chapter_index)
        page.wait_for_function(
            "() => !!document.querySelector('#story-map') && !document.querySelector('.boot')",
            timeout=30_000)
        page.wait_for_timeout(1600)
    # The cover is a full-screen card and would cover every label there is.
    page.evaluate("() => document.querySelector('.story__cover')?.classList.remove('is-on')")
    page.evaluate("() => { const p = window.__leg.api.getPlayer(); if (p) p.playing = false; }")
    page.wait_for_timeout(300)
    try:
        page.evaluate("() => document.fonts.ready")
    except Exception:
        pass
    return page.evaluate(PLAN)


# ------------------------------------------------------------------
# Turning a plan into probes
# ------------------------------------------------------------------

def probes_for(plan, verbs):
    """[(scene_index, t, [refs], beat_id, sentence, centre_on)] -- one entry
    per instant, because one seek can answer for every place named at it."""
    groups = {}
    order = []
    for si, scene in enumerate(plan["scenes"]):
        texts = {b["id"]: b["text"] for b in scene["beats"]}
        for cue in scene["cues"]:
            spec = verbs.get(cue.get("do"))
            if not spec:
                continue
            refs = []
            for arg, kind, is_list in spec:
                val = cue.get(arg)
                if val is None:
                    continue
                for one in (val if is_list else [val]):
                    if isinstance(one, str):
                        refs.append({"kind": kind, "ref": one, "verb": cue["do"]})
            if not refs:
                continue
            key = (si, round(float(cue.get("t", 0.0)), 3))
            if key not in groups:
                groups[key] = {"scene": si, "t": key[1], "refs": [], "seen": set(),
                               "beat": cue.get("beat"), "text": texts.get(cue.get("beat"), ""),
                               "centre": None}
                order.append(key)
            g = groups[key]
            for r in refs:
                k = (r["kind"], r["ref"])
                if k not in g["seen"]:
                    g["seen"].add(k)
                    g["refs"].append(r)
            if cue["do"] == "place.highlight" and cue.get("centre") is not False:
                g["centre"] = cue.get("at")
    return [groups[k] for k in order]


# ------------------------------------------------------------------
# Reporting
# ------------------------------------------------------------------

RANK = {"CLIPPED": 0, "COVERED": 1, "MISSING": 2, "PLATED": 3}
VERDICTS = ("CLIPPED", "COVERED", "MISSING", "PLATED")


def one_line(f):
    v = f["verdict"]
    r = f.get("rect") or {}
    if v == "CLIPPED":
        where = "" if f["clipBy"] == "viewport" else f" of the map frame {f['clipBy']}"
        anchor = (f"anchor x={f['anchor'][0]:.0f} of {f['clipW']:.0f}, "
                  if f.get("anchor") else "")
        # A label further out than it is wide is not clipped, it is elsewhere —
        # its anchor is off the frame and the name was drawn anyway. Different
        # sentence, because "40 px of 62" invites you to shave 40 px and that
        # is not the fix.
        how = ("whole, past" if f["offPx"] >= r["w"]
               else f"{f['offPx']:.0f} px of {r['w']:.0f} past")
        return (f"{how} the {f['offEdge']} edge{where} "
                f"({anchor}label {r['l']:.0f} -> {r['r']:.0f})")
    if v in ("COVERED", "PLATED"):
        by = f["coverBy"][:2]
        who = ", ".join(sel if len(by) == 1 else f"{sel} ({share * 100:.0f}%)"
                        for sel, share in by) or "something unnamed"
        return (f"{f['cover'] * 100:.0f}% covered, by {who} "
                f"(label {r['l']:.0f} -> {r['r']:.0f}, y {r['t']:.0f} -> {r['b']:.0f})")
    return f.get("why", "no label")


def trim(s, n):
    s = " ".join(str(s or "").split())
    return s if len(s) <= n else s[:n - 1] + "…"


def report(pack, cid, lang, findings, stats):
    print(f"\n  {pack}/{cid}  [{lang}]")
    real = [f for f in findings if f["verdict"] != "PLATED"]
    if not real:
        print("    every named place is legible")
    for f in sorted(real, key=lambda f: (RANK[f["verdict"]], f["scene_id"], f["t"])):
        print(f"    {f['verdict']:<8} {f['ref']:<16} {f['beat'] or f['scene_id']:<10} "
              f"t={f['t']:>6.1f}  {f['verb']}")
        print(f"             {one_line(f)}")
        # No tool can read a sentence, so the sentence goes next to the finding
        # or the finding is unactionable. check-script.py does the same for
        # plates and for effects, for the same reason.
        print(f'             "{trim(f["sentence"], 94)}"')

    # A picture over the whole frame is not an overlay sitting on a name, it is
    # the map not being on screen -- fine when the cue is pre-staging the map
    # behind the plate, wrong when the line is pointing at it. Exactly the list
    # CLAUDE.md says a tool can print and only a human can judge. So: printed,
    # compactly, and never mixed in with the faults.
    plated = [f for f in findings if f["verdict"] == "PLATED"]
    if plated:
        print(f"    behind a full-frame plate ({len(plated)}), for you to read: "
              + ", ".join(sorted({f"{f['ref']}@{f['beat']}" for f in plated})))

    print(f"    {stats['named']:>3} named  {stats['ok']:>3} legible  "
          f"{stats['CLIPPED']:>2} clipped  {stats['COVERED']:>2} covered  "
          f"{stats['MISSING']:>2} missing  {stats['PLATED']:>2} behind a plate"
          + (f"   ({stats['unlabelled']} deliberately unlabelled)"
             if stats["unlabelled"] else ""))


# ------------------------------------------------------------------
# The self-test: a case that must pass, and the same case moved to the edge
# ------------------------------------------------------------------

SELFTEST = r"""
async () => {
  const L = window.__leg;
  const map = L.map;
  const out = {};

  const at = (fx) => {
    const c = map.camera();
    const [cx, cy] = map.toScreen(c.lat, c.lon);
    return map.toLatLng(cx + (fx - 0.5) * c.size.w, cy);
  };
  const settle = async () => {
    map.redraw();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 140));
  };
  const chip = () => [...document.querySelectorAll('.atlas-pin b')]
    .find((n) => (n.textContent || '').trim() === 'Selftest');
  const put = async (fx) => {
    map.markers.clear();
    map.markers.add({ id: 'mk:__selftest', at: at(fx), label: 'Selftest', instant: true });
    await settle();
    const n = chip();
    return n ? { visible: L.eff(n) > 0.05, ...L.measure(n) } : { gone: true };
  };

  // An empty frame: nothing on the stage but the map, so the pass case really
  // is a name with nothing near it.
  const host = document.querySelector('#story-map, .stage-map, .atlas');
  for (const n of document.querySelectorAll('.story__stage > *, .captions')) {
    if (!n.contains(host)) n.style.display = 'none';
  }
  map.places.clear(); map.regions.clear(); map.highlights.clear(); map.markers.clear();
  await settle();

  out.centre = await put(0.5);

  // The same name, with a card laid over it. The card is a plain painted div
  // owned by nobody -- no class the tool knows, no stylesheet -- so what is
  // being tested is the derivation and not a selector list.
  if (!out.centre.gone) {
    const r = out.centre.rect;
    const card = document.createElement('div');
    card.className = 'selftest-card';
    card.style.cssText = `position:fixed;left:${r.l - 6}px;top:${r.t - 6}px;`
      + `width:${r.w + 12}px;height:${r.h + 12}px;background:#123;z-index:99999;`
      + 'pointer-events:none;';
    document.body.appendChild(card);
    await settle();
    const n = chip();
    out.covered = n ? L.measure(n) : { gone: true };
    card.remove();
    await settle();
  }

  // Pushed against the frame. Either the label runs off the edge (CLIPPED) or
  // the map refuses to place it (MISSING) -- which of the two is the map's
  // business. The tool's business is that it must not call this legible.
  out.edge = await put(1.02);
  map.markers.clear();
  return out;
}
"""


def selftest(page):
    got = page.evaluate(SELFTEST)
    ok = True
    print("\n  FALSIFICATION — the same measurement, on cases built to a known answer")

    c = got.get("centre") or {}
    if c.get("gone") or not c.get("visible"):
        print("    1. a name alone in the middle of an empty frame: NOT DRAWN — "
              "the probe is testing air")
        ok = False
    else:
        good = c["offPx"] <= CLIP_BAD and c["cover"] < COVER_BAD
        print(f"    1. a name alone in the middle of an empty frame")
        print(f"       label {c['rect']['l']:.0f} -> {c['rect']['r']:.0f} of "
              f"{c['clipW']:.0f} px, {c['cover'] * 100:.0f}% covered, "
              f"{c['offPx']:.0f} px off any edge")
        print("       -> " + ("legible, as it must be" if good
                              else "REPORTED AS A FAULT — the tool cries wolf"))
        ok = ok and good

    v = got.get("covered") or {}
    if v.get("gone"):
        print("    2. the same name under a card: NOT DRAWN — the probe is testing air")
        ok = False
    else:
        who = v.get("coverBy") or []
        good = v["cover"] >= COVER_BAD and any(k == ".selftest-card" for k, _ in who)
        print(f"    2. the same name under a plain painted div the tool has never heard of")
        print(f"       {v['cover'] * 100:.0f}% covered, by "
              + (", ".join(f"{k}" for k, _ in who[:2]) or "nothing"))
        print("       -> " + ("COVERED, and it named the right thing" if good
                              else "MISSED — the derivation does not see a real overlay"))
        ok = ok and good

    e = got.get("edge") or {}
    if e.get("gone"):
        print("    3. the same name pushed past the frame edge")
        print("       no node at all -> not legible, as it must be")
    else:
        bad = (not e.get("visible")) or e["offPx"] > CLIP_BAD
        state = ("the map hid it (no room on any side)" if not e.get("visible")
                 else f"{e['offPx']:.0f} px past the {e['offEdge']} edge")
        print(f"    3. the same name pushed past the frame edge")
        print(f"       {state}")
        print("       -> " + ("not legible, as it must be" if bad
                              else "REPORTED CLEAN — the tool is blind to a name off the frame"))
        ok = ok and bad
    return ok


# ------------------------------------------------------------------
# Server: use what is there, start one if not
# ------------------------------------------------------------------

def reachable(url):
    try:
        with urlopen(url, timeout=2):
            return True
    except Exception:
        return False


def serve() -> str:
    """tools/serve.py's own handler, on a random port. Not http.server: it
    answers Range requests and sends no-store, and CLAUDE.md records what
    using the other one costs."""
    spec = _importlib_util.spec_from_file_location(
        "fortell_serve", Path(__file__).with_name("serve.py"))
    mod = _importlib_util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    class Quiet(mod.Handler):
        def log_message(self, *a):
            pass

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}"


# ------------------------------------------------------------------

def targets(args):
    packs = json.loads((ROOT / "content" / "packs.json").read_text(encoding="utf-8"))
    ids = [p if isinstance(p, str) else p["id"] for p in (packs.get("packs") if isinstance(packs, dict) else packs)]
    out = []
    for pid in ids:
        pj = json.loads((ROOT / "content" / pid / "pack.json").read_text(encoding="utf-8"))
        for i, ch in enumerate(pj.get("chapters") or []):
            out.append((pid, ch["id"], i))
    if args.targets:
        want = set()
        for t in args.targets:
            want.add(tuple(t.split("/", 1)) if "/" in t else (t, None))
        out = [(p, c, i) for (p, c, i) in out
               if (p, c) in want or (p, None) in want]
    return out


def run_chapter(page, url, pack, cid, index, lang, verbs, args):
    plan = open_app(page, url, pack, index, lang)
    if not plan:
        print(f"\n  {pack}/{cid}  [{lang}]  — no chapter loaded")
        return [], None
    if plan["id"] != cid:
        print(f"\n  {pack}/{cid}  [{lang}]  — opened {plan['id']} instead; skipping")
        return [], None
    if plan["lang"] != lang:
        print(f"\n  {pack}/{cid}  [{lang}]  — app is in '{plan['lang']}'; skipping")
        return [], None

    groups = probes_for(plan, verbs)
    findings = []
    stats = {"named": 0, "ok": 0, "unlabelled": 0, "fixed": 0, "probes": len(groups)}
    stats.update({v: 0 for v in VERDICTS})
    for g in groups:
        got = page.evaluate(PROBE, {
            "scene": g["scene"], "t": g["t"] + 0.02, "refs": g["refs"],
            "lang": lang, "settle": args.settle,
            "coverBad": COVER_BAD, "clipBad": CLIP_BAD,
            "centreOn": g["centre"] if args.camera_fix else None,
        })
        if got.get("error"):
            print(f"    probe failed at {plan['scenes'][g['scene']]['id']} t={g['t']}: {got['error']}")
            continue
        if got.get("cameraFixed"):
            stats["fixed"] += 1
        for row in got["rows"]:
            stats["named"] += 1
            # A place the author said not to label has no name to read, and
            # saying so every time would bury the findings that are faults.
            if (row["verdict"] == "MISSING" and row["kind"] == "place"
                    and plan["places"].get(row["ref"], {}).get("label") is False):
                stats["unlabelled"] += 1
                continue
            if row["verdict"] == "ok":
                stats["ok"] += 1
                continue
            stats[row["verdict"]] += 1
            findings.append({**row, "scene_id": plan["scenes"][g["scene"]]["id"],
                             "beat": g["beat"], "t": g["t"], "sentence": g["text"]})
    return findings, stats


VERIFY_N = 6


def _shot(page, g, lang, args):
    got = page.evaluate(PROBE, {
        "scene": g["scene"], "t": g["t"] + 0.02, "refs": g["refs"],
        "lang": lang, "settle": args.settle,
        "coverBad": COVER_BAD, "clipBad": CLIP_BAD,
        "centreOn": g["centre"] if args.camera_fix else None,
    })
    return {(r["kind"], r["ref"]): (r["verdict"],
                                    round(r.get("rect", {}).get("l", -1), 1),
                                    round(r.get("rect", {}).get("t", -1), 1))
            for r in got.get("rows", [])}, got


def verify(page, url, pack, cid, index, lang, verbs, args, groups):
    """One page per chapter, or one page per beat? Measure it, do not assume.

    The whole run-time argument for a single page is that label geometry is a
    pure function of the rebuilt stage. If that is false the engine is broken,
    not this tool -- but "silently measuring the previous beat" is exactly the
    kind of bug a bench hides, so a spread of probes is re-run against a page
    booted from scratch for each one and the rectangles compared."""
    step = max(1, len(groups) // VERIFY_N)
    picked = groups[::step][:VERIFY_N]
    print(f"\n  VERIFY — {len(picked)} probes, one shared page vs one fresh page each")

    shared = []
    for g in picked:
        first, _ = _shot(page, g, lang, args)
        shared.append(first)

    moved = 0
    for g, first in zip(picked, shared):
        open_app(page, url, pack, index, lang)
        again, _ = _shot(page, g, lang, args)
        for key, was in first.items():
            now = again.get(key)
            if now != was:
                moved += 1
                print(f"    MOVED {key[1]:<16} scene {g['scene']} t={g['t']:.1f}: "
                      f"{was} -> {now}")
    print(f"    {moved} of {sum(len(s) for s in shared)} labels disagreed")
    return moved


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("targets", nargs="*", help="pack, or pack/chapter-id")
    ap.add_argument("--lang", default="no,en", help="comma separated (default no,en)")
    default_url = os.environ.get("LAB_BASE", "http://localhost:8000").rstrip("/")
    ap.add_argument("--url", default=default_url)
    ap.add_argument("--viewport", default=f"{VIEWPORT[0]}x{VIEWPORT[1]}")
    ap.add_argument("--settle", type=int, default=180,
                    help="ms after the camera settles before measuring")
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 on any finding. Off by default -- see the header.")
    ap.add_argument("--no-camera-fix", dest="camera_fix", action="store_false",
                    help="measure the raw seek camera, quirk and all")
    ap.add_argument("--verify", action="store_true",
                    help="re-measure a sample on a freshly booted page")
    ap.add_argument("--selftest", action="store_true",
                    help="measure a case built to pass, and the same case clipped")
    ap.add_argument("--json", help="write every finding to this file as well")
    a = ap.parse_args()

    manifest = json.loads((ROOT / "engine" / "verbs.json").read_text(encoding="utf-8"))
    verbs = naming_verbs(manifest)

    url = a.url
    if not reachable(url + "/index.html"):
        url = serve()
        print(f"nothing at {a.url} — serving this tree at {url}")
    w, h = (int(x) for x in a.viewport.lower().split("x"))

    print(f"\nCan you read the name of the place being talked about?  {w}x{h}")
    print("  verbs that name a place, from engine/verbs.json:")
    for name in sorted(verbs):
        print(f"    {name:<16} {', '.join(f'{arg} ({k})' for arg, k, _ in verbs[name])}")

    from playwright.sync_api import sync_playwright   # imported late: the header runs without it

    langs = [s.strip() for s in a.lang.split(",") if s.strip()]
    all_findings = []
    totals = {"named": 0, "ok": 0, "unlabelled": 0, "fixed": 0}
    totals.update({v: 0 for v in VERDICTS})
    selfok = None
    seen_overlays = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for lang in langs:
            page = browser.new_page(viewport={"width": w, "height": h},
                                    locale="nb-NO" if lang == "no" else "en-GB")
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            for pack, cid, index in targets(a):
                try:
                    findings, stats = run_chapter(page, url, pack, cid, index, lang, verbs, a)
                except Exception as err:      # one chapter must not lose the rest
                    print(f"\n  {pack}/{cid}  [{lang}] — could not be driven: "
                          f"{trim(err, 160)}")
                    continue
                if stats is None:
                    continue
                report(pack, cid, lang, findings, stats)
                for f in findings:
                    f["pack"], f["chapter"], f["lang"] = pack, cid, lang
                    for sel, share in f.get("coverBy", []):
                        seen_overlays[sel] = seen_overlays.get(sel, 0) + 1
                all_findings += findings
                for k in totals:
                    totals[k] += stats.get(k, 0)
                if a.selftest and selfok is None:
                    selfok = selftest(page)
                if a.verify:
                    verify(page, url, pack, cid, index, lang, verbs, a,
                           probes_for(page.evaluate(PLAN), verbs))
            if errs:
                print(f"\n  ({len(errs)} page error(s) in '{lang}', first: {trim(errs[0], 120)})")
            page.close()
        browser.close()

    print(f"\n{'-' * 66}")
    print(f"  {totals['named']} places named, {totals['ok']} legible, "
          f"{totals['CLIPPED']} clipped, {totals['COVERED']} covered, "
          f"{totals['MISSING']} missing, {totals['PLATED']} behind a plate"
          + (f", {totals['unlabelled']} deliberately unlabelled" if totals["unlabelled"] else ""))
    if seen_overlays:
        print("  overlays that were found covering a name, derived not listed: "
              + ", ".join(f"{k} ({n})" for k, n in
                          sorted(seen_overlays.items(), key=lambda kv: -kv[1])))
    if a.camera_fix and totals["fixed"]:
        print(f"  {totals['fixed']} probe(s) needed the place.highlight camera put back "
              "(engine/surfaces/map.js skips centring under `instant`)")

    if a.json:
        Path(a.json).write_text(json.dumps(all_findings, ensure_ascii=False, indent=1),
                                encoding="utf-8")
        print(f"  findings written to {a.json}")

    # PLATED is deliberately not a failure: it is a list for a human to read.
    bad = totals["CLIPPED"] + totals["COVERED"] + totals["MISSING"]
    if a.selftest and selfok is False:
        print("\n  THE TOOL FAILED ITS OWN FALSIFICATION — do not trust the numbers above")
        return 1
    if not a.strict:
        print("\n  Reporting only. --strict exits 1 on any of the above.")
        return 0
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
