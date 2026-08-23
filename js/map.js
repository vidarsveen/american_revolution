/* ============================================================
   map.js — Explore's map: markers, place labels, camera.

   This used to be Leaflet plus raster tiles from a CDN. It is now the same
   renderer the narrated story uses, which is the whole point: there were two
   maps of the same war, drawn by two different engines, and only one of them
   had been fixed.

   What moving here bought, beyond consistency:

     * The ground ships with the app, so it is there offline and there is no
       blank square while a tile arrives.
     * No 1770s map with modern motorways drawn across it.
     * Land and water separate properly. A filtered third-party raster tops
       out around dE 8; the authored basemap reaches 12 — see
       tools/check-contrast.py, which measures both.
     * 162 KB of Leaflet, gone.

   The module positions; this file decides what the markers look like. Their
   markup and CSS predate the move and are unchanged.
   ============================================================ */

import { state, subscribe, parseDate, yearOf, onNextFrame, matchesFilter } from './store.js';
import { tx, t } from './i18n.js';
import { GLYPH, icoTarget } from '../core/icons.js';
import { derivePalette, toneFactions } from '../core/palette.js';
import { isDark } from '../core/theme.js';
import { createMap } from '../map/index.js';

/* Where the map opens when a pack does not say. Bounds rather than a fixed
   zoom, so a tall phone and a wide laptop frame the same thing — but WHICH
   bounds is a fact about the subject, and lives in pack.json under
   map.explore.bounds. This is only the fallback, so it is the whole world
   rather than somebody's theatre of war. */
const HOME_BOUNDS = [[-55, -170], [70, 170]];

/* What a side looks like comes from the pack, the same way the story stage
   gets it. This was a duplicate of the engine's four-name table, so adding a
   subject meant editing the same list in two files and noticing neither. */
function readFactions() {
  const el = document.documentElement;
  return {
    ...derivePalette(manifest?.factions, { el, dark: isDark(el) }),
    ...toneFactions(el),
  };
}

/** The pack manifest, handed in by main.js at boot. */
let manifest = null;

export function usePack(m) { manifest = m || null; }

let map = null;
let host = null;

/** id -> the event, so a marker can be rebuilt from state alone */
const markers = new Map();
let events = [];
let onSelect = () => {};

/** Where the map opens. A fact about the subject, so the pack says it. */
function homeBounds() {
  return manifest?.map?.explore?.bounds || HOME_BOUNDS;
}

/* Explore's map is built the first time somebody asks to see it.

   It used to be built at boot, whether or not the Map tab was ever opened --
   so every session carried TWO full-resolution canvases: the story's and this
   one, each 3088x1518 backing store, about 36 MB apiece, one of them blank
   for ever. It also meant two region label layers, which is why "VIRGINIA"
   and "Virginia" printed on top of each other in the Explore map, and why
   regions.geojson was fetched twice on every load.

   Anything that wants to draw before then queues. */
let pending = [];

export function whenMap(fn) {
  if (map) fn(map); else pending.push(fn);
}

function ensureMap() {
  if (map) return map;
  map = createMap(host, {
    interactive: true,
    minZoom: manifest?.map?.explore?.zoom?.min ?? 2.6,
    maxZoom: manifest?.map?.explore?.zoom?.max ?? 12,
    geoBase: './assets/geo',
    factions: readFactions(),
    onCamera: applyZoomClass,
    // The map has had a setLang since it was written and nothing had ever
    // called it, so Explore drew every region name in Norwegian whatever the
    // interface was set to -- "NORD-CAROLINA" next to "New England".
    lang: state.lang,
  });
  map.setBorders(manifest?.map?.borders || {});
  map.fitBounds(homeBounds(), { padding: 12, instant: true });
  buildMarkers();
  refresh();
  const queued = pending;
  pending = [];
  for (const fn of queued) fn(map);
  return map;
}

export function initMap(allEvents, handlers = {}) {
  events = allEvents;
  onSelect = handlers.onSelect || (() => {});
  host = document.getElementById('map');

  subscribe((s, changed) => {
    if (changed.has('view') && s.view === 'map') {
      ensureMap();
      // A map laid out while its container was hidden measured as zero.
      onNextFrame(() => map.invalidate());
    }
    if (!map) return;
    if (changed.has('date') || changed.has('filter')) refresh();
    if (changed.has('selected')) refreshSelection();
    if (changed.has('lang')) { map.setLang(s.lang); relabel(); }
  });

  // A shared link can land straight on #/kart, and then there is nothing to
  // defer -- the map IS the view being asked for.
  if (state.view === 'map') ensureMap();

  return null;
}

/** Build it now, for a caller that needs the map before the tab is opened. */
export function readyMap() { return ensureMap(); }

/** Label density is a function of zoom; the CSS decides what that means. */
function applyZoomClass({ zoom }) {
  if (!host) return;
  host.classList.toggle('map-z-mid', zoom >= 6 && zoom < 8);
  host.classList.toggle('map-z-near', zoom >= 8);
}

/* ------------------------------------------------------------
   Markers
   ------------------------------------------------------------ */

function markerHtml(ev) {
  const glyph = GLYPH[ev.kind] || GLYPH.battle;
  return (
    `<div class="mk" data-id="${escapeHtml(ev.id)}" style="--mk-color: var(--f-${escapeHtml(ev.side || 'neutral')}, var(--ink-faint))">` +
      `<span class="mk__ring"></span>` +
      `<span class="mk__body">${glyph}</span>` +
      `<span class="mk__label">${escapeHtml(tx(ev.title))}</span>` +
    `</div>`
  );
}

/**
 * The class list is a pure function of the event and the current state.
 *
 * These go on the WRAPPER, not on .mk itself. Every rule that reads them is
 * either a custom property (--mk-color, --mk-size, which inherit) or a
 * descendant selector (.mk--now .mk__ring), so they work one level up — and
 * keeping them off .mk means a selection change rewrites one attribute
 * instead of re-rendering the glyph.
 */
function markerClass(ev) {
  const now = yearOf(state.date);
  const isNow = yearOf(parseDate(ev.date)) === now;
  const sel = state.selected?.type === 'event' && state.selected.id === ev.id;
  return [
    'mk-wrap',
    `mk--imp${ev.importance || 2}`,
    isNow ? 'mk--now' : 'mk--past',
    sel ? 'mk--sel' : '',
  ].filter(Boolean).join(' ');
}

function buildMarkers() {
  markers.clear();
  for (const ev of events) {
    if (!ev.coords) continue;
    markers.set(ev.id, ev);
  }
}

/** Which events are visible at the current scrubber date + filter. */
export function visibleEvents() {
  return events.filter(
    (ev) => parseDate(ev.date) <= state.date && matchesFilter(ev)
  );
}

/**
 * Put the right markers on the map, in the right state.
 *
 * Driven entirely from state rather than by reaching into the DOM the way the
 * Leaflet version had to. Whatever is happening this year sits above the
 * history, so a cluster stays tappable.
 */
function refresh() {
  const shown = new Set();
  for (const ev of visibleEvents()) {
    shown.add(ev.id);
    const isNow = yearOf(parseDate(ev.date)) === yearOf(state.date);
    map.pins.add({
      id: `ev:${ev.id}`,
      at: ev.coords,
      html: markerHtml(ev),
      className: markerClass(ev),
      z: (ev.importance || 2) * 100 + (isNow ? 1000 : 0),
      onClick: () => onSelect(ev.id),
    });
  }
  for (const id of markers.keys()) {
    if (!shown.has(id)) map.pins.remove(`ev:${id}`);
  }
}

function refreshSelection() {
  for (const [id, ev] of markers) {
    if (map.pins.get(`ev:${id}`)) {
      map.pins.update(`ev:${id}`, { className: markerClass(ev) });
    }
  }
}

function relabel() {
  for (const [id, ev] of markers) {
    if (map.pins.get(`ev:${id}`)) {
      map.pins.update(`ev:${id}`, { html: markerHtml(ev) });
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
  if (!map) { whenMap(() => drawPlaces(placesCache)); return; }
  for (const p of placesCache) {
    const cls = p.type === 'region' ? 'place place--region' : 'place place--city';
    map.pins.add({
      id: `pl:${p.id || tx(p.name)}`,
      at: p.coords,
      className: 'place-wrap',
      html: `<span class="${cls}">${escapeHtml(tx(p.name))}</span>`,
    });
  }
}

/**
 * The thirteen colonies, in the colours the story uses.
 *
 * Restrained — this is a browsing map whose subject is the markers, not the
 * politics — but the same thirteen colours, so moving between the two tabs
 * shows you the same country.
 */
export function drawColonies(geojson) {
  if (!geojson) return;
  if (!map) { whenMap(() => drawColonies(geojson)); return; }
  map.useRegions(geojson).then((set) => {
    if (!set) return;
    for (const name of map.regionNames()) {
      map.regions.add({
        id: `colony:${name}`,
        name,
        faction: 'patriot',
        // Much fainter than the story uses. There the thirteen colours ARE
        // the subject; here they are context behind markers and routes, and
        // at story strength the wash pulled land and water together badly
        // enough to fail the shore-legibility check around the Chesapeake.
        strength: 0.5,
        label: false,
        instant: true,
      });
    }
  }).catch(() => {});
}

/* ------------------------------------------------------------
   Camera
   ------------------------------------------------------------ */

/** Fly to an event. `offsetY` nudges the target up so the sheet does not cover it. */
export function flyToEvent(id, { zoom, offsetY = 0, instant = false } = {}) {
  const ev = markers.get(id);
  if (!ev || !map) return;
  map.flyTo({
    to: ev.coords,
    zoom: zoom ?? Math.max(map.camera().zoom, 7),
    offset: [0, -offsetY],
    over: 1.15,
    instant,
  });
}

export function resetView(animate = true) {
  if (!map) return;
  map.fitBounds(homeBounds(), { padding: 12, instant: !animate, over: 0.9 });
}

/** The ground is ours and drawn from design tokens, so a theme flip redraws it. */
export function refreshMapTheme() {
  if (!map) return;
  map.refreshTheme();
  map.setFactions(readFactions());
}

export function getMap() { return map; }

/** Height in px of the visible map area, for sheet-aware camera offsets. */
export function mapHeight() {
  return host ? host.getBoundingClientRect().height : 0;
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
