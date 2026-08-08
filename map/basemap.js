/* ============================================================
   basemap.js — the ground, drawn by us.

   Each level is projected once into world pixels at zoom 0 and baked into a
   Path2D. Panning and zooming then cost one ctx.setTransform() and a fill,
   not a walk over forty thousand points — and because nothing is fetched
   while you drag, there is no blank square to arrive late. That was the
   whole complaint about tiles.
   ============================================================ */

import { project, scaleFor, WORLD } from './geo.js';

/* Which level to draw at which zoom. Below 4 the 50m coastline is finer than
   one screen pixel; above 6.5 it is visibly a straight line where a real
   shore bends, so the theatre extract takes over. */
const LEVELS = [
  { name: 'world-110m', maxZoom: 4.0 },
  { name: 'world-50m', maxZoom: 6.5 },
  { name: 'atlantic-10m', maxZoom: Infinity },
];

const cache = new Map();

/* A pack's own close-in geometry. It OVERLAYS the shipped level rather than
   replacing it: OSM gives coastline as lines and water as polygons, with no
   land polygon to fill, so on its own it would paint the world as sea. Land
   still comes from Natural Earth; the detail carves the harbours, rivers and
   ponds back out of it, which is exactly the part NE is too coarse to get
   right at the zooms a chapter actually plays at. */
let detail = null;

export function registerDetail(spec) {
  detail = spec ? { minZoom: 9.5, ...spec, data: null } : null;
}

export async function loadDetail() {
  if (!detail || detail.data) return detail?.data || null;
  const res = await fetch(detail.url);
  if (!res.ok) throw new Error(`detail: HTTP ${res.status}`);
  const data = await res.json();

  const paths = {};
  for (const [layer, shapes] of Object.entries(data.layers || {})) {
    const path = new Path2D();
    const closed = layer === 'land' || layer === 'lakes';
    for (const parts of shapes) {
      for (const flat of parts) {
        for (let i = 0; i < flat.length; i += 2) {
          const [x, y] = project(flat[i], flat[i + 1]);
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        if (closed) path.closePath();
      }
    }
    paths[layer] = path;
  }
  detail.data = { paths, bbox: data.bbox, credit: data.credit };
  return detail.data;
}

function detailShowing(zoom, lon, lat) {
  if (!detail || zoom < detail.minZoom) return false;
  const bb = detail.bbox || detail.data?.bbox;
  if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) return false;
  return true;
}

/**
 * Who to credit for what is currently drawn.
 *
 * Natural Earth is public domain and needs no attribution, but the pack's
 * close-in geometry is OpenStreetMap under ODbL, which does. The credit
 * travelled in the detail file from the day it was built and was never once
 * rendered — it was invisible only because a Leaflet attribution control for
 * the old raster tiles happened to be sitting in the corner saying something
 * similar. Taking the tiles away without this would have left OSM data on
 * screen with nothing crediting it.
 */
export function creditFor(zoom, lon, lat) {
  if (!detailShowing(zoom, lon, lat)) return '';
  return detail.data?.credit || detail.credit || '';
}

export function detailWanted(zoom, lon, lat) {
  return detailShowing(zoom, lon, lat) && !detail.data;
}

/** Fetch and bake one level. Idempotent. */
export async function loadLevel(name, base = '../assets/geo') {
  if (cache.has(name)) return cache.get(name);

  const promise = (async () => {
    const res = await fetch(`${base}/${name}.json`);
    if (!res.ok) throw new Error(`basemap ${name}: HTTP ${res.status}`);
    const data = await res.json();

    const baked = { name, bbox: data.bbox, paths: {} };
    for (const [layer, shapes] of Object.entries(data.layers || {})) {
      const path = new Path2D();
      const closed = layer !== 'rivers';
      for (const parts of shapes) {
        for (const flat of parts) {
          for (let i = 0; i < flat.length; i += 2) {
            const [x, y] = project(flat[i], flat[i + 1]);
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          if (closed) path.closePath();
        }
      }
      baked.paths[layer] = path;
    }

    // Boundaries arrive as [adminLevel, parts] and are baked into one path
    // per level, so a country line and a state line can carry different
    // weight without walking the data again every frame.
    if (data.borders) {
      const byLevel = new Map();
      for (const [admin, parts] of data.borders) {
        if (!byLevel.has(admin)) byLevel.set(admin, new Path2D());
        const path = byLevel.get(admin);
        for (const flat of parts) {
          for (let i = 0; i < flat.length; i += 2) {
            const [x, y] = project(flat[i], flat[i + 1]);
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
        }
      }
      for (const [admin, path] of byLevel) baked.paths[`border${admin}`] = path;
    }

    cache.set(name, baked);
    return baked;
  })();

  cache.set(name, promise);
  return promise;
}

/**
 * Has this level finished loading and baking?
 *
 * The cache holds a promise while a level is in flight and the baked object
 * afterwards, so the two are told apart by whether it is thenable. Callers
 * need this because "the network went idle" does not mean "the ground is
 * drawn": the level JSON is fetched from inside the first draw, so a
 * screenshot taken on a timer can catch a canvas that is still nothing but
 * water. That made tools/check-contrast.py report land and sea as the same
 * colour, at random.
 */
export function levelReady(name) {
  const v = cache.get(name);
  return !!v && typeof v.then !== 'function';
}

export function levelFor(zoom, lon, lat) {
  for (const lv of LEVELS) {
    if (zoom >= lv.maxZoom) continue;
    if (lv.name === 'atlantic-10m') {
      const bb = cache.get('atlantic-10m')?.bbox;
      // Outside the theatre extract there is nothing to draw; fall back
      // rather than render an empty ocean.
      if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) {
        return 'world-50m';
      }
    }
    return lv.name;
  }
  return 'world-50m';
}

export function preload(base) {
  return Promise.all(LEVELS.map((lv) => loadLevel(lv.name, base).catch(() => null)));
}

/**
 * Paint the ground.
 *
 * @param ctx      2D context, already cleared and DPR-scaled
 * @param cam      { x, y, zoom } — world-pixel top-left at zoom 0, plus zoom
 * @param size     { w, h } in CSS pixels
 * @param palette  resolved colours from style.js
 */
export function drawBasemap(ctx, cam, size, palette, levelName, borders = {}) {
  const level = cache.get(levelName);
  const scale = scaleFor(cam.zoom);

  // Water is the ground, so it is the canvas background — every gap is sea
  // by construction, which is also why a slow frame can never show "nothing".
  ctx.fillStyle = palette.waterDeep;
  ctx.fillRect(0, 0, size.w, size.h);

  if (!level || typeof level.then === 'function') return;

  ctx.save();
  // Multiply onto the existing transform, never replace it: the caller has
  // already scaled the context by devicePixelRatio, and setTransform() would
  // throw that away — drawing the ground at half size on a retina screen
  // while the HTML overlay stayed correct, so labels floated out to sea.
  ctx.scale(scale, scale);
  ctx.translate(-cam.x, -cam.y);

  // One device pixel, expressed in the transformed space.
  const px = 1 / scale;

  ctx.fillStyle = palette.land;
  ctx.strokeStyle = palette.coast;
  ctx.lineWidth = palette.coastW * px;
  ctx.lineJoin = 'round';
  if (level.paths.land) {
    ctx.fill(level.paths.land, 'evenodd');
    ctx.stroke(level.paths.land);
  }

  if (level.paths.lakes) {
    ctx.fillStyle = palette.water;
    ctx.lineWidth = Math.max(0.6, palette.coastW * 0.8) * px;
    ctx.fill(level.paths.lakes, 'evenodd');
    ctx.stroke(level.paths.lakes);
  }

  if (level.paths.rivers) {
    ctx.strokeStyle = palette.river;
    ctx.lineWidth = palette.riverW * px;
    ctx.lineCap = 'round';
    ctx.stroke(level.paths.rivers);
  }

  /* A pack's close-in geometry REPLACES the shipped ground inside its box.
     It used to be drawn over the top, which meant two coastlines about a
     kilometre apart were both visible around Boston: the coarse Natural
     Earth polygon edge, and the fine OSM line stroked on top of it. Clip to
     the box, repaint it from the detail, and there is one coast again. */
  if (detailShowing(cam.zoom, ...centreOf(cam, size)) && detail.data) {
    const d = detail.data;
    const bb = d.bbox || detail.bbox;
    if (bb && d.paths.land) {
      const [x0, y0] = project(bb[0], bb[3]);
      const [x1, y1] = project(bb[2], bb[1]);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();

      ctx.fillStyle = palette.waterDeep;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      ctx.fillStyle = palette.land;
      ctx.strokeStyle = palette.coast;
      ctx.lineWidth = palette.coastW * px;
      ctx.lineJoin = 'round';
      ctx.fill(d.paths.land, 'evenodd');
      ctx.stroke(d.paths.land);

      /* Woodland, on the land and under the water.

         This is what makes the ground between Boston and Concord worth
         looking at. The rest of this extract is water, and away from the
         harbour there is barely any — so scenes three to five, which are the
         whole point of the chapter, were playing over a blank field. No
         outline: a wood has no edge you could stand on, and drawing one
         turns a texture into a claim. */
      if (d.paths.woods) {
        ctx.fillStyle = palette.wood;
        ctx.fill(d.paths.woods, 'evenodd');
      }

      if (d.paths.lakes) {
        ctx.fillStyle = palette.water;
        ctx.lineWidth = Math.max(0.6, palette.coastW * 0.8) * px;
        ctx.fill(d.paths.lakes, 'evenodd');
        ctx.stroke(d.paths.lakes);
      }
      if (d.paths.rivers) {
        ctx.strokeStyle = palette.river;
        ctx.lineWidth = palette.riverW * 1.3 * px;
        ctx.lineCap = 'round';
        ctx.stroke(d.paths.rivers);
      }
      ctx.restore();
    }
  }

  // Boundaries last, so they read over the ground rather than under a river.
  // Dashed, because an administrative line is a claim, not a physical thing —
  // and drawn thinner as the level goes down, so a country reads before a
  // state and a state before a municipality without anyone having to squint.
  for (const [key, on, colour, width, dash] of [
    ['border0', borders.country !== false, palette.border0, palette.border0W, [7, 4]],
    ['border1', borders.state === true, palette.border1, palette.border1W, [4, 4]],
    ['border2', borders.local === true, palette.border1, palette.border1W * 0.8, [2, 3]],
  ]) {
    const path = level.paths[key];
    if (!on || !path) continue;
    ctx.strokeStyle = colour;
    ctx.lineWidth = width * px;
    ctx.setLineDash(dash.map((d) => d * px));
    ctx.lineCap = 'butt';
    ctx.stroke(path);
  }
  ctx.setLineDash([]);

  ctx.restore();
}

/** Rough centre of the drawn area, for the detail bbox test. */
function centreOf(cam, size) {
  const sc = scaleFor(cam.zoom);
  const x = cam.x + (size.w / 2) / sc;
  const y = cam.y + (size.h / 2) / sc;
  const lon = x / WORLD * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / WORLD;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lon, lat];
}

/** Where the world wraps, for clamping the camera. */
export const worldSize = (zoom) => WORLD * scaleFor(zoom);
