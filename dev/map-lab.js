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

/* The lab draws real region geometry, but it must not know whose. Ask the
   registry for the first pack and take whatever it calls its areas — so this
   page keeps working when the subject changes, which is the whole point of
   the pack boundary. */
let areasUrl = null;
async function packAreas() {
  if (areasUrl) return areasUrl;
  const packs = await fetch('../content/packs.json').then((r) => r.json());
  const pack = packs[0];
  const manifest = await fetch(`../content/${pack}/pack.json`).then((r) => r.json());
  areasUrl = `../content/${pack}/${manifest.pools?.areas || 'geo/areas.geojson'}`;
  return areasUrl;
}

/**
 * The bounds of whatever geometry we just loaded.
 *
 * Both region demos used to fly to [[30.2,-86.2],[47.6,-66.6]] — the eastern
 * seaboard, hardcoded — while packAreas() takes packs[0], which stopped being
 * american-revolution the day content/packs.json was reordered. So the lab
 * loaded Roman provinces and pointed the camera at Georgia, drew nothing, and
 * reported "Ingen naboer maalt": a bench measuring an empty screen and calling
 * it a result. The same trap, in check-contrast.py, had three of its four
 * measurements silently unrun.
 *
 * A bench must not know what the subject is either.
 */
function boundsOf(geo) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const f of geo.features || []) {
    const g = f.geometry || {};
    const groups = g.type === 'MultiPolygon' ? g.coordinates
                 : g.type === 'Polygon' ? [g.coordinates] : [];
    for (const grp of groups) for (const ring of grp) for (const [lon, lat] of ring) {
      if (lat < s) s = lat; if (lat > n) n = lat;
      if (lon < w) w = lon; if (lon > e) e = lon;
    }
  }
  return n >= s ? [[s, w], [n, e]] : null;
}

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
    const res = await fetch(await packAreas());
    const geo = await res.json();
    await map.useRegions(geo);
    map.regions.clear();
    map.setBorders({ state: false });
    for (const name of map.regionNames()) {
      map.regions.add({ id: `c-${name}`, name, label: true, instant: true });
    }
    const bb = boundsOf(geo);
    if (bb) map.fitBounds(bb, { padding: 24 });
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

  const res = await fetch(await packAreas());
  const geo = await res.json();
  await map.useRegions(geo);

  map.reset();
  map.setBorders({ state: false });
  for (const name of map.regionNames()) {
    map.regions.add({ id: `p-${name}`, name, faction: 'patriot',
                      label: false, instant: true });
  }
  const bb = boundsOf(geo);
  if (!bb) { out.textContent = 'FEIL - omraadefila har ingen geometri'; return; }
  await map.fitBounds(bb, { instant: true, padding: 24 });
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

  /* A region's colour is not one pixel. Rhode Island is thirteen pixels wide
     at seaboard zoom on a phone, and the border stroked over it is more than
     one of them — so a single sample lands on the line about as often as on
     the wash, and reports two colonies as nearly identical when they are not.
     Hand-checked against the real pixels, this test was claiming deltaE 6.7
     for a pair that measures 14.3. Take the median of a small patch, the same
     way tools/check-contrast.py does. */
  const patch = (px, py, r = 2) => {
    const R = [], G = [], B = [];
    for (let x = px - r; x <= px + r; x++) {
      for (let y = py - r; y <= py + r; y++) {
        if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
        const d = g2.getImageData(x, y, 1, 1).data;
        R.push(d[0]); G.push(d[1]); B.push(d[2]);
      }
    }
    if (!R.length) return null;
    const mid = (a) => a.sort((u, v) => u - v)[a.length >> 1];
    return [mid(R), mid(G), mid(B)];
  };

  const seen = new Map();
  for (const r of map.regions.all()) {
    if (!r.centre) continue;
    const p = map.toScreen(r.centre[0], r.centre[1]);
    const px = Math.round(p[0] * dpr), py = Math.round(p[1] * dpr);
    if (px < 0 || py < 0 || px >= c.width || py >= c.height) continue;
    const got = patch(px, py);
    if (got) seen.set(r.name, got);
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

/* ------------------------------------------------------------
   Is every label that is drawn entirely inside the viewport?

   The defect, measured: at 390x844, italy-wine s5 t=14 s, Barbaresco's anchor
   sat 27 px from the right edge. Both things that can carry a name run
   rightward from the anchor under `white-space: nowrap` — the `.atlas-place`
   name and the `.atlas-pin` chip — so the 80 px chip ran 374 -> 455 and lost
   65 px of itself off the frame. It was reported as SHOWN, because the only
   test it faced was onScreen(), which asks about the ANCHOR with 60-140 px of
   slack on both sides: a visibility test standing in for a placement one. Both
   forms are cased below.

   So this asks the question on the pixels: for every label the map draws, is
   its getBoundingClientRect() inside the map's? Places near every edge and
   every corner, pins with chips too wide for either side, a name wider than
   the phone, an anchor off the frame entirely — and the Barbaresco geometry
   itself, at the exact anchor it failed at.

   It runs TWICE, in both themes, and the second run puts the bug back through
   map.bench.setLabelSides(false): every label hard right of its dot, drawn
   whenever the anchor is near the frame. A bench nobody has watched fail is a
   bench nobody knows works, so the failing number is printed beside the
   passing one every time this is run.
   ------------------------------------------------------------ */

/* One long name, so "wider than the phone" is a case and not a hope. */
const TOO_WIDE = 'Storhertugdømmet Toscana og Piemonte med omland, øyer og fjellbygder';

function labelCases(w, h) {
  return {
    places: [
      // The measured defect: 27 px of room to the right of the anchor.
      ['Barbaresco', w - 27, Math.round(h * 0.42), 'town'],
      ['Barolo', 32, Math.round(h * 0.63), 'town'],
      ['Alba', Math.round(w / 2), Math.round(h / 2), 'city'],
      ['Nordvest', 10, 10, 'town'],
      ['Nordøst', w - 10, 10, 'town'],
      ['Sørvest', 10, h - 10, 'town'],
      ['Sørøst', w - 10, h - 10, 'town'],
      ['Topp', Math.round(w / 2), 7, 'city'],
      ['Bunn', Math.round(w / 2), h - 7, 'city'],
      ['Venstrekanten', 7, Math.round(h * 0.30), 'city'],
      ['Høyrekanten', w - 7, Math.round(h * 0.72), 'city'],
      /* A region name is dotless and the LARGEST type on the map — one step
         above a city name, two above a town, whatever the scale's numbers
         happen to be (--fs-base / --fs-sm / --fs-2xs in css/atlas.css). It
         said "15px" here until the scale moved and the number went stale
         inside a week; the relationship is what this case is testing. */
      ['Piemonte', w - 34, Math.round(h * 0.18), 'region'],
      [TOO_WIDE, Math.round(w / 2), Math.round(h * 0.86), 'town'],
      ['Utenfor', w + 40, Math.round(h / 2), 'town'],
    ],
    markers: [
      ['Barbaresco', w - 27, Math.round(h * 0.30)],
      ['Barolo', 22, Math.round(h * 0.70)],
      // Wider than either side of a 390 px phone, so it has to go above.
      ['Slaget ved Bunker Hill og Charlestown', Math.round(w / 2), Math.round(h * 0.12)],
      ['', w - 9, Math.round(h * 0.90)],
    ],
  };
}

async function labelScene() {
  const c = map.camera();
  map.setView(c.lat, c.lon, c.zoom);          // land any flight first
  map.reset();
  /* The frame's own size, read NOW. `.frame` transitions its width and
     height over 250 ms, so a size read straight after map.invalidate() is a
     size the map is on its way out of — and every case built from it lands
     nearer the edge than intended. That put eight of this bench's twelve edge
     cases outside the frame and had them dropped as correct behaviour. */
  const { w, h } = c.size;
  const cases = labelCases(w, h);
  for (const [name, px, py, kind] of cases.places) {
    map.places.add({ id: `lbl:${name}`, name, kind, coords: map.toLatLng(px, py) });
  }
  for (const [label, px, py] of cases.markers) {
    map.markers.add({ id: `pin:${label || 'bar'}`, label,
                      at: map.toLatLng(px, py), faction: 'patriot' });
  }
  map.redraw();
  // Long enough for --t-enter on the pin, or its opacity reads as hidden.
  await wait(1000);
  return { w, h };
}

/** Everything the map is actually showing, measured against the map's rect. */
function labelAudit() {
  const host = map.el();
  const frame = host.getBoundingClientRect();
  const shown = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none'
          || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };

  const crossings = [];
  const sides = [];
  const dropped = [];
  let drawn = 0;
  for (const el of host.querySelectorAll('.atlas-place, .atlas-pin, .atlas-pin i')) {
    if (!shown(el)) {
      if (el.matches('.atlas-place')) dropped.push((el.textContent || '').trim());
      continue;
    }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (!el.matches('.atlas-pin i')) drawn += 1;
    const over = Math.max(frame.left - r.left, frame.top - r.top,
                          r.right - frame.right, r.bottom - frame.bottom);
    const text = (el.textContent || '').trim() || 'prikk';
    const side = /--(left|above|below)/.exec(el.className)?.[1] || 'right';
    if (el.matches('.atlas-place')) sides.push(`${text} ${side}`);
    if (over > 0.5) {
      crossings.push(`${text}: ${over.toFixed(0)} px utenfor (${side})`);
    }
  }

  // The dot is the truth. Wherever the words went, did it stay on its
  // coordinate? Measured on the pin, whose dot is a real element.
  const want = new Map(map.markers.all().map((s) => [s.label || '', s.at]));
  let dotErr = 0;
  for (const pin of host.querySelectorAll('.atlas-pin')) {
    if (!shown(pin)) continue;
    const at = want.get(pin.querySelector('b').textContent);
    if (!at) continue;
    const [ex, ey] = map.toScreen(at[0], at[1]);
    const r = pin.querySelector('i').getBoundingClientRect();
    dotErr = Math.max(dotErr,
      Math.hypot(r.left + r.width / 2 - frame.left - ex,
                 r.top + r.height / 2 - frame.top - ey));
  }
  return { crossings, sides, dropped, drawn, dotErr };
}

/** What a frame costs with these labels up, so the cache can be held to it. */
async function frameCost(frames = 60) {
  const c = map.camera();
  map.bench.profile(true);
  for (let i = 0; i < frames; i++) {
    map.setView(c.lat + Math.sin(i / 7) * 0.01, c.lon + i * 0.002, c.zoom);
    await new Promise(requestAnimationFrame);
  }
  const p = map.bench.profile();
  map.bench.profile(false);
  map.setView(c.lat, c.lon, c.zoom);
  return { n: p.frames, avg: p.drawMs / Math.max(1, p.frames), max: p.maxDrawMs };
}

async function labelTest() {
  const out = $('#testOut');
  out.textContent = 'Kjører…';

  // A phone, exactly: the defect was measured at 390x844 and the numbers only
  // mean anything at a stated size.
  const frame = $('#frame');
  const hadStyle = frame.getAttribute('style') || '';
  const hadClass = frame.className;
  const hadTheme = document.documentElement.getAttribute('data-theme');
  frame.className = 'frame';
  frame.style.cssText = 'width:390px;height:844px;max-width:none;max-height:none;'
                      + 'aspect-ratio:auto;border-radius:22px';
  map.invalidate();
  await wait(500);            // past the .frame width/height transition
  let w = 0, h = 0;

  const rows = [];
  let bad = 0, bugBad = 0, worstDot = 0, sidesTaken = [], dropList = [];
  let cost = null;

  for (const theme of ['light', 'dark']) {
    document.documentElement.setAttribute('data-theme', theme);
    map.refreshTheme();
    for (const fixed of [true, false]) {
      map.bench.setLabelSides(fixed);
      ({ w, h } = await labelScene());
      const a = labelAudit();
      if (fixed) {
        bad += a.crossings.length;
        worstDot = Math.max(worstDot, a.dotErr);
        if (theme === 'light') { sidesTaken = a.sides; dropList = a.dropped; cost = await frameCost(); }
      } else {
        bugBad += a.crossings.length;
      }
      rows.push(`${theme}, ${fixed ? 'med plassering' : 'med feilen tilbake'}: `
        + `${a.drawn} etiketter, ${a.crossings.length} utenfor rammen`
        + (a.crossings.length ? `<br><small>${a.crossings.slice(0, 4).join('<br>')}</small>` : ''));
    }
  }

  map.bench.setLabelSides(true);
  document.documentElement.setAttribute('data-theme', hadTheme || 'light');
  map.refreshTheme();
  frame.className = hadClass;
  frame.setAttribute('style', hadStyle);
  map.invalidate();

  const verdict = bad === 0 && bugBad > 0
    ? `<b style="color:#55704c">Ingen etikett utenfor rammen</b> ved ${w}×${h}`
      + ` — og med feilen tilbake: <b>${bugBad}</b>, så testen kan faktisk feile.`
    : bad === 0
      ? '<b style="color:#a8322d">Testen beviser ingenting</b>'
        + ' — feilen tilbake ga også null utenfor rammen.'
      : `<b style="color:#a8322d">${bad} etiketter utenfor rammen</b> ved ${w}×${h}.`;

  out.innerHTML = `${verdict}<br>${rows.join('<br>')}`
    + `<br>Prikken står stille: største avvik <b>${worstDot.toFixed(2)} px</b>.`
    + (cost ? `<br>Ramme: <b>${cost.avg.toFixed(2)} ms</b> snitt, `
            + `${cost.max.toFixed(1)} ms verst, over ${cost.n} bilder.` : '')
    + `<br><small>${sidesTaken.join(' · ')}`
    + (dropList.length ? `<br>droppet: ${dropList.join(', ')}` : '')
    + '</small>';
  console.table(sidesTaken);
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
  if (b.dataset.do === 'labelTest') return void labelTest();
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
