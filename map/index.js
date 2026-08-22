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
import { loadLevel, levelFor, levelReady, preload, drawBasemap, registerDetail,
         loadDetail, detailWanted, creditFor } from './basemap.js';
import { loadRegions, fromGeoJSON } from './regions.js';
import { tintFor } from './tint.js';
import {
  drawArrow, drawMarch, drawFront, drawArea, drawRegions, drawCrossing,
  drawBattle, drawGlow, widthForStrength,
} from './artifacts.js';

const DEFAULT_FACTIONS = {
  neutral: { label: 'Neutral', fill: '#55704c', flag: '' },
};

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
    detail = null,
    lang = 'no',
  } = opts;

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
     level changes. Same idea as a tile margin, without the tiles. */
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d');
  let bufState = null;
  const MARGIN = 0.3;
  /* How far the live zoom may drift from the zoom the ground was baked at
     before it has to be baked again. Within this the buffer is simply scaled,
     which is what every tile map does during a pinch: slightly soft while the
     camera is moving, sharp the moment it stops. Above it the softness starts
     to read as blur rather than as motion. */
  const ZOOM_SLACK = 0.55;
  let camMovedAt = -1e9;
  let settleTimer = 0;

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
    battles: new Map(), places: new Map(), units: new Map(),
    regions: new Map(), markers: new Map(), highlights: new Map(),
    pins: new Map(), glows: new Map(),
  };

  const now = () => performance.now();

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

  function draw() {
    if (flight) stepFlight();

    // Tell the caller when the view actually moved. Fired from the draw
    // rather than from the input handlers, so a flight, a fit and a pinch all
    // report the same way and nothing has to poll.
    const camKey = `${cam.lat.toFixed(5)},${cam.lon.toFixed(5)},${cam.zoom.toFixed(3)}`;
    if (camKey !== lastCam) {
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
    // 1.6 MB of harbour is worth loading when you are standing in the harbour
    // and not one moment before, so this waits for the camera to ask.
    if (!detailPending && detailWanted(cam.zoom, cam.lon, cam.lat)) {
      detailPending = true;
      loadDetail()
        .then(() => { bufState = null; schedule(); })
        .catch(() => {})
        .finally(() => { detailPending = false; });
    }

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

  function paintGround(tl, want) {
    const s = scale();
    const mx = size.w * MARGIN, my = size.h * MARGIN;

    // Was the geometry actually there when this buffer was painted? If the
    // level was still in flight, drawBasemap filled the buffer with water and
    // returned — and every check below would then call that buffer fresh, so
    // it got blitted for good and the land never appeared. The story map hid
    // this because its camera never stops moving, which invalidates the
    // buffer anyway; Explore fits once at boot and then holds still, so it
    // kept the empty one. Land or sea is not something to leave to whether a
    // fetch beat the first frame.
    const groundReady = levelReady(want);

    /* Re-baking the ground on every frame of a zoom is what made a fly-over
       crawl: a 2.6 s flight changed the zoom ~150 times and re-walked every
       coastline, pond and wood each time. Measured at 118 ms a frame — eight
       frames a second. So while the camera is moving the existing bake is
       SCALED instead, and re-baked once it settles.

       The coverage test below also has to use the zoom the buffer was baked
       at rather than the live one, or a scaled buffer is measured against the
       wrong world size and reports itself as covering ground it does not. */
    const sBuf = bufState ? scaleFor(bufState.zoom) : s;
    const zoomOff = bufState ? Math.abs(cam.zoom - bufState.zoom) : 0;
    const moving = now() - camMovedAt < 140;

    const stale = !bufState
      || !bufState.ready
      || (moving ? zoomOff > ZOOM_SLACK : zoomOff > 1e-6)
      || bufState.level !== want
      || bufState.palette !== palette
      || bufState.borders !== borderKey()
      || tl.x < bufState.x || tl.y < bufState.y
      || tl.x + size.w / s > bufState.x + bufState.w / sBuf
      || tl.y + size.h / s > bufState.y + bufState.h / sBuf;

    if (stale) {
      const bw = Math.ceil(size.w + mx * 2);
      const bh = Math.ceil(size.h + my * 2);
      if (buf.width !== Math.round(bw * dpr) || buf.height !== Math.round(bh * dpr)) {
        buf.width = Math.round(bw * dpr);
        buf.height = Math.round(bh * dpr);
      }
      const bx = tl.x - mx / s;
      const by = tl.y - my / s;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, bw, bh);
      drawBasemap(bctx, { x: bx, y: by, zoom: cam.zoom }, { w: bw, h: bh },
                  palette, want, borders);
      bufState = { zoom: cam.zoom, level: want, palette, borders: borderKey(),
                   x: bx, y: by, w: bw, h: bh, ready: groundReady };
    }

    const ox = (bufState.x - tl.x) * s;
    const oy = (bufState.y - tl.y) * s;
    // k is 1 whenever the bake is at the live zoom, so a still map is pixel
    // for pixel what it always was.
    const k = s / scaleFor(bufState.zoom);
    ctx.drawImage(buf, ox, oy, bufState.w * k, bufState.h * k);

    // A scaled bake has to be redeemed. Nothing else will schedule a frame
    // once the camera stops, so ask for one — otherwise the ground stays soft
    // for as long as you leave it alone, which is exactly the wrong way round.
    if (k !== 1) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(schedule, 160);
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
      n.textContent = s.name;
      const [x, y] = toScreen(s.coords[0], s.coords[1]);
      n.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      n.style.visibility = onScreen(x, y) ? '' : 'hidden';
      labels.push({ n, x, y, rank: s.kind === 'city' ? 3 : s.kind === 'region' ? 2 : 1 });
    }

    // Counters are wide and armies gather in the same place, so plain
    // positioning stacks them illegibly. Push each one clear of the last.
    const taken = [];
    for (const s of layers.regions.values()) {
      if (!s.label || !s.centre) continue;
      if (s.minZoom != null && cam.zoom < s.minZoom) { dropNode(`r:${s.id}`); continue; }
      live.add(`r:${s.id}`);
      const n = nodeFor(`r:${s.id}`, () => {
        const el = document.createElement('div');
        el.className = 'atlas-place atlas-place--region';
        return el;
      });
      // You tap the NAME, not the polygon. That is honest — the canvas has no
      // hit-testing and adding it would mean either a second render per frame
      // or point-in-polygon on every pointerdown — and it composes with the
      // declutter pass for free: a label that got dropped is not a target,
      // which is correct, because an invisible target is a bug.
      setTap(n, s.tap, s.name);

      const [x0, y] = toScreen(s.centre[0], s.centre[1]);
      // How much room the region itself offers, in pixels, right now.
      const [left, right] = s.bounds
        ? [toScreen(s.bounds[0][0], s.bounds[0][1])[0],
           toScreen(s.bounds[1][0], s.bounds[1][1])[0]]
        : [-Infinity, Infinity];

      measureLabel(n, pickLabel(s.label) || s.name, pickLabel(s.short));
      const placed = placeLabel(n, x0, left, right);
      n.style.transform = `translate3d(${placed.x}px, ${y}px, 0) translateX(-50%)`;
      n.style.visibility = onScreen(x0, y) ? '' : 'hidden';
      // Rank by how much of the screen the region covers, so a collision is
      // lost by the colony there is least room for. Without a tiebreak the
      // sort fell back to the order the regions happen to sit in the file,
      // and which name survived was decided by luck.
      const [, top] = toScreen(s.bounds ? s.bounds[1][0] : 0, 0);
      const [, bottom] = toScreen(s.bounds ? s.bounds[0][0] : 0, 0);
      const area = Math.abs(right - left) * Math.abs(bottom - top);
      // `shrink` is the smaller form declutter tries before dropping the name.
      labels.push({ n, x: placed.x, y, rank: 2 + Math.min(0.9, area / 4e5),
                    centred: true, w: placed.w, shrink: placed.shrink });
    }

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
      n.querySelector('b').textContent = s.label || '';
      n.classList.toggle('atlas-pin--bare', !s.label);
      setTap(n, s.tap, s.label);
      const [x, y] = toScreen(s.at[0], s.at[1]);
      n.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      n.style.visibility = onScreen(x, y, 120) ? '' : 'hidden';
      // A pin is the one thing the narration is pointing at right now, so it
      // enters the collision pass at a rank nothing can outbid — and the place
      // names underneath it get out of the way. Leaving pins out of the pass
      // was why "Boston" landed squarely on top of "Boston Common", which at
      // harbour zoom is six pixels away, and why the Concord pin sat on
      // "North Bridge".
      if (s.label) labels.push({ n, x, y, rank: 20 });
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
    if (n._fullIn === full && n._shortIn === short) return;
    n._fullIn = full;
    n._shortIn = short;
    n._full = full;
    n._short = short || full;
    n.textContent = full;
    n._wFull = n.offsetWidth;
    if (n._short !== full) {
      n.textContent = n._short;
      n._wShort = n.offsetWidth;
    } else {
      n._wShort = n._wFull;
    }
    n.textContent = full;
    n._showing = full;
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
  function placeLabel(n, x0, left, right) {
    const want = (w) => {
      const half = w / 2;
      const lo = Math.max(left + half + 2, half + 6);
      const hi = Math.min(right - half - 2, size.w - half - 6);
      return lo <= hi ? clamp(x0, lo, hi) : null;
    };

    let x = n._wFull ? want(n._wFull) : x0;
    let text = n._full;
    let w = n._wFull;
    const canShrink = n._wShort < n._wFull;

    if (x == null && canShrink) {
      x = want(n._wShort);
      text = n._short;
      w = n._wShort;
    }
    if (x == null) {
      // Nothing fits. Centre it on the region and let the collision pass
      // decide — a dropped label is honest, a misplaced one is not.
      x = x0;
      text = canShrink ? n._short : n._full;
      w = canShrink ? n._wShort : n._wFull;
    }
    if (n._showing !== text) { n.textContent = text; n._showing = text; }
    // Offer declutter the smaller form, if there is one still unused.
    const shrink = text === n._full && canShrink
      ? { text: n._short, w: n._wShort, x: want(n._wShort) ?? x0 }
      : null;
    return { x, w, shrink };
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
      box.x < p.x + p.w + 4 && box.x + box.w + 4 > p.x &&
      box.y < p.y + p.h + 2 && box.y + box.h + 2 > p.y);

    for (const l of labels.sort((a, b) => b.rank - a.rank)) {
      if (l.n.style.visibility === 'hidden') continue;
      const h = l.n.offsetHeight;
      const w = l.w || l.n.offsetWidth;
      if (!w) continue;
      // The node is anchored at (x, y) but drawn offset by its own margins.
      const boxAt = (x, width) => ({
        x: x + l.n.offsetLeft - (l.centred ? width / 2 : 0),
        y: l.y + l.n.offsetTop, w: width, h,
      });

      let box = boxAt(l.x, w);
      if (!clear(box) && l.shrink) {
        // Before dropping a name, try the short form. "New York" is 99 px on
        // a phone and collides with Massachusetts; "N.Y." is 40 and does not.
        // Dropping first is how a colony the narration just named ends up as
        // an unlabelled patch of colour.
        const small = boxAt(l.shrink.x, l.shrink.w);
        if (clear(small)) {
          l.n.textContent = l.shrink.text;
          l.n._showing = l.shrink.text;
          l.n.style.transform =
            `translate3d(${l.shrink.x}px, ${l.y}px, 0) translateX(-50%)`;
          box = small;
        }
      }
      if (!clear(box)) l.n.style.visibility = 'hidden';
      else placed.push(box);
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
    return clamp(speed * (0.5 + 0.5 * Math.min(screens, 3) + 0.15 * dz), 0.9, 7);
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

    host.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const r = host.getBoundingClientRect();
      zoomAround(ev.clientX - r.left, ev.clientY - r.top,
                 cam.zoom - ev.deltaY / 260);
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

  /** Keep the point under the cursor fixed while the zoom changes. */
  function zoomAround(px, py, z) {
    const target = clamp(z, minZoom, maxZoom);
    if (target === cam.zoom) return;
    const before = toLatLng(px, py);
    cam.zoom = target;
    const after = toLatLng(px, py);
    cam.lat += before[0] - after[0];
    cam.lon += before[1] - after[1];
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
    /** Seconds for a middling camera move. A pack or a script sets this once. */
    setFlightSpeed(seconds) { speed = clamp(seconds, 0.2, 12); },
    flightSpeed: () => speed,
    zoomBy: (d) => zoomAround(size.w / 2, size.h / 2, cam.zoom + d),
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
    redraw: schedule,
    /** True once the ground for the current view is drawn, not merely fetched. */
    ready: () => levelReady(levelFor(cam.zoom, cam.lon, cam.lat)),
    destroy() {
      if (ro) ro.disconnect();
      removeEventListener('resize', resize);
      host.replaceChildren();
    },
  };
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
