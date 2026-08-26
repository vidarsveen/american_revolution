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

/* A fill's lightness is a RESULT, not a constant.

   Those two numbers used to be taken as written, whatever hue they were
   applied to, and a fixed lightness is a statement about no colour in
   particular. Measured against the ground the map actually draws, on the three
   packs whose factions are derived rather than hand-tuned: a red pin in the
   dark theme came out at 2.21, an Antonian one at 1.96, a Pompeian one at 2.46
   in the light theme — against WCAG's 3.0 floor for a mark that is not text.
   Warm hues are too dark for a dark ground at L=56 and cool ones too light for
   parchment at L=42, which is exactly what one number for every hue buys you.

   The pin itself survived that, because its keyline is `--atlas-ink` and a
   keyline is the strongest edge on the map. Nothing carries a march, an arrow
   or a front: those are strokes in this colour and nothing else.

   So: start at the band, and walk the lightness AWAY from the ground until the
   mark clears 3:1. Hue and saturation never move, so a faction is still the
   colour the pack asked for and eight factions still read as one family. The
   worst move measured across the three packs is eleven points of lightness on
   a dark-theme red; most factions do not move at all, and every faction in
   every theme clears (3.01 worst). It reads the ground live from
   `--atlas-land`, so a pack that retints its parchment gets colours fitted to
   the parchment it actually has. */
const AA_NONTEXT = 3.0;
const GROUND_FALLBACK = { light: '#f4ecd8', dark: '#4c4838' };

function rgbOf(colour) {
  const c = String(colour || '').trim();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    if (h.length === 3) return [...h].map((d) => parseInt(d + d, 16));
    if (h.length >= 6) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return null;
  }
  const m = c.match(/-?[\d.]+/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null;
}

/** WCAG 2.2 relative luminance. Text is not the point here — 1.4.11 is. */
function relLum(colour) {
  const rgb = rgbOf(colour);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  if (la == null || lb == null) return AA_NONTEXT;   // unreadable input: do not move it
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function fitFill(hue, sat, band, ground) {
  const groundLum = relLum(ground);
  if (groundLum == null) return fromHSL(hue, sat, band.l);
  // Away from the ground: darker on parchment, lighter on a dark map.
  const step = groundLum > 0.18 ? -1 : 1;
  const limit = step < 0 ? 14 : 88;
  let l = band.l;
  let colour = fromHSL(hue, sat, l);
  while (contrast(colour, ground) < AA_NONTEXT) {
    const next = l + step;
    if (step < 0 ? next < limit : next > limit) break;
    l = next;
    colour = fromHSL(hue, sat, l);
  }
  return colour;
}

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
    const ground = read('--atlas-land',
                        GROUND_FALLBACK[dark ? 'dark' : 'light']);
    // The fill is a mark on the ground and is fitted to it; the wash goes
    // UNDER the ink and is scored on how far apart two neighbours are, which
    // is a different question with its own measurement in check-contrast.py.
    const fill = fitFill(spec.hue, band.fill.s * sat, band.fill, ground);
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
