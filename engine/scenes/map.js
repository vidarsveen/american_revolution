/* ============================================================
   scenes/map.js — the map surface the narration drives.

   Everything here is idempotent and reset-able, because the player rebuilds
   the whole picture from scratch whenever you seek backwards. Nothing may
   depend on having seen the previous cue.
   ============================================================ */

import { attachTiles } from '../basemap.js';

const SIDE = { british: 'british', patriot: 'patriot', french: 'french', neutral: 'neutral' };

let map = null;
let tiles = null;
let chapter = null;
let routeLayer = null;
let markerLayer = null;
let arrowLayer = null;
let labelLayer = null;
let timeEl = null;
let flashEl = null;
let moodEl = null;

const drawn = new Map();      // routeId -> polyline
const markers = new Map();    // placeId -> marker

export function mountMap(container, ch) {
  chapter = ch;

  const host = document.createElement('div');
  host.className = 'stage-map';
  host.innerHTML = `
    <div class="stage-map__canvas" id="story-map"></div>
    <div class="stage-map__mood"></div>
    <div class="map-wash"></div>
    <div class="map-grain"></div>
    <div class="map-vignette"></div>
    <div class="stage-map__flash"></div>
    <div class="stage-map__time"><span></span></div>
  `;
  container.appendChild(host);

  moodEl = host.querySelector('.stage-map__mood');
  flashEl = host.querySelector('.stage-map__flash');
  timeEl = host.querySelector('.stage-map__time');

  map = L.map(host.querySelector('#story-map'), {
    zoomControl: false,
    attributionControl: true,
    dragging: false,          // the narration drives the camera, not the finger
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    keyboard: false,
    zoomSnap: 0,              // continuous zoom so flyTo lands exactly
    fadeAnimation: true,
  });
  map.attributionControl.setPrefix('');
  map.setView([42.42, -71.18], 11);

  tiles = attachTiles(map);
  labelLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  arrowLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  drawStandingLabels();
  applyZoomClass();
  map.on('zoomend', applyZoomClass);

  return { invalidate, refreshTheme: () => tiles.refresh() };
}

function invalidate() {
  if (map) map.invalidateSize({ animate: false });
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A label-free basemap of rural Massachusetts is a blank field. These names
 * are what make it a map rather than a beige rectangle — and they are the
 * places the narration keeps referring to.
 */
function drawStandingLabels() {
  labelLayer.clearLayers();
  for (const [id, place] of Object.entries(chapter.places || {})) {
    if (place.label === false) continue;
    const name = pick(place.name, chapter.lang);
    if (!name) continue;
    const icon = L.divIcon({
      className: 'story-place-wrap',
      html: `<span class="story-place" data-place="${escAttr(id)}">${esc(name)}</span>`,
      iconSize: [150, 20],
      iconAnchor: [75, 10],
    });
    L.marker(place.coords, { icon, interactive: false, keyboard: false }).addTo(labelLayer);
  }
}

/** Only show the smaller places once there is room for them. */
function applyZoomClass() {
  const z = map.getZoom();
  const el = map.getContainer();
  el.classList.toggle('story-z-mid', z >= 11.5);
  el.classList.toggle('story-z-near', z >= 12.8);
}

/* ------------------------------------------------------------
   Reset — called before re-applying cues after a seek
   ------------------------------------------------------------ */

export function resetMap() {
  routeLayer?.clearLayers();
  arrowLayer?.clearLayers();
  markerLayer?.clearLayers();
  drawn.clear();
  for (const id of markers.keys()) setStandingLabel(id, true);
  markers.clear();
  setMood('day', true);
  setTime(null);
  if (flashEl) flashEl.classList.remove('is-on');
}

/* ------------------------------------------------------------
   Verbs
   ------------------------------------------------------------ */

export function flyTo(cue, instant) {
  const place = chapter.places[cue.to];
  if (!place || !map) return;
  const zoom = cue.zoom ?? place.zoom ?? 12;
  if (instant || reduced()) map.setView(place.coords, zoom, { animate: false });
  else map.flyTo(place.coords, zoom, { duration: cue.over ?? 2.4, easeLinearity: 0.25 });
}

export function fitRoute(cue, instant) {
  const route = chapter.routes[cue.id];
  if (!route || !map) return;
  map.flyToBounds(L.latLngBounds(route.coords), {
    padding: [40, 40], duration: instant ? 0 : 1.8, animate: !instant && !reduced(),
  });
}

export function setTime(value) {
  if (!timeEl) return;
  const span = timeEl.querySelector('span');
  const text = typeof value === 'string' ? value : '';
  span.textContent = text;
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

/** A muzzle-flash for the moment a shot is fired. */
export function flash(instant) {
  if (!flashEl || instant || reduced()) return;
  flashEl.classList.remove('is-on');
  void flashEl.offsetWidth;
  flashEl.classList.add('is-on');
  setTimeout(() => flashEl.classList.remove('is-on'), 700);
}

export function drawRoute(cue, instant) {
  const route = chapter.routes[cue.id];
  if (!route || !map || drawn.has(cue.id)) return;

  const side = SIDE[route.side] || 'neutral';
  const line = L.polyline(route.coords, {
    className: `story-route story-route--${side}`,
    weight: 4,
    opacity: 0.9,
    interactive: false,
    smoothFactor: 1,
  }).addTo(routeLayer);
  drawn.set(cue.id, line);

  const path = line.getElement?.() || line._path;
  if (!path) return;

  if (instant || reduced()) {
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
    return;
  }

  let len = 0;
  try { len = path.getTotalLength(); } catch { /* not laid out yet */ }
  if (!len) return;

  const over = (cue.over ?? 4) * 1000;
  path.style.transition = 'none';
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  requestAnimationFrame(() => {
    path.style.transition = `stroke-dashoffset ${over}ms cubic-bezier(.35,.05,.25,1)`;
    path.style.strokeDashoffset = '0';
  });
  // Hand the line back once drawn, so a later zoom does not restart the dash.
  setTimeout(() => {
    path.style.transition = '';
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
  }, over + 80);
}

export function clearRoutes() {
  routeLayer?.clearLayers();
  arrowLayer?.clearLayers();
  drawn.clear();
}

export function showMarker(cue, instant, lang) {
  const place = chapter.places[cue.at];
  if (!place || !map || markers.has(cue.at)) return;
  const label = pick(cue.label, lang) || pick(place.name, lang) || '';
  const kind = cue.kind || 'point';
  const icon = L.divIcon({
    className: 'story-mk-wrap',
    html: `<div class="story-mk story-mk--${kind}${instant ? ' is-instant' : ''}">
             <span class="story-mk__dot"></span>
             <span class="story-mk__label">${esc(label)}</span>
           </div>`,
    iconSize: [140, 46],
    iconAnchor: [70, 23],
  });
  markers.set(cue.at, L.marker(place.coords, { icon, interactive: false, keyboard: false }).addTo(markerLayer));
  // A pin already names the place; the standing label would just double it.
  setStandingLabel(cue.at, false);
}

function setStandingLabel(placeId, visible) {
  const node = map?.getContainer().querySelector(`.story-place[data-place="${cssEscape(placeId)}"]`);
  if (node) node.classList.toggle('is-hidden', !visible);
}

function cssEscape(s) {
  return CSS.escape(String(s));
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
 * Militia closing in on the road. Deliberately vague: a scatter of short
 * arrows pointing inward, not a claim about who came from exactly where.
 */
export function militiaConverge(cue, instant) {
  if (!map) return;
  const target = cue.wide
    ? [[42.40, -71.10], 0.42]
    : [[42.44, -71.24], 0.26];
  const [centre, spread] = target;
  const n = cue.wide ? 14 : 10;

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + 0.4;
    const from = [
      centre[0] + Math.sin(angle) * spread,
      centre[1] + Math.cos(angle) * spread * 1.5,
    ];
    const to = [
      centre[0] + Math.sin(angle) * spread * 0.45,
      centre[1] + Math.cos(angle) * spread * 0.45 * 1.5,
    ];
    const line = L.polyline([from, to], {
      className: 'story-arrow',
      weight: 2.5,
      interactive: false,
    }).addTo(arrowLayer);

    const path = line.getElement?.() || line._path;
    if (!path) continue;
    if (instant || reduced()) continue;
    let len = 0;
    try { len = path.getTotalLength(); } catch { /* ignore */ }
    if (!len) continue;
    path.style.transition = 'none';
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    const delay = 90 * i;
    requestAnimationFrame(() => {
      path.style.transition = `stroke-dashoffset 900ms ${delay}ms ease-out`;
      path.style.strokeDashoffset = '0';
    });
  }
}

/* ------------------------------------------------------------ */

function pick(field, lang) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[lang] ?? field.no ?? field.en ?? '';
}

function escAttr(s) { return esc(s); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function getStoryMap() { return map; }
