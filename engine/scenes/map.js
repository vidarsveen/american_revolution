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
const WASH = { british: '--red-wash', patriot: '--blue-wash',
               french: '--gold-wash', neutral: '--sage-wash' };

function readFactions(el) {
  const cs = getComputedStyle(el);
  const out = {};
  for (const id of SIDES) {
    const fill = cs.getPropertyValue(TOKEN[id]).trim() || '#55704c';
    const wash = cs.getPropertyValue(WASH[id]).trim() || fill;
    out[id] = { label: id, fill, line: fill, wash, flag: '' };
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
    // Low enough that a phone can hold an ocean. At minZoom 3 a 393 px screen
    // shows 64 degrees of longitude, so the establishing shot could not fit
    // Boston and Britain at once however it was framed — Britain sat 46 px off
    // the right edge at the moment the narration named it. A wide screen never
    // showed the problem, because 64 degrees is what it has to spare.
    minZoom: 1.8,
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
    lang,
  });

  drawStandingLabels();
  // Warm the region file now rather than mid-sentence.
  ensureRegions();

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
  regionEpoch += 1;
  map.reset();
  map.setBorders({ country: true, state: false });
  pinned.clear();
  drawStandingLabels();
}

/* ------------------------------------------------------------
   Camera
   ------------------------------------------------------------ */

/**
 * Room for the furniture that sits ON TOP of the map, per edge.
 *
 * The caption and transport cover the bottom of the stage and the title bar
 * covers the top — they are over the map, not beside it, so the map is
 * 393x742 while the part you can actually see is more like 393x540. Padding
 * every edge equally treats those as free space and frames the picture into
 * them: the "thirteen colonies" shot put Georgia and South Carolina behind
 * the subtitles, which are the two the sentence names.
 *
 * Measured off the real elements rather than guessed, so a caption that grows
 * to three lines on a narrow screen is still cleared.
 */
function framePadding() {
  const host = hostEl?.querySelector('#story-map') || hostEl;
  const box = host?.getBoundingClientRect();
  const w = box?.width || 400;
  const h = box?.height || 600;
  const edge = Math.max(20, Math.min(w * 0.07, h * 0.07));

  const pad = { top: edge, right: edge, bottom: edge, left: edge };
  if (!box) return pad;

  // The caption sits in its own slot ABOVE the transport, so measuring the
  // transport alone leaves the map framing a caption's worth of picture it
  // cannot show. Both, plus the slot, because the caption element is empty
  // between beats and the slot is not.
  for (const sel of ['.story__chrome', '.transport', '.story__caption-slot',
                     '.captions']) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.height) pad.bottom = Math.max(pad.bottom, box.bottom - r.top + 8);
    }
  }

  /* A portrait or a picture covers the map too, and a march drawing itself
     underneath one is a march nobody can see. These sit in a corner rather
     than across an edge, so clearing them is a choice of which way to push:
     down past the bottom of the card, or in past its inner edge. Take
     whichever costs less picture — for a 46vw portrait in the top right that
     is almost always the right edge, and pushing everything down below it
     would have thrown away half the frame. */
  for (const el of document.querySelectorAll('.ov-portrait__card, .ov-image__card, .ov-quote')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (getComputedStyle(el).opacity === '0') continue;
    if (r.right < box.left || r.left > box.right) continue;
    if (r.bottom < box.top || r.top > box.bottom) continue;

    const options = [
      ['top', r.bottom - box.top + 8],
      ['bottom', box.bottom - r.top + 8],
      ['left', r.right - box.left + 8],
      ['right', box.right - r.left + 8],
    ].filter(([, v]) => v > 0);
    if (!options.length) continue;
    const [side, amount] = options.reduce((a, b) => (b[1] < a[1] ? b : a));
    pad[side] = Math.max(pad[side], amount);
  }

  // Never squeeze the map to nothing, whatever is piled on top of it.
  pad.bottom = Math.min(pad.bottom, h * 0.42);
  pad.top = Math.min(pad.top, h * 0.34);
  pad.left = Math.min(pad.left, w * 0.42);
  pad.right = Math.min(pad.right, w * 0.42);
  return pad;
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

/**
 * Draw a route: an army arrow if a force is moving along it, a line if not.
 *
 * The distinction is the whole point and it used to be missing — every route
 * drew the same hairline, so seven hundred regulars marching on Concord looked
 * exactly like Paul Revere alone on a horse, while the militia coming in from
 * the towns got proper broad arrows because they happened to arrive through a
 * different verb. Same map, two visual languages, no rule.
 *
 * The rule now: a route with a `strength` is a body of people and gets an
 * arrow sized by how many of them there are. A route without one is a rider or
 * a ship and stays a line. That is a property of who is moving, so it lives on
 * the route rather than on the cue — though a cue can still override it.
 */
export function drawRoute(cue, instant) {
  const route = chapter.routes?.[cue.id];
  if (!route || !map) return;

  // Frame it first, or a march can draw itself straight off the edge.
  if (cue.fit !== false) frame(route.coords, instant, 1.6);

  const id = `route:${cue.id}`;
  const faction = route.side || cue.side || 'neutral';
  const strength = cue.strength ?? route.strength;

  if (strength) {
    map.arrows.add({
      id, coords: route.coords, faction, strength,
      over: cue.over ?? 2.6,
      instant,
    });
  } else {
    map.marches.add({
      id, coords: route.coords, faction,
      naval: route.naval,
      over: cue.over ?? 2.6,
      instant,
    });
  }
}

/**
 * Lay a road down: a quiet standing line, drawn whole.
 *
 * The ground between Boston and Concord is close to empty at the zooms
 * scenes three to five play at — our close-in geometry is water, and inland
 * New England has little of it — so every march was crossing a blank field.
 * The road is the one line the entire day happens on, and once it is there
 * the marches are travelling ALONG something rather than over nothing.
 *
 * Not animated and not a route: it is scenery, so it never competes with the
 * movement drawn on top of it.
 */
export function drawRoad(cue) {
  const route = chapter.routes?.[cue.id];
  if (!route || !map) return;
  map.roads.add({
    id: `road:${cue.id}`,
    coords: route.coords,
    width: cue.width ?? 1.8,
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
 *
 * The amount is constant. It used to grow with the index — 0.16, 0.24, 0.32,
 * and so on — which is fine for the three or four columns it was written for
 * and absurd for the twelve that close on Boston during the siege: the last
 * arrows bowed so far they crossed the earlier ones and the picture became a
 * knot. Towns surrounding a target already arrive on different bearings and
 * need no help separating; the bow is only there for the ones that share a
 * bearing, and a small constant does that job without anything looping.
 */
function bow([aLat, aLon], [bLat, bLon], i) {
  const midLat = (aLat + bLat) / 2;
  const midLon = (aLon + bLon) / 2;
  const dLat = bLat - aLat;
  const dLon = bLon - aLon;
  const amt = 0.13 * (i % 2 ? -1 : 1);
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

/* ------------------------------------------------------------
   Regions and boundaries
   ------------------------------------------------------------ */

/* Loaded once, lazily: a chapter that never names a region should not pay
   for the file. `chapter.regions` is a path relative to the pack, so the
   engine never learns what a colony is. */
let regionsReady = null;

/* Every clear bumps this. An in-flight show captured an older value and
   drops itself when it lands.

   Without it the async load breaks the engine's central rule. Replaying cues
   after a seek runs them in order, but `region.show` has to wait for a fetch
   while `region.clear` is instant — so a clear in beat 9 ran first and beat
   8's show resolved afterwards and put the region back. Seeking to the end of
   the scene left Massachusetts washed over the whole map. The picture has to
   be a function of time, and an unguarded promise is a history of events. */
let regionEpoch = 0;

function ensureRegions() {
  if (regionsReady) return regionsReady;
  const rel = chapter.regions;
  if (!rel) return Promise.resolve(null);
  regionsReady = fetch(`./content/${chapter.pack}/${rel}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((geo) => map.useRegions(geo))
    .catch((err) => {
      console.warn('[map] could not load regions:', err.message);
      return null;
    });
  return regionsReady;
}

export function showRegions(cue, instant) {
  if (!map) return;
  const names = cue.names || (cue.name ? [cue.name] : []);
  if (!names.length) return;
  const epoch = regionEpoch;
  ensureRegions().then((set) => {
    if (!set || epoch !== regionEpoch) return;
    for (const name of names) {
      map.regions.add({
        id: `region:${name}`,
        name,
        faction: cue.side,
        strength: cue.strength,
        label: cue.label !== false,
        // Each region its own colour within the side, unless the shot is
        // about the side rather than the areas.
        vary: cue.vary !== false,
        over: cue.over ?? 1.2,
        instant,
      });
    }
  });
}

export function clearRegions() {
  regionEpoch += 1;
  map?.regions.clear();
}

export function setBorders(cue) {
  const next = {};
  if (cue.country !== undefined) next.country = !!cue.country;
  if (cue.state !== undefined) next.state = !!cue.state;
  map?.setBorders(next);
}

/** Debug hook — tools/shoot.py drives the stage through this. */
export function getStoryMap() { return map; }
