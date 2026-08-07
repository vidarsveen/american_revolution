/* ============================================================
   routes.js — campaign movement.

   Each march is an SVG polyline that draws itself across the map
   when the scrubber reaches its date, with an arrowhead on the end.
   A soft glow marks where the war's weight sits that year.
   ============================================================ */

import { state, subscribe, parseDate, onNextFrame } from './store.js';
import { getMap } from './map.js';

const SIDE_COLOR = {
  british: 'var(--red)',
  patriot: 'var(--blue)',
  french: 'var(--gold)',
  neutral: 'var(--sage)',
};

const DRAW_MS = 1600;

let map = null;
let routeLayer = null;
let theatreLayer = null;
let routes = [];
let theatres = [];
let defsReady = false;

/** id -> { line, drawn } */
const lines = new Map();
let theatreShape = null;
let theatreId = null;

export function initRoutes(data) {
  map = getMap();
  if (!map || !data) return;

  routes = data.routes || [];
  theatres = data.theatres || [];

  // Under the markers, above the tiles.
  map.createPane('theatrePane').style.zIndex = 390;
  map.createPane('routePane').style.zIndex = 395;
  map.getPane('theatrePane').style.pointerEvents = 'none';
  map.getPane('routePane').style.pointerEvents = 'none';

  theatreLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);

  refresh();
  subscribe((s, changed) => { if (changed.has('date')) refresh(); });
}

/* ------------------------------------------------------------
   Routes
   ------------------------------------------------------------ */

function refresh() {
  for (const r of routes) {
    const due = state.date >= parseDate(r.from);
    const has = lines.has(r.id);
    if (due && !has) addRoute(r);
    else if (!due && has) removeRoute(r.id);
  }
  refreshTheatre();
}

function addRoute(r) {
  const line = L.polyline(r.coords, {
    pane: 'routePane',
    className: `route-path route--${r.side}${r.naval ? ' route--naval' : ''}`,
    weight: r.naval ? 3 : 3.4,
    opacity: 0.85,
    interactive: false,
    smoothFactor: 1,
  }).addTo(routeLayer);

  lines.set(r.id, { line, drawn: false });
  onNextFrame(() => drawOn(r, line));
}

function removeRoute(id) {
  const rec = lines.get(id);
  if (!rec) return;
  routeLayer.removeLayer(rec.line);
  lines.delete(id);
}

/**
 * Animate the stroke from nothing to full length.
 *
 * Leaflet rewrites the path's `d` on every zoom, which would restart a
 * running dash animation — so once the draw is done we clear the dash
 * properties entirely and let the line just be a line.
 */
function drawOn(r, line) {
  const path = line.getElement?.() || line._path;
  if (!path) return;

  ensureDefs();
  path.setAttribute('marker-end', `url(#arrow-${r.side})`);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  let len = 0;
  try { len = path.getTotalLength(); } catch { /* not laid out yet */ }
  if (!len) return;

  // Naval routes keep their dotted look, so they cannot be dash-animated.
  if (r.naval) {
    path.style.opacity = '0';
    path.style.transition = `opacity ${DRAW_MS}ms var(--ease-out)`;
    onNextFrame(() => { path.style.opacity = ''; });
    setTimeout(() => { path.style.transition = ''; }, DRAW_MS + 80);
    return;
  }

  path.style.transition = 'none';
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
  path.setAttribute('marker-end', '');

  onNextFrame(() => {
    path.style.transition = `stroke-dashoffset ${DRAW_MS}ms cubic-bezier(.33,.02,.2,1)`;
    path.style.strokeDashoffset = '0';
  });

  // Hand the line back to Leaflet once it is fully drawn.
  const settle = () => {
    path.style.transition = '';
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
    path.setAttribute('marker-end', `url(#arrow-${r.side})`);
  };
  setTimeout(settle, DRAW_MS + 60);
}

/** One <defs> block of arrowheads, shared by every route. */
function ensureDefs() {
  if (defsReady) return;
  const svg = map.getPane('routePane').querySelector('svg');
  if (!svg) return;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = ['british', 'patriot', 'french', 'neutral'].map((side) => `
    <marker id="arrow-${side}" viewBox="0 0 10 10" refX="7.5" refY="5"
            markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"
            markerUnits="strokeWidth">
      <path d="M0.5 1 L9 5 L0.5 9 z" style="fill: ${SIDE_COLOR[side]}"/>
    </marker>`).join('');
  svg.insertBefore(defs, svg.firstChild);
  defsReady = true;
}

/* ------------------------------------------------------------
   Theatre glow — where the weight of the war sits
   ------------------------------------------------------------ */

function refreshTheatre() {
  const t = theatres.find(
    (x) => state.date >= parseDate(x.from) && state.date <= parseDate(x.to)
  );
  if ((t?.id || null) === theatreId) return;
  theatreId = t?.id || null;

  if (theatreShape) { theatreLayer.removeLayer(theatreShape); theatreShape = null; }
  if (!t) return;

  theatreShape = L.circle(t.center, {
    pane: 'theatrePane',
    radius: t.radiusKm * 1000,
    className: 'theatre-glow',
    interactive: false,
    stroke: false,
    fillOpacity: 1,
  }).addTo(theatreLayer);

  ensureGlowDef();
  const el = theatreShape.getElement?.() || theatreShape._path;
  if (el) el.setAttribute('fill', 'url(#theatre-glow)');
}

function ensureGlowDef() {
  const svg = map.getPane('theatrePane').querySelector('svg');
  if (!svg || svg.querySelector('#theatre-glow')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <radialGradient id="theatre-glow">
      <stop offset="0%"   style="stop-color: var(--gold); stop-opacity: .16"/>
      <stop offset="55%"  style="stop-color: var(--gold); stop-opacity: .09"/>
      <stop offset="100%" style="stop-color: var(--gold); stop-opacity: 0"/>
    </radialGradient>`;
  svg.insertBefore(defs, svg.firstChild);
}
