/* ============================================================
   surfaces/registry.js — what a stage is made of, and who says so.

   WHY THIS EXISTS

   engine/stage.js used to mount four things unconditionally — map, plate,
   overlays, sound — and hold one flat table of forty-three verbs. So
   "artifact" meant "map": a pack about wine, or literature, or a finance
   course with a graph still created a map and still fetched up to five
   megabytes of geometry before its first sentence. And adding a surface meant
   a new module, an import, a mount call and a hand-merged block of verbs, in
   three places, by hand — which is the engine/verbs.json mistake in a larger
   shape.

   A SURFACE DECLARES ITSELF:

       export default {
         id: 'map',
         layer: 10,                     // z-order inside .story__stage
         verbs: { 'map.flyTo': flyTo, … },
         mount(container, chapter, ctx) {},
         reset({ soft }) {},
         unmount() {},
       };

   and a pack declares which ones it wants:

       "surfaces": ["map", "plate", "overlays", "sound"]

   Absent means exactly those four, so no pack file had to change.

   TWO CHECKS FALL OUT OF THAT, AND THEY ARE THE POINT

   · engine/verbs.json carries `"surface": "<id>"` on every verb, so
     tools/check-script.py refuses a chapter that uses a verb whose surface
     the pack does not declare. Before this, a chapter written against a pack
     with no map validated clean and drew nothing.
   · a surface that declares no verbs cannot be mounted. A surface exists to
     answer cues; one that answers none is a module that got loaded for
     nothing, which is the very cost this file exists to remove.

   THE IMPORT BOUNDARY IS THE WHOLE PAYOFF

   Surfaces are reached through `import()` and NOTHING here imports one
   statically. That is what makes "a pack with no map does not fetch map/"
   true rather than aspirational: a static import anywhere on the path from
   index.html would pull map/index.js, map/basemap.js and their Path2D
   machinery into the graph whatever pack.json says. It is easy to claim and
   easy to lose — one convenience import in engine/story.js undoes it
   silently — so engine/scenes/*.js survive as handles that go through this
   registry rather than through the module.

   RULE 1, AND WHY THERE IS A QUEUE

   `import()` is asynchronous and mountStage() is called synchronously. On the
   very first mount of a page the modules are not there yet; on every mount
   after that they are cached and mounting is entirely synchronous. So a cue
   that arrives before the surfaces are up is HELD, in order, and released
   when they mount — and resetStage() empties the queue, which is what makes
   this safe under rule 1: a rebuild drops everything the previous timeline
   had queued, exactly as it wipes everything the previous timeline drew.
   Dropping the cues instead would make the picture depend on how fast the
   network was, which is a history of events by another name.
   ============================================================ */

/** What a pack gets when it does not say. The four that always existed. */
export const DEFAULT_SURFACES = ['map', 'plate', 'overlays', 'sound'];

/** id -> module namespace, once loaded. Survives chapter switches. */
const modules = new Map();
/** id -> the surface descriptor (module.default). */
const declared = new Map();
/** id -> whatever its mount() returned, for this chapter. */
const apis = new Map();
/** Mounted, in layer order. */
let mounted = [];
/** The merged verb table, rebuilt whenever the mounted set changes. */
let verbs = Object.create(null);

/** Cues that arrived before the surfaces did. Emptied by resetAll(). */
let queue = [];
let ready = true;

/**
 * Take a surface into the registry.
 *
 * Idempotent by id: mounting a second chapter re-registers the same
 * descriptors and must not double anything.
 */
export function register(surface) {
  if (!surface || !surface.id) throw new Error('[surfaces] a surface needs an id');
  if (!surface.verbs || !Object.keys(surface.verbs).length) {
    // A surface answers cues. One that answers none is dead weight that was
    // loaded, mounted and reset for nothing — and it would be invisible.
    throw new Error(`[surfaces] "${surface.id}" declares no verbs`);
  }
  declared.set(surface.id, surface);
  return surface;
}

/** Which surfaces this chapter's pack asks for. */
export function surfacesFor(packInfo) {
  const want = packInfo?.surfaces;
  if (!Array.isArray(want)) return DEFAULT_SURFACES.slice();
  // Order is z-order, and z-order is the surface's own business (`layer`).
  // Deduplicated because a pack listing `map` twice must not mount two.
  return [...new Set(want.map(String))];
}

/**
 * The surfaces that ship, each behind a LITERAL dynamic import.
 *
 * `import(`./${id}.js`)` would be shorter and would mean a new surface was a
 * file plus a line in a pack, with nothing to edit here. It is written out
 * anyway, and the reason is tools/graph.py: it derives the service worker's
 * precache list by reading the source, deliberately follows only literal
 * paths, and "a path built at runtime cannot be found by reading the source"
 * is its stated contract. A computed specifier here would take all five
 * surface modules out of PRECACHE — so they would work online and 404
 * offline, silently, because the install uses Promise.allSettled. That is the
 * exact failure sw.js is generated to prevent.
 *
 * It also means a pack cannot name a path. `surfaces: ["../../etc/x"]` is a
 * miss, not a fetch.
 *
 * So: a new surface is a file, a line here, and a line in the pack.
 */
const SHIPPED = {
  map:      () => import('./map.js'),
  plate:    () => import('./plate.js'),
  overlays: () => import('./overlays.js'),
  sound:    () => import('./sound.js'),
  chart:    () => import('./chart.js'),
};

/** Which surfaces exist at all — for a bench, and for the manifest check. */
export function shippedSurfaces() { return Object.keys(SHIPPED); }

/** Load a surface module, once per page. */
async function loadSurface(id) {
  if (modules.has(id)) return modules.get(id);
  const load = SHIPPED[id];
  if (!load) throw new Error(`no surface "${id}" ships — see SHIPPED in registry.js`);
  const mod = await load();
  if (!mod.default) throw new Error(`[surfaces] ${id}.js has no default export`);
  modules.set(id, mod);
  register(mod.default);
  return mod;
}

/**
 * Mount every surface the pack declares.
 *
 * Returns synchronously with `{ api, ready }`. `api` delegates to the mounted
 * surfaces — see stageApi() — and `ready` resolves when the last module has
 * landed. On any mount after the first in a page, everything is already
 * cached and `ready` is already resolved.
 */
export function mountAll(container, chapter, ctx = {}) {
  const wanted = surfacesFor(chapter?.packInfo);
  unmountAll();

  const pending = [];
  for (const id of wanted) {
    if (modules.has(id)) { mountOne(id, container, chapter, ctx); continue; }
    pending.push(loadSurface(id).then(
      () => mountOne(id, container, chapter, ctx),
      (err) => {
        // A surface that will not load must not take the chapter with it —
        // rule 3's shape, one layer out. The verbs it owns then do nothing,
        // and applyCue says so once per verb rather than per cue.
        console.warn(`[surfaces] "${id}" could not be loaded:`, err && err.message);
      },
    ));
  }

  if (!pending.length) { ready = true; return { api: stageApi(), ready: Promise.resolve() }; }
  ready = false;
  const done = Promise.all(pending).then(() => {
    ready = true;
    flush();
  });
  return { api: stageApi(), ready: done };
}

function mountOne(id, container, chapter, ctx) {
  const surface = declared.get(id);
  if (!surface) return;
  try {
    apis.set(id, surface.mount(container, chapter, ctx) || null);
  } catch (err) {
    console.warn(`[surfaces] "${id}" failed to mount:`, err && err.message);
    return;
  }
  mounted = [...new Set([...mounted, id])]
    .sort((a, b) => (declared.get(a)?.layer ?? 0) - (declared.get(b)?.layer ?? 0));
  rebuildVerbs();
}

function rebuildVerbs() {
  const table = Object.create(null);
  for (const id of mounted) {
    for (const [verb, fn] of Object.entries(declared.get(id).verbs)) {
      if (table[verb]) {
        console.warn(`[surfaces] "${verb}" is declared by two surfaces; `
          + `"${id}" wins over the earlier one`);
      }
      table[verb] = fn;
    }
  }
  verbs = table;
}

/** The merged verb table. engine/stage.js reads this and nothing else. */
export function verbTable() { return verbs; }

/** Every verb any LOADED surface declares — for checkVerbManifest(). */
export function declaredVerbs() {
  const out = new Set();
  for (const surface of declared.values()) {
    for (const verb of Object.keys(surface.verbs)) out.add(verb);
  }
  return out;
}

/** Whatever a surface's mount() handed back, or null. */
export function surfaceApi(id) { return apis.get(id) ?? null; }

/**
 * The module namespace of a mounted surface.
 *
 * This is how engine/scenes/*.js reach a surface without importing it. It
 * returns null rather than throwing when the surface is not in this pack,
 * because "no map" is a legitimate answer and every handle treats it as one.
 */
export function surfaceModule(id) {
  return mounted.includes(id) ? (modules.get(id) ?? null) : null;
}

export function isMounted(id) { return mounted.includes(id); }

/** Which surfaces are up, in layer order. */
export function mountedSurfaces() { return mounted.slice(); }

/**
 * One object carrying whatever the mounted surfaces offer.
 *
 * engine/story.js holds this as `stageApi` and calls `stageApi?.invalidate()`
 * on a resize. Which surface provides that is not the host's business — the
 * map does today, and a pack without one has nothing to invalidate.
 *
 * A Proxy rather than a snapshot of method names, for two reasons that are
 * both about time. The first mount of a page resolves its modules
 * asynchronously, so a snapshot taken when mountStage() returns would be
 * EMPTY and `stageApi?.invalidate()` would throw — optional chaining guards
 * the object, not the method. And a surface that is not in this pack must
 * answer "no" by doing nothing, not by being absent: the host may call
 * `invalidate()` on a chapter with no map, and that is a correct thing for it
 * to do.
 */
const STAGE_API = new Proxy({}, {
  get(_t, key) {
    // Never claim to be a promise. Returning a callable for `then` would make
    // this thenable, and `await` on it would never settle.
    if (typeof key !== 'string' || key === 'then') return undefined;
    return (...args) => {
      for (const id of mounted) {
        const from = apis.get(id);
        if (from && typeof from[key] === 'function') return from[key](...args);
      }
      return undefined;
    };
  },
  has(_t, key) {
    return mounted.some((id) => typeof apis.get(id)?.[key] === 'function');
  },
});

function stageApi() { return STAGE_API; }

/* ------------------------------------------------------------
   The cue path
   ------------------------------------------------------------ */

/**
 * Hold a cue that arrived before its surface did, or say there is nowhere
 * for it to go.
 *
 * Returns true when the cue was queued and the caller should stop.
 */
export function holdIfNotReady(cue, instant) {
  if (ready) return false;
  queue.push([cue, instant]);
  return true;
}

function flush() {
  const held = queue;
  queue = [];
  for (const [cue, instant] of held) apply(cue, instant);
}

/** What engine/stage.js's applyCue() ends up calling. */
export function apply(cue, instant) {
  const fn = verbs[cue.do];
  if (!fn) return false;
  fn(cue, instant);
  return true;
}

export function resetAll({ soft = false } = {}) {
  // A rebuild starts from nothing, and that has to include the cues this
  // registry is still holding: releasing a previous timeline's cues after a
  // seek is the "an await outliving its epoch" bug with a queue instead of a
  // promise.
  queue = [];
  for (const id of mounted) {
    try { declared.get(id)?.reset?.({ soft }); } catch (err) {
      console.warn(`[surfaces] "${id}" reset failed:`, err && err.message);
    }
  }
}

export function unmountAll() {
  for (const id of mounted) {
    try { declared.get(id)?.unmount?.(); } catch (err) {
      console.warn(`[surfaces] "${id}" unmount failed:`, err && err.message);
    }
  }
  mounted = [];
  apis.clear();
  queue = [];
  verbs = Object.create(null);
}
