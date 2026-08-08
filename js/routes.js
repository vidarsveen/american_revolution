/* ============================================================
   routes.js — campaign movement.

   Each march draws itself across the map when the scrubber reaches its date.
   A soft glow marks where the war's weight sits that year.

   This was SVG polylines on a Leaflet pane, with hand-built <defs> for the
   arrowheads and a stroke-dashoffset animation that had to be torn down again
   afterwards, because Leaflet rewrites a path's `d` on every zoom and would
   have restarted a running dash. None of that survives the move: the map
   module draws a route as a function of (data, camera, progress), so it grows
   itself and keeps growing correctly while you pan and zoom underneath it.
   ============================================================ */

import { state, subscribe, parseDate } from './store.js';
import { getMap } from './map.js';

/* Long enough to read as movement, short enough that dragging the scrubber
   across five years does not queue up a minute of animation. */
const DRAW_OVER = 1.6;

let map = null;
let routes = [];
let theatres = [];

const drawn = new Set();
let theatreId = null;

export function initRoutes(data) {
  map = getMap();
  if (!map || !data) return;

  routes = data.routes || [];
  theatres = data.theatres || [];

  refresh();
  subscribe((s, changed) => { if (changed.has('date')) refresh(); });
}

/* ------------------------------------------------------------
   Routes
   ------------------------------------------------------------ */

function refresh() {
  for (const r of routes) {
    const due = state.date >= parseDate(r.from);
    if (due && !drawn.has(r.id)) addRoute(r);
    else if (!due && drawn.has(r.id)) removeRoute(r.id);
  }
  refreshTheatre();
}

/**
 * A route with a strength is a body of troops and gets an army arrow; one
 * without is a fleet or a courier and stays a line. Same rule the narrated
 * chapters use, so a march means the same thing in both halves of the app.
 */
function addRoute(r) {
  drawn.add(r.id);
  const spec = {
    id: `route:${r.id}`,
    coords: r.coords,
    faction: r.side || 'neutral',
    over: DRAW_OVER,
  };
  if (r.strength) map.arrows.add({ ...spec, strength: r.strength });
  else map.marches.add({ ...spec, naval: r.naval });
}

function removeRoute(id) {
  drawn.delete(id);
  map.marches.remove(`route:${id}`);
  map.arrows.remove(`route:${id}`);
}

/* ------------------------------------------------------------
   Theatre glow — where the weight of the war sits
   ------------------------------------------------------------ */

function refreshTheatre() {
  const t = theatres.find(
    (x) => state.date >= parseDate(x.from) && state.date <= parseDate(x.to)
  );
  if ((t?.id || null) === theatreId) return;

  if (theatreId) map.glows.remove(`theatre:${theatreId}`);
  theatreId = t?.id || null;
  if (!t) return;

  map.glows.add({
    id: `theatre:${t.id}`,
    at: t.center,
    radiusKm: t.radiusKm,
    faction: 'french',    // the gold token: a turning point, not a side
    over: 0.9,
  });
}
