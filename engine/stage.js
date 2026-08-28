/* ============================================================
   stage.js — the cue vocabulary.

   One table mapping a verb to what it does. This is the whole contract
   between a chapter script and the engine: a content pack can only ask for
   things listed here, and tools/check-script.py validates against the same
   list so a typo fails at build time rather than silently doing nothing.

   Every handler takes (cue, instant). `instant` means "we are rebuilding the
   picture after a seek — get to the end state without animating".

   WHAT CHANGED, AND WHY

   That table used to be written out here: forty-three entries, and four
   modules imported and mounted unconditionally at the top of the file. So
   "artifact" meant "map" — a pack about wine, or literature, or a finance
   course with a graph still built a map and still fetched up to five
   megabytes of geometry — and adding a surface meant an import, a mount call
   and a hand-merged block of verbs, which is the engine/verbs.json mistake in
   a larger shape.

   The table is now the union of what the MOUNTED surfaces declare
   (engine/surfaces/registry.js), and which surfaces are mounted is a property
   of the pack. Nothing here imports a surface: `import()` inside the registry
   is what makes "a pack with no map never fetches map/" a fact rather than an
   intention.

   Two verbs are not surface verbs and never were: `pause` is handled by the
   player and `term.mark` by the compiler in engine/script.js, both before a
   cue list exists. They sit in HOST_VERBS so checkVerbManifest() does not
   report drift against engine/verbs.json.
   ============================================================ */

import { mountAll, resetAll, unmountAll, verbTable, declaredVerbs,
         holdIfNotReady, surfacesFor } from './surfaces/registry.js';

/* Verbs the HOST answers, not a surface. Both are resolved before a cue ever
   reaches applyCue(); they are listed so the manifest cross-check has
   something to match, and they must stay out of any surface's table. */
const HOST_VERBS = {
  pause: () => {},
  'term.mark': () => {},
};

/**
 * Build the stage for a chapter.
 *
 * Returns the stage api — `invalidate`, `refreshTheme`, whatever the mounted
 * surfaces offer — synchronously, even on the first mount of a page where the
 * surface modules are still being fetched. See the registry's STAGE_API.
 *
 * `stageReady()` is the promise for anyone who needs the surfaces to actually
 * be up, which in practice is a bench and not the app: the app is showing a
 * cover while this resolves.
 */
let ready = Promise.resolve();

export function mountStage(container, chapter, people, language) {
  const { api, ready: done } = mountAll(container, chapter, {
    lang: language,
    people: people || [],
    // fact.show and chart.show resolve against every declared kind, not four
    // fixed pools. Handed in rather than fetched: an await inside a cue
    // handler is how Massachusetts ended up washed blue over the whole map.
    entries: chapter?.entries || null,
  });
  ready = done;
  return api;
}

/** Resolves when every surface this chapter declared is mounted. */
export function stageReady() { return ready; }

/** Which surfaces this chapter's pack asked for. */
export function stageSurfaces(chapter) {
  return surfacesFor(chapter?.packInfo, chapter);
}

/** Back to a blank slate, before cues are re-applied. */
export function resetStage({ soft = false } = {}) {
  resetAll({ soft });
}

/** Take every surface down. */
export function unmountStage() { unmountAll(); }

export function applyCue(cue, instant = false) {
  if (HOST_VERBS[cue.do]) return;
  // The very first mount of a page is still fetching its surface modules. A
  // cue that arrives now is HELD in order and released when they land, and
  // resetStage() throws the queue away — so the picture stays a function of
  // time rather than of how fast the network was. See the registry header.
  if (holdIfNotReady(cue, instant)) return;

  const table = verbTable();
  const fn = table[cue.do];
  if (!fn) {
    // Two different faults with one message each. A verb no surface declares
    // is a typo; a verb whose surface this pack did not ask for is a chapter
    // written against the wrong pack, and tools/check-script.py fails on it
    // before it can get here.
    const known = declaredVerbs().has(cue.do);
    console.warn(known
      ? `[stage] cue verb "${cue.do}" belongs to a surface this pack does not `
        + `declare (${cue.beat})`
      : `[stage] unknown cue verb "${cue.do}" (${cue.beat})`);
    return;
  }
  try {
    fn(cue, instant);
  } catch (err) {
    // One bad cue must never take the whole narration down.
    console.warn(`[stage] cue "${cue.do}" failed in ${cue.beat}:`, err);
  }
}

/** Every verb that is answerable right now — the mounted surfaces plus the host. */
export function knownVerbs() {
  return [...Object.keys(verbTable()), ...Object.keys(HOST_VERBS)];
}

/**
 * Cross-check the surfaces against engine/verbs.json.
 *
 * The vocabulary used to live in two hand-maintained lists — a table here and
 * VERBS in tools/check-script.py. Adding a verb to one and forgetting the
 * other meant a chapter validated clean and then silently did nothing in the
 * browser, which is the worst possible failure mode: no error, no picture,
 * and a cue that reads correct on the page.
 *
 * The manifest is now the source of truth for BOTH, and it carries a
 * `surface` per verb as well as a name. So there are three drifts to report,
 * not one:
 *
 *   · a verb the manifest declares that no surface implements
 *   · a verb a surface implements that the manifest does not declare
 *   · a verb whose manifest `surface` is not the surface that implements it,
 *     which would make check-script.py accept a chapter the engine cannot
 *     draw, or refuse one it can
 *
 * It deliberately only warns: a mismatched manifest must never be the reason
 * a reader cannot hear a chapter. It loads every surface the manifest names
 * rather than only the mounted ones — the question is about the vocabulary,
 * not about this pack.
 */
export async function checkVerbManifest(base = './engine/verbs.json') {
  try {
    const res = await fetch(base);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();
    const spec = manifest.verbs || {};

    const declared = new Set(Object.keys(spec));
    // Every surface the manifest mentions, loaded for the check only.
    const surfaces = new Set(Object.values(spec).map((v) => v.surface).filter(Boolean));
    const owners = new Map();
    for (const id of surfaces) {
      try {
        const mod = await import(`./surfaces/${id}.js`);
        for (const verb of Object.keys(mod.default?.verbs || {})) owners.set(verb, id);
      } catch (err) {
        console.warn(`[stage] verbs.json names a surface "${id}" that will not load:`,
          err && err.message);
      }
    }
    const implemented = new Set([...owners.keys(), ...Object.keys(HOST_VERBS)]);

    const missing = [...declared].filter((v) => !implemented.has(v));
    const extra = [...implemented].filter((v) => !declared.has(v));
    const misfiled = [...owners].filter(([verb, id]) => spec[verb] && spec[verb].surface !== id)
      .map(([verb, id]) => `${verb} is ${id}'s, verbs.json says ${spec[verb].surface}`);
    const unowned = [...declared].filter((v) => !HOST_VERBS[v] && !spec[v].surface);

    if (missing.length) {
      console.warn('[stage] verbs.json declares verbs with no handler:', missing.join(', '));
    }
    if (extra.length) {
      console.warn('[stage] handlers missing from verbs.json (check-script.py will '
                 + 'reject chapters that use them):', extra.join(', '));
    }
    if (misfiled.length) {
      console.warn('[stage] verbs.json points a verb at the wrong surface:',
        misfiled.join('; '));
    }
    if (unowned.length) {
      console.warn('[stage] verbs.json declares no `surface` for:', unowned.join(', '));
    }
    const ok = !missing.length && !extra.length && !misfiled.length && !unowned.length;
    return { manifest, missing, extra, misfiled, unowned, ok };
  } catch (err) {
    console.warn('[stage] could not read the verb manifest:', err.message);
    return { manifest: null, missing: [], extra: [], misfiled: [], unowned: [], ok: false };
  }
}
