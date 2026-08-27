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
   shore bends, so a regional extract takes over.

   WHICH regional extract is a property of the subject, not of the renderer.
   This list used to name `atlantic-10m` outright, which put the American
   Revolution inside the map module — where `grep american-revolution` would
   never have found it. A pack declares its own levels; these are the fallback
   for a lab page or a pack that only ever shows the whole world.

   A level marked `regional` is skipped when the camera is outside the bbox of
   the data actually loaded for it, because outside the extract there is
   nothing to draw and an empty ocean is worse than a coarse coastline. */
const DEFAULT_LEVELS = [
  { name: 'world-110m', maxZoom: 4.0 },
  { name: 'world-50m', maxZoom: Infinity },
];

let LEVELS = DEFAULT_LEVELS;

export function registerLevels(levels) {
  LEVELS = (levels && levels.length)
    ? levels.map((lv) => ({ ...lv, maxZoom: lv.maxZoom ?? Infinity }))
    : DEFAULT_LEVELS;
  // A level list is a different world; nothing baked for the old one applies.
  for (const key of [...cache.keys()]) {
    if (!LEVELS.some((lv) => lv.name === key)) cache.delete(key);
  }
}

/** The coarsest level that covers everywhere — what a regional one falls back to. */
function globalFallback() {
  for (let i = LEVELS.length - 1; i >= 0; i -= 1) {
    if (!LEVELS[i].regional) return LEVELS[i].name;
  }
  return LEVELS[0]?.name || 'world-50m';
}

const cache = new Map();

/* Spatial culling, on. The only reason to touch either of these is
   dev/perf-lab.html putting the bug back to check that its own measurement
   notices — `inset` shrinks the rect a bake culls against, so it drops
   features that ARE on screen, which is the defect the pixel test exists to
   catch and therefore the one it has to be shown catching. */
let culling = true;
let cullInset = 0;
export function setCulling(on, inset = 0) {
  culling = on !== false;
  cullInset = Number(inset) || 0;
}

/* A pack's own close-in geometry. It OVERLAYS the shipped level rather than
   replacing it: OSM gives coastline as lines and water as polygons, with no
   land polygon to fill, so on its own it would paint the world as sea. Land
   still comes from Natural Earth; the detail carves the harbours, rivers and
   ponds back out of it, which is exactly the part NE is too coarse to get
   right at the zooms a chapter actually plays at. */
/* A LIST, not one box. A course goes where its chapters go: the wine course
   has the Langhe and, from chapter two, the hills between Florence and the
   sea. One box meant the second chapter zoomed into blank parchment — no
   coast, no river, nothing to draw — because Natural Earth at 1:10M has
   nothing to say at zoom nine and the pack's own geometry was six hundred
   kilometres away.

   Each entry keeps its own url, bbox, minZoom and lazily-loaded data, and
   only the one the camera is standing in is fetched or drawn. A pack that
   declares a single object still works: it becomes a list of one. */
let details = [];

export function registerDetail(spec) {
  const list = Array.isArray(spec) ? spec : (spec ? [spec] : []);
  details = list.map((d) => ({ minZoom: 9.5, ...d, data: null }));
}

/** The level whose box the camera is inside, or null. */
function detailAt(zoom, lon, lat) {
  for (const d of details) {
    if (zoom < d.minZoom) continue;
    const bb = d.bbox || d.data?.bbox;
    if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) continue;
    return d;
  }
  return null;
}

/**
 * Bake one layer: a Path2D per FEATURE, with the world-pixel box it lives in,
 * plus the whole layer as one path for when everything is on screen anyway.
 *
 * Why per feature. A bake submits the level to the offscreen ground buffer,
 * and at harbour zoom that was ~186,000 points across thirteen fill/stroke
 * calls, nearly all of it hundreds of kilometres outside the buffer. The
 * geometry is projected once and frozen into a Path2D here, and a Path2D is
 * opaque afterwards — there is no reading points back out of it and no
 * clipping it. So the box has to be measured at bake time, while the numbers
 * are still numbers, and the whole feature is then either submitted or
 * skipped.
 *
 * Either/or, never partly: a feature is a ring and a ring is filled with
 * `evenodd`. Cut a ring at the buffer's edge and you have changed which side
 * of it is inside, which is how a harbour turns into a lake. A single ring
 * bigger than the buffer — the Americas coastline in atlantic-10m is one ring
 * of 38,190 points — is therefore drawn whole and clipped by the rasteriser,
 * as it always was. The win is everything ELSE: the other 295 land features,
 * 197 lakes, 309 rivers and 1,069 border arcs that are not within a thousand
 * kilometres of Boston.
 */
function bakeLayer(shapes, closed) {
  const whole = new Path2D();
  const groups = [];
  let points = 0;

  for (const parts of shapes) {
    const path = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
    for (const flat of parts) {
      if (flat.length < 4) continue;
      for (let i = 0; i < flat.length; i += 2) {
        const [x, y] = project(flat[i], flat[i + 1]);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
        n += 1;
      }
      if (closed) path.closePath();
    }
    if (!n) continue;
    whole.addPath(path);
    groups.push({ path, x0, y0, x1, y1, n });
    points += n;
  }

  /* An EMPTY Path2D is still an object, and therefore truthy. drawBasemap
     guards the detail repaint on the land layer existing, fills the whole
     detail box with deep water and then carves the land back out of it -- so
     a layer that came back with no rings at all painted the entire box as
     sea.

     No coastal pack ever hit it, because a coastline always has land. The
     first INLAND pack did, immediately: Piemonte has no coast, OSM returned
     `land 0`, and the Langhe rendered as ocean with woodland floating on it.
     Same shape as the cached ground buffer that had to remember whether it
     had any ground. */
  return groups.length ? { whole, groups, points } : null;
}

/**
 * Fetch and bake the level the camera is standing in.
 *
 * Only that one: a course may declare several boxes and they are megabytes
 * each, so a chapter in Tuscany must not pull the Langhe down with it. Called
 * from the draw path when detailWanted() says the camera has arrived somewhere
 * a level covers.
 */
export async function loadDetail(zoom, lon, lat) {
  const d = zoom === undefined ? details.find((x) => !x.data)
                               : detailAt(zoom, lon, lat);
  if (!d || d.data) return d?.data || null;
  const res = await fetch(d.url);
  if (!res.ok) throw new Error(`detail: HTTP ${res.status}`);
  const data = await res.json();

  const paths = {};
  for (const [layer, shapes] of Object.entries(data.layers || {})) {
    const baked = bakeLayer(shapes, layer === 'land' || layer === 'lakes');
    if (baked) paths[layer] = baked;
  }
  d.data = { paths, bbox: data.bbox, credit: data.credit };
  return d.data;
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
  const d = detailAt(zoom, lon, lat);
  return d ? (d.data?.credit || d.credit || '') : '';
}

export function detailWanted(zoom, lon, lat) {
  const d = detailAt(zoom, lon, lat);
  return Boolean(d && !d.data);
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
      const built = bakeLayer(shapes, layer !== 'rivers');
      if (built) baked.paths[layer] = built;
    }

    // Boundaries arrive as [adminLevel, parts] and are baked into one path
    // per level, so a country line and a state line can carry different
    // weight without walking the data again every frame. Each arc keeps its
    // own box for the same reason the layers above do: atlantic-10m ships
    // 1,069 of them and a harbour sees two.
    if (data.borders) {
      const byLevel = new Map();
      for (const [admin, parts] of data.borders) {
        if (!byLevel.has(admin)) byLevel.set(admin, []);
        byLevel.get(admin).push(parts);
      }
      for (const [admin, shapes] of byLevel) {
        const built = bakeLayer(shapes, false);
        if (built) baked.paths[`border${admin}`] = built;
      }
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
    if (lv.regional) {
      const bb = cache.get(lv.name)?.bbox;
      // Outside the extract there is nothing to draw; fall back rather than
      // render an empty ocean. Before the data has loaded there is no bbox to
      // test, so it is used — which is right: it is about to arrive.
      if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) {
        return globalFallback();
      }
    }
    return lv.name;
  }
  return globalFallback();
}

export function preload(base) {
  return Promise.all(LEVELS.map((lv) => loadLevel(lv.name, base).catch(() => null)));
}

/* How much geometry one step of a bake may submit.

   Not a quality setting — every chunk is drawn, and the picture is the same
   whatever this is. It is how finely the bake can be sliced when it is spread
   across tasks, and the number is a time budget in disguise: measured on this
   pack, twelve thousand points is on the order of ten milliseconds, which is
   inside a frame. A layer smaller than this is never split, and one FEATURE
   bigger than it cannot be split at all — the Americas coastline is a single
   ring of 38,190 points and a ring is atomic. */
/**
 * The part of a baked layer that can paint inside `rect` — or null.
 *
 * `rect` is in world pixels at zoom 0, the space the paths were baked in, and
 * has already been grown by a few device pixels so a feature whose box is
 * just outside it but whose STROKE reaches in is still submitted. Losing a
 * coastline to a hairline of rounding is exactly the failure this must not
 * have, and dev/perf-lab.html's pixel test is the check: apart from edge
 * antialiasing, a culled bake and a whole one must be the same picture.
 *
 * ONE path, and one fill. Splitting a layer into several paths so that a bake
 * could be sliced more finely was built, measured and thrown away: two fills
 * of polygons that share an edge each antialias that edge on their own, and
 * the seam between them showed up as 245 solid pixels of difference through
 * the woodland north of Boston, where OSM's forest polygons abut. That is the
 * "one stroke() call, not one per region" hazard in CLAUDE.md, arriving in a
 * fill instead of a stroke. A layer is atomic. The bake is sliced BETWEEN
 * layers instead, which is coarser and correct.
 */
function inRect(layer, rect, stats) {
  if (!layer) return null;
  const out = (f) => f.x1 < rect.x0 || f.x0 > rect.x1
                  || f.y1 < rect.y0 || f.y0 > rect.y1;
  if (!culling) {
    stats.features += layer.groups.length;
    stats.points += layer.points;
    return layer.whole;
  }

  let n = 0, pts = 0;
  for (const f of layer.groups) if (!out(f)) { n += 1; pts += f.n; }
  stats.features += n;
  stats.points += pts;
  stats.culled += layer.groups.length - n;
  if (!n) return null;
  // Nothing dropped: hand back the pre-merged path rather than copying the
  // layer to say "all of it".
  if (n === layer.groups.length) return layer.whole;

  const path = new Path2D();
  for (const f of layer.groups) if (!out(f)) path.addPath(f.path);
  return path;
}

/* What the step just prepared will cost to rasterise, in points times passes.

   Read off the running total in `stats`, which inRect has just added to — so
   it is the geometry THIS step submits and not the layer's whole size, and a
   culled layer is charged for what survived. `passes` is 2 for a fill and a
   stroke of the same path, 1 for either alone. */
function costOf(stats, passes) {
  const n = stats.points - stats.charged;
  stats.charged = stats.points;
  return n * passes;
}

/**
 * The bake, as an ordered list of things to do.
 *
 * Why a list rather than a function. The bake is the one piece of work in the
 * app that is too big for a frame: measured on this pack, 90 ms at the zoom
 * where the harbour geometry comes in, against 14 ms one tenth of a zoom
 * level below it. Deferring it off the frame stops it tearing the picture but
 * it still holds the thread, and a 90 ms hole in a 2.8 s flight is still a
 * hole. Handed back as steps, the caller can run them one task at a time and
 * the longest thing it ever blocks for is one layer.
 *
 * The steps carry canvas state across each other — the DPR-and-zoom transform
 * is pushed by the first and popped by the last, and the detail box's clip
 * likewise. That is safe because the sheet being baked into is touched by
 * nothing else, and it is why a half-run bake must be ABANDONED rather than
 * interleaved with a second one.
 *
 * drawBasemap runs the whole list in one go, so the split path and the whole
 * path are not two implementations that can drift apart — they are the same
 * list, run differently.
 *
 * @param ctx      2D context, already cleared and DPR-scaled
 * @param cam      { x, y, zoom } — world-pixel top-left at zoom 0, plus zoom
 * @param size     { w, h } in CSS pixels
 * @param palette  resolved colours from style.js
 */
export function bakeSteps(ctx, cam, size, palette, levelName, borders = {}) {
  const level = cache.get(levelName);
  const scale = scaleFor(cam.zoom);
  const stats = { features: 0, culled: 0, points: 0, charged: 0 };
  const steps = [];

  // Water is the ground, so it is the canvas background — every gap is sea
  // by construction, which is also why a slow frame can never show "nothing".
  /* Each step carries what it will cost, in points submitted times the
     number of passes over them, so the caller can slice the bake by WORK.
     Slicing it by the clock does not work and looked as though it did: canvas
     commands are queued, so every step returns in a tenth of a millisecond
     and a time budget runs the whole bake in one task, then pays for all of
     it at once inside the blit. */
  const step = (cost, run) => steps.push({ cost, run });

  step(0, () => {
    ctx.fillStyle = palette.waterDeep;
    ctx.fillRect(0, 0, size.w, size.h);
  });

  if (!level || typeof level.then === 'function') return { steps, stats };

  /* What this bake can actually paint into, in the world pixels the paths
     were baked in. The margin is eight device pixels' worth: the widest thing
     stroked below is a 1.6 px border and a round join adds half of it again,
     so eight is several times over — and being generous here costs one
     feature and being mean costs a coastline. */
  const pad = (8 - cullInset) / scale;
  const rect = {
    x0: cam.x - pad, y0: cam.y - pad,
    x1: cam.x + size.w / scale + pad, y1: cam.y + size.h / scale + pad,
  };

  // One device pixel, expressed in the transformed space.
  const px = 1 / scale;

  step(0, () => {
    ctx.save();
    // Multiply onto the existing transform, never replace it: the caller has
    // already scaled the context by devicePixelRatio, and setTransform() would
    // throw that away — drawing the ground at half size on a retina screen
    // while the HTML overlay stayed correct, so labels floated out to sea.
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);
    // The coast pen, set unconditionally the way it always was — the blocks
    // below inherit from it, and one of them (a pack's inland lakes, stroked
    // in the river colour the rivers block left behind) inherits from further
    // down still. Each step therefore sets exactly what its block used to set
    // and no more: adding the "obvious" missing strokeStyle would repaint
    // Piemonte's ponds a different colour.
    ctx.fillStyle = palette.land;
    ctx.strokeStyle = palette.coast;
    ctx.lineWidth = palette.coastW * px;
    ctx.lineJoin = 'round';
  });

  const land = inRect(level.paths.land, rect, stats);
  if (land) {
    step(costOf(stats, 2), () => {
      ctx.fillStyle = palette.land;
      ctx.strokeStyle = palette.coast;
      ctx.lineWidth = palette.coastW * px;
      ctx.lineJoin = 'round';
      ctx.fill(land, 'evenodd');
      ctx.stroke(land);
    });
  }

  const lakes = inRect(level.paths.lakes, rect, stats);
  if (lakes) {
    step(costOf(stats, 2), () => {
      ctx.fillStyle = palette.water;
      ctx.lineWidth = Math.max(0.6, palette.coastW * 0.8) * px;
      ctx.fill(lakes, 'evenodd');
      ctx.stroke(lakes);
    });
  }

  const rivers = inRect(level.paths.rivers, rect, stats);
  if (rivers) {
    step(costOf(stats, 1), () => {
      ctx.strokeStyle = palette.river;
      ctx.lineWidth = palette.riverW * px;
      ctx.lineCap = 'round';
      ctx.stroke(rivers);
    });
  }

  /* A pack's close-in geometry REPLACES the shipped ground inside its box.
     It used to be drawn over the top, which meant two coastlines about a
     kilometre apart were both visible around Boston: the coarse Natural
     Earth polygon edge, and the fine OSM line stroked on top of it. Clip to
     the box, repaint it from the detail, and there is one coast again. */
  const close = detailAt(cam.zoom, ...centreOf(cam, size));
  const bb = close && close.data ? (close.data.bbox || close.bbox) : null;
  if (bb) {
    const d = close.data;
    const [x0, y0] = project(bb[0], bb[3]);
    const [x1, y1] = project(bb[2], bb[1]);

    step(0, () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
    });

    /* Replacing the ground is only right where the detail HAS a coastline.
       Inland there is none to replace: OSM ships `natural=coastline` and a
       landlocked box comes back with none, so filling the box with sea and
       carving land back out of an empty path painted the whole Langhe as
       ocean with woodland floating on it.

       So the repaint is conditional and everything below it is not. Rivers,
       lakes and woods are additions to whatever ground is already there,
       which is what they always were -- they were simply nested inside the
       coastal case because until now every pack had a coast.

       The test is `d.paths.land` existing, not whether any of it is in
       frame: that is a property of the FILE, and culling it first would let
       an inland corner of a coastal box repaint itself as sea. */
    if (d.paths.land) {
      step(0, () => {
        ctx.fillStyle = palette.waterDeep;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      });
      const dLand = inRect(d.paths.land, rect, stats);
      if (dLand) {
        step(costOf(stats, 2), () => {
          ctx.fillStyle = palette.land;
          ctx.strokeStyle = palette.coast;
          ctx.lineWidth = palette.coastW * px;
          ctx.lineJoin = 'round';
          ctx.fill(dLand, 'evenodd');
          ctx.stroke(dLand);
        });
      }
    }

    /* Woodland, on the land and under the water.

       This is what makes the ground between Boston and Concord worth
       looking at. The rest of this extract is water, and away from the
       harbour there is barely any — so scenes three to five, which are the
       whole point of the chapter, were playing over a blank field. No
       outline: a wood has no edge you could stand on, and drawing one
       turns a texture into a claim. */
    const dWoods = inRect(d.paths.woods, rect, stats);
    if (dWoods) {
      step(costOf(stats, 1), () => {
        ctx.fillStyle = palette.wood;
        ctx.fill(dWoods, 'evenodd');
      });
    }

    const dLakes = inRect(d.paths.lakes, rect, stats);
    if (dLakes) {
      step(costOf(stats, 2), () => {
        ctx.fillStyle = palette.water;
        ctx.lineWidth = Math.max(0.6, palette.coastW * 0.8) * px;
        ctx.fill(dLakes, 'evenodd');
        ctx.stroke(dLakes);
      });
    }

    const dRivers = inRect(d.paths.rivers, rect, stats);
    if (dRivers) {
      step(costOf(stats, 1), () => {
        ctx.strokeStyle = palette.river;
        ctx.lineWidth = palette.riverW * 1.3 * px;
        ctx.lineCap = 'round';
        ctx.stroke(dRivers);
      });
    }

    step(0, () => ctx.restore());
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
    if (!on) continue;
    const path = inRect(level.paths[key], rect, stats);
    if (!path) continue;
    step(costOf(stats, 1), () => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width * px;
      ctx.setLineDash(dash.map((v) => v * px));
      ctx.lineCap = 'butt';
      ctx.stroke(path);
    });
  }

  step(0, () => {
    ctx.setLineDash([]);
    ctx.restore();
  });

  return { steps, stats };
}

/**
 * Paint the ground, all of it, now.
 *
 * @returns what was submitted, for dev/perf-lab.html
 */
export function drawBasemap(ctx, cam, size, palette, levelName, borders = {}) {
  const { steps, stats } = bakeSteps(ctx, cam, size, palette, levelName, borders);
  for (const s of steps) s.run();
  return stats;
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
