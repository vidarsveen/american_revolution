/* ============================================================
   scenes/map.js — the story stage's map, as an adapter.

   This used to be 437 lines of Leaflet. It is now a translation layer: cue
   objects in, map-module calls out. The map itself lives in map/ and is
   developed and tested on its own bench (dev/map-lab.html) without the app,
   the narration or a chapter anywhere near it.

   The export names are unchanged, so engine/stage.js and its verb table did
   not have to move at all.
   ============================================================ */

import { createMap } from '../../map/index.js';

let map = null;
let chapter = null;
let lang = 'no';
let hostEl = null;

/** Places the chapter named, so a pin can suppress the standing label. */
const pinned = new Set();

/* Sides are read from the design tokens rather than hard-coded, so they flip
   with the theme and there is still exactly one place that decides what
   "British" looks like. When packs land, this comes from pack.json instead. */
const SIDES = ['british', 'patriot', 'french', 'neutral'];
const TOKEN = { british: '--red', patriot: '--blue', french: '--gold', neutral: '--sage' };

function readFactions(el) {
  const cs = getComputedStyle(el);
  const out = {};
  for (const id of SIDES) {
    const fill = cs.getPropertyValue(TOKEN[id]).trim() || '#55704c';
    out[id] = { label: id, fill, line: fill, flag: '' };
  }
  return out;
}

export function mountMap(container, ch, language) {
  chapter = ch;
  lang = language || ch.narrationLang || 'no';

  hostEl = document.createElement('div');
  hostEl.className = 'stage-map';
  hostEl.innerHTML = '<div class="stage-map__canvas" id="story-map"></div>';
  container.appendChild(hostEl);

  const host = hostEl.querySelector('#story-map');
  map = createMap(host, {
    // The narration drives the camera; a stray finger must not fight it.
    interactive: false,
    center: homeCentre(),
    zoom: 10.5,
    minZoom: 3,
    maxZoom: 15,
    geoBase: './assets/geo',
    // Natural Earth is 1:10M and this chapter plays at zoom 11-13.5. Without
    // the pack's own geometry the harbour is a blob and the Charles does not
    // exist — emptier than the tiles this replaced, which would be no trade.
    detail: {
      url: `./content/${ch.pack}/geo/detail.json`,
      minZoom: 9.5,
      bbox: [-71.70, 42.05, -70.75, 42.75],
    },
    factions: readFactions(document.documentElement),
  });

  drawStandingLabels();

  // A map created while its container is hidden or still being laid out
  // measures as zero and renders nothing — the "map didn't load" case.
  addEventListener('orientationchange', () => setTimeout(invalidate, 250));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(invalidate, 60);
  });
  for (const d of [0, 120, 400, 1200]) setTimeout(invalidate, d);

  return { invalidate, refreshTheme };
}

function invalidate() { map?.invalidate(); }

function refreshTheme() {
  if (!map) return;
  map.refreshTheme();
  // Faction colours are design tokens too, and they differ per theme.
  map.setFactions(readFactions(document.documentElement));
}

function homeCentre() {
  const home = chapter.places?.[chapter.home] || Object.values(chapter.places || {})[0];
  return home ? home.coords : [0, 0];
}

const pick = (field) => {
  if (field == null) return null;
  if (typeof field === 'string') return field;
  return field[lang] ?? field.no ?? field.en ?? null;
};

/* ------------------------------------------------------------
   Standing place names
   ------------------------------------------------------------ */

function drawStandingLabels() {
  for (const [id, place] of Object.entries(chapter.places || {})) {
    if (place.label === false) continue;
    map.places.add({
      id: `place:${id}`,
      name: pick(place.name) || id,
      coords: place.coords,
      kind: place.kind || 'town',
    });
  }
}

/** A pin already names the place; two labels on one dot is noise. */
function setStandingLabel(id, on) {
  const place = chapter.places?.[id];
  if (!place || place.label === false) return;
  if (on) {
    if (!pinned.has(id)) return;
    pinned.delete(id);
    map.places.add({
      id: `place:${id}`,
      name: pick(place.name) || id,
      coords: place.coords,
      kind: place.kind || 'town',
    });
  } else {
    pinned.add(id);
    map.places.remove(`place:${id}`);
  }
}

export function resetMap() {
  if (!map) return;
  map.reset();
  pinned.clear();
  drawStandingLabels();
}

/* ------------------------------------------------------------
   Camera
   ------------------------------------------------------------ */

/** Room for the transport and captions, which sit over the bottom of the map. */
function framePadding() {
  const h = hostEl?.clientHeight || 600;
  const w = hostEl?.clientWidth || 400;
  return Math.max(28, Math.min(w * 0.12, h * 0.16));
}

export function flyTo(cue, instant) {
  const place = chapter.places?.[cue.to];
  if (!place || !map) return;
  map.flyTo({
    to: place.coords,
    zoom: cue.zoom ?? place.zoom ?? 12,
    over: cue.over,
    instant,
  });
}

function frame(points, instant, over) {
  if (!map || !points.length) return;
  map.fitCoords(points, { padding: framePadding(), instant, over, maxZ: 13.5 });
}

export function fitRoute(cue, instant) {
  const route = chapter.routes?.[cue.id];
  if (route) frame(route.coords, instant, cue.over);
}

export function fitPlaces(cue, instant) {
  const pts = (cue.places || [])
    .map((id) => chapter.places?.[id]?.coords)
    .filter(Boolean);
  frame(pts, instant, cue.over);
}

/* ------------------------------------------------------------
   Atmosphere
   ------------------------------------------------------------ */

export function setTime(value) {
  map?.setTimeLabel(typeof value === 'string' ? value : '');
}

export function setMood(value, instant) {
  map?.setMood(value || 'day', instant);
}

export function flash(instant) {
  map?.flash(instant);
}

/* ------------------------------------------------------------
   Routes
   ------------------------------------------------------------ */

export function drawRoute(cue, instant) {
  const route = chapter.routes?.[cue.id];
  if (!route || !map) return;

  // Frame it first, or a march can draw itself straight off the edge.
  if (cue.fit !== false) frame(route.coords, instant, 1.6);

  map.marches.add({
    id: `route:${cue.id}`,
    coords: route.coords,
    faction: route.side || cue.side || 'neutral',
    naval: route.naval,
    over: cue.over ?? 2.6,
    instant,
  });
}

export function clearRoutes() {
  map?.marches.clear();
  map?.arrows.clear();
}

/* ------------------------------------------------------------
   Converge — lines coming in from outside and joining
   ------------------------------------------------------------ */

export function converge(cue, instant) {
  const target = chapter.places?.[cue.to];
  if (!target || !map) return;

  const from = (cue.from || [])
    .map((id) => chapter.places?.[id])
    .filter(Boolean);
  if (!from.length) return;

  if (cue.fit !== false) {
    frame([target.coords, ...from.map((p) => p.coords)], instant, 1.6);
  }

  // Militia on a road, armies on a capital, supply lines on a port — all of
  // them are bodies of people moving, so they get the army arrow rather than
  // the thin line this used to draw.
  from.forEach((place, i) => {
    map.arrows.add({
      id: `converge:${cue.to}:${i}`,
      coords: bow(place.coords, target.coords, i),
      faction: cue.side || 'patriot',
      strength: cue.strength ?? 600,
      over: cue.over ?? 3.2,
      instant,
    });
  });
}

/**
 * Bow the path so several arrows converging on one point stay distinguishable
 * instead of collapsing into a single thick spoke.
 */
function bow([aLat, aLon], [bLat, bLon], i) {
  const midLat = (aLat + bLat) / 2;
  const midLon = (aLon + bLon) / 2;
  const dLat = bLat - aLat;
  const dLon = bLon - aLon;
  const side = i % 2 ? -1 : 1;
  const amt = 0.16 * (1 + Math.floor(i / 2) * 0.5) * side;
  return [
    [aLat, aLon],
    [midLat - dLon * amt, midLon + dLat * amt],
    [bLat, bLon],
  ];
}

/* ------------------------------------------------------------
   Pins and rings
   ------------------------------------------------------------ */

export function showMarker(cue, instant) {
  const place = chapter.places?.[cue.at];
  if (!place || !map) return;
  map.markers.add({
    id: `mk:${cue.at}`,
    at: place.coords,
    label: pick(cue.label) || pick(place.name) || '',
    faction: cue.side || cue.tone || 'british',
    instant,
  });
  setStandingLabel(cue.at, false);
}

export function hideMarker(cue) {
  map?.markers.remove(`mk:${cue.at}`);
  setStandingLabel(cue.at, true);
}

export function clearMarkers() {
  if (!map) return;
  map.markers.clear();
  for (const id of [...pinned]) setStandingLabel(id, true);
}

export function highlight(cue, instant) {
  const place = chapter.places?.[cue.at];
  if (!place || !map) return;
  map.highlights.add({
    id: `ring:${cue.at}`,
    at: place.coords,
    faction: cue.side || 'french',
    instant,
  });
  if (cue.centre !== false && !instant) {
    map.flyTo({ to: place.coords, over: 1.1 });
  }
}

export function clearHighlights() {
  map?.highlights.clear();
}

/** Debug hook — tools/shoot.py drives the stage through this. */
export function getStoryMap() { return map; }
