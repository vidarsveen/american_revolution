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
    if (rings.length) out.push({ name, country: '', rings });
  }
  return index(out, level);
}

function index(regions, level) {
  const byName = new Map();
  for (const r of regions) {
    r.level = level;
    r.coords = r.rings.map(toLatLngRing);
    r.centre = centroid(r.rings);
    byName.set(norm(r.name), r);
  }
  return {
    level,
    all: () => regions,
    get: (name) => byName.get(norm(name)) || null,
    /** Every region whose name is in `names`, quietly skipping misses. */
    pick: (names) => names.map((n) => byName.get(norm(n))).filter(Boolean),
  };
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
