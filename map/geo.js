/* ============================================================
   geo.js — projection and curve maths.

   Web Mercator with a 256 px world at zoom 0, identical to Leaflet's. That
   is deliberate, not incidental: every coordinate and zoom already authored
   in the chapter scripts (`"zoom": 11.4`, `13.5`) keeps meaning exactly what
   it meant, so content carries over untouched and the old and new maps can
   be compared frame by frame.
   ============================================================ */

export const WORLD = 256;              // world pixels at zoom 0
const MAX_LAT = 85.0511287798;         // where Mercator stops being finite

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** [lon, lat] -> world pixels at zoom 0. */
export function project(lon, lat) {
  const x = (lon + 180) / 360 * WORLD;
  const phi = clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * WORLD;
  return [x, y];
}

/** World pixels at zoom 0 -> [lon, lat]. */
export function unproject(x, y) {
  const lon = x / WORLD * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / WORLD;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lon, lat];
}

export const scaleFor = (zoom) => Math.pow(2, zoom);

/** Metres per world-pixel at zoom 0, for a given latitude. */
export function metresPerPixel(lat, zoom) {
  return 40075016.686 * Math.cos(lat * Math.PI / 180) / (WORLD * scaleFor(zoom));
}

/* ------------------------------------------------------------
   Curves — an army does not march in straight segments
   ------------------------------------------------------------ */

/**
 * Centripetal Catmull-Rom through `pts`, resampled to `n` points.
 *
 * Centripetal (alpha = 0.5) specifically, not uniform: uniform Catmull-Rom
 * forms cusps and self-intersections on the tight turns real march routes
 * have, and a self-intersecting centreline turns into a folded ribbon when
 * you give it width.
 */
export function catmullRom(pts, n = 120, alpha = 0.5) {
  if (pts.length < 2) return pts.slice();
  if (pts.length === 2) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      out.push([pts[0][0] + (pts[1][0] - pts[0][0]) * t,
                pts[0][1] + (pts[1][1] - pts[0][1]) * t]);
    }
    return out;
  }

  // Duplicate the ends so the curve reaches its first and last control point.
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  const knots = [0];
  for (let i = 1; i < p.length; i++) {
    const dx = p[i][0] - p[i - 1][0];
    const dy = p[i][1] - p[i - 1][1];
    knots.push(knots[i - 1] + Math.pow(Math.hypot(dx, dy) || 1e-6, alpha));
  }

  const out = [];
  const total = knots[knots.length - 2] - knots[1];
  for (let i = 0; i < n; i++) {
    const u = knots[1] + total * (i / (n - 1));
    let k = 1;
    while (k < p.length - 3 && knots[k + 1] < u) k++;
    out.push(interp(p, knots, k, u));
  }
  return out;
}

function interp(p, k, i, t) {
  const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
  const [t0, t1, t2, t3] = [k[i - 1], k[i], k[i + 1], k[i + 2]];
  const mix = (a, b, ta, tb) => {
    const w = tb - ta || 1e-6;
    return [((tb - t) * a[0] + (t - ta) * b[0]) / w,
            ((tb - t) * a[1] + (t - ta) * b[1]) / w];
  };
  const a1 = mix(p0, p1, t0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2), b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

/** Cumulative arc length along a polyline, plus the total. */
export function arcLength(pts) {
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return { cum, total: cum[cum.length - 1] || 0 };
}

/** Unit normals by central difference — the direction width grows in. */
export function normals(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push([-dy / len, dx / len]);
  }
  return out;
}

export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Trim a polyline to a fraction of its length — how a route draws itself. */
export function takeFraction(pts, cum, total, f) {
  if (f >= 1) return pts.slice();
  const want = total * f;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (cum[i] <= want) { out.push(pts[i]); continue; }
    const prev = i ? cum[i - 1] : 0;
    const t = (want - prev) / ((cum[i] - prev) || 1e-6);
    const a = pts[i - 1] || pts[0];
    out.push([a[0] + (pts[i][0] - a[0]) * t, a[1] + (pts[i][1] - a[1]) * t]);
    break;
  }
  return out.length > 1 ? out : pts.slice(0, 2);
}
