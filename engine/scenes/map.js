/* ============================================================
   scenes/map.js — the map surface the narration drives.

   Everything here is idempotent and reset-able, because the player rebuilds
   the whole picture from scratch whenever you seek backwards. Nothing may
   depend on having seen the previous cue.

   Nothing here knows about any particular war. Places, routes and the things
   that converge on them all come from the content pack.
   ============================================================ */

import { attachTiles } from '../basemap.js';

let map = null;
let tiles = null;
let chapter = null;
let lang = 'no';

let labelLayer = null;
let routeLayer = null;
let arrowLayer = null;
let markerLayer = null;
let ringLayer = null;

let timeEl = null;
let flashEl = null;
let moodEl = null;
let hostEl = null;

const drawn = new Map();      // routeId  -> polyline
const markers = new Map();    // placeId  -> marker
const rings = new Map();      // placeId  -> marker

/** Keeps the framed area clear of the transport and the caption strip. */
function framePadding() {
  const h = hostEl ? hostEl.clientHeight : 600;
  const w = hostEl ? hostEl.clientWidth : 390;
  const bottom = Math.min(260, Math.max(120, Math.round(h * 0.34)));
  const side = Math.max(28, Math.round(w * 0.10));
  return { paddingTopLeft: [side, 70], paddingBottomRight: [side, bottom] };
}

export function mountMap(container, ch, language) {
  chapter = ch;
  lang = language || ch.narrationLang || 'no';

  hostEl = document.createElement('div');
  hostEl.className = 'stage-map';
  hostEl.innerHTML = `
    <div class="stage-map__canvas" id="story-map"></div>
    <div class="stage-map__mood"></div>
    <div class="map-wash"></div>
    <div class="map-grain"></div>
    <div class="map-vignette"></div>
    <div class="stage-map__flash"></div>
    <div class="stage-map__time"><span></span></div>
  `;
  container.appendChild(hostEl);

  moodEl = hostEl.querySelector('.stage-map__mood');
  flashEl = hostEl.querySelector('.stage-map__flash');
  timeEl = hostEl.querySelector('.stage-map__time');

  map = L.map(hostEl.querySelector('#story-map'), {
    zoomControl: false,
    attributionControl: true,
    dragging: false,          // the narration drives the camera, not the finger
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    keyboard: false,
    zoomSnap: 0,
    fadeAnimation: true,
  });
  map.attributionControl.setPrefix('');
  map.setView(homeCentre(), 10.5);

  tiles = attachTiles(map);
  labelLayer = L.layerGroup().addTo(map);
  ringLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  arrowLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  drawStandingLabels();
  applyZoomClass();
  map.on('zoomend', applyZoomClass);

  // A Leaflet map created while its container is hidden or still being laid
  // out measures as zero and renders nothing — the "map didn't load" case.
  // Re-measure whenever the box could have changed.
  addEventListener('resize', invalidate);
  addEventListener('orientationchange', () => setTimeout(invalidate, 250));
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => invalidate()).observe(hostEl);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(invalidate, 60);
  });
  for (const d of [0, 120, 400, 1200]) setTimeout(invalidate, d);

  return { invalidate, refreshTheme: () => tiles.refresh() };
}

function homeCentre() {
  const home = chapter.places?.[chapter.home] || Object.values(chapter.places || {})[0];
  return home ? home.coords : [0, 0];
}

function invalidate() {
  if (!map) return;
  map.invalidateSize({ animate: false });
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   Standing place names
   ------------------------------------------------------------ */

function drawStandingLabels() {
  labelLayer.clearLayers();
  for (const [id, place] of Object.entries(chapter.places || {})) {
    if (place.label === false) continue;
    const name = pick(place.name);
    if (!name) continue;
    const icon = L.divIcon({
      className: 'story-place-wrap',
      html: `<span class="story-place" data-place="${esc(id)}">${esc(name)}</span>`,
      iconSize: [150, 20],
      iconAnchor: [75, 10],
    });
    L.marker(place.coords, { icon, interactive: false, keyboard: false }).addTo(labelLayer);
  }
}

function applyZoomClass() {
  const z = map.getZoom();
  const el = map.getContainer();
  el.classList.toggle('story-z-mid', z >= 11.2);
  el.classList.toggle('story-z-near', z >= 12.6);
}

function setStandingLabel(placeId, visible) {
  const node = map?.getContainer()
    .querySelector(`.story-place[data-place="${CSS.escape(String(placeId))}"]`);
  if (node) node.classList.toggle('is-hidden', !visible);
}

/* ------------------------------------------------------------
   Reset
   ------------------------------------------------------------ */

export function resetMap() {
  routeLayer?.clearLayers();
  arrowLayer?.clearLayers();
  markerLayer?.clearLayers();
  ringLayer?.clearLayers();
  drawn.clear();
  rings.clear();
  for (const id of markers.keys()) setStandingLabel(id, true);
  markers.clear();
  setMood('day', true);
  setTime(null);
  flashEl?.classList.remove('is-on');
}

/* ------------------------------------------------------------
   Camera
   ------------------------------------------------------------ */

export function flyTo(cue, instant) {
  const place = chapter.places[cue.to];
  if (!place || !map) return;
  const zoom = cue.zoom ?? place.zoom ?? 12;
  if (instant || reduced()) map.setView(place.coords, zoom, { animate: false });
  else map.flyTo(place.coords, zoom, { duration: cue.over ?? 2.4, easeLinearity: 0.25 });
}

/** Frame a set of points, leaving room for the chrome. */
function frame(points, instant, duration = 1.8) {
  if (!map || !points.length) return;
  const bounds = L.latLngBounds(points);
  const opts = { ...framePadding(), maxZoom: 13.5 };
  if (instant || reduced()) map.fitBounds(bounds, { ...opts, animate: false });
  else map.flyToBounds(bounds, { ...opts, duration });
}

export function fitRoute(cue, instant) {
  const route = chapter.routes[cue.id];
  if (route) frame(route.coords, instant, cue.over ?? 1.8);
}

/** Frame several named places at once. */
export function fitPlaces(cue, instant) {
  const ids = cue.places || [];
  const pts = ids.map((id) => chapter.places[id]?.coords).filter(Boolean);
  frame(pts, instant, cue.over ?? 1.8);
}

/* ------------------------------------------------------------
   Atmosphere
   ------------------------------------------------------------ */

export function setTime(value) {
  if (!timeEl) return;
  const text = typeof value === 'string' ? value : '';
  timeEl.querySelector('span').textContent = text;
  timeEl.classList.toggle('is-on', Boolean(text));
}

export function setMood(value, instant) {
  if (!moodEl) return;
  moodEl.dataset.mood = value || 'day';
  if (instant) {
    moodEl.style.transition = 'none';
    void moodEl.offsetWidth;
    moodEl.style.transition = '';
  }
}

export function flash(instant) {
  if (!flashEl || instant || reduced()) return;
  flashEl.classList.remove('is-on');
  void flashEl.offsetWidth;
  flashEl.classList.add('is-on');
  setTimeout(() => flashEl.classList.remove('is-on'), 700);
}

/* ------------------------------------------------------------
   Routes
   ------------------------------------------------------------ */

export function drawRoute(cue, instant) {
  const route = chapter.routes[cue.id];
  if (!route || !map || drawn.has(cue.id)) return;

  // A march that draws itself off the edge of the screen explains nothing, so
  // unless the author opts out, frame it before drawing.
  if (cue.fit !== false) frame(route.coords, instant, 1.4);

  const side = route.side || 'neutral';
  const line = L.polyline(route.coords, {
    className: `story-route story-route--${side}${route.naval ? ' story-route--naval' : ''}`,
    weight: 4,
    opacity: 0.92,
    interactive: false,
    smoothFactor: 1,
  }).addTo(routeLayer);
  drawn.set(cue.id, line);

  const path = line.getElement?.() || line._path;
  if (!path) return;

  if (instant || reduced()) return;

  let len = 0;
  try { len = path.getTotalLength(); } catch { /* not laid out yet */ }
  if (!len) return;

  // Start drawing after the camera has mostly settled, or the line grows
  // while the ground moves under it.
  const lead = cue.fit === false ? 0 : 900;
  const over = (cue.over ?? 4) * 1000;
  path.style.transition = 'none';
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  setTimeout(() => {
    path.style.transition = `stroke-dashoffset ${over}ms cubic-bezier(.35,.05,.25,1)`;
    path.style.strokeDashoffset = '0';
  }, lead);
  setTimeout(() => {
    path.style.transition = '';
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
  }, lead + over + 90);
}

export function clearRoutes() {
  routeLayer?.clearLayers();
  arrowLayer?.clearLayers();
  drawn.clear();
}

/* ------------------------------------------------------------
   Converging lines

   Generic: "these named places moved on that one". Militia closing on a road,
   armies on a capital, supply lines on a port — the verb does not care.
   ------------------------------------------------------------ */

export function converge(cue, instant) {
  if (!map) return;
  const target = chapter.places[cue.to];
  if (!target) return;

  const from = (cue.from || [])
    .map((id) => ({ id, place: chapter.places[id] }))
    .filter((x) => x.place);
  if (!from.length) return;

  if (cue.fit !== false) {
    frame([target.coords, ...from.map((x) => x.place.coords)], instant, 1.6);
  }

  const side = cue.side || 'patriot';
  const over = (cue.over ?? 3.2) * 1000;
  const lead = cue.fit === false ? 0 : 800;

  from.forEach((x, i) => {
    const line = L.polyline([x.place.coords, target.coords], {
      className: `story-converge story-converge--${side}`,
      weight: 2.6,
      interactive: false,
    }).addTo(arrowLayer);

    const path = line.getElement?.() || line._path;
    if (!path) return;
    if (instant || reduced()) return;

    let len = 0;
    try { len = path.getTotalLength(); } catch { /* ignore */ }
    if (!len) return;
    path.style.transition = 'none';
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    const delay = lead + i * 220;
    setTimeout(() => {
      path.style.transition = `stroke-dashoffset ${over}ms cubic-bezier(.3,.1,.2,1)`;
      path.style.strokeDashoffset = '0';
    }, delay);
  });
}

/* ------------------------------------------------------------
   Markers and highlights
   ------------------------------------------------------------ */

export function showMarker(cue, instant) {
  const place = chapter.places[cue.at];
  if (!place || !map || markers.has(cue.at)) return;
  const label = pick(cue.label) || pick(place.name) || '';
  const kind = cue.kind || 'point';
  const icon = L.divIcon({
    className: 'story-mk-wrap',
    html: `<div class="story-mk story-mk--${esc(kind)}${instant ? ' is-instant' : ''}">
             <span class="story-mk__dot"></span>
             ${label ? `<span class="story-mk__label">${esc(label)}</span>` : ''}
           </div>`,
    iconSize: [160, 48],
    iconAnchor: [80, 24],
  });
  markers.set(cue.at, L.marker(place.coords, { icon, interactive: false, keyboard: false })
    .addTo(markerLayer));
  setStandingLabel(cue.at, false);   // the pin already names it
}

export function hideMarker(cue) {
  const m = markers.get(cue.at);
  if (m) { markerLayer.removeLayer(m); markers.delete(cue.at); setStandingLabel(cue.at, true); }
}

export function clearMarkers() {
  markerLayer?.clearLayers();
  for (const id of markers.keys()) setStandingLabel(id, true);
  markers.clear();
}

/**
 * Draw attention to a place without necessarily pinning it: an expanding ring
 * you can see from across the screen. This is the "point at the map while you
 * talk" verb.
 */
export function highlight(cue, instant) {
  const place = chapter.places[cue.at];
  if (!place || !map) return;
  if (rings.has(cue.at)) return;

  const tone = cue.tone || 'gold';
  const icon = L.divIcon({
    className: 'story-ring-wrap',
    html: `<span class="story-ring story-ring--${esc(tone)}${instant ? ' is-instant' : ''}"></span>`,
    iconSize: [120, 120],
    iconAnchor: [60, 60],
  });
  rings.set(cue.at, L.marker(place.coords, { icon, interactive: false, keyboard: false })
    .addTo(ringLayer));

  if (cue.centre !== false && !instant && !reduced()) {
    map.panTo(place.coords, { duration: 1.1 });
  }
}

export function clearHighlights() {
  ringLayer?.clearLayers();
  rings.clear();
}

/* ------------------------------------------------------------ */

function pick(field) {
  if (field == null) return '';
  if (typeof field === 'string' || typeof field === 'number') return String(field);
  return field[lang] ?? field.no ?? field.en ?? '';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function getStoryMap() { return map; }
