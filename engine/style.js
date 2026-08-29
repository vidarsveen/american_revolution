/* ============================================================
   style.js — the numbers a PACK ships, in the pack.

   Numbers that describe what a subject ships kept going stale inside modules,
   and each one cost real time:

     DECK_RESERVE_PX (engine/surfaces/map.js) was derived by rendering all 78
     fact cards the packs ship and taking the tallest: 163. The type scale
     moved a week later, the same cards measured 178, the card was then capped
     and it became 126. Three values, two of them wrong, all hard-coded.

     docs/design-direction.md prescribed the map's three label sizes as
     13px / 11px / 15px. They were the scale STEPS written as numbers, and the
     moment the scale moved they were three wrong pixel values.

     The Ken Burns push and drift are a MOTION table hard-coded in
     engine/surfaces/plate.js with four defaults beside it, and a wine chapter
     and a battle chapter want different pacing out of the same code.

   So: content/<pack>/style.json, merged over engine/defaults/style.json, which
   is docs/design-direction.md sections 1 and 2 in machine-readable form.

   ------------------------------------------------------------
   THREE RULES THIS MODULE KEEPS
   ------------------------------------------------------------

   1. A CUE ARGUMENT STILL WINS. That already works — engine/surfaces/plate.js
      reads `cue.push ?? 0.16` — and this only moves where the 0.16 comes
      from. Do not invert it: the file is the DEFAULT, never the override.

   2. THE STYLESHEETS KEEP READING var(--t-enter) AND var(--fs-md). Only the
      value's origin moves. "A literal duration in a stylesheet is a defect"
      has to stay true and stay greppable — tools/check-dead-css.py and the
      direction's own grep rules depend on it. So this module publishes CSS
      custom properties on :root, the mechanism --f-<faction> already uses in
      core/palette.js, and touches no rule.

   3. A TUNING FILE IS NOT ALLOWED TO BREAK A CHAPTER. Rule 3's shape. A pack
      with no style.json, an unparseable one, or one that says
      `"enter": "quite fast"` falls back to the default for that key alone,
      warns once, and runs. Nothing here throws and nothing here is awaited by
      a cue handler.

   ------------------------------------------------------------
   NOTHING A CUE TOUCHES MAY ARRIVE LATE
   ------------------------------------------------------------

   engine/script.js:32-38 records why: an await inside a cue handler is how a
   `clear` in a later beat ran before an earlier `show` resolved and left
   Massachusetts washed blue over the whole map. The plate's push and the
   map's deck reserve ARE touched by cues, so loadStyle() must be awaited in
   the same wave as the chapter — not from inside a handler. It is cached per
   pack and resolves instantly on every call after the first.

   ------------------------------------------------------------
   WHY tokens.css STILL CARRIES THE SAME SIX DURATIONS
   ------------------------------------------------------------

   A number in two places is what this file exists to stop, so the duplication
   is deliberate and CHECKED. tokens.css is the pre-boot value: the chooser,
   the splash and every bench under dev/ paint before any pack is chosen, and
   they must not paint with no motion scale at all. checkStyleTokens() compares
   the stylesheet, the JSON defaults and the built-in fallback below, and
   reports drift at boot on localhost — the same ratchet checkVerbManifest()
   puts on the cue vocabulary. dev/style-lab.html asserts it.
   ============================================================ */

import { styleUrl, defaultStyleUrl } from '../core/paths.js';

/* ------------------------------------------------------------
   The built-in copy.

   Rule 3: if engine/defaults/style.json 404s or is malformed there must still
   be a complete answer, because every key below is read while a chapter is
   drawing. Kept byte-for-byte in step with the JSON by checkStyleTokens().
   ------------------------------------------------------------ */
export const BUILT_IN = Object.freeze({
  motion: { tap: 160, enter: 900, exit: 600, dissolve: 1200, turn: 1200, drift: 14000 },
  camera: { flyOver: 2.8, clamp: [1.4, 6], quantise: 0.5 },
  plate: { motion: 'in', push: 0.16, focus: [0.5, 0.42], fit: 'cover' },
  type: { scale: 1 },
  map: { deckReserve: 126, labelGap: [4, 2] },
  /* The bed, metered against the voice rather than derived from the cue gains
     it used to be summed from. See sound/soundscape.js. */
  sound: { bedDb: -8, duckDb: -12, minOpenMs: 1200 },
});

/* ------------------------------------------------------------
   What a value is allowed to be.

   Not decoration: `"scale": "big"` used to be the shape of bug that reaches
   the screen as NaN in a calc() and silently drops every font size to zero.
   A value outside its range is clamped, a value of the wrong kind is
   discarded, and either way the default stands and says so once.
   ------------------------------------------------------------ */
const SPEC = {
  'motion.tap': { kind: 'num', min: 0, max: 2000 },
  'motion.enter': { kind: 'num', min: 0, max: 4000 },
  'motion.exit': { kind: 'num', min: 0, max: 4000 },
  'motion.dissolve': { kind: 'num', min: 0, max: 6000 },
  'motion.turn': { kind: 'num', min: 0, max: 6000 },
  'motion.drift': { kind: 'num', min: 0, max: 60000 },
  'camera.flyOver': { kind: 'num', min: 0.2, max: 12 },
  'camera.clamp': { kind: 'pair', min: 0.2, max: 20, ordered: true },
  'camera.quantise': { kind: 'num', min: 0, max: 4 },
  'plate.motion': { kind: 'enum', of: ['in', 'out', 'left', 'right', 'still'] },
  'plate.push': { kind: 'num', min: 0, max: 1 },
  'plate.focus': { kind: 'pair', min: 0, max: 1 },
  'plate.fit': { kind: 'enum', of: ['cover', 'contain'] },
  'type.scale': { kind: 'num', min: 0.7, max: 1.6 },
  'map.deckReserve': { kind: 'num', min: 0, max: 400 },
  'map.labelGap': { kind: 'pair', min: 0, max: 40 },
  /* How loud this subject's music sits, and how far it gets out of the way
     when someone speaks. Metered rather than chosen: at the old -24 the bed
     came out 35 dB under the voice, which is inaudible. The floor is -40
     because below that it is silence with extra steps, and the ceiling is -2
     because a bed level with the narration is not a bed. */
  'sound.bedDb': { kind: 'num', min: -40, max: -2 },
  'sound.duckDb': { kind: 'num', min: -24, max: 0 },
  // How long a pause has to be before the bed rides back up. The compiler
  // writes 0.9 s between sentences, 1.35 s across a paragraph and 2.0 s at a
  // scene end, so anything under about 1000 lets the bed breathe on every
  // sentence — which is what "it goes up and down in volume" was.
  'sound.minOpenMs': { kind: 'num', min: 0, max: 4000 },
};

/* ------------------------------------------------------------
   Which keys become CSS custom properties, and under what name.

   Rule 2 above: the stylesheet keeps saying var(--t-enter). This sets the
   value on :root as an inline property, which beats the stylesheet's
   declaration for the same reason applyPaletteVars() does.

   TWO HAZARDS, both documented in CLAUDE.md and both live here:

   - An inline custom property on :root beats EVERY rule for that property,
     including one inside a media query. That is safe today because nothing
     overrides --t-* or --fs-* in a media query: reduced motion is handled in
     css/base.css with `transition-duration: .001ms !important`, which is a
     different property, and the dark blocks in tokens.css redefine colour
     only. Add a `@media` override of one of these tokens and it will lose to
     this module, silently.

   - A var() inside a custom property resolves where the property is DECLARED.
     --fs-md is declared at :root and reads var(--type-scale), so setting
     --type-scale on :root works and setting it on a descendant does NOT
     re-derive --fs-md. Scale the document, never a subtree.
   ------------------------------------------------------------ */
const CSS_VARS = {
  'motion.tap': { prop: '--t-tap', unit: 'ms' },
  'motion.enter': { prop: '--t-enter', unit: 'ms' },
  'motion.exit': { prop: '--t-exit', unit: 'ms' },
  'motion.dissolve': { prop: '--t-dissolve', unit: 'ms' },
  'motion.turn': { prop: '--t-turn', unit: 'ms' },
  'motion.drift': { prop: '--t-drift', unit: 'ms' },
  'type.scale': { prop: '--type-scale', unit: '' },
  'map.deckReserve': { prop: '--deck-reserve', unit: 'px' },
};

/* ------------------------------------------------------------
   TRACE — who is supposed to be reading each key, and who still owns it.

   This is the audit registry dev/style-lab.html walks, and it is the part of
   this module that will still be worth having in six months. For every key it
   records where the number lives TODAY, as a file and a regex, so the lab can
   answer two different questions:

     status: 'css'      the app already draws with this, through the custom
                        property. The lab reads the computed value off :root
                        and compares.

     status: 'js'       a module reads it through styleValue(), which is the
                        only way a number that never reaches a stylesheet can
                        be read from this file at all — a camera duration and
                        a label gap have no CSS to live in. The owner regex
                        points at the CALL SITE, so the row goes red the day
                        someone puts the literal back.

     status: 'pending'  the module still owns a literal. The lab greps that
                        literal out of the source and compares it to this
                        file. So a number that drifts apart FAILS TODAY, before
                        the wiring lands — which is the only way an unwired key
                        is better than no key.

   AND A NOTE ON THE FALLBACK LITERALS, because they look like the very
   duplication this file exists to remove. `styleValue('plate.push', 0.16)`
   names 0.16 at the call site on purpose: a module imported by a bench that
   never called applyStyle() gets the built-in set, and a reader of that line
   should not have to open two other files to find out what it will draw. They
   are checked rather than trusted — every one of them is an owner row below,
   compared against engine/defaults/style.json on every run of the lab.

   A regex that stops matching is reported as "shape changed", not as a pass.
   tools/check-script.py's check_camera_lands() reads map/index.js's constants
   the same way and for the same reason: retuning moves the check with it,
   rewriting the shape fails out loud.
   ------------------------------------------------------------ */
/* Both surfaces moved from engine/scenes/ to engine/surfaces/. The old path
   is named second so a check written against one layout survives the other —
   dev/style-lab.js takes the first of these that exists and says which. */
const PLATE = ['engine/surfaces/plate.js', 'engine/scenes/plate.js'];
const SURFACE_MAP = ['engine/surfaces/map.js', 'engine/scenes/map.js'];

export const TRACE = [
  { path: 'motion.tap', status: 'css',
    owners: [{ file: 'css/tokens.css', re: /--t-tap:\s*([\d.]+)ms/ }] },
  { path: 'motion.enter', status: 'css',
    owners: [{ file: 'css/tokens.css', re: /--t-enter:\s*([\d.]+)ms/ }] },
  { path: 'motion.exit', status: 'css',
    owners: [{ file: 'css/tokens.css', re: /--t-exit:\s*([\d.]+)ms/ }] },
  { path: 'motion.dissolve', status: 'css',
    owners: [
      { file: 'css/tokens.css', re: /--t-dissolve:\s*([\d.]+)ms/ },
      // The plate's cross-dissolve is the same event at the same duration —
      // "one thing replacing another across the whole frame" — and it used to
      // say 1.2 in seconds, twice, in its own file. One helper now, reading
      // this key.
      { file: PLATE, re: /styleValue\('motion\.dissolve', ([\d.]+)\)/ },
    ] },
  { path: 'motion.turn', status: 'css',
    owners: [
      { file: 'css/tokens.css', re: /--t-turn:\s*([\d.]+)ms/ },
      // A `let`, not a `const`, and read through here: see syncTurn().
      { file: 'engine/transition.js', re: /styleValue\('motion\.turn', ([\d.]+)\)/ },
    ] },
  { path: 'motion.drift', status: 'css',
    owners: [
      { file: 'css/tokens.css', re: /--t-drift:\s*([\d.]+)s/, scale: 1000 },
      // The plate's push IS --t-drift: the direction calls 14 s "the slow push
      // on a still" and this is that push.
      { file: PLATE, re: /styleValue\('motion\.drift', ([\d.]+)\)/ },
    ] },

  /* The camera. None of these has a stylesheet to live in, so `js` is as
     sourced as they get: engine/surfaces/map.js asks this file and hands the
     answer to createMap(). map/index.js keeps its own default for its bench,
     which never boots the engine — a second literal, and therefore a second
     owner row rather than a promise that they agree. */
  { path: 'camera.flyOver', status: 'js',
    owners: [
      { file: SURFACE_MAP, re: /styleValue\('camera\.flyOver', ([\d.]+)\)/ },
      { file: 'map/index.js', re: /flyOver = ([\d.]+),/ },
    ] },
  { path: 'camera.clamp', status: 'js',
    owners: [
      { file: SURFACE_MAP, re: /styleValue\('camera\.clamp', \[([\d.]+), ([\d.]+)\]\)/ },
      { file: 'map/index.js', re: /flyClamp = \[([\d.]+), ([\d.]+)\]/ },
    ] },
  { path: 'camera.quantise', status: 'js',
    owners: [
      { file: SURFACE_MAP, re: /styleValue\('camera\.quantise', ([\d.]+)\)/ },
      { file: 'map/index.js', re: /bakeQuantise = ([\d.]+),/ },
    ] },

  { path: 'plate.motion', status: 'js',
    owners: [{ file: PLATE, re: /styleValue\('plate\.motion', '(\w+)'\)/, text: true }] },
  /* And NOT `cue.push / 0.16`, which is still in that file and is a different
     number: MOTION_SPAN is how far the table's own `in` travels, so a cue's
     push is a multiple of it. They are equal today and tying them together is
     how a pack asking for a stronger push would have moved `left` and `right`
     sideways by less. */
  { path: 'plate.push', status: 'js',
    owners: [{ file: PLATE, re: /styleValue\('plate\.push', ([\d.]+)\)/ }] },
  { path: 'plate.focus', status: 'js',
    owners: [{ file: PLATE, re: /styleValue\('plate\.focus', \[([\d.]+), ([\d.]+)\]\)/ }] },
  { path: 'plate.fit', status: 'js',
    owners: [{ file: PLATE, re: /styleValue\('plate\.fit', '(\w+)'\)/, text: true }] },

  { path: 'type.scale', status: 'css',
    owners: [{ file: 'css/tokens.css', re: /--type-scale:\s*([\d.]+)/ }] },

  { path: 'map.deckReserve', status: 'css',
    owners: [
      { file: 'css/tokens.css', re: /--deck-reserve:\s*([\d.]+)px/ },
      { file: SURFACE_MAP, re: /styleValue\('map\.deckReserve', ([\d.]+)\)/ },
    ] },
  { path: 'map.labelGap', status: 'js',
    owners: [
      { file: SURFACE_MAP, re: /styleValue\('map\.labelGap', \[([\d.]+), ([\d.]+)\]\)/ },
      { file: 'map/index.js', re: /labelGap = \[([\d.]+), ([\d.]+)\]/ },
    ] },
];

/* ------------------------------------------------------------
   Loading
   ------------------------------------------------------------ */

let defaultsPromise = null;
const packCache = new Map();
let current = clone(BUILT_IN);
let currentPack = null;
const warned = new Set();

function warnOnce(key, msg) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[style] ${msg}`);
}

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** The documented default set. Falls back to BUILT_IN, and says so. */
export function loadDefaults() {
  if (!defaultsPromise) {
    defaultsPromise = getJSON(defaultStyleUrl())
      .then((raw) => merge(BUILT_IN, raw, 'engine/defaults/style.json'))
      .catch((err) => {
        warnOnce('defaults', `no ${defaultStyleUrl()} — using the built-in set (${err.message})`);
        return clone(BUILT_IN);
      });
  }
  return defaultsPromise;
}

/**
 * A pack's merged style. Cached, never throws, and safe to await in the same
 * wave as the chapter — which is where it has to be awaited. See the header.
 */
export function loadStyle(pack) {
  const key = pack || '';
  if (!packCache.has(key)) {
    packCache.set(key, (async () => {
      const base = await loadDefaults();
      if (!pack) return base;
      let own = null;
      try {
        own = await getJSON(styleUrl(pack));
      } catch {
        // Not a warning. A pack is entitled to ship no tuning at all, and
        // most will — the defaults ARE the design direction.
        return base;
      }
      return merge(base, own, `content/${pack}/style.json`);
    })());
  }
  return packCache.get(key);
}

/** Forget everything. For the benches, which switch pack on a dropdown. */
export function resetStyle() {
  defaultsPromise = null;
  packCache.clear();
  warned.clear();
  current = clone(BUILT_IN);
  currentPack = null;
}

/* ------------------------------------------------------------
   Merging and validating
   ------------------------------------------------------------ */

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function set(obj, path, v) {
  const parts = path.split('.');
  const last = parts.pop();
  let o = obj;
  for (const p of parts) o = (o[p] ||= {});
  o[last] = v;
}

/**
 * One section at a time, one KEY at a time — not a spread.
 *
 * `{ ...defaults.motion, ...pack.motion }` looks equivalent and is not: a pack
 * that writes `"motion": { "enter": null }` would blow the default away, and a
 * pack that writes a typo'd section would replace a whole block with nothing.
 * Every key is validated on its own and a bad one leaves the default standing.
 */
export function mergeStyle(base, raw, where = '(inline)') {
  return merge(base, raw, where);
}

function merge(base, raw, where) {
  const out = clone(base);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    warnOnce(where, `${where} is not an object — ignored`);
    return out;
  }
  for (const [path, spec] of Object.entries(SPEC)) {
    if (get(raw, path) === undefined) continue;
    const v = validate(get(raw, path), spec, path, where);
    if (v !== undefined) set(out, path, v);
  }
  // Anything declared that nothing reads is decoration, and CLAUDE.md's own
  // lesson about undeclared cue arguments is that decoration sits there for
  // months looking like configuration. Say so.
  for (const [section, block] of Object.entries(raw)) {
    if (section.startsWith('$')) continue;
    if (!block || typeof block !== 'object') continue;
    for (const key of Object.keys(block)) {
      // `//` is this repo's comment key everywhere else; it is not decoration
      // pretending to be configuration.
      if (key.startsWith('//')) continue;
      if (!SPEC[`${section}.${key}`]) {
        warnOnce(`${where}:${section}.${key}`,
          `${where} declares "${section}.${key}", which nothing reads`);
      }
    }
  }
  return out;
}

function validate(v, spec, path, where) {
  const bad = (why) => {
    warnOnce(`${where}:${path}:${why}`, `${where} "${path}" ${why} — keeping the default`);
    return undefined;
  };
  if (spec.kind === 'enum') {
    return spec.of.includes(v) ? v : bad(`is not one of ${spec.of.join(', ')}`);
  }
  if (spec.kind === 'pair') {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite)) {
      return bad('is not a pair of numbers');
    }
    const [a, b] = v.map((n) => Math.min(spec.max, Math.max(spec.min, n)));
    return spec.ordered && a > b ? bad('is a range that runs backwards') : [a, b];
  }
  if (!Number.isFinite(v)) return bad('is not a number');
  const c = Math.min(spec.max, Math.max(spec.min, v));
  if (c !== v) {
    warnOnce(`${where}:${path}:clamp`,
      `${where} "${path}" is ${v}, outside ${spec.min}…${spec.max} — clamped to ${c}`);
  }
  return c;
}

/* ------------------------------------------------------------
   Applying
   ------------------------------------------------------------ */

/**
 * Publish the numeric half as CSS custom properties on :root, and remember the
 * whole thing for the modules that want it in JS.
 *
 * Idempotent, and safe to call again on a chapter switch — which it must be,
 * because a second pack's tuning has to replace the first's the way
 * applyPaletteVars() replaces --f-*.
 */
export function applyStyle(style, el = document.documentElement, pack = null) {
  current = style || clone(BUILT_IN);
  currentPack = pack;
  if (!el) return current;
  for (const [path, { prop, unit }] of Object.entries(CSS_VARS)) {
    const v = get(current, path);
    if (!Number.isFinite(v)) continue;
    el.style.setProperty(prop, `${round(v)}${unit}`);
  }
  return current;
}

function round(n) {
  return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : String(Number(n.toFixed(4)));
}

/** Load and apply in one call. The shape a boot wants. */
export async function useStyle(pack, el = document.documentElement) {
  return applyStyle(await loadStyle(pack), el, pack);
}

/* ------------------------------------------------------------
   Reading, from a module
   ------------------------------------------------------------ */

/** The whole merged style currently applied. */
export function style() { return current; }

/** Which pack it came from, for a bench that wants to say so. */
export function stylePack() { return currentPack; }

/**
 * One value by path, with the caller's own fallback.
 *
 *   const push = cue.push ?? styleValue('plate.push', 0.16);
 *
 * The cue still wins. The fallback argument is not belt-and-braces: a module
 * imported by a bench that never called applyStyle() gets the built-in, and a
 * literal at the call site is what makes that readable at the call site.
 */
export function styleValue(path, fallback) {
  const v = get(current, path);
  if (v === undefined || v === null) return fallback;
  return Array.isArray(v) ? v.slice() : v;
}

/* ------------------------------------------------------------
   The drift check
   ------------------------------------------------------------ */

/**
 * Is the built-in fallback still the JSON, and is the JSON still what the
 * stylesheet says?
 *
 * Reports rather than throws, and is called at boot on localhost only — the
 * shape checkVerbManifest() already uses for the cue vocabulary. Returns an
 * array of findings so dev/style-lab.html can assert on it instead.
 */
export async function checkStyleTokens(el = document.documentElement) {
  const found = [];
  let json;
  try {
    json = await getJSON(defaultStyleUrl());
  } catch (err) {
    found.push({ level: 'fail', path: '(defaults)', msg: `cannot read ${defaultStyleUrl()}: ${err.message}` });
    return found;
  }

  for (const path of Object.keys(SPEC)) {
    const a = get(BUILT_IN, path);
    const b = get(json, path);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      found.push({ level: 'fail', path,
        msg: `engine/style.js BUILT_IN says ${JSON.stringify(a)}, engine/defaults/style.json says ${JSON.stringify(b)}` });
    }
  }

  /* And the stylesheet, through the browser rather than through the source.

     THE INLINE PROPERTY HAS TO COME OFF FIRST. applyStyle() has already set
     --type-scale on :root, and an inline custom property beats every rule — so
     reading the computed value here would report the PACK's tuning as a
     stylesheet drift, and a pack that legitimately tunes anything would fail
     its own bench. What is being asked is what :root resolves to with nothing
     applied, because that is what the chooser and every dev/ bench paint with
     before a pack is chosen. Saved and put straight back. */
  const held = Object.fromEntries(Object.values(CSS_VARS)
    .map(({ prop }) => [prop, el.style.getPropertyValue(prop)]));
  for (const prop of Object.keys(held)) el.style.removeProperty(prop);
  const cs = getComputedStyle(el);
  const readings = {};
  for (const [path, { prop, unit }] of Object.entries(CSS_VARS)) {
    readings[path] = cs.getPropertyValue(prop).trim();
  }
  for (const [prop, v] of Object.entries(held)) if (v) el.style.setProperty(prop, v);

  for (const [path, { prop, unit }] of Object.entries(CSS_VARS)) {
    const want = get(json, path);
    if (!Number.isFinite(want)) continue;
    const raw = readings[path];
    if (!raw) {
      found.push({ level: 'fail', path, msg: `${prop} is not defined in any stylesheet` });
      continue;
    }
    const got = toNumber(raw, unit);
    if (got === null) {
      found.push({ level: 'warn', path, msg: `${prop} is "${raw}", which is not a ${unit || 'number'}` });
    } else if (Math.abs(got - want) > 1e-6) {
      found.push({ level: 'fail', path,
        msg: `${prop} is ${raw} in css/tokens.css, engine/defaults/style.json says ${want}${unit}` });
    }
  }
  return found;
}

/** Every key the file may carry, with what it is allowed to be. For a bench. */
export function styleSpec() { return { ...SPEC }; }

/** Which keys reach the DOM, and under what custom property. For a bench. */
export function styleVars() { return { ...CSS_VARS }; }

/** "160ms" / "14s" / "126px" / "1" -> a number in the unit asked for. */
export function toNumber(raw, unit = '') {
  const s = String(raw).trim();
  const m = /^(-?[\d.]+)\s*(ms|s|px|rem|%)?$/.exec(s);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (unit === 'ms' && m[2] === 's') n *= 1000;
  if (unit === 's' && m[2] === 'ms') n /= 1000;
  return n;
}

/**
 * Boot-time drift report, localhost only.
 *
 * Same contract as checkVerbManifest(): it is noisy where it is useful and
 * silent where it is not, and it never changes what the app does.
 */
export async function reportStyleDrift(el = document.documentElement) {
  const host = location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '') return [];
  const found = await checkStyleTokens(el);
  for (const f of found) {
    console[f.level === 'fail' ? 'error' : 'warn'](`[style] ${f.path}: ${f.msg}`);
  }
  return found;
}
