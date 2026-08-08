/* ============================================================
   regions.js — named administrative areas.

   A border is a line; a region is a thing with a name you can fill,
   highlight and label. Both are wanted: outlines alone tell you where
   Massachusetts stops, but not that it is Massachusetts, and not that it
   is on the rebel side.

   Deliberately level-agnostic. Level 0 is a country, 1 a state or province,
   2 a municipality or county — the framework does not care which, so the
   same code serves a Napoleonic pack drawing German states and a modern one
   drawing Norwegian kommuner. All it needs is named polygons.
   ============================================================ */

import { spreadIndex, assignTints } from './tint.js';

let cache = null;

/** Load the framework's default (modern) regions. */
export async function loadRegions(base = '../assets/geo', file = 'regions-10m.json') {
  if (cache) return cache;
  cache = (async () => {
    const res = await fetch(`${base}/${file}`);
    if (!res.ok) throw new Error(`regions: HTTP ${res.status}`);
    const data = await res.json();
    return index(data.regions || [], data.level ?? 1);
  })();
  return cache;
}

/**
 * Adopt a pack's own regions from plain GeoJSON.
 *
 * This is how a historical pack stays honest. The shipped defaults are
 * modern boundaries, and modern boundaries are wrong for most of history:
 * in 1775 Massachusetts included Maine, Vermont was claimed by two
 * colonies at once, and West Virginia would not exist for another 88 years.
 * A pack drops in geo/borders.geojson and the framework never has to know.
 */
export function fromGeoJSON(geojson, { level = 1, nameKey = 'name' } = {}) {
  const out = [];
  for (const feat of geojson.features || []) {
    const name = feat.properties?.[nameKey] ?? feat.properties?.name;
    const geom = feat.geometry;
    if (!name || !geom) continue;
    // `name` is the key a script writes; `label` is what a reader sees, and
    // the two are not the same language. "North Carolina" is the id;
    // "Nord-Carolina" is what a Norwegian sixteen-year-old should read.
    const label = feat.properties?.label ?? null;
    // What the name shrinks to when the area is narrower than the word. A
    // phone showing all thirteen colonies has room for "Mass." and not for
    // "Massachusetts", and a dropped label teaches less than a short one.
    const short = feat.properties?.short ?? null;
    // Which of the side's colours this region wears. Solved against the
    // adjacency graph at build time, because only the build knows which
    // regions touch — see assign_tints in tools/build-colonies.py. A region
    // with no tint (a country, say) wears its side's own colour.
    const tint = feat.properties?.tint ?? null;
    const tints = feat.properties?.tints ?? null;
    // Who this region borders, so the colours can be solved against the
    // geometry rather than against a guess about it.
    const neighbours = feat.properties?.neighbours ?? null;
    // Where the name should sit. The area-weighted centroid is usually right,
    // but not when a colony reached hundreds of miles inland: Virginia ran to
    // Kentucky, so its centroid lands in the mountains while every reader is
    // looking at the coast.
    const labelAt = feat.properties?.labelAt ?? null;

    const rings = [];
    const groups = geom.type === 'Polygon' ? [geom.coordinates]
                 : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    for (const group of groups) {
      for (const ring of group) {
        const flat = [];
        for (const [lon, lat] of ring) flat.push(lon, lat);
        if (flat.length >= 6) rings.push(flat);
      }
    }
    if (rings.length) {
      out.push({ name, label, short, labelAt, tint, tints, neighbours,
                 country: '', rings });
    }
  }
  return index(out, level);
}

function index(regions, level) {
  const byName = new Map();
  // Does this file decide its own colours? If any region carries a slot, the
  // file is in charge and a region WITHOUT one is opting out on purpose —
  // Britain and France are the only region of their side ever on screen, so
  // there is nothing to tell them apart from and they wear their side's own
  // colour. Handing them a slot from the fallback painted the British red
  // through a hue rotation and came out olive.
  const authored = regions.some((r) => r.tint != null);
  const family = authored ? regions.filter((r) => r.tint != null).length
                          : regions.length;

  /* If the data says which regions touch, solve the colours against that.
     Only the regions that HAVE neighbours take part — a country sitting on
     its own has nothing to be told apart from and keeps its side's colour. */
  const inFamily = regions.filter((r) => Array.isArray(r.neighbours));
  if (inFamily.length > 2) {
    const at = new Map(inFamily.map((r, i) => [norm(r.name), i]));
    const edges = [];
    inFamily.forEach((r, i) => {
      for (const other of r.neighbours) {
        const j = at.get(norm(other));
        if (j != null && j > i) edges.push([i, j]);
      }
    });
    const solved = assignTints(inFamily.length, edges);
    inFamily.forEach((r, i) => { r.tint = solved[i]; r.tints = inFamily.length; });
  }

  regions.forEach((r, i) => {
    r.level = level;
    r.coords = r.rings.map(toLatLngRing);
    r.centre = centroid(r.rings);
    r.bounds = bounds(r.rings);
    // Which colour of its side's family this region wears, and how big that
    // family is. The data says so when it knows — it is the build that can
    // see which regions touch. Otherwise fall back to position in the set,
    // which at least is a function of the data rather than of the order a
    // script happened to name things in: seek backwards, replay the cues in
    // any order, and Virginia is still Virginia's colour.
    if (r.tint == null && !authored) r.tint = spreadIndex(i, family);
    if (r.tints == null) r.tints = family;
    byName.set(norm(r.name), r);
  });
  return {
    level,
    count: regions.length,
    all: () => regions,
    get: (name) => byName.get(norm(name)) || null,
    /** Every region whose name is in `names`, quietly skipping misses. */
    pick: (names) => names.map((n) => byName.get(norm(n))).filter(Boolean),
  };
}

/** [[minLat, minLon], [maxLat, maxLon]] — for keeping a label on its own area. */
function bounds(rings) {
  let s = 90, n = -90, w = 180, e = -180;
  for (const flat of rings) {
    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i] < w) w = flat[i];
      if (flat[i] > e) e = flat[i];
      if (flat[i + 1] < s) s = flat[i + 1];
      if (flat[i + 1] > n) n = flat[i + 1];
    }
  }
  return [[s, w], [n, e]];
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Stored as flat [lon, lat, …]; the map wants [[lat, lon], …]. */
function toLatLngRing(flat) {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i + 1], flat[i]]);
  return out;
}

/**
 * Area-weighted centroid of the largest ring, for label placement.
 *
 * The mean of the vertices is not good enough: a state with a long
 * finger of coastline has most of its vertices along that coast, so the
 * label drifts off into the sea. The shoelace centroid follows the mass.
 */
function centroid(rings) {
  let best = null, bestArea = 0;
  for (const flat of rings) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const j = (i + 2) % flat.length;
      const cross = flat[i] * flat[j + 1] - flat[j] * flat[i + 1];
      a += cross;
      cx += (flat[i] + flat[j]) * cross;
      cy += (flat[i + 1] + flat[j + 1]) * cross;
    }
    a *= 0.5;
    if (Math.abs(a) > Math.abs(bestArea) && a !== 0) {
      bestArea = a;
      best = [cy / (6 * a), cx / (6 * a)];   // [lat, lon]
    }
  }
  if (best) return best;

  // Degenerate ring — fall back to the bounding-box middle.
  const flat = rings[0] || [];
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  for (let i = 0; i < flat.length; i += 2) {
    x0 = Math.min(x0, flat[i]); x1 = Math.max(x1, flat[i]);
    y0 = Math.min(y0, flat[i + 1]); y1 = Math.max(y1, flat[i + 1]);
  }
  return [(y0 + y1) / 2, (x0 + x1) / 2];
}
