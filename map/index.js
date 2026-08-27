/* ============================================================
   index.js — createMap(host, opts) -> a map instance.

   One module, two configurations: `interactive` for browsing, cue-driven for
   narration. Geometry goes on a canvas; text and counters go in a positioned
   HTML overlay, so place names and commander chips keep real typography, the
   project's CSS tokens and normal tap handling instead of becoming canvas
   text nobody can select or style.

   Nothing here is a singleton — the lab page runs a light instance and a
   dark instance side by side, which is the only honest way to judge whether
   a palette works in both.
   ============================================================ */

import { project, unproject, scaleFor, clamp, metresPerPixel, WORLD } from './geo.js';
import { loadLevel, levelFor, levelReady, preload, bakeSteps, registerDetail,
         loadDetail, detailWanted, creditFor, setCulling } from './basemap.js';
import { loadRegions, fromGeoJSON } from './regions.js';
import { tintFor } from './tint.js';
import {
  drawArrow, drawMarch, drawFront, drawArea, drawRegions, drawCrossing, drawFleet,
  drawBattle, drawGlow, widthForStrength,
} from './artifacts.js';

const DEFAULT_FACTIONS = {
  neutral: { label: 'Neutral', fill: '#55704c', flag: '' },
};

/** A [a, b] option, or the fallback if it is anything else. */
function pairOr(v, fallback) {
  return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)
    ? [Number(v[0]), Number(v[1])] : fallback;
}

export function createMap(host, opts = {}) {
  const {
    center = [40, -74],
    zoom = 5,
    minZoom = 2,
    maxZoom = 14,
    interactive = true,
    geoBase = '../assets/geo',
    factions = { ...DEFAULT_FACTIONS },
    onSelect = () => {},
    onCamera = () => {},
    // Named for the shipped geometry. Natural Earth is public domain, so this
    // is courtesy; a pack's own data may not be, and creditFor() adds it.
    credit = 'Natural Earth',
    flyOver = 2.8,
    /* What autoOver() is allowed to come out as, in seconds. Below 1.4 s a
       fly is a cut and the eye loses the ground it was holding; above 6 s it
       is two thirds of a spoken sentence spent travelling.
       docs/design-direction.md §1. An option rather than a literal in
       autoOver() because a pack's style.json (`camera.clamp`) sets it — a
       subject fought across one valley and one fought across an ocean do not
       have the same idea of a long move. */
    flyClamp = [1.4, 6],
    detail = null,
    lang = 'no',
    /* How much air a placed label demands around it before declutter() calls
       it a collision, [x, y] in CSS pixels. Small and asymmetric on purpose:
       names sit on their own line, so a horizontal neighbour is the one that
       reads as crowding. A pack sets it through `map.labelGap` — a map with
       four names wants less than one with forty. */
    labelGap = [4, 2],
    /* How coarsely the zoom a bake is taken AT is rounded, in zoom levels.
       Not a literal buried in paintGround, because a later phase reads it
       from a pack's style.json (`camera.quantise`) along with the rest of
       the numbers. 0 turns it off. See bakeZoom(). */
    bakeQuantise = 0.5,
  } = opts;
  let quantise = Math.max(0, Number(bakeQuantise) || 0);
  // Both are pairs off a JSON file, so neither is trusted to be one. A tuning
  // file is not allowed to be able to break a map.
  const [flyLo, flyHi] = pairOr(flyClamp, [1.4, 6]);
  const [gapX, gapY] = pairOr(labelGap, [4, 2]);

  /* ---------------- DOM ---------------- */
  host.classList.add('atlas');
  const canvas = document.createElement('canvas');
  canvas.className = 'atlas__canvas';
  const overlay = document.createElement('div');
  overlay.className = 'atlas__overlay';

  /* Tappable things.

     ONE delegated listener, not a closure per node. The pins layer already
     had to work around the per-node version going stale when a spec is
     re-added under the same id, and the same trap is waiting here.

     The map dispatches `atlas:tap` on its host and knows nothing else: what a
     'person' or a 'term' is belongs to whatever mounted it. Nothing in this
     module learns that dossiers exist. */
  const tapTarget = (e) => e.target.closest?.('[data-tap]');
  overlay.addEventListener('click', (e) => {
    const el = tapTarget(e);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const [kind, ...rest] = el.dataset.tap.split(':');
    host.dispatchEvent(new CustomEvent('atlas:tap', {
      bubbles: true, detail: { kind, id: rest.join(':') },
    }));
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = tapTarget(e);
    if (!el) return;
    e.preventDefault();
    el.click();
  });

  /* A node is a target only while it is a target. Re-applying the same spec
     without `tap` has to take the affordance away, or a seek leaves a button
     behind that opens the wrong thing. */
  function setTap(n, tap, label) {
    if (tap && tap.id) {
      n.dataset.tap = `${tap.kind || 'place'}:${tap.id}`;
      n.tabIndex = 0;
      n.setAttribute('role', 'button');
      if (label) n.setAttribute('aria-label', label);
    } else if (n.dataset.tap) {
      delete n.dataset.tap;
      n.removeAttribute('tabindex');
      n.removeAttribute('role');
      n.removeAttribute('aria-label');
    }
  }
  const grain = document.createElement('div');
  grain.className = 'atlas__grain';
  const vignette = document.createElement('div');
  vignette.className = 'atlas__vignette';
  const mood = document.createElement('div');
  mood.className = 'atlas__mood';
  mood.dataset.mood = 'day';
  const flashEl = document.createElement('div');
  flashEl.className = 'atlas__flash';
  const timeEl = document.createElement('div');
  timeEl.className = 'atlas__time';
  const creditEl = document.createElement('div');
  creditEl.className = 'atlas__credit';

  // Order is the lesson the old map taught the hard way: the time-of-day
  // tint goes ABOVE the ground and BELOW the labels. Night used to darken
  // the place names as hard as the fields, which is exactly when you most
  // need to read them.
  host.append(canvas, grain, mood, overlay, flashEl, vignette, timeEl, creditEl);

  const ctx = canvas.getContext('2d');
  let size = { w: 0, h: 0 };
  let dpr = 1;

  /* The ground is redrawn into an offscreen buffer that is larger than the
     viewport. Panning inside the margin is then a blit, not a walk over
     seventy thousand coastline points — which measured 20 ms a frame. The
     buffer is re-rendered only when the view leaves it, or the zoom or the
     level changes. Same idea as a tile margin, without the tiles.

     TWO buffers, not one. A bake that is merely late is invisible — the old
     buffer keeps drawing, scaled, and softness for a beat reads as motion.
     A bake that happens IN the frame is a hole in the movement, and measured
     at 81 ms during a six-level flight before this. So a bake that is only
     wanted, rather than needed, goes into the spare sheet on a timer and the
     two are swapped when it lands.

     The spare is allocated the first time one is deferred, because it is not
     free: at a phone's 390x844 and the 0.3 margin it is about 21 MB, and iOS
     will drop a canvas context rather than exceed its total. destroy() gives
     both back. */
  const sheets = [makeSheet()];
  let sheetIx = 0;
  let bufState = null;
  const MARGIN = 0.3;
  /* How far the live zoom may drift from the zoom the ground was baked at
     before it has to be baked again. Within this the buffer is simply scaled,
     which is what every tile map does during a pinch: slightly soft while the
     camera is moving, sharp the moment it stops. Above it the softness starts
     to read as blur rather than as motion.

     It is the fallback now: while the zoom is CHANGING the bake zoom is
     quantised instead (see bakeZoom), which bounds the drift to one step and
     puts the re-bakes at predictable zooms rather than wherever a flight
     happened to cross a threshold. It still applies when quantising is turned
     off. */
  const ZOOM_SLACK = 0.55;

  function makeSheet() {
    const c = document.createElement('canvas');
    return { c, x: c.getContext('2d') };
  }

  /* Making a slice of the bake actually happen before yielding.

     Canvas commands are queued, so a slice that yields without forcing the
     work through has moved nothing: the queue simply grows and empties all at
     once in the blit. Reading a pixel back is the way to force it — but
     reading back from the SHEET turns the sheet into a software canvas.
     Chromium says so in the console, and it showed up as the bakes getting
     half again as slow the moment slicing was turned on.

     So the readback happens somewhere else. One pixel of the sheet is drawn
     into a one-by-one scratch canvas and that is what is read: the scratch
     cannot be rendered until the sheet is, so the sheet is forced through,
     and the only canvas that gets demoted to software is one pixel wide. */
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });

  function flushSheet(sheet) {
    probeCtx.drawImage(sheet.c, 0, 0, 1, 1, 0, 0, 1, 1);
    probeCtx.getImageData(0, 0, 1, 1);
  }

  /* "Is the camera moving" is a question about the last few hundred
     milliseconds, not about this frame.

     It used to be `now() - camMovedAt < 140`, set inside the same draw() —
     which is true whenever the camera changed on THIS frame and false
     otherwise, with no memory of a flight and no memory of anything else. The
     failure was not the obvious one: a bake that blocks for 81 ms leaves the
     NEXT frame more than 140 ms after the last recorded move, so mid-flight
     the map declared itself settled and took a second full sharp bake, one
     frame after the first. A stall that causes the next stall.

     Zoom is tracked apart from position because only the zoom makes the
     buffer stale. Quantising during a pan would leave a still map soft for
     no reason at all. */
  const MOVE_MS = 400;
  let camMovedAt = -1e9;
  let zoomMovedAt = -1e9;
  let settleTimer = 0;
  let bakeTimer = 0;
  /* Bumped when the ground gains geometry it did not have — the pack's
     detail file arriving mid-flight. The buffer is then out of date but not
     WRONG, which is the difference between a deferred bake and a stall. */
  let groundStamp = 0;

  /* ---------------- camera ---------------- */
  const cam = { lon: center[1], lat: center[0], zoom };
  let flight = null;

  const scale = () => scaleFor(cam.zoom);

  function topLeft() {
    const [cx, cy] = project(cam.lon, cam.lat);
    const s = scale();
    return { x: cx - (size.w / 2) / s, y: cy - (size.h / 2) / s };
  }

  function toScreen(lat, lon) {
    const [wx, wy] = project(lon, lat);
    const tl = topLeft();
    const s = scale();
    return [(wx - tl.x) * s, (wy - tl.y) * s];
  }

  function toLatLng(px, py) {
    const tl = topLeft();
    const s = scale();
    const [lon, lat] = unproject(tl.x + px / s, tl.y + py / s);
    return [lat, lon];
  }

  /* ---------------- layers ---------------- */
  const layers = {
    areas: new Map(), roads: new Map(), fronts: new Map(),
    marches: new Map(), arrows: new Map(), crossings: new Map(),
    fleets: new Map(),
    battles: new Map(), places: new Map(), units: new Map(),
    regions: new Map(), markers: new Map(), highlights: new Map(),
    pins: new Map(), glows: new Map(),
  };

  const now = () => performance.now();

  /* ---------------- the bench hook ----------------

     dev/perf-lab.html asks one question — during a six-level flight, what is
     the longest single frame and how many times was the ground re-baked — and
     it has to ask it of THIS module rather than of a copy, because a copy
     answers about itself. So the counters live here.

     They are inert until a bench turns them on: `perfOn` is false in the app
     and every read of performance.now() below is behind it, so production
     pays one boolean test per frame and nothing else. Nothing in the module
     reads these values back; they are write-only. */
  let perfOn = false;
  const perf = blankPerf();

  function blankPerf() {
    return {
      frames: 0, drawMs: 0, maxDrawMs: 0, over32: 0,
      bakes: 0, bakesSync: 0, bakeMs: 0, maxBakeMs: 0,
      // The number that decides whether the map feels continuous: the longest
      // the thread was held by ONE task of baking, sliced or not.
      maxSliceMs: 0, slices: 0,
      // Why a bake had to happen inside the frame. Named, because "three sync
      // bakes" is not actionable and "two of them were the buffer no longer
      // covering the viewport" is.
      syncCover: 0, syncReady: 0, syncOther: 0, syncAt: [],
      points: 0, features: 0, culled: 0,
    };
  }

  function progressOf(spec) {
    if (spec.instant || !spec.over) return 1;
    if (spec.t0 == null) return 1;
    return clamp((now() - spec.t0) / (spec.over * 1000), 0, 1);
  }

  function makeLayer(name, { dom = false } = {}) {
    const store = layers[name];
    return {
      add(spec) {
        const id = spec.id || `${name}-${store.size + 1}`;
        const prev = store.get(id);
        store.set(id, {
          ...spec, id,
          t0: spec.instant ? null : (prev?.t0 ?? now()),
        });
        schedule();
        return id;
      },
      update(id, patch) {
        const s = store.get(id);
        if (s) { store.set(id, { ...s, ...patch }); schedule(); }
      },
      remove(id) { store.delete(id); if (dom) dropNode(id); schedule(); },
      clear() { for (const id of store.keys()) if (dom) dropNode(id); store.clear(); schedule(); },
      get: (id) => store.get(id) || null,
      all: () => [...store.values()],
      get size() { return store.size; },
    };
  }

  /* ---------------- palette ---------------- */
  let palette = readPalette();

  function readPalette() {
    const cs = getComputedStyle(host);
    const v = (n, f) => (cs.getPropertyValue(n).trim() || f);
    return {
      water: v('--atlas-water', '#8fb2c9'),
      waterDeep: v('--atlas-water-deep', '#7ba3bd'),
      land: v('--atlas-land', '#f4ecd8'),
      wood: v('--atlas-wood', '#e4e3c6'),
      coast: v('--atlas-coast', '#5d4f3a'),
      coastW: parseFloat(v('--atlas-coast-w', '1.1')) || 1.1,
      river: v('--atlas-river', '#6f9ab6'),
      riverW: parseFloat(v('--atlas-river-w', '1')) || 1,
      border0: v('--atlas-border-0', 'rgba(60,48,32,.62)'),
      border0W: parseFloat(v('--atlas-border-0-w', '1.6')) || 1.6,
      border1: v('--atlas-border-1', 'rgba(60,48,32,.40)'),
      border1W: parseFloat(v('--atlas-border-1-w', '1.1')) || 1.1,
      ink: v('--atlas-ink', '#241f18'),
      inkQuiet: v('--atlas-ink-quiet', '#5b5240'),
    };
  }

  const side = (id) => factions[id] || factions.neutral || DEFAULT_FACTIONS.neutral;

  function colourOf(id) {
    const f = side(id);
    const dark = host.closest('[data-theme="dark"]') ||
      (!host.closest('[data-theme="light"]') && matchMedia('(prefers-color-scheme: dark)').matches);
    const fill = (dark && f.fillDark) || f.fill || '#55704c';
    return {
      fill,
      line: (dark && f.lineDark) || f.line || f.fill || '#55704c',
      // Large areas get their own colour; everything else uses the line hue.
      wash: (dark && f.washDark) || f.wash || fill,
    };
  }

  /**
   * The colour one region is filled with.
   *
   * All thirteen colonies are on the same side, and filling them all with
   * that side's one wash is how the map ends up as a single blue smear with
   * thirteen names floating on it. The side decides the family; the region's
   * own position in the set decides which member of the family it gets.
   */
  function fillForRegion(s) {
    if (!s.faction) return palette.border0;
    const c = colourOf(s.faction);
    const base = c.wash || c.fill;
    if (s.tint == null || !(s.of > 1) || s.vary === false) return base;
    return tintFor(base, s.tint, s.of);
  }

  /* ---------------- administrative boundaries ---------------- */
  let borders = { country: true, state: false, local: false };
  let regionSet = null;

  // The ground buffer caches whatever was drawn into it, boundaries included,
  // so a toggle has to invalidate it or nothing appears until you pan.
  const borderKey = () =>
    `${borders.country ? 1 : 0}${borders.state ? 1 : 0}${borders.local ? 1 : 0}`;

  /* ---------------- sizing ---------------- */
  function resize() {
    const r = host.getBoundingClientRect();
    size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    schedule();
  }

  /* ---------------- draw ---------------- */
  let pending = false;
  let levelWanted = null;
  let detailPending = false;

  /**
   * Pull the pack's close-in geometry in and bake it, once.
   *
   * Public, because the honest moment to start a 1.5-2.8 MB fetch is when the
   * chapter loads and we already know which pack it is — not from inside
   * draw(), on the first frame a flight crosses detail.minZoom, which is the
   * one moment the main thread is busiest. engine/scenes/map.js calls this at
   * mount; draw() still calls it as a fallback.
   *
   * Deliberately NOT awaited by the caller and deliberately not throwing: rule
   * 3's shape one layer over. A harbour that fails to arrive is a coarser map,
   * not a broken chapter.
   *
   * On arrival it bumps groundStamp rather than nulling bufState. Throwing the
   * buffer away would mean the very next frame has nothing to draw and must
   * bake synchronously — the arrival of a download turning into a stall. The
   * buffer is merely out of date: still the right ground at the right zoom,
   * just without the harbour in it. So it keeps drawing and the re-bake is
   * deferred like any other drift.
   */
  function warmDetail() {
    if (detailPending) return;
    detailPending = true;
    // Which box: a course may declare several and they are megabytes each.
    loadDetail(cam.zoom, cam.lon, cam.lat)
      .then(() => { groundStamp += 1; schedule(); })
      .catch(() => {})
      .finally(() => { detailPending = false; });
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; draw(); });
  }

  function anyAnimating() {
    for (const store of Object.values(layers)) {
      for (const s of store.values()) if (progressOf(s) < 1) return true;
    }
    return flight != null;
  }

  let lastCam = '';
  let lastZoom = NaN;

  function draw() {
    if (!perfOn) return drawFrame();
    const t0 = now();
    drawFrame();
    const ms = now() - t0;
    perf.frames += 1;
    perf.drawMs += ms;
    if (ms > perf.maxDrawMs) perf.maxDrawMs = ms;
    if (ms > 32) perf.over32 += 1;
    return undefined;
  }

  function drawFrame() {
    if (flight) stepFlight();

    // Tell the caller when the view actually moved. Fired from the draw
    // rather than from the input handlers, so a flight, a fit and a pinch all
    // report the same way and nothing has to poll.
    const camKey = `${cam.lat.toFixed(5)},${cam.lon.toFixed(5)},${cam.zoom.toFixed(3)}`;
    if (camKey !== lastCam) {
      if (cam.zoom !== lastZoom) { lastZoom = cam.zoom; zoomMovedAt = now(); }
      lastCam = camKey;
      camMovedAt = now();
      onCamera({ lat: cam.lat, lon: cam.lon, zoom: cam.zoom });
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const want = levelFor(cam.zoom, cam.lon, cam.lat);
    if (want !== levelWanted) {
      levelWanted = want;
      loadLevel(want, geoBase).then(schedule).catch(() => {});
    }
    // The camera has arrived somewhere the close-in geometry covers and we do
    // not have it. This is the LATE path and it is a fallback: warmDetail()
    // below is meant to have started it at chapter load, long before anyone
    // flew anywhere. It stays because a pack that never calls warmDetail, or
    // a camera that reaches the box by a route nobody expected, must still get
    // its harbour.
    if (detailWanted(cam.zoom, cam.lon, cam.lat)) warmDetail();

    const tl = topLeft();
    paintGround(tl, want);

    const pts = (coords) => coords.map(([la, lo]) => toScreen(la, lo));

    // Under even the regions: this is atmosphere, not a claim about ground.
    for (const s of layers.glows.values()) {
      const mppNow = metresPerPixel(cam.lat, cam.zoom);
      drawGlow(ctx, toScreen(s.at[0], s.at[1]),
               (s.radiusKm * 1000) / mppNow,
               { fill: colourOf(s.faction).fill, progress: progressOf(s) });
    }

    // Regions sit under the campaign: they are the ground's political shape,
    // not an event on it. Drawn as one layer rather than one at a time,
    // because a border between two of them belongs to both — see drawRegions.
    drawRegions(ctx, [...layers.regions.values()]
      .filter((s) => (s.coords || []).length)
      .map((s) => ({
        rings: s.coords.map(pts),
        fill: fillForRegion(s),
        progress: progressOf(s),
        strength: s.strength ?? (s.faction ? 3.0 : 1),
      })), { line: palette.border0, width: palette.border0W });
    for (const s of layers.areas.values()) {
      drawArea(ctx, (s.rings || [s.coords]).map(pts), { ...colourOf(s.faction), progress: progressOf(s) });
    }
    for (const s of layers.roads.values()) {
      drawMarch(ctx, pts(s.coords), { line: palette.inkQuiet, width: s.width || 1.8, progress: 1 });
    }
    for (const s of layers.fronts.values()) {
      drawFront(ctx, pts(s.coords), { ...colourOf(s.faction), facing: s.facing ?? 1,
                                      fluid: s.fluid, progress: progressOf(s) });
    }
    for (const s of layers.marches.values()) {
      drawMarch(ctx, pts(s.coords), { line: colourOf(s.faction).line, naval: s.naval,
                                      width: s.width || 3.2, progress: progressOf(s) });
    }
    // Ships ride ON the water and under the pins, so they draw after the
    // marches and before the arrows.
    for (const s of layers.fleets.values()) {
      const c = colourOf(s.faction);
      drawFleet(ctx, pts(s.coords), { line: c.line, fill: c.fill, kind: s.kind,
                                      // No halo colour passed: the default is
                                      // white, and a ship is always on water.
                                      ships: s.ships,
                                      spacing: s.spacing, progress: progressOf(s) });
    }
    const mpp = metresPerPixel(cam.lat, cam.zoom);
    for (const s of layers.arrows.values()) {
      drawArrow(ctx, pts(s.coords), { ...colourOf(s.faction), strength: s.strength,
                                      mpp, widthM: s.widthM,
                                      viewport: Math.min(size.w, size.h),
                                      ghost: s.ghost, progress: progressOf(s) });
    }
    for (const s of layers.crossings.values()) {
      const [a, b] = pts([s.from, s.to]);
      drawCrossing(ctx, a, b, { line: colourOf(s.faction).line, progress: progressOf(s) });
    }
    for (const s of layers.battles.values()) {
      drawBattle(ctx, toScreen(s.at[0], s.at[1]), { ...colourOf(s.faction), scale: s.scale,
                                                    kind: s.kind, progress: progressOf(s) });
    }

    syncOverlay();

    const extra = creditFor(cam.zoom, cam.lon, cam.lat);
    const line = [credit, extra].filter(Boolean).join(' · ');
    if (creditEl.textContent !== line) creditEl.textContent = line;

    if (anyAnimating()) schedule();
  }

  /**
   * Is the ZOOM changing — not "did it change on this frame". See MOVE_MS.
   *
   * Only the zoom, because only the zoom can make the buffer soft: quantising
   * during a PAN would leave a still map blurred for no reason at all. A
   * flight counts even before its first frame has run, which is what lets the
   * ground for a flight be asked for the moment the flight is declared.
   */
  const zooming = () =>
    (!!flight && Math.abs(flight.to.zoom - flight.from.zoom) > 1e-6)
    || now() - zoomMovedAt < MOVE_MS;

  /**
   * Which zoom to take a bake at.
   *
   * While the zoom is changing, the `quantise` step at or below it. The
   * buffer is being scaled anyway, so the exact zoom buys nothing; what the
   * step buys is that the drift is never more than one of them — the ground
   * can no longer soften and snap by an arbitrary amount depending on where a
   * flight's easing happened to cross a threshold — and that the same flight
   * re-bakes at the same zooms every time, which is what makes the bench
   * repeatable.
   *
   * The moment it settles the bake goes back to the live zoom, so a still map
   * is pixel for pixel what it always was. A quantised bake left standing
   * would be permanently, pointlessly soft.
   *
   * DOWN to the step, not to the nearest. A buffer taken at a lower zoom than
   * the camera's covers MORE ground, and a buffer that stops covering the
   * viewport is the one case that has to be re-baked inside the frame — it
   * would otherwise leave the edges of the picture empty. Rounding to the
   * nearest step put the bake above the camera half the time and cost eight
   * such bakes in a six-level flight; flooring costs none, and the ground is
   * never blurrier than it already was (the slack it replaces was wider).
   */
  function bakeZoom() {
    if (!quantise || !zooming()) return cam.zoom;
    return clamp(Math.floor(cam.zoom / quantise) * quantise, minZoom, maxZoom);
  }

  /* How far ahead a bake looks when the camera is flying. Long enough to
     outlast the bake itself and the next few frames, short enough that the
     buffer is not mostly ground the camera has already left. */
  const LEAD_MS = 600;

  /**
   * The world-pixel centre of the viewport, LEAD_MS from now.
   *
   * Uses the flight's own easing, so it is where the camera will really be
   * and not where a straight line says it should be. With no flight running
   * it is simply where the camera is: a pan cannot be predicted and a still
   * camera has nowhere to go.
   */
  function camAhead(ms) {
    const s = scale();
    if (!flight) {
      const tl = topLeft();
      return { x: tl.x + (size.w / s) / 2, y: tl.y + (size.h / s) / 2, zoom: cam.zoom };
    }
    const t = clamp((now() + ms - flight.t0) / flight.ms, 0, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const f = flight.from, g = flight.to;
    const [x, y] = project(f.lon + (g.lon - f.lon) * e,
                           f.lat + (g.lat - f.lat) * e);
    return { x, y, zoom: f.zoom + (g.zoom - f.zoom) * e };
  }

  /** Will the buffer still cover the frame `ms` from now? */
  function willCover(ms) {
    if (!bufState) return false;
    const a = camAhead(ms);
    const sa = scaleFor(a.zoom);
    const sb = scaleFor(bufState.zoom);
    const ax = a.x - (size.w / 2) / sa;
    const ay = a.y - (size.h / 2) / sa;
    return ax >= bufState.x && ay >= bufState.y
      && ax + size.w / sa <= bufState.x + bufState.w / sb
      && ay + size.h / sa <= bufState.y + bufState.h / sb;
  }

  /**
   * Everything a bake needs, without doing any of it.
   *
   * `spare` prepares the OTHER sheet, so the sheet being blitted is never the
   * sheet being painted into; the swap happens only once the last step has
   * run. A bake that is half done is a sheet with sea where the land goes,
   * and the whole point of two of them is that such a sheet is never on
   * screen.
   */
  function planBake(spare) {
    const tl = topLeft();
    const s = scale();
    const want = levelFor(cam.zoom, cam.lon, cam.lat);
    const zb = bakeZoom();
    const sb = scaleFor(zb);
    const bw = Math.ceil(size.w * (1 + MARGIN * 2));
    const bh = Math.ceil(size.h * (1 + MARGIN * 2));

    /* Where to centre it.

       Not on the viewport, if the camera is going somewhere. A flight is a
       zoom AND a translation, and a buffer centred on where the camera IS
       falls off the back of it within a fraction of a second — the camera
       leaves the margin, coverage is lost, and coverage lost is the one case
       that has to be re-baked inside the frame. Measured: five such bakes in
       a 2.8 s flight, and they were the last frames over 32 ms left.

       So the bake looks ahead: it is centred on the middle of where the
       camera is now and where it will be in LEAD_MS, and it is then pulled
       back until the CURRENT viewport is certainly inside it. Nothing about
       the picture changes — the buffer is bigger than the frame either way —
       it just stops being stale a moment after it is made. */
    const then = camAhead(LEAD_MS);
    const midX = (tl.x + (size.w / s) / 2 + then.x) / 2;
    const midY = (tl.y + (size.h / s) / 2 + then.y) / 2;

    // Centre in the world units the BAKE zoom uses, not the live one — a
    // buffer taken at a different zoom covers a different amount of ground,
    // and measuring it with the wrong scale is how it reports itself as
    // covering ground it does not.
    const worldW = bw / sb, worldH = bh / sb;
    const bx = clamp(midX - worldW / 2,
                     Math.min(tl.x, tl.x + size.w / s - worldW), tl.x);
    const by = clamp(midY - worldH / 2,
                     Math.min(tl.y, tl.y + size.h / s - worldH), tl.y);

    if (spare && !sheets[1]) sheets[1] = makeSheet();
    const sheet = spare ? sheets[sheetIx ? 0 : 1] : sheets[sheetIx];
    if (sheet.c.width !== Math.round(bw * dpr)
        || sheet.c.height !== Math.round(bh * dpr)) {
      sheet.c.width = Math.round(bw * dpr);
      sheet.c.height = Math.round(bh * dpr);
    }
    /* A bake abandoned half way leaves its save() calls outstanding, and the
       next one would then nest inside them until the stack ran away. restore()
       on an empty stack is defined to do nothing, so unwinding further than
       any bake can nest is both safe and enough. */
    for (let i = 0; i < 4; i += 1) sheet.x.restore();
    sheet.x.setTransform(dpr, 0, 0, dpr, 0, 0);
    sheet.x.clearRect(0, 0, bw, bh);

    const { steps, stats } = bakeSteps(sheet.x, { x: bx, y: by, zoom: zb },
                                       { w: bw, h: bh }, palette, want, borders);
    return {
      steps, stats, i: 0, spare, sheet,
      ix: spare ? (sheetIx ? 0 : 1) : sheetIx,
      state: { zoom: zb, level: want, palette, borders: borderKey(),
               x: bx, y: by, w: bw, h: bh,
               // Was the geometry actually there when this buffer was
               // painted? If the level was still in flight, the bake filled
               // it with water and stopped — and every check would then call
               // that buffer fresh, so it got blitted for good and the land
               // never appeared. The story map hid this because its camera
               // never stops moving, which invalidates the buffer anyway;
               // Explore fits once at boot and then holds still, so it kept
               // the empty one.
               ready: levelReady(want), stamp: groundStamp },
    };
  }

  /** Charge a finished bake to the bench, and put it on screen. */
  function finishBake(plan, ms) {
    if (perfOn) {
      /* Canvas commands are QUEUED, so this timer is honest about how long it
         took to DESCRIBE the ground and says little about rasterising it. The
         rasterising surfaces in the frame clock instead, which is where a
         viewer meets it anyway.

         A flush was tried here and thrown out: it made the bench charge a
         readback of its own to every bake, on top of the one the slicer
         already does. What one bake really costs is asked separately, at
         rest, by bench.bakeCost(). */
      perf.bakes += 1;
      if (!plan.spare) perf.bakesSync += 1;
      perf.bakeMs += ms;
      if (ms > perf.maxBakeMs) perf.maxBakeMs = ms;
      perf.points += plan.stats.points;
      perf.features += plan.stats.features;
      perf.culled += plan.stats.culled;
    }
    sheetIx = plan.ix;
    bufState = plan.state;
  }

  /** Re-render the ground now, in one go, because the picture needs it now. */
  function bakeGround(spare) {
    stopSplit();
    const t0 = perfOn ? now() : 0;
    const plan = planBake(spare);
    for (const step of plan.steps) step.run();
    if (perfOn) flushSheet(plan.sheet);
    const ms = perfOn ? now() - t0 : 0;
    if (perfOn) {
      perf.slices += 1;
      if (ms > perf.maxSliceMs) perf.maxSliceMs = ms;
    }
    finishBake(plan, ms);
  }

  /* A bake that is wanted but not needed, run a slice at a time.

     Deferring the whole thing keeps the picture correct but still holds the
     thread for as long as the bake takes, and 90 ms is 90 ms whichever task
     it happens in. So the steps are run against a budget and what does not
     fit goes to the next task.

     Two things about that budget, both learned by getting them wrong:

     The budget is WORK, not time. Canvas commands are queued, so a step
     returns in a tenth of a millisecond however much it submitted; a
     wall-clock budget therefore ran every step in the first task and the bill
     arrived, undivided, in the blit. Each step declares what it costs
     instead — points submitted times passes over them — and 50,000 of those
     units measured about 16 ms on the machine this was tuned on.

     And each slice has to be MADE to rasterise before yielding, or the same
     thing happens one level up: the queue simply grows across the slices and
     empties all at once. Reading a single pixel back forces the flush. It is
     the one deliberate readback in the module and it costs about a
     millisecond, against turning one 90 ms hole into five 18 ms ones.

     Timers throughout, never animation frames: a backgrounded tab stops
     delivering frames and would leave a half-painted spare sheet standing for
     ever, which is rule 2 exactly. */
  const SLICE_COST = 25000;
  let split = null;
  /* dev/perf-lab.html sets this false to put the old behaviour back — every
     bake inside the frame, whole — and check that the frame clock notices.
     A bench nobody has seen fail is a bench nobody knows works. */
  let deferBakes = true;

  function stopSplit() {
    if (split?.timer) clearTimeout(split.timer);
    split = null;
    clearTimeout(bakeTimer);
    bakeTimer = 0;
  }

  /* One deferred bake at a time, and not back to back. Without the interval,
     a prediction the next bake cannot satisfy — the camera crossing more
     ground than a buffer holds — asks for another one the moment the last
     finishes, and the map bakes for ever instead of drawing. */
  const BAKE_GAP_MS = 120;
  let lastBakeAt = -1e9;

  function wantBake() {
    if (bakeTimer || split) return;
    const wait = Math.max(0, BAKE_GAP_MS - (now() - lastBakeAt));
    bakeTimer = setTimeout(() => {
      bakeTimer = 0;
      split = planBake(true);
      split.ms = 0;
      runSlice();
    }, wait);
  }

  function runSlice() {
    const plan = split;
    if (!plan) return;
    const t0 = now();
    let cost = 0;
    // Test the budget BEFORE taking a step, not after. Testing afterwards let
    // a slice that was already at the limit take one more 16 ms layer, which
    // is how a 25,000-unit budget produced a 46,000-unit slice and the
    // longest hold of the whole gesture. A slice is now one step, or as many
    // as fit — never one too many.
    while (plan.i < plan.steps.length) {
      const step = plan.steps[plan.i];
      if (cost && cost + step.cost > SLICE_COST) break;
      plan.i += 1;
      cost += step.cost;
      step.run();
    }

    // Make this slice pay for itself now rather than letting the queue grow.
    // The LAST one too: whatever is still queued when the sheets are swapped
    // is paid for inside the blit, which is a frame, which is the one place
    // this is all trying to keep the work out of.
    flushSheet(plan.sheet);
    const done = plan.i >= plan.steps.length;
    const ms = now() - t0;
    plan.ms += ms;
    if (perfOn) {
      perf.slices += 1;
      if (ms > perf.maxSliceMs) perf.maxSliceMs = ms;
    }

    if (!done) { plan.timer = setTimeout(runSlice, 0); return; }
    split = null;
    lastBakeAt = now();
    finishBake(plan, plan.ms);
    schedule();
  }

  function paintGround(tl, want) {
    const s = scale();

    /* Re-baking the ground on every frame of a zoom is what made a fly-over
       crawl: a 2.6 s flight changed the zoom ~150 times and re-walked every
       coastline, pond and wood each time. Measured at 81 ms a frame on this
       machine, twelve frames a second. So while the camera is moving the
       existing bake is SCALED instead.

       The coverage test has to use the zoom the buffer was baked at rather
       than the live one, or a scaled buffer is measured against the wrong
       world size and reports itself as covering ground it does not. */
    const sBuf = bufState ? scaleFor(bufState.zoom) : s;
    const covers = !!bufState
      && tl.x >= bufState.x && tl.y >= bufState.y
      && tl.x + size.w / s <= bufState.x + bufState.w / sBuf
      && tl.y + size.h / s <= bufState.y + bufState.h / sBuf;

    // A buffer that is the wrong picture cannot be shown for even one frame:
    // the wrong level, the wrong palette, no ground in it at all, or none of
    // it under the viewport, which would leave the edges of the frame empty.
    const wrong = !bufState
      || !bufState.ready
      || bufState.palette !== palette
      || bufState.borders !== borderKey()
      || !covers;

    /* A buffer that is merely out of date. Soft for a beat is invisible.

       With quantising on, the test is against the STEP: the bake is stale the
       moment the live zoom falls past a different one, which is a fixed
       thirteen times across a 6.4-level flight rather than "whenever the
       easing crosses 0.55, wherever that lands". With it off the old slack
       applies, which is what dev/perf-lab.html turns back on to check that it
       can still see the difference. */
    const zb = bakeZoom();
    const zoomStale = (zooming() && !quantise)
      ? Math.abs(cam.zoom - (bufState?.zoom ?? 0)) > ZOOM_SLACK
      : Math.abs((bufState?.zoom ?? 0) - zb) > 1e-6;
    /* Two more things count as drift rather than as wrongness.

       A LEVEL change. Crossing from world-50m to the regional extract
       mid-flight used to force a bake inside the frame and did not have to:
       the coarse coastline and the fine one are the same shore to within a
       kilometre, and holding the coarse one for another hundred milliseconds
       is not something anyone can see. A palette change is not like this —
       that one really is the wrong picture, and it stays above.

       And coverage about to be LOST, which is worth predicting precisely
       because losing it is the one thing that cannot be deferred: a buffer
       that no longer reaches the edge of the frame leaves the edge undrawn.
       Those were the last frames over 32 ms in a flight. A lead of warning is
       enough to bake beside the frame instead, and the prediction only has to
       be roughly right — being wrong just means the old behaviour, one bake
       in one frame. */
    const drifted = !!bufState
      && (zoomStale || bufState.level !== want || bufState.stamp !== groundStamp
          || !willCover(LEAD_MS));

    /* Only a WRONG buffer is worth a frame. Drift never is — not even the
       sharpening bake after the camera stops, which used to be synchronous
       and was the single longest task in a wheel gesture at 52 ms, arriving
       160 ms after the fingers had left. Nobody is waiting for it; the ground
       is a fifth of a zoom level soft until it lands. */
    if (wrong) {
      if (perfOn) {
        if (bufState && !covers) { perf.syncCover += 1; perf.syncAt.push(+cam.zoom.toFixed(2)); }
        else if (!bufState || !bufState.ready) perf.syncReady += 1;
        else perf.syncOther += 1;
      }
      bakeGround(false);
    } else if (drifted) { if (deferBakes) wantBake(); else bakeGround(false); }

    const b = sheets[sheetIx].c;
    const ox = (bufState.x - tl.x) * s;
    const oy = (bufState.y - tl.y) * s;
    // k is 1 whenever the bake is at the live zoom, so a still map is pixel
    // for pixel what it always was.
    const k = s / scaleFor(bufState.zoom);
    ctx.drawImage(b, ox, oy, bufState.w * k, bufState.h * k);

    /* A scaled bake has to be redeemed. Nothing else will schedule a frame
       once the camera stops — a flight keeps them coming, a wheel notch does
       not — so ask for one just after the move window closes, or the ground
       stays soft for as long as you leave it alone, which is exactly the
       wrong way round. */
    if (k !== 1 && !flight) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(schedule,
        Math.max(30, MOVE_MS - (now() - zoomMovedAt) + 30));
    }
  }

  /* ---------------- overlay: labels and unit counters ---------------- */
  const nodes = new Map();

  function dropNode(id) {
    const n = nodes.get(id);
    if (n) { n.remove(); nodes.delete(id); }
  }

  function nodeFor(id, build) {
    let n = nodes.get(id);
    if (!n) { n = build(); nodes.set(id, n); overlay.appendChild(n); }
    return n;
  }

  function syncOverlay() {
    const live = new Set();
    const labels = [];

    for (const s of layers.places.values()) {
      if (s.minZoom != null && cam.zoom < s.minZoom) { dropNode(s.id); continue; }
      live.add(s.id);
      const n = nodeFor(s.id, () => {
        const el = document.createElement('div');
        el.className = `atlas-place atlas-place--${s.kind || 'city'}`;
        return el;
      });
      // Only on change. Assigning textContent replaces the child nodes and
      // dirties layout, so writing the same string every frame turned the very
      // next measurement into a forced reflow, once per label per frame.
      if (n.textContent !== s.name) n.textContent = s.name;
      const m = pointMetrics(n, s.name);
      const [x, y] = toScreen(s.coords[0], s.coords[1]);
      const put = placePoint(x, y, m);
      setSide(n, 'place', put && put.side);
      if (!put) { n.style.visibility = 'hidden'; continue; }
      n.style.transform = `translate3d(${put.tx}px, ${put.ty}px, 0)`;
      n.style.visibility = '';
      labels.push({ n, x, y, box: put.box,
                    rank: s.kind === 'city' ? 3 : s.kind === 'region' ? 2 : 1 });
    }

    // Counters are wide and armies gather in the same place, so plain
    // positioning stacks them illegibly. Push each one clear of the last.
    const taken = [];
    /* THE REGION NAME IS NOT DRAWN, and this is where it used to be.

       It was asked to go a dozen times and was answered four times with a
       different font size, then with one line of CSS —
       `.atlas-place--region { display: none !important }` — while this loop
       went on building the node, measuring it, placing it, ranking it above
       every city name and handing it a tap target. Hidden is not removed: on
       a phone holding an older stylesheet the name was back, and it behaved
       exactly as reported — arriving near the end of one scene, jumping to a
       different place on screen when the next scene re-showed the region from
       a new camera, then vanishing at the clear.

       The wash carries the area and the narration names it. `region.show` no
       longer takes a `label`, so a chapter cannot ask for one either.
       A city and a town are untouched: they are drawn above, from
       layers.places. */

    // A pin names one spot the narration is talking about right now.
    for (const s of layers.markers.values()) {
      live.add(s.id);
      const n = nodeFor(s.id, () => {
        const el = document.createElement('div');
        el.className = 'atlas-pin';
        el.innerHTML = '<i></i><b></b>';
        return el;
      });
      n.style.setProperty('--faction', colourOf(s.faction).fill);
      const chip = n.querySelector('b');
      const text = s.label || '';
      if (chip.textContent !== text) chip.textContent = text;
      n.classList.toggle('atlas-pin--bare', !s.label);
      setTap(n, s.tap, s.label);
      const [x, y] = toScreen(s.at[0], s.at[1]);
      // A bare pin is a dot, and a dot cannot run off anything its own
      // coordinate does not. Only the chip has to be placed.
      const put = s.label ? placePin(n, x, y) : barePin(n, x, y);
      setSide(n, 'pin', put && put.side);
      if (!put) { n.style.visibility = 'hidden'; continue; }
      n.style.transform = `translate3d(${put.tx}px, ${put.ty}px, 0)`;
      n.style.visibility = '';
      // A pin is the one thing the narration is pointing at right now, so it
      // enters the collision pass at a rank nothing can outbid — and the place
      // names underneath it get out of the way. Leaving pins out of the pass
      // was why "Boston" landed squarely on top of "Boston Common", which at
      // harbour zoom is six pixels away, and why the Concord pin sat on
      // "North Bridge".
      if (s.label) labels.push({ n, x, y, box: put.box, rank: 20 });
    }

    // A ring is the equivalent of pointing at the map while you talk.
    for (const s of layers.highlights.values()) {
      live.add(s.id);
      const n = nodeFor(s.id, () => {
        const el = document.createElement('div');
        el.className = 'atlas-ring';
        return el;
      });
      n.style.setProperty('--faction', colourOf(s.faction).fill);
      n.classList.toggle('atlas-ring--still', !!s.instant);
      const [x, y] = toScreen(s.at[0], s.at[1]);
      n.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      n.style.visibility = onScreen(x, y, 120) ? '' : 'hidden';
    }

    /* Pins the caller draws itself.
       Everything else in this overlay has a shape the module decides — a place
       name, a commander chip, a ring. Explore's event markers are none of
       those: they carry a glyph, a side, an importance and a selected state,
       with styling that predates this module. Rather than bend them into a
       shape that does not fit, or make Explore position its own DOM and
       duplicate the projection, the module positions and the caller supplies
       the markup. */
    for (const s of layers.pins.values()) {
      if (s.minZoom != null && cam.zoom < s.minZoom) { dropNode(s.id); continue; }
      live.add(s.id);
      const n = nodeFor(s.id, () => {
        const el = document.createElement('div');
        // Bound once and dispatched through the node, because the spec object
        // is replaced on every add() and a captured one goes stale.
        el.addEventListener('click', () => n._onClick?.(s.id));
        return el;
      });
      n._onClick = s.onClick;
      if (n._cls !== s.className) { n.className = s.className || ''; n._cls = s.className; }
      if (n._html !== s.html) { n.innerHTML = s.html || ''; n._html = s.html; }
      if (s.z != null) n.style.zIndex = String(s.z);
      const [x, y] = toScreen(s.at[0], s.at[1]);
      n.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      n.style.visibility = onScreen(x, y, 140) ? '' : 'hidden';
      if (s.rank != null) labels.push({ n, x, y, rank: s.rank });
    }

    for (const s of layers.units.values()) {
      live.add(s.id);
      const f = side(s.faction);
      const n = nodeFor(s.id, () => {
        const el = document.createElement('div');
        el.className = 'atlas-unit';
        el.addEventListener('click', () => onSelect(s.id));
        return el;
      });
      n.style.setProperty('--faction', colourOf(s.faction).fill);
      n.innerHTML =
        `<span class="atlas-unit__flag">${f.flag || ''}</span>` +
        `<span class="atlas-unit__text">` +
          `<span class="atlas-unit__name">${esc(s.commander || f.label || '')}</span>` +
          (s.strength ? `<span class="atlas-unit__n">${fmt(s.strength)}</span>` : '') +
        `</span>`;
      const [x, y] = toScreen(s.at[0], s.at[1]);
      const w = n.offsetWidth || 150;
      let dy = 0;
      for (let guard = 0; guard < 12; guard++) {
        const hit = taken.some((t) =>
          Math.abs(t.x - x) < (t.w + w) / 2 && Math.abs(t.y - (y + dy)) < 30);
        if (!hit) break;
        dy = dy <= 0 ? -dy + 32 : -dy;      // alternate below, above, further
      }
      taken.push({ x, y: y + dy, w });
      n.style.transform = `translate3d(${x}px, ${y + dy}px, 0)`;
      n.style.setProperty('--lean', `${-dy}px`);
      n.style.visibility = onScreen(x, y, 140) ? '' : 'hidden';
    }

    declutter(labels);
    for (const id of [...nodes.keys()]) if (!live.has(id)) dropNode(id);
  }

  const pickLabel = (field) =>
    (field && (field[lang] ?? field.no ?? field.en)) || null;

  /* ---------------- where a point label goes ----------------

     THE ORDER IS RIGHT, LEFT, ABOVE, BELOW, AND THE FIRST FIT WINS.

     A point label is attached to a dot. An area name may slide along its own
     ground because the ground is what it names; a point name may not, because
     move it and it is naming the next village along. So it moves to the other
     SIDE of its anchor instead, which is what every printed atlas does.

     Right first: in a left-to-right script the eye finds the dot and reads on,
     and that is where every name on the map already is, so a flip is the
     exception and reads as one. Left is its mirror and costs the reader
     nothing but a glance. Above and below break the reading line, so they are
     last -- but they are the only thing left when the words are wider than the
     room on either side of the dot, which on a 390 px phone is common.

     Measured: Barbaresco's anchor sits 27 px from the right edge, so an 80 px
     name ran 374 -> 455 and lost 65 px of itself off the frame. Flipped left
     it spans 283 -> 358, comfortably inside.

     A pure function of (anchor, metrics, viewport) and nothing else. There is
     deliberately NO memory of the side chosen last frame: "keep the old side
     unless it stops fitting" is hysteresis, which is the accumulation rule 1
     forbids -- seek to the same second twice and the two pictures would
     disagree, and dev/engine-lab.html exists to catch exactly that. */
  const SIDES = ['right', 'left', 'above', 'below'];

  /* Right is the default and carries no class, so a map with nothing near an
     edge writes the same DOM it always did.

     The names are written out rather than composed. A class this module only
     ever builds as `${base}--${side}` appears nowhere in the source, so
     tools/check-dead-css.py reads the stylesheet rule as dead — and it is
     right to: a name nothing writes literally is a name nobody can grep for
     either. */
  const SIDE_CLASS = {
    place: ['atlas-place--left', 'atlas-place--above', 'atlas-place--below'],
    pin: ['atlas-pin--left', 'atlas-pin--above', 'atlas-pin--below'],
  };

  function setSide(n, kind, side) {
    const [l, a, b] = SIDE_CLASS[kind];
    n.classList.toggle(l, side === 'left');
    n.classList.toggle(a, side === 'above');
    n.classList.toggle(b, side === 'below');
  }

  /* Room to leave around the frame. EDGE keeps the halo off the very last
     pixel; ANCHOR_INSET is half the dot plus its halo ring, so a label is
     drawn only where its own dot is wholly on screen. A dot hanging over the
     edge points at ground the viewer cannot see. */
  const EDGE = 2;
  const ANCHOR_INSET = 6;

  const inFrame = (x, y) =>
    x >= ANCHOR_INSET && y >= ANCHOR_INSET
    && x <= size.w - ANCHOR_INSET && y <= size.h - ANCHOR_INSET;

  const fitsFrame = (b) =>
    b.x >= EDGE && b.y >= EDGE
    && b.x + b.w <= size.w - EDGE && b.y + b.h <= size.h - EDGE;

  /**
   * The node's own type metrics, cached on it.
   *
   * `ox`/`oy` are what the STYLESHEET says about the offset from the anchor to
   * the words: `ox` is the `--dot-gap` margin resolved to pixels, `oy` the
   * `--dot-rise`. Read off the node rather than restated here, so both numbers
   * live in css/atlas.css and nowhere else; `ox` doubles as the gap to leave
   * above and below, and is 0 for an area name, which has no dot.
   *
   * Measuring forces layout. Doing it per label per frame is what declutter()
   * used to do and what measureLabel() was written to stop, so this measures
   * on change only: the text, or the font generation.
   */
  function pointMetrics(n, text) {
    if (n._ptIn !== text || n._ptGen !== metricsGen) {
      n._ptIn = text;
      n._ptGen = metricsGen;
      n._pt = boxOf(n);
    }
    return n._pt;
  }

  /**
   * A node's untransformed box, in the overlay's own coordinates.
   *
   * Rects, not offsetLeft/offsetWidth, because those are rounded to whole
   * pixels — and a label placed against a box a third of a pixel out of
   * position lands on the wrong side of an edge test. Measured: a town name
   * at (10, 10) has its box top at 2.3 and offsetTop reported 2.0, so the two
   * corner labels of a 390 px frame were dropped as "does not fit" by 0.0 px.
   * The same rounding put a pin's dot up to half a pixel off its coordinate.
   *
   * The transform is cleared for the read, so what comes back is where the
   * stylesheet puts the node and not where the last frame did. Both writes
   * happen inside one measurement, which is rare — see pointMetrics.
   */
  function boxOf(n) {
    const had = n.style.transform;
    n.style.transform = 'none';
    const r = n.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    n.style.transform = had;
    return { w: r.width, h: r.height, ox: r.left - o.left, oy: r.top - o.top };
  }

  /** Where the words land, in viewport pixels, for one side. */
  function pointBox(side, x, y, m) {
    if (side === 'left')  return { x: x - m.ox - m.w, y: y + m.oy, w: m.w, h: m.h };
    if (side === 'above') return { x: x - m.w / 2, y: y - m.ox - m.h, w: m.w, h: m.h };
    if (side === 'below') return { x: x - m.w / 2, y: y + m.ox, w: m.w, h: m.h };
    return { x: x + m.ox, y: y + m.oy, w: m.w, h: m.h };
  }

  /* dev/map-lab.html sets this false to put the defect back — every label hard
     right of its anchor, drawn whenever the anchor is anywhere near the frame,
     which is a visibility test and not a placement one. The bench then reports
     the labels that cross an edge, and a bench nobody has watched fail is a
     bench nobody knows works. Same reason as setCulling and setQuantise. */
  let labelSides = true;

  function placePoint(x, y, m) {
    if (!labelSides) {
      const box = pointBox('right', x, y, m);
      return onScreen(x, y)
        ? { side: 'right', tx: box.x - m.ox, ty: box.y - m.oy, box } : null;
    }
    if (!inFrame(x, y)) return null;
    for (const side of SIDES) {
      const box = pointBox(side, x, y, m);
      if (!fitsFrame(box)) continue;
      // The node is drawn at translate + its own margins, so back the margins
      // out of the box we want.
      return { side, tx: box.x - m.ox, ty: box.y - m.oy, box };
    }
    // Nothing fits. A dropped label is honest; a misplaced one is not.
    return null;
  }

  /**
   * The same four placements for a pin, which is a flex row of [dot, chip].
   *
   * Where the dot ends up INSIDE the node is a question for the browser, not
   * arithmetic: row-reverse moves it to the far end, a column puts it under
   * the chip, and each carries its own negative margin. So ask — set the
   * class, read the dot's own box, cache it. That is why the dot lands exactly
   * on its coordinate in all four, and why it keeps doing so if the chip's
   * padding ever changes. It also fixed a standing error: with `align-items:
   * center` a labelled pin's dot sat 5.75 px BELOW its coordinate while a bare
   * one sat on it.
   */
  function pinMetrics(n, side) {
    const text = n.textContent;
    let cache = n._pinM;
    if (!cache || cache.text !== text || cache.gen !== metricsGen) {
      cache = n._pinM = { text, gen: metricsGen };
    }
    if (cache[side]) return cache[side];
    const dot = n.querySelector('i');
    const hadClass = n.className;
    const hadT = n.style.transform;
    setSide(n, 'pin', side);
    n.style.transform = 'none';
    const r = n.getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    n.style.transform = hadT;
    n.className = hadClass;
    // `.atlas-pin` has no margins, so its border box IS the translate origin —
    // and the dot's offset from it is what has to be cancelled to land the dot
    // on its coordinate. Sub-pixel, for the reason boxOf() gives.
    const m = { w: r.width, h: r.height,
                dx: d.left + d.width / 2 - r.left,
                dy: d.top + d.height / 2 - r.top };
    cache[side] = m;
    return m;
  }

  const pinAt = (m, x, y) => ({ x: x - m.dx, y: y - m.dy, w: m.w, h: m.h });

  function placePin(n, x, y) {
    if (!labelSides) {
      const box = pinAt(pinMetrics(n, 'right'), x, y);
      return onScreen(x, y, 120) ? { side: 'right', tx: box.x, ty: box.y, box } : null;
    }
    if (!inFrame(x, y)) return null;
    for (const side of SIDES) {
      const box = pinAt(pinMetrics(n, side), x, y);
      if (!fitsFrame(box)) continue;
      return { side, tx: box.x, ty: box.y, box };
    }
    return null;
  }

  /** A pin with no chip: nothing to place, but the dot still has to land. */
  function barePin(n, x, y) {
    if (!inFrame(x, y)) return null;
    const box = pinAt(pinMetrics(n, 'right'), x, y);
    return { side: null, tx: box.x, ty: box.y, box };
  }

  /**
   * Measure both forms of a region name once, and cache them on the node.
   *
   * offsetWidth forces layout. Doing it for thirteen regions on every frame
   * of a fly-over is thirteen forced reflows a frame; the widths only change
   * when the text or the font does, so they are measured on change and read
   * from the node after that.
   */
  function measureLabel(n, full, short) {
    // Compare against the arguments as given, not against what they resolved
    // to. Testing the resolved `_short` never matched for a region with no
    // short form — `short` is null, `_short` fell back to the full name — so
    // every such region re-measured itself on every frame, which is the
    // forced reflow this cache exists to avoid.
    if (n._fullIn === full && n._shortIn === short && n._gen === metricsGen) return;
    n._gen = metricsGen;
    n._fullIn = full;
    n._shortIn = short;
    n._full = full;
    n._short = short || full;
    n.textContent = full;
    const b = boxOf(n);
    n._wFull = b.w;
    n._h = b.h;
    n._ox = b.ox;
    n._oy = b.oy;
    if (n._short !== full) {
      n.textContent = n._short;
      n._wShort = boxOf(n).w;
    } else {
      n._wShort = n._wFull;
    }
    n.textContent = full;
    n._showing = full;
  }

  /* Type metrics are a function of the text AND of the font, and the display
     face arrives after first paint. Every width measured before Fraunces lands
     is the fallback's, and a cache with no generation counter keeps those for
     ever — which is a label placed against a width it no longer has, and the
     one way this pass could put a name off the edge again. One promise, one
     bump, one redraw. */
  let metricsGen = 0;
  document.fonts?.ready?.then(() => { metricsGen += 1; schedule(); });

  /**
   * Throw every cached label measurement away and draw again.
   *
   * The font is not the only thing that changes a label's width. `type.scale`
   * multiplies every step of the type scale, and until this existed the only
   * thing that ever bumped `metricsGen` was `document.fonts.ready` — so a
   * live scale change restyled every name and left declutter() colliding
   * yesterday's boxes. Names overlapped and names that would now fit stayed
   * dropped, and dev/style-lab.html's section C measured the type scale as
   * FREE because it was comparing two pictures that had both been laid out
   * for 1.0. Cheap: it invalidates a cache, it does not measure anything —
   * the next draw pays for what it actually uses.
   */
  function remeasureLabels() {
    metricsGen += 1;
    schedule();
  }

  /**
   * Where a region's name goes — and, first, which name.
   *
   * The rule that matters: a label must never leave the region it names.
   * This used to clamp the name into the VIEWPORT, which on a 393 px phone
   * meant "MASSACHUSETTS" was wider than the screen edge allowed and got
   * shoved inland until it sat squarely over Connecticut. Every reader of
   * that frame learned the wrong name for a colony, which is worse than
   * learning none.
   *
   * So the name is fitted to its own ground: full name if the area is wide
   * enough for it, the atlas abbreviation if not, and if even that will not
   * fit, it stays centred and takes its chances with declutter() rather than
   * wandering off onto a neighbour.
   */
  function placeLabel(n, x0, y0, left, right, top, bottom) {
    const want = (w) => {
      const half = w / 2;
      const lo = Math.max(left + half + 2, half + EDGE);
      const hi = Math.min(right - half - 2, size.w - half - EDGE);
      return lo <= hi ? clamp(x0, lo, hi) : null;
    };
    /* Vertically too, and for the same reason. The horizontal clamp has been
       here since "MASSACHUSETTS" was shoved onto Connecticut, but nothing ever
       held a name to the TOP of the frame — a region whose centre lands three
       pixels down drew its name half above the map. Same rule: inside its own
       ground first, inside the frame second, and if the two cannot both be
       had, no name. */
    const wantY = () => {
      const lo = Math.max(top - n._oy, EDGE - n._oy);
      const hi = Math.min(bottom - n._h - n._oy, size.h - EDGE - n._h - n._oy);
      return lo <= hi ? clamp(y0, lo, hi) : null;
    };

    const y = labelSides ? wantY() : y0;
    if (y == null) return null;

    let x = n._wFull ? want(n._wFull) : x0;
    let text = n._full;
    let w = n._wFull;
    const canShrink = n._wShort < n._wFull;

    if (x == null && canShrink) {
      x = want(n._wShort);
      text = n._short;
      w = n._wShort;
    }
    // The node is drawn at translate3d(x, y) translateX(-50%), plus its own
    // margins — which for an area name are zero across and `--dot-rise` up.
    const boxAt = (cx, width) =>
      ({ x: cx + n._ox - width / 2, y: y + n._oy, w: width, h: n._h });

    if (x == null) {
      // Nothing fits. Centre it on the region — never on a neighbour — and
      // drop it if that leaves it hanging over the edge of the frame. Both
      // halves of that are the same rule: a dropped label is honest, a
      // misplaced one is not, and a name half off the screen is misplaced.
      x = x0;
      text = canShrink ? n._short : n._full;
      w = canShrink ? n._wShort : n._wFull;
      if (labelSides && !fitsFrame(boxAt(x, w))) return null;
    }
    if (n._showing !== text) { n.textContent = text; n._showing = text; }
    // Offer declutter the smaller form, if there is one still unused — and
    // only where the smaller form is itself inside the frame, or the collision
    // pass would dodge one problem into the other one.
    const sx = canShrink ? (want(n._wShort) ?? x0) : 0;
    const sbox = canShrink ? boxAt(sx, n._wShort) : null;
    const shrink = text === n._full && canShrink && fitsFrame(sbox)
      ? { text: n._short, w: n._wShort, x: sx, box: sbox }
      : null;
    return { x, y, w, box: boxAt(x, w), shrink };
  }

  /**
   * Hide labels that collide, most important first.
   *
   * Nudging is right for a unit counter, which belongs beside its army and
   * can lean. It is wrong for a place name: move "Rhode Island" far enough
   * to clear "Connecticut" and it is now labelling Connecticut. Better to
   * drop it and let the reader zoom in, which is what paper atlases do.
   */
  function declutter(labels) {
    const placed = [];
    const clear = (box) => !placed.some((p) =>
      box.x < p.x + p.w + gapX && box.x + box.w + gapX > p.x &&
      box.y < p.y + p.h + gapY && box.y + box.h + gapY > p.y);

    for (const l of labels.sort((a, b) => b.rank - a.rank)) {
      if (l.n.style.visibility === 'hidden') continue;
      /* The box comes from the placement pass, which already knows it — where
         a label sits is a decision, not something to re-derive here. Only the
         pins the CALLER draws itself (Explore's event markers) have no box,
         because their markup and their margins are not this module's; those
         still pay for a layout read. */
      const box = l.box || {
        x: l.x + l.n.offsetLeft, y: l.y + l.n.offsetTop,
        w: l.n.offsetWidth, h: l.n.offsetHeight,
      };
      if (!box.w) continue;

      let used = box;
      if (!clear(used) && l.shrink) {
        // Before dropping a name, try the short form. "New York" is 99 px on
        // a phone and collides with Massachusetts; "N.Y." is 40 and does not.
        // Dropping first is how a colony the narration just named ends up as
        // an unlabelled patch of colour.
        if (clear(l.shrink.box)) {
          l.n.textContent = l.shrink.text;
          l.n._showing = l.shrink.text;
          l.n.style.transform =
            `translate3d(${l.shrink.x}px, ${l.y}px, 0) translateX(-50%)`;
          used = l.shrink.box;
        }
      }
      if (!clear(used)) l.n.style.visibility = 'hidden';
      else placed.push(used);
    }
  }

  const onScreen = (x, y, pad = 60) =>
    x > -pad && y > -pad && x < size.w + pad && y < size.h + pad;

  /* ---------------- camera moves ---------------- */
  function setView(lat, lon, z, { instant = true } = {}) {
    if (instant) {
      cam.lat = lat; cam.lon = lon; cam.zoom = clamp(z ?? cam.zoom, minZoom, maxZoom);
      flight = null;
      schedule();
      return Promise.resolve();
    }
    return flyTo({ to: [lat, lon], zoom: z });
  }

  /* Camera pacing. `speed` is the duration of a middling move; a nudge across
     half a screen takes less, crossing the theatre takes more. A single fixed
     duration makes short moves feel sluggish and long ones feel thrown, which
     is why the default used to read as too fast: 1.6 s was tuned for a small
     hop and then used for everything. A cue can always override with `over`. */
  let speed = flyOver;

  function autoOver(from, to) {
    const s = scaleFor(Math.min(from.zoom, to.zoom));
    const [ax, ay] = project(from.lon, from.lat);
    const [bx, by] = project(to.lon, to.lat);
    const screens = (Math.hypot(bx - ax, by - ay) * s) / Math.max(size.w, size.h, 1);
    const dz = Math.abs(to.zoom - from.zoom);
    // A camera flight is a distance, not a duration -- but it is bounded.
    // The bounds are `flyClamp` above, where the reason for them is written.
    return clamp(speed * (0.5 + 0.5 * Math.min(screens, 3) + 0.15 * dz), flyLo, flyHi);
  }

  /**
   * @param offset  [dx, dy] in screen pixels at the TARGET zoom. Positive dy
   *                moves the point down the screen, which is how you keep a
   *                marker clear of a sheet that covers the bottom half.
   */
  function flyTo({ to, zoom: z, over, offset, instant = false } = {}) {
    const targetZ = clamp(z ?? cam.zoom, minZoom, maxZoom);
    let [lat, lon] = to;
    if (offset && (offset[0] || offset[1])) {
      // Shift the CAMERA the opposite way, at the zoom we will arrive at.
      const sc = scaleFor(targetZ);
      const [wx, wy] = project(lon, lat);
      [lon, lat] = unproject(wx - offset[0] / sc, wy - offset[1] / sc);
    }
    if (instant || reducedMotion()) return setView(lat, lon, targetZ);
    const from = { lat: cam.lat, lon: cam.lon, zoom: cam.zoom };
    const target = { lat, lon, zoom: targetZ };
    return new Promise((resolve) => {
      flight = {
        from, to: target,
        t0: now(), ms: (over ?? autoOver(from, target)) * 1000, resolve,
      };
      /* Ask for the ground the flight is about to need, now, while the camera
         has not moved yet and the buffer it is standing on still covers.
         Without this the first warning comes from the flight itself, by which
         point the bake has to happen inside a frame — the one stall left in a
         six-level flight, and the most visible, because it is at the moment
         the movement starts. */
      wantBake();
      schedule();
    });
  }

  function stepFlight() {
    const f = flight;
    const t = clamp((now() - f.t0) / f.ms, 0, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    cam.lat = f.from.lat + (f.to.lat - f.from.lat) * e;
    cam.lon = f.from.lon + (f.to.lon - f.from.lon) * e;
    cam.zoom = f.from.zoom + (f.to.zoom - f.from.zoom) * e;
    if (t >= 1) { flight = null; f.resolve(); }
  }

  /**
   * Fit a lat/lon box into the part of the map that is actually visible.
   *
   * `padding` may be one number or {top, right, bottom, left}. The asymmetric
   * form is not a nicety: on a phone the narration's caption and transport
   * cover the bottom 150 px of the map and the title bar covers the top, so
   * a box fitted to the full canvas puts a fifth of what it framed underneath
   * the furniture. Georgia spent the whole "here they are, thirteen colonies"
   * beat behind the subtitles.
   */
  function fitBounds(bounds, { padding = 40, instant = false, over, maxZ = maxZoom } = {}) {
    const [[s, w], [n, e]] = bounds;
    const [x0, y1] = project(w, s);
    const [x1, y0] = project(e, n);

    const p = typeof padding === 'number'
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : { top: 0, right: 0, bottom: 0, left: 0, ...padding };
    const availW = Math.max(1, size.w - p.left - p.right);
    const availH = Math.max(1, size.h - p.top - p.bottom);

    const zx = Math.log2(availW / Math.abs(x1 - x0));
    const zy = Math.log2(availH / Math.abs(y1 - y0));
    const z = clamp(Math.min(zx, zy), minZoom, maxZ);

    // The camera sits at the centre of the CANVAS; the box has to land at the
    // centre of the free rectangle. Offset one by the distance between them.
    const sc = scaleFor(z);
    const cx = (x0 + x1) / 2 + (size.w / 2 - (p.left + availW / 2)) / sc;
    const cy = (y0 + y1) / 2 + (size.h / 2 - (p.top + availH / 2)) / sc;
    const [lon, lat] = unproject(cx, cy);
    return instant ? setView(lat, lon, z) : flyTo({ to: [lat, lon], zoom: z, over });
  }

  function fitCoords(coords, o) {
    let s = 90, n = -90, w = 180, e = -180;
    for (const [la, lo] of coords) {
      s = Math.min(s, la); n = Math.max(n, la);
      w = Math.min(w, lo); e = Math.max(e, lo);
    }
    return fitBounds([[s, w], [n, e]], o);
  }

  /* ---------------- input ---------------- */
  if (interactive) attachInput();

  function attachInput() {
    host.style.touchAction = 'none';
    const active = new Map();
    let last = null, pinch = null;

    host.addEventListener('pointerdown', (ev) => {
      host.setPointerCapture(ev.pointerId);
      active.set(ev.pointerId, [ev.clientX, ev.clientY]);
      flight = null;
      if (active.size === 2) pinch = pinchState(active);
      last = [ev.clientX, ev.clientY];
    });

    host.addEventListener('pointermove', (ev) => {
      if (!active.has(ev.pointerId)) return;
      active.set(ev.pointerId, [ev.clientX, ev.clientY]);

      if (active.size >= 2 && pinch) {
        const p = pinchState(active);
        const dz = Math.log2(p.dist / pinch.dist || 1);
        zoomAround(p.cx, p.cy, cam.zoom + dz);
        pinch = p;
        return;
      }
      if (!last) return;
      const dx = ev.clientX - last[0], dy = ev.clientY - last[1];
      last = [ev.clientX, ev.clientY];
      panBy(-dx, -dy);
    });

    const end = (ev) => {
      active.delete(ev.pointerId);
      if (active.size < 2) pinch = null;
      if (active.size === 0) last = null;
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);

    /* A wheel notch is not a number of pixels.
       `deltaY` used to be read raw, and `deltaMode` — which says what the
       number is COUNTED IN — was ignored. Measured on the bench: Chrome
       reports 100 pixels a notch and zoomed 0.385 levels; Firefox reports 3
       LINES for the same flick of the same wheel and zoomed 0.0115. The same
       gesture, thirty-three times apart. The line and page factors are
       Leaflet's, for no better reason than that they are the ones every map
       on the web has been tuned against. */
    const WHEEL_LINE = 20;
    host.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const r = host.getBoundingClientRect();
      const unit = ev.deltaMode === 1 ? WHEEL_LINE
        : ev.deltaMode === 2 ? Math.max(size.h, 1)
        : 1;
      // Trackpads send a stream of small deltas and a mouse sends one large
      // one; the cap keeps a single event from throwing the camera.
      const dz = -clamp(ev.deltaY * unit, -160, 160) / 260;
      // From where the camera is GOING, not where it is, or a second notch
      // arriving mid-move undoes most of the first.
      const from = flight ? flight.to.zoom : cam.zoom;
      zoomAround(ev.clientX - r.left, ev.clientY - r.top, from + dz, WHEEL_OVER);
    }, { passive: false });
  }

  function pinchState(active) {
    const [a, b] = [...active.values()];
    const r = host.getBoundingClientRect();
    return {
      dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
      cx: (a[0] + b[0]) / 2 - r.left,
      cy: (a[1] + b[1]) / 2 - r.top,
    };
  }

  function panBy(dx, dy) {
    const s = scale();
    const [cx, cy] = project(cam.lon, cam.lat);
    const [lon, lat] = unproject(cx + dx / s, clamp(cy + dy / s, 0, WORLD));
    cam.lon = lon; cam.lat = lat;
    schedule();
  }

  /**
   * Where the camera has to be at zoom `z` for the world point under the
   * screen point (px, py) to still be under it.
   *
   * Solved in world pixels rather than by moving the camera and correcting
   * the latitude afterwards, which is what this did before: Mercator's
   * latitude is not linear in y, so the correction was a good approximation
   * near the middle of the screen and drifted towards the edges.
   */
  function anchoredCentre(px, py, z, base) {
    const sB = scaleFor(base.zoom);
    const [bx, by] = project(base.lon, base.lat);
    const wx = bx - (size.w / 2) / sB + px / sB;
    const wy = by - (size.h / 2) / sB + py / sB;
    const sT = scaleFor(z);
    return unproject(wx + (size.w / 2 - px) / sT,
                     clamp(wy + (size.h / 2 - py) / sT, 0, WORLD));
  }

  /* How long a wheel notch takes. §1 of docs/design-direction.md: `tap`, the
     shortest thing in the motion scale, because a notch has to feel like a
     direct response and not like a journey. Its only job is to stop a notch
     being a CUT — a cut re-bakes the ground the instant it lands, so twelve
     notches were twelve stalls, each one delayed behind the gesture. */
  const WHEEL_OVER = 0.16;

  /**
   * Keep the point under the cursor fixed while the zoom changes.
   *
   * `over` of 0 is a pinch: it is already continuous, the fingers are doing
   * the easing, and anything else would fight them. Anything else is a
   * discrete step — a wheel notch, a zoom button — and goes through the same
   * flight animator the narration uses, so it inherits the easing, the
   * reduced-motion cut, and being cancelled by a pointerdown.
   */
  function zoomAround(px, py, z, over = 0) {
    const base = (over && flight) ? flight.to : cam;
    const target = clamp(z, minZoom, maxZoom);
    if (Math.abs(target - base.zoom) < 1e-9) return;
    const [lon, lat] = anchoredCentre(px, py, target, base);
    if (over) { flyTo({ to: [lat, lon], zoom: target, over }); return; }
    cam.lat = lat; cam.lon = lon; cam.zoom = target;
    schedule();
  }

  /* ---------------- lifecycle ---------------- */
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(host);
  addEventListener('resize', resize);

  resize();
  registerDetail(detail);
  preload(geoBase).then(schedule);

  return {
    el: () => host,
    canvas,
    camera: () => ({ ...cam, size: { ...size } }),
    setView, flyTo, fitBounds, fitCoords,
    warmDetail,

    /**
     * Resolves when the camera has stopped moving.
     *
     * flyTo already returns a promise, but a CUE swallows it -- applyCue is
     * synchronous and has nowhere to put one. So the story could not tell
     * whether the opening shot had landed, and started narrating over a map
     * still in flight: you watched it arrive while the first sentence was
     * already running.
     *
     * Polls rather than chaining, because several cues can fly in one beat
     * and only the last one's promise would be the right one to wait on.
     */
    settled(timeoutMs = 6000) {
      if (!flight) return Promise.resolve();
      return new Promise((resolve) => {
        const t0 = now();
        const tick = () => {
          if (!flight || now() - t0 > timeoutMs) return resolve();
          setTimeout(tick, 60);         // a timer, never a frame: a
        };                              // backgrounded tab stops rAF and
        setTimeout(tick, 60);           // this must still resolve
      });
    },
    /** Seconds for a middling camera move. A pack or a script sets this once. */
    setFlightSpeed(seconds) { speed = clamp(seconds, 0.2, 12); },
    flightSpeed: () => speed,
    zoomBy: (d) => zoomAround(size.w / 2, size.h / 2,
                              (flight ? flight.to.zoom : cam.zoom) + d, WHEEL_OVER),
    toScreen, toLatLng,
    /** Half-width in px an arrow spec would draw at right now — for benches. */
    arrowWidthPx: (spec) =>
      widthForStrength(spec.strength, metresPerPixel(cam.lat, cam.zoom), spec.widthM),

    /**
     * Which administrative levels are drawn. 0 country, 1 state/province,
     * 2 municipality — the same switch whichever a pack happens to mean.
     */
    setBorders(next = {}) {
      borders = { ...borders, ...next };
      bufState = null;
      schedule();
    },
    borders: () => ({ ...borders }),

    /** Adopt regions: the shipped modern set, or a pack's historical GeoJSON. */
    async useRegions(source) {
      regionSet = typeof source === 'string' || source == null
        ? await loadRegions(geoBase, source || undefined)
        : fromGeoJSON(source);
      return regionSet;
    },
    regionNames: () => (regionSet ? regionSet.all().map((r) => r.name) : []),

    /* ---- atmosphere ---- */
    setMood(value = 'day', instant = false) {
      mood.style.transition = instant ? 'none' : '';
      mood.dataset.mood = value;
      if (instant) { void mood.offsetWidth; mood.style.transition = ''; }
    },
    mood: () => mood.dataset.mood,
    flash(instant = false) {
      // A muzzle flash is an event, not a state. Rebuilding the picture
      // after a seek must not re-fire every shot in the chapter.
      if (instant) return;
      flashEl.classList.remove('is-on');
      void flashEl.offsetWidth;
      flashEl.classList.add('is-on');
    },
    setTimeLabel(text) {
      timeEl.textContent = text || '';
      timeEl.classList.toggle('is-on', !!text);
    },

    places: makeLayer('places', { dom: true }),
    pins: makeLayer('pins', { dom: true }),
    glows: makeLayer('glows'),
    markers: makeLayer('markers', { dom: true }),
    highlights: makeLayer('highlights', { dom: true }),
    units: makeLayer('units', { dom: true }),
    roads: makeLayer('roads'),
    marches: makeLayer('marches'),
    fleets: makeLayer('fleets'),
    arrows: makeLayer('arrows'),
    fronts: makeLayer('fronts'),
    areas: makeLayer('areas'),
    crossings: makeLayer('crossings'),
    battles: makeLayer('battles'),
    regions: (() => {
      const base = makeLayer('regions', { dom: true });
      // Delegate explicitly rather than spreading: `makeLayer` exposes `size`
      // as a getter, and object spread EVALUATES getters, so `{...base}` would
      // freeze the count at whatever it was when the wrapper was built (zero).
      return {
        update: base.update, remove: base.remove, clear: base.clear,
        get: base.get, all: base.all,
        get size() { return base.size; },
        /** Accepts explicit `coords`, or a `name` looked up in the loaded set. */
        add(spec) {
          if (!spec.coords && spec.name && regionSet) {
            const r = regionSet.get(spec.name);
            if (r) return base.add({ ...spec, coords: r.coords,
                                     centre: r.labelAt || r.centre,
                                     bounds: r.bounds, label: r.label,
                                     short: r.short,
                                     // Which colour of the side's family
                                     // this one wears, and how many there
                                     // are — everything tintFor needs.
                                     tint: spec.tint ?? r.tint,
                                     of: r.tints ?? regionSet.count });
            console.warn(`[map] no region named "${spec.name}"`);
            return null;
          }
          return base.add(spec);
        },
      };
    })(),

    reset() {
      for (const store of Object.values(layers)) store.clear();
      for (const id of [...nodes.keys()]) dropNode(id);
      mood.style.transition = 'none';
      mood.dataset.mood = 'day';
      void mood.offsetWidth;
      mood.style.transition = '';
      flashEl.classList.remove('is-on');
      timeEl.textContent = '';
      timeEl.classList.remove('is-on');
      schedule();
    },
    refreshTheme() { palette = readPalette(); bufState = null; schedule(); },
    /** Replace faction colours — they are design tokens, so they flip with the theme. */
    setFactions(next) { Object.assign(factions, next); schedule(); },
    setLang(next) { lang = next; schedule(); },
    invalidate: resize,
    /* The type scale moved. Every cached label width is now a lie — see
       remeasureLabels(). Not folded into invalidate(): that one is about the
       CONTAINER changing size and re-bakes the ground, which is the expensive
       half and has nothing to do with type. */
    remeasureLabels,
    redraw: schedule,

    /* ---- the bench hook ----
       Read by dev/perf-lab.html and by nothing in the app. `setCulling` and
       `setQuantise` exist so the bench can put each bug back and watch itself
       fail, which is the only evidence that it measures what it claims. */
    bench: {
      profile(on) {
        if (on === undefined) return { ...perf };
        perfOn = !!on;
        if (on) Object.assign(perf, blankPerf());
        return { ...perf };
      },
      setCulling(on, inset) { setCulling(on, inset); bufState = null; schedule(); },
      /**
       * What one bake costs, rasterising included.
       *
       * Measured at rest and with the pixels actually read back, because the
       * cost of a bake is not the cost of queueing it. Not on the hot path
       * and never called by the app.
       */
      /**
       * What each step of a bake costs, rasterising included.
       *
       * The slicer budgets by declared cost — points times passes — and that
       * is a model, not a measurement. This is the measurement, and it is how
       * you find out that the model is wrong about a particular layer.
       */
      stepProfile() {
        stopSplit();
        const plan = planBake(false);
        const out = plan.steps.map((step) => {
          const t0 = now();
          step.run();
          flushSheet(plan.sheet);
          return { cost: step.cost, ms: now() - t0 };
        });
        finishBake(plan, 0);
        return out;
      },
      bakeCost() {
        bufState = null;
        const t0 = now();
        bakeGround(false);
        flushSheet(sheets[sheetIx]);
        const ms = now() - t0;
        const b = sheets[sheetIx].c;
        return { ms, w: b.width, h: b.height, zoom: bufState.zoom,
                 level: bufState.level };
      },
      /** Put the label defect back: every name hard right of its dot. */
      setLabelSides(on) { labelSides = on !== false; schedule(); },
      setQuantise(v) { quantise = Math.max(0, Number(v) || 0); bufState = null; schedule(); },
      setDefer(on) { deferBakes = on !== false; bufState = null; schedule(); },
      quantise: () => quantise,
      state: () => (bufState ? { ...bufState, palette: undefined } : null),
      /**
       * Is the ground finished — baked at the live zoom, with nothing owed?
       *
       * A bench that grabs the pixels on a timer grabs whichever bake the
       * timer landed on, and during the 400 ms after a move that is the
       * quantised one, which is a slightly blurrier picture of the same
       * ground. Two runs then differ by a third of a percent of the pixels
       * and it looks exactly like a culling defect. It is not; it is asking
       * the question before the answer is finished.
       */
      groundSettled: () => !split && !bakeTimer && !!bufState
        && Math.abs(bufState.zoom - cam.zoom) < 1e-9
        && bufState.stamp === groundStamp,
    },
    /** True once the ground for the current view is drawn, not merely fetched. */
    ready: () => levelReady(levelFor(cam.zoom, cam.lon, cam.lat)),
    destroy() {
      if (ro) ro.disconnect();
      removeEventListener('resize', resize);
      stopSplit();
      clearTimeout(settleTimer);
      // Two full-viewport sheets is tens of megabytes, and a chapter switch
      // builds a new map before the old one is collected. Give them back.
      for (const s of sheets) if (s) { s.c.width = 0; s.c.height = 0; }
      host.replaceChildren();
    },
  };
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
