/* ============================================================
   map-lab.js — drives the bench.

   Every capability the map has gets one button here. If an artifact cannot
   be demonstrated from this page it does not count as built.
   ============================================================ */

import { createMap } from '../map/index.js';
import * as F from './fixture.js';

const $ = (s) => document.querySelector(s);

const map = createMap($('#map'), {
  center: [42.40, -71.18],
  zoom: 10.4,
  minZoom: 2,
  maxZoom: 15,
  geoBase: '../assets/geo',
  factions: F.FACTIONS,
  onSelect: (id) => console.log('[lab] selected', id),
});
window.map = map;   // so the screenshot harness can drive it

const VIEWS = {
  atlantic: { bounds: [[24, -92], [52, -58]] },
  colonies: { bounds: [[31, -82], [46, -69]] },
  boston:   { to: [42.36, -71.06], zoom: 11.6 },
  lexington:{ to: [42.446, -71.229], zoom: 13.2 },
};

/* ------------------------------------------------------------
   Artifact demos — each is idempotent, so pressing twice is safe
   ------------------------------------------------------------ */

const strength = () => Number($('#strength').value);

const DEMOS = {
  places() {
    map.places.clear();
    for (const p of F.PLACES) map.places.add(p);
  },

  roads() {
    map.roads.add({ id: 'road-concord', coords: F.ROAD_CONCORD, width: 2.2 });
  },

  march() {
    map.marches.remove('revere');
    map.marches.add({ id: 'revere', coords: F.REVERE_RIDE, faction: 'patriot', over: 2.6 });
  },

  arrows() {
    map.arrows.clear();
    // Frame them, or you are looking at the middle of a shaft and wondering
    // why it looks like a road.
    map.fitCoords([...F.BRITISH_ADVANCE, ...F.BRITISH_RETREAT], { padding: 90 });
    map.arrows.add({ id: 'out', coords: F.BRITISH_ADVANCE, faction: 'british',
                     strength: strength(), over: 3.0 });
    map.arrows.add({ id: 'back', coords: F.BRITISH_RETREAT, faction: 'british',
                     strength: strength() * 0.8, over: 3.0, ghost: true });
  },

  units() {
    map.units.clear();
    map.units.add({ id: 'smith', at: [42.4604, -71.3489], faction: 'british',
                    commander: 'Oberstløytnant Smith', strength: 700 });
    map.units.add({ id: 'parker', at: [42.4430, -71.2290], faction: 'patriot',
                    commander: 'Kaptein Parker', strength: 77 });
    map.units.add({ id: 'gage', at: [42.3601, -71.0589], faction: 'british',
                    commander: 'General Gage', strength: 4000 });
  },

  front() {
    map.fronts.add({ id: 'siege', coords: F.SIEGE_FRONT, faction: 'patriot',
                     facing: -1, over: 1.8 });
  },

  area() {
    // Pick the polygon that suits the frame we are actually looking at.
    const wide = map.camera().zoom < 9;
    map.areas.add({ id: 'ne', faction: 'patriot', over: 1.4,
                    rings: wide ? F.NEW_ENGLAND_CONTROL : F.BOSTON_CONTROL });
  },

  crossing() {
    map.crossings.add({ id: 'charles', ...F.CHARLES_CROSSING,
                        faction: 'british', over: 1.4 });
  },

  battles() {
    map.battles.clear();
    map.battles.add({ id: 'lex', at: [42.4430, -71.2290], faction: 'british',
                      kind: 'battle', scale: 2, over: 0.7 });
    map.battles.add({ id: 'con', at: [42.4604, -71.3489], faction: 'patriot',
                      kind: 'battle', scale: 3, over: 0.7 });
    map.battles.add({ id: 'siegeb', at: [42.3601, -71.0589], faction: 'patriot',
                      kind: 'siege', scale: 2, over: 0.7 });
    map.battles.add({ id: 'camp', at: [42.3900, -71.1500], faction: 'patriot',
                      kind: 'camp', scale: 1.4, over: 0.7 });
  },

  converge() {
    F.MILITIA_CONVERGE.forEach((coords, i) => {
      map.arrows.add({ id: `militia-${i}`, coords, faction: 'patriot',
                       strength: 400, over: 2.4 });
    });
  },

  all() {
    DEMOS.clear();
    map.fitBounds([[42.30, -71.42], [42.52, -70.98]], { instant: true, padding: 70 });
    DEMOS.places(); DEMOS.roads(); DEMOS.area(); DEMOS.front();
    DEMOS.roads(); DEMOS.march(); DEMOS.arrows(); DEMOS.converge();
    DEMOS.crossing(); DEMOS.battles(); DEMOS.units();
  },

  clear() { map.reset(); },

  /* ---- administrative boundaries ----
     The framework ships MODERN boundaries, because that is the honest
     general default. Every historical pack will want to override them:
     in 1775 Massachusetts ran up to include Maine, Vermont was claimed by
     two colonies at once, and West Virginia was 88 years away. */
  async regionsModern() {
    await map.useRegions();
    map.regions.clear();
    map.setBorders({ state: true });
    for (const name of ['Massachusetts', 'Connecticut', 'Rhode Island',
                        'New Hampshire', 'New York', 'New Jersey',
                        'Pennsylvania', 'Maryland', 'Virginia', 'Maine',
                        'Delaware', 'Vermont']) {
      map.regions.add({ id: `m-${name}`, name, label: true, instant: true });
    }
    map.fitBounds([[37.5, -80.5], [47.5, -66.5]]);
  },

  async regionsColonies() {
    const res = await fetch('../content/american-revolution/geo/colonies.geojson');
    await map.useRegions(await res.json());
    map.regions.clear();
    map.setBorders({ state: false });
    for (const name of map.regionNames()) {
      map.regions.add({ id: `c-${name}`, name, label: true, instant: true });
    }
    map.fitBounds([[30.5, -82.5], [47.5, -66.5]]);
  },

  /* Regions are subject-neutral, so "which side is this" is just a faction. */
  regionsSides() {
    const SIDE = {
      Massachusetts: 'patriot', Connecticut: 'patriot', 'Rhode Island': 'patriot',
      'New Hampshire': 'patriot', Virginia: 'patriot', Pennsylvania: 'patriot',
      'New York': 'british', Georgia: 'british', 'South Carolina': 'british',
      Maine: 'british', 'North Carolina': 'neutral', Maryland: 'neutral',
      'New Jersey': 'neutral', Delaware: 'neutral', 'West Virginia': 'neutral',
    };
    for (const s of map.regions.all()) {
      map.regions.update(s.id, { faction: SIDE[s.name] || 'neutral' });
    }
  },

  regionsClear() {
    map.regions.clear();
    map.setBorders({ state: false });
  },

  /* A miniature of what a narrated chapter does to the map. */
  async story() {
    map.reset();
    DEMOS.places();
    await map.fitBounds(VIEWS.colonies.bounds, { instant: true });
    await wait(300);

    await map.flyTo({ to: [42.36, -71.06], zoom: 11.4, over: 2.0 });
    map.units.add({ id: 'gage', at: [42.3601, -71.0589], faction: 'british',
                    commander: 'General Gage', strength: 4000 });
    await wait(1200);

    map.crossings.add({ id: 'charles', ...F.CHARLES_CROSSING, faction: 'british', over: 1.2 });
    await wait(1400);

    map.marches.add({ id: 'revere', coords: F.REVERE_RIDE, faction: 'patriot', over: 2.4 });
    await wait(1800);

    await map.flyTo({ to: [42.42, -71.20], zoom: 11.6, over: 1.6 });
    map.roads.add({ id: 'road', coords: F.ROAD_CONCORD, width: 2 });
    map.arrows.add({ id: 'out', coords: F.BRITISH_ADVANCE, faction: 'british',
                     strength: 700, over: 3.2 });
    await wait(2600);

    map.units.add({ id: 'parker', at: [42.4430, -71.2290], faction: 'patriot',
                    commander: 'Kaptein Parker', strength: 77 });
    map.battles.add({ id: 'lex', at: [42.4430, -71.2290], faction: 'british',
                      kind: 'battle', scale: 2, over: 0.6 });
    await wait(1600);

    DEMOS.converge();
    await wait(2000);

    map.arrows.add({ id: 'back', coords: F.BRITISH_RETREAT, faction: 'british',
                     strength: 700, over: 3.4, ghost: true });
    await wait(2400);

    await map.flyTo({ to: [42.38, -71.12], zoom: 10.6, over: 1.8 });
    map.fronts.add({ id: 'siege', coords: F.SIEGE_FRONT, faction: 'patriot',
                     facing: -1, over: 2.0 });
    map.battles.add({ id: 'siegeb', at: [42.3601, -71.0589], faction: 'patriot',
                      kind: 'siege', scale: 2, over: 0.8 });
  },
};

/* ------------------------------------------------------------
   Tests
   ------------------------------------------------------------ */

async function panTest() {
  const out = $('#testOut');
  out.textContent = 'Panorerer…';
  const el = map.el();
  const r = el.getBoundingClientRect();
  const start = performance.now();
  let frames = 0;

  // Drag hard across the map and count frames. There are no tiles, so the
  // only way a blank could appear is if a frame drew nothing at all.
  for (let i = 0; i < 60; i++) {
    map.setView(
      42.4 + Math.sin(i / 6) * 1.4,
      -71.2 + i * 0.09,
      10.4,
    );
    await new Promise(requestAnimationFrame);
    frames++;
  }
  const ms = performance.now() - start;
  const ctx = map.canvas.getContext('2d');
  const corner = ctx.getImageData(2, 2, 1, 1).data;
  const blank = corner[3] === 0;
  out.innerHTML =
    `${frames} bilder på ${ms.toFixed(0)} ms — <b>${(frames / ms * 1000).toFixed(0)} fps</b>.<br>` +
    `Hjørnepiksel: rgba(${[...corner].join(',')}) — ` +
    (blank ? '<b style="color:#a8322d">gjennomsiktig, altså blankt</b>'
           : '<b>tegnet</b>, aldri blankt.');
}

/**
 * Can you tell two colonies that share a border apart?
 *
 * The question the palette exists to answer, asked of the pixels rather than
 * of the tokens — and the two give different answers. Thirteen tints that were
 * 13 dE apart as colours arrived on screen 4 dE apart once laid over olive
 * ground at the alpha the wash used. Reading the palette would have called
 * that a pass.
 *
 * Adjacency comes from the geometry: since the borders are simplified as a
 * network, two colonies that share a border share the coordinates along it.
 * So this fails too if the build ever stops guaranteeing that.
 */
async function paletteTest() {
  const out = $('#testOut');
  out.textContent = 'Kjorer...';

  const res = await fetch('../content/american-revolution/geo/colonies.geojson');
  const geo = await res.json();
  await map.useRegions(geo);

  map.reset();
  map.setBorders({ state: false });
  for (const name of map.regionNames()) {
    map.regions.add({ id: `p-${name}`, name, faction: 'patriot',
                      label: false, instant: true });
  }
  await map.fitBounds([[30.2, -86.2], [47.6, -66.6]], { instant: true, padding: 24 });
  await wait(500);

  const verts = new Map();
  for (const f of geo.features) {
    const g = f.geometry;
    const groups = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    const set = new Set();
    for (const grp of groups) for (const ring of grp) {
      for (const pair of ring) set.add(`${pair[0]},${pair[1]}`);
    }
    verts.set(f.properties.name, set);
  }

  const c = map.canvas;
  const g2 = c.getContext('2d');
  const dpr = c.width / c.getBoundingClientRect().width;
  const seen = new Map();
  for (const r of map.regions.all()) {
    if (!r.centre) continue;
    const p = map.toScreen(r.centre[0], r.centre[1]);
    const px = Math.round(p[0] * dpr), py = Math.round(p[1] * dpr);
    if (px < 0 || py < 0 || px >= c.width || py >= c.height) continue;
    const d = g2.getImageData(px, py, 1, 1).data;
    seen.set(r.name, [d[0], d[1], d[2]]);
  }

  const names = [...verts.keys()];
  const rows = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      let shared = 0;
      for (const v of verts.get(a)) if (verts.get(b).has(v) && ++shared >= 2) break;
      if (shared < 2 || !seen.has(a) || !seen.has(b)) continue;
      rows.push([a, b, deltaE(seen.get(a), seen.get(b))]);
    }
  }
  rows.sort((p, q) => p[2] - q[2]);

  if (!rows.length) { out.textContent = 'Ingen naboer maalt.'; return; }
  const worst = rows[0];
  const list = rows.slice(0, 4)
    .map((r) => `${r[0]} / ${r[1]} — ΔE ${r[2].toFixed(1)}`).join('<br>');
  out.innerHTML = worst[2] >= 10
    ? `<b style="color:#55704c">Naboer kan skilles</b> (verst ΔE ${worst[2].toFixed(1)}, krav 10).<br>${list}`
    : `<b style="color:#a8322d">For likt</b> — ${worst[0]} og ${worst[1]} ligger ΔE ${worst[2].toFixed(1)} fra hverandre.<br>${list}`;
}

/** CIE76 ΔE*ab. WCAG contrast cannot see a hue difference; this can. */
function deltaE(p, q) {
  const lab = (rgb) => {
    const lin = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const r = lin[0], g = lin[1], b = lin[2];
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const A = lab(p), B = lab(q);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

async function seekTest() {
  const out = $('#testOut');
  out.textContent = 'Kjører…';

  const grab = () => {
    const c = map.canvas;
    return c.getContext('2d').getImageData(0, 0, c.width, c.height);
  };

  map.reset();
  await DEMOS.regionsColonies();
  DEMOS.regionsSides();
  DEMOS.all();
  await wait(4500);                    // let every animation finish
  await settled();
  const animated = grab();

  // Same content, but every artifact jumps straight to its end state — the
  // path the player takes after a seek.
  //
  // `regions` is in this list for a reason. It is the one layer that is not
  // drawn one artifact at a time — the whole set goes down in a single pass so
  // that a border shared by two regions is stroked once — and a layer that
  // draws itself as a group is exactly where a per-artifact progress value can
  // quietly stop being a pure function of time.
  const patched = [];
  for (const layer of ['places', 'roads', 'marches', 'arrows', 'fronts',
                       'areas', 'crossings', 'battles', 'units', 'regions']) {
    const add = map[layer].add.bind(map[layer]);
    patched.push([layer, map[layer].add]);
    map[layer].add = (spec) => add({ ...spec, instant: true, over: 0 });
  }
  map.reset();
  await DEMOS.regionsColonies();
  DEMOS.regionsSides();
  DEMOS.all();
  // The camera is NOT an artifact: a fitCoords inside the demo starts a
  // flight, and grabbing mid-flight compares two different viewpoints — which
  // is what this test was reporting as a seek failure. Let it land first.
  await settled();
  const instant = grab();
  for (const [layer, fn] of patched) map[layer].add = fn;

  // Compare properly. Byte equality is the wrong bar: antialiasing along a
  // curve differs by a shade or two between a path built at progress 1 and
  // one built by growing to it, and that is not a correctness failure.
  let differing = 0;
  const a = animated.data, b = instant.data;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 8 ||
        Math.abs(a[i + 1] - b[i + 1]) > 8 ||
        Math.abs(a[i + 2] - b[i + 2]) > 8) differing++;
  }
  const pct = differing / (a.length / 4) * 100;

  out.innerHTML = pct < 0.5
    ? `<b style="color:#55704c">Samme bilde</b> (${pct.toFixed(3)} % piksler avviker).
       Å hoppe til et tidspunkt gir samme kart som å vente på det.`
    : `<b style="color:#a8322d">Ulikt bilde</b> — ${pct.toFixed(2)} % av pikslene.
       Noe akkumulerer i stedet for å være en funksjon av tiden.`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve once the camera has stopped moving. */
async function settled(quietMs = 260, limit = 6000) {
  const t0 = performance.now();
  let last = '', still = 0;
  while (performance.now() - t0 < limit) {
    const c = map.camera();
    const key = `${c.lat.toFixed(6)},${c.lon.toFixed(6)},${c.zoom.toFixed(4)}`;
    still = key === last ? still + 60 : 0;
    last = key;
    if (still >= quietMs) return;
    await wait(60);
  }
}

/* ------------------------------------------------------------
   Wiring
   ------------------------------------------------------------ */

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;

  if (b.dataset.themeSet) {
    document.documentElement.setAttribute('data-theme', b.dataset.themeSet);
    mark('#theme', b);
    map.refreshTheme();
  }
  if (b.dataset.frame) {
    $('#frame').className = `frame ${b.dataset.frame === 'full' ? '' : b.dataset.frame}`;
    mark('#frameBtns', b);
    setTimeout(() => map.invalidate(), 260);
  }
  if (b.dataset.view) {
    const v = VIEWS[b.dataset.view];
    if (v.bounds) map.fitBounds(v.bounds);
    else map.flyTo(v);
  }
  if (b.dataset.zoom) map.zoomBy(Number(b.dataset.zoom));
  if (b.dataset.border) {
    const on = !map.borders()[b.dataset.border];
    map.setBorders({ [b.dataset.border]: on });
    b.classList.toggle('on', on);
  }
  if (b.dataset.do === 'panTest') return void panTest();
  if (b.dataset.do === 'seekTest') return void seekTest();
  if (b.dataset.do === 'paletteTest') return void paletteTest();
  if (b.dataset.do && DEMOS[b.dataset.do]) DEMOS[b.dataset.do]();
});

$('#speed').addEventListener('input', (ev) => {
  const v = Number(ev.target.value);
  map.setFlightSpeed(v);
  $('#speedOut').textContent = `${v.toFixed(1).replace('.', ',')} s`;
});

$('#strength').addEventListener('input', (ev) => {
  $('#strengthOut').textContent = String(ev.target.value)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (map.arrows.size) DEMOS.arrows();
});

function mark(group, btn) {
  for (const b of document.querySelectorAll(`${group} button`)) b.classList.remove('on');
  btn.classList.add('on');
}

/* HUD */
let last = performance.now(), fps = 0;
(function tick() {
  const t = performance.now();
  fps = fps * 0.9 + (1000 / Math.max(1, t - last)) * 0.1;
  last = t;
  const c = map.camera();
  $('#hudZoom').textContent = `z ${c.zoom.toFixed(2)}`;
  $('#hudPos').textContent = `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`;
  $('#hudFps').textContent = `${fps.toFixed(0)} fps`;
  const a = map.arrows.all()[0];
  $('#hudArrow').textContent = a
    ? `pil ${(2 * map.arrowWidthPx(a)).toFixed(0)} px` : '';
  requestAnimationFrame(tick);
}());

document.querySelector('[data-border="country"]').classList.add('on');

/* Something on screen immediately — an empty bench proves nothing. */
DEMOS.places();
DEMOS.roads();
