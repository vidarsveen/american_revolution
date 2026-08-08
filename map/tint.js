/* ============================================================
   tint.js — thirteen regions, thirteen colours, one side.

   A map that fills every colony with the same wash answers "whose side are
   they on" and nothing else. You cannot see where one ends and the next
   begins except by hunting for the border line, and on a phone that line is
   one pixel. Give each area its own colour and the shape of the thing is
   readable at a glance — which is the whole reason to draw a map instead of
   writing a list.

   The colours are still derived from the side, not chosen freely. A pack that
   says "patriot" gets thirteen patriot colours, and flipping a colony to the
   British side must visibly move it across the map's politics, not just
   nudge its hue. So: rotate around the side's own hue, keep its lightness,
   and stay out of the arcs that mean something else.
   ============================================================ */

/* How far around the wheel the family is allowed to spread, in degrees either
   way. Wide enough that thirteen steps are distinguishable, narrow enough
   that the set still reads as one side. */
const SPREAD = 78;

/* Hues that are already spoken for and must not be wandered into:
   the British red, and the land itself. A colony the colour of the ground it
   sits on is not a colony, it is a hole in the map. */
const FORBIDDEN = [
  [-25, 30],    // red — the other side
  [35, 100],    // olive and gold — the land, and the French
];

/**
 * Colour number `slot` of a family of `n`, derived from `base`.
 *
 * Deterministic in (base, slot, n) and nothing else. No counter, no draw
 * order, no memory — replay the cues after a seek and every colony is the
 * colour it was.
 *
 * WHICH region gets which slot is deliberately not decided here. Spreading
 * hue evenly across a list is only right if neighbours are far apart in that
 * list, and they are not: the colonies run north to south, so New York and
 * Pennsylvania sit two apart and share four hundred kilometres of border.
 * Solving that needs the adjacency graph, which lives with the geometry —
 * tools/build-colonies.py assigns the slots and ships them in the file.
 * spreadIndex() below is the fallback for data that never had them.
 */
export function tintFor(base, slot, n) {
  const hsl = toHSL(base);
  if (!hsl || n <= 1) return base;

  slot = ((slot % n) + n) % n;
  // -1..1 across the family, centred so the base hue stays in the middle.
  const t = n === 1 ? 0 : (slot / (n - 1)) * 2 - 1;

  const h = avoid(hsl.h + t * SPREAD, hsl.h);
  // A second, slower wave across lightness and saturation. Two regions that
  // land on a similar hue — unavoidable at thirteen — still separate, and the
  // set gains the unevenness a hand-coloured atlas has.
  const wave = Math.cos((slot / n) * Math.PI * 2);
  const l = clamp(hsl.l + wave * 7, 22, 82);
  const s = clamp(hsl.s + Math.sin((slot / n) * Math.PI * 4) * 10, 18, 78);

  return fromHSL(h, s, l);
}

/**
 * A slot for the i-th of n regions, when nothing better is known.
 *
 * Used for region sets that ship without solved slots — the framework's
 * default modern boundaries, say. Walking by a stride coprime with n visits
 * every slot and never lands next to where it just was, so consecutive
 * entries in the list come out far apart on the wheel. It is a guess about
 * adjacency rather than an answer, but it beats handing neighbouring entries
 * neighbouring hues, which is what a plain index does.
 */
export function spreadIndex(i, n) {
  return n > 1 ? (i * strideFor(n)) % n : 0;
}

/** The largest stride below n/2 that shares no factor with n. */
function strideFor(n) {
  for (let k = Math.floor(n / 2); k > 1; k--) if (gcd(k, n) === 1) return k;
  return 1;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Push a hue out of an arc that already means something else. */
function avoid(h, home) {
  let deg = norm360(h);
  for (const [lo, hi] of FORBIDDEN) {
    const a = norm360(lo), b = norm360(hi);
    const inside = a <= b ? deg >= a && deg <= b : deg >= a || deg <= b;
    if (!inside) continue;
    // Out the nearer end, and away from the base rather than across it.
    const dLo = arc(deg, a), dHi = arc(deg, b);
    deg = norm360(dLo < dHi ? a - 1 : b + 1);
  }
  return deg;
}

const norm360 = (d) => ((d % 360) + 360) % 360;
const arc = (a, b) => { const d = Math.abs(norm360(a) - norm360(b)); return Math.min(d, 360 - d); };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ------------------------------------------------------------
   Colour conversion

   Kept here rather than pulled in, because the only thing the map needs is
   a hue rotation and CSS gives no way to do one on a canvas fillStyle.
   ------------------------------------------------------------ */

/** '#rgb', '#rrggbb' or 'rgb(r g b)' -> {h, s, l}. Null if unparseable. */
export function toHSL(colour) {
  const rgb = toRGB(colour);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: norm360(h * 60), s: s * 100, l: l * 100 };
}

export function fromHSL(h, s, l) {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = norm360(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
      hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function toRGB(colour) {
  const c = String(colour || '').trim();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    if (h.length === 3) return [...h].map((d) => parseInt(d + d, 16));
    if (h.length >= 6) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return null;
  }
  // getComputedStyle hands back 'rgb(123 45 67)' or 'rgb(123, 45, 67)'
  // depending on the browser and how the token was authored.
  const m = c.match(/-?\d+(\.\d+)?/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null;
}
