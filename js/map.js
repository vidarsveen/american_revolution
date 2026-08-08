/* ============================================================
   map.js — Leaflet set-up, markers, place labels, camera.
   ============================================================ */

import { state, subscribe, parseDate, yearOf, onNextFrame, matchesFilter } from './store.js';
import { tx, t } from './i18n.js';
import { GLYPH, icoTarget } from './icons.js';
import { attachTiles } from '../map/tiles.js';
import { mountTexture } from '../map/texture.js';

/* Roughly the theatre of the war: New England down to Georgia.
   We fit these bounds rather than fixing a zoom, so a tall phone and a
   wide laptop both frame the same story. */
const HOME_BOUNDS = [[31.2, -82.0], [46.0, -69.5]];
/* Paris and London are in the data (the alliance, the peace), so the world
   has to be big enough to fly there. */
const MAX_BOUNDS = [[14, -110], [62, 22]];

let map = null;
let tiles = null;

let markerLayer = null;
let labelLayer = null;
let shapeLayer = null;

/** id -> { marker, event, el } */
const markers = new Map();
let events = [];
let onSelect = () => {};

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

export function initMap(allEvents, handlers = {}) {
  events = allEvents;
  onSelect = handlers.onSelect || (() => {});

  map = L.map('map', {
    minZoom: 3,
    maxZoom: 10,
    zoomControl: false,
    attributionControl: true,
    maxBounds: MAX_BOUNDS,
    maxBoundsViscosity: 0.65,
    zoomSnap: 0.5,
    wheelPxPerZoomLevel: 140,
    // Inertia feels good on a phone; keep it lively but not slippery.
    inertiaDeceleration: 2600,
    tap: false,           // Leaflet's legacy tap shim fights modern pointer events
  });

  map.fitBounds(HOME_BOUNDS, { padding: [12, 12], animate: false });
  map.attributionControl.setPrefix('');

  shapeLayer = L.layerGroup().addTo(map);   // colonies, proclamation line
  labelLayer = L.layerGroup().addTo(map);   // period place names
  markerLayer = L.layerGroup().addTo(map);  // events

  tiles = attachTiles(map, { relief: true });
  mountTexture(map);
  applyZoomClass();
  map.on('zoomend', applyZoomClass);

  buildMarkers();
  refresh();

  subscribe((s, changed) => {
    if (changed.has('date') || changed.has('filter')) refresh();
    if (changed.has('selected')) refreshSelection();
    if (changed.has('lang')) relabel();
    if (changed.has('view') && s.view === 'map') {
      // Leaflet measures on show; a hidden container measures as 0.
      onNextFrame(() => map.invalidateSize({ animate: false }));
    }
  });

  return map;
}

function applyZoomClass() {
  const z = map.getZoom();
  const el = map.getContainer();
  el.classList.toggle('map-z-mid', z >= 6 && z < 8);
  el.classList.toggle('map-z-near', z >= 8);
}

/* ------------------------------------------------------------
   Markers
   ------------------------------------------------------------ */

function markerHtml(ev) {
  const glyph = GLYPH[ev.kind] || GLYPH.battle;
  return (
    `<span class="mk__ring"></span>` +
    `<span class="mk__body">${glyph}</span>` +
    `<span class="mk__label">${escapeHtml(tx(ev.title))}</span>`
  );
}

function buildMarkers() {
  markerLayer.clearLayers();
  markers.clear();

  for (const ev of events) {
    if (!ev.coords) continue;
    const icon = L.divIcon({
      className: `mk-wrap`,
      html: `<div class="mk mk--${ev.side || 'neutral'} mk--imp${ev.importance || 2}"
                  data-id="${ev.id}">${markerHtml(ev)}</div>`,
      iconSize: [96, 64],
      iconAnchor: [48, 32],
    });

    // Big events sit above small ones so a cluster stays tappable.
    const m = L.marker(ev.coords, {
      icon, riseOnHover: true, keyboard: false,
      zIndexOffset: (ev.importance || 2) * 100,
    });
    m.on('click', () => onSelect(ev.id));
    markers.set(ev.id, { marker: m, event: ev, el: null });
  }
}

/** Re-read the DOM node for a marker (Leaflet recreates it on add). */
function elFor(id) {
  const rec = markers.get(id);
  if (!rec) return null;
  if (rec.el && rec.el.isConnected) return rec.el;
  const icon = rec.marker.getElement();
  rec.el = icon ? icon.querySelector('.mk') : null;
  return rec.el;
}

/** Which events are visible at the current scrubber date + filter. */
export function visibleEvents() {
  return events.filter(
    (ev) => parseDate(ev.date) <= state.date && matchesFilter(ev)
  );
}

/** Add/remove markers and set past / now classes. */
function refresh() {
  const now = yearOf(state.date);
  const shown = new Set();

  for (const ev of visibleEvents()) {
    shown.add(ev.id);
    const rec = markers.get(ev.id);
    if (!rec) continue;
    if (!markerLayer.hasLayer(rec.marker)) markerLayer.addLayer(rec.marker);

    const el = elFor(ev.id);
    if (!el) continue;
    const isNow = yearOf(parseDate(ev.date)) === now;
    el.classList.toggle('mk--now', isNow);
    el.classList.toggle('mk--past', !isNow);
    // Whatever is happening right now should never be hidden behind history.
    rec.marker.setZIndexOffset((ev.importance || 2) * 100 + (isNow ? 1000 : 0));
  }

  for (const [id, rec] of markers) {
    if (!shown.has(id) && markerLayer.hasLayer(rec.marker)) {
      markerLayer.removeLayer(rec.marker);
      rec.el = null;
    }
  }
  refreshSelection();
}

function refreshSelection() {
  const selId = state.selected?.type === 'event' ? state.selected.id : null;
  for (const [id] of markers) {
    const el = elFor(id);
    if (el) el.classList.toggle('mk--sel', id === selId);
  }
}

function relabel() {
  for (const [id, rec] of markers) {
    const el = elFor(id);
    if (el) {
      const label = el.querySelector('.mk__label');
      if (label) label.textContent = tx(rec.event.title);
    }
  }
  drawPlaces(placesCache);
}

/* ------------------------------------------------------------
   Period place labels & shapes
   ------------------------------------------------------------ */

let placesCache = [];

export function drawPlaces(places) {
  placesCache = places || [];
  labelLayer.clearLayers();
  for (const p of placesCache) {
    const cls = p.type === 'region' ? 'place place--region' : 'place place--city';
    const icon = L.divIcon({
      className: 'place-wrap',
      html: `<span class="${cls}">${escapeHtml(tx(p.name))}</span>`,
      iconSize: [160, 22],
      iconAnchor: [80, 11],
    });
    L.marker(p.coords, { icon, interactive: false, keyboard: false }).addTo(labelLayer);
  }
}

export function drawColonies(geojson) {
  if (!geojson) return;
  L.geoJSON(geojson, {
    className: 'colonies-shape',
    interactive: false,
    smoothFactor: 1.4,
  }).addTo(shapeLayer);
}

/* ------------------------------------------------------------
   Camera
   ------------------------------------------------------------ */

/** Fly to an event. `offset` nudges the target up so the sheet does not cover it. */
export function flyToEvent(id, { zoom, offsetY = 0, instant = false } = {}) {
  const rec = markers.get(id);
  if (!rec || !map) return;
  const z = zoom ?? Math.max(map.getZoom(), 7);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const target = map.project(rec.event.coords, z).subtract([0, offsetY]);
  const latlng = map.unproject(target, z);

  if (instant || reduced) map.setView(latlng, z, { animate: false });
  else map.flyTo(latlng, z, { duration: 1.15, easeLinearity: 0.22 });
}

export function resetView(animate = true) {
  if (!map) return;
  map.fitBounds(HOME_BOUNDS, { padding: [12, 12], animate, duration: 0.9 });
}

/** The basemap itself changes with the theme — swap the tile style. */
export function refreshTileTheme() {
  if (tiles) tiles.refresh();
}

export function getMap() { return map; }

/** Height in px of the visible map area, for sheet-aware camera offsets. */
export function mapHeight() {
  return map ? map.getSize().y : 0;
}

/* ------------------------------------------------------------
   Recentre control
   ------------------------------------------------------------ */

export function mountTools(container) {
  const wrap = document.createElement('div');
  wrap.className = 'map-tools';
  const btn = document.createElement('button');
  btn.className = 'map-tool';
  btn.type = 'button';
  btn.innerHTML = icoTarget;
  btn.setAttribute('aria-label', t('recenter'));
  btn.addEventListener('click', () => resetView(true));
  wrap.appendChild(btn);
  container.appendChild(wrap);

  subscribe((s, changed) => {
    if (changed.has('lang')) btn.setAttribute('aria-label', t('recenter'));
  });
}

/* ------------------------------------------------------------ */

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
