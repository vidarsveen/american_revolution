/* ============================================================
   palette.js — what a side looks like.

   The engine used to carry a four-name table:

       const SIDES = ['british', 'patriot', 'french', 'neutral'];
       const TOKEN = { british: '--red', patriot: '--blue', … };

   which is fine for one subject and wrong for the next. Octavian's rise has
   seven or eight parties, and two of them change sides halfway through. So
   the table moves into pack.json and the count stops mattering.

   A faction declares its colour one of three ways, in this order:

     token   names a CSS custom property. The right answer when a designer
             has already tuned the palette and the theme flips it for free:
             --red is #a8322d in light and something else in dark, and
             nothing here needs to know that.
     hue     0-360. The framework derives fill and wash. The right answer for
             a new pack, before anyone has tuned anything, and it keeps the
             relationship between a colour and its wash consistent across
             however many factions there turn out to be.
     fill    explicit hex, plus optional wash/fillDark/washDark. The escape
             hatch, for when neither of the above says the thing you mean.

   The output keys — fill, line, wash — are exactly what colourOf() in
   map/index.js already reads, so the map module does not change.
   ============================================================ */

import { toHSL, fromHSL } from '../map/tint.js';

/* Light and dark differ in how much room a colour has. A wash covers a large
   area and has to stay under the ink; a fill is a stroke or a small shape and
   can be stronger.

   These are not invented numbers: --red is hsl(2.5, 58%, 42%) and --red-wash
   is hsl(4.7, 46%, 57%), so a derived faction sits beside a hand-tuned one
   without looking like a guest. Percentages, because that is what fromHSL()
   in map/tint.js takes. */
const LIGHT = { fill: { s: 57, l: 42 }, wash: { s: 46, l: 57 } };
const DARK = { fill: { s: 50, l: 56 }, wash: { s: 34, l: 46 } };

/**
 * Resolve every faction a pack declares.
 *
 * @param factions  pack.json's `factions` object
 * @param el        the element to read custom properties from
 * @param dark      whether this subtree is dark right now
 * @returns { id: { label, fill, line, wash, flag } }
 */
export function derivePalette(factions, { el = document.documentElement, dark = false } = {}) {
  const cs = el ? getComputedStyle(el) : null;
  const read = (name, fallback) =>
    (cs?.getPropertyValue(name)?.trim()) || fallback;

  const out = {};
  for (const [id, spec] of Object.entries(factions || {})) {
    out[id] = resolve(id, spec || {}, read, dark);
  }
  return out;
}

function resolve(id, spec, read, dark) {
  const label = spec.label ?? id;
  const flag = spec.flag ?? '';

  // 1. Explicit colour wins, and may still name per-theme variants.
  if (spec.fill) {
    const fill = (dark && spec.fillDark) || spec.fill;
    const wash = (dark && spec.washDark) || spec.wash || fill;
    return { label, flag, fill, line: (dark && spec.lineDark) || spec.line || fill, wash };
  }

  // 2. A design token, read live so the theme flips it for us.
  if (spec.token) {
    const fill = read(spec.token, '#55704c');
    const wash = read(`${spec.token}-wash`, fill);
    return { label, flag, fill, line: fill, wash };
  }

  // 3. A hue, and let the framework be consistent about the rest.
  if (typeof spec.hue === 'number') {
    const band = dark ? DARK : LIGHT;
    const sat = spec.sat ?? 1;
    const fill = fromHSL(spec.hue, band.fill.s * sat, band.fill.l);
    const wash = fromHSL(spec.hue, band.wash.s * sat, band.wash.l);
    return { label, flag, fill, line: fill, wash };
  }

  // Nothing declared. Say so once rather than drawing a mystery colour.
  console.warn(`[palette] faction "${id}" declares no token, hue or fill`);
  const fill = read('--sage', '#55704c');
  return { label, flag, fill, line: fill, wash: read('--sage-wash', fill) };
}

/* ------------------------------------------------------------
   Palette roles
   ------------------------------------------------------------ */

/* `tone: red|blue|gold|sage` on a cue used to be an alias for a faction —
   TONE = { red: 'british', … } — which is the same leak in a smaller shape.
   It now means a *role in the palette*: point at this, mark it as a turning
   point, keep it quiet. Registering the four as synthetic factions means the
   map module needs no concept of a tone at all, and the two Revolution
   chapters keep drawing byte-identically without a single edit. */
export const TONES = ['red', 'blue', 'gold', 'sage'];

export function toneFactions(el = document.documentElement) {
  const cs = el ? getComputedStyle(el) : null;
  const read = (name, fallback) => (cs?.getPropertyValue(name)?.trim()) || fallback;
  const out = {};
  for (const tone of TONES) {
    const fill = read(`--tone-${tone}`, read(`--${tone}`, '#55704c'));
    out[`tone:${tone}`] = {
      label: tone, flag: '',
      fill, line: fill,
      wash: read(`--tone-${tone}-wash`, read(`--${tone}-wash`, fill)),
    };
  }
  return out;
}

/**
 * The faction a cue means, or the fallback.
 *
 * `side` names a party in the pack; `tone` names a role. A cue may use either
 * and the engine no longer has an opinion about which parties exist.
 */
export function factionOf(cue, fallback = 'tone:gold') {
  if (cue?.side) return cue.side;
  if (cue?.tone) return `tone:${cue.tone}`;
  return fallback;
}

/**
 * Publish a palette as CSS custom properties: --f-<id> and --f-<id>-wash.
 *
 * For the DOM side of the app, so a stylesheet can carry a faction colour
 * without a selector per faction — `.mk--british { … }` bakes N=4 into CSS,
 * and N is a property of the pack.
 */
export function applyPaletteVars(el, palette) {
  if (!el) return;
  for (const [id, f] of Object.entries(palette || {})) {
    const safe = id.replace(/[^a-z0-9]+/gi, '-');
    el.style.setProperty(`--f-${safe}`, f.fill);
    el.style.setProperty(`--f-${safe}-wash`, f.wash);
  }
}

/** The colour to hand a DOM node for a side. Falls back to quiet ink. */
export function sideColour(palette, side) {
  return palette?.[side]?.fill || 'var(--ink-faint)';
}
