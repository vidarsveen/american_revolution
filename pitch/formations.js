/* ============================================================
   pitch/formations.js — a shape, written the way it is spoken.

   A chapter writes `shape: "4-2-3-1"` and never eleven pairs of coordinates,
   for the same reason a wine chapter writes `region: "barolo"` and never a
   polygon. The shape is the thing the course is about; where exactly the
   right-back stands is not, and eleven hand-placed numbers in a script would
   drift the first time anybody changed one.

   ------------------------------------------------------------
   A SHAPE IS RELATIVE, AND THAT IS THE WHOLE POINT
   ------------------------------------------------------------

   Every position here is given as

       rx   0 .. 1   across the block, 0 = left
       ry   0 .. 1   through the block, 0 = the deepest outfield line,
                     1 = the furthest forward

   and is only turned into metres when it is placed, against three numbers a
   cue supplies:

       line    where the deepest outfield line stands, in metres from own goal
       depth   how many metres from that line to the front one
       width   how much of the 68 m the block spreads across, 0 .. 1

   That separation is not tidiness, it is the syllabus. "A high line" and "a
   low block" are the SAME shape at a different `line`. "Compact" is the same
   shape at a smaller `depth` — and chapter four's whole argument is that the
   distance between the lines is the thing being defended, not the formation
   name. If a formation baked in absolute metres, a chapter could not say any
   of that without a second formation for every sentence.

   ------------------------------------------------------------
   NAMED, AND DERIVED
   ------------------------------------------------------------

   Any digit string works: "4-3-2-1" is parsed into units, spread through the
   block and drawn. The table below only overrides the ones where an even
   spread is actually WRONG — a libero standing behind his own back four, a
   wing-back who is ten metres wider than anybody else, the two inside
   forwards of a WM that are the whole reason it is called a WM. Those are the
   shapes chapter two needs, and they are the ones an algorithm gets wrong.

   Roles are ids a cue can point at (`who: "six"`), and they exist only where
   the position has a name people actually say. A 4-4-2 has two central
   midfielders and neither of them is "the six", so it does not claim one.

   ------------------------------------------------------------
   `num` IS A SHIRT NUMBER, AND ONLY FIVE SHAPES HAVE ONE
   ------------------------------------------------------------

   A dot's number was originally its position in the drawing order, which
   looked completely convincing and was wrong: the WM came out with the
   centre-half wearing 3 when the whole reason he is interesting is that he is
   the 5. Chapter two's argument is that a six, an eight and a ten are real
   position numbers left over from the 2-3-5, so a picture that made numbers
   up would teach the opposite of the sentence over it.

   So `num` is DECLARED, and only on the five shapes where the numbering is
   conventional: the pyramid it came from, the WM it survived, and the three
   modern shapes a broadcast graphic actually numbers. A back three and a back
   five have no agreed numbering — clubs differ — and rather than invent one,
   a shape without `num` draws no numbers at all and says so once. Label the
   dots that matter instead.
   ============================================================ */

import { PITCH, HALF_W, clampToPitch } from './geometry.js';

/**
 * The shapes that are hand-placed, each as its ten outfield players in
 * drawing order: deepest first, left to right within a line.
 *
 * `ry` may be negative. A libero stands BEHIND the line he sweeps up for, and
 * flattening him into it would remove the only thing that made catenaccio
 * different from a back five.
 */
const NAMED = {
  '4-4-2': [
    { rx: 0.10, ry: 0,    role: 'lb', num: 3 },
    { rx: 0.37, ry: 0,    role: 'lcb', num: 5 },
    { rx: 0.63, ry: 0,    role: 'rcb', num: 4 },
    { rx: 0.90, ry: 0,    role: 'rb', num: 2 },
    { rx: 0.08, ry: 0.55, role: 'lm', num: 11 },
    { rx: 0.38, ry: 0.52, role: 'lcm', num: 6 },
    { rx: 0.62, ry: 0.52, role: 'rcm', num: 8 },
    { rx: 0.92, ry: 0.55, role: 'rm', num: 7 },
    { rx: 0.40, ry: 1,    role: 'st', num: 9 },
    { rx: 0.60, ry: 1,    role: 'st2', num: 10 },
  ],
  '4-2-3-1': [
    { rx: 0.10, ry: 0,    role: 'lb', num: 3 },
    { rx: 0.36, ry: 0,    role: 'lcb', num: 5 },
    { rx: 0.64, ry: 0,    role: 'rcb', num: 4 },
    { rx: 0.90, ry: 0,    role: 'rb', num: 2 },
    { rx: 0.36, ry: 0.40, role: 'six', num: 6 },
    { rx: 0.64, ry: 0.40, role: 'eight', num: 8 },
    { rx: 0.08, ry: 0.76, role: 'lw', num: 11 },
    { rx: 0.50, ry: 0.74, role: 'ten', num: 10 },
    { rx: 0.92, ry: 0.76, role: 'rw', num: 7 },
    { rx: 0.50, ry: 1,    role: 'nine', num: 9 },
  ],
  '4-3-3': [
    { rx: 0.10, ry: 0,    role: 'lb', num: 3 },
    { rx: 0.36, ry: 0,    role: 'lcb', num: 5 },
    { rx: 0.64, ry: 0,    role: 'rcb', num: 4 },
    { rx: 0.90, ry: 0,    role: 'rb', num: 2 },
    { rx: 0.50, ry: 0.36, role: 'six', num: 6 },
    { rx: 0.27, ry: 0.58, role: 'eight', num: 8 },
    { rx: 0.73, ry: 0.58, role: 'eight2', num: 10 },
    { rx: 0.06, ry: 0.96, role: 'lw', num: 11 },
    { rx: 0.50, ry: 1,    role: 'nine', num: 9 },
    { rx: 0.94, ry: 0.96, role: 'rw', num: 7 },
  ],
  '3-4-3': [
    { rx: 0.24, ry: 0,    role: 'lcb' },
    { rx: 0.50, ry: 0,    role: 'cb' },
    { rx: 0.76, ry: 0,    role: 'rcb' },
    { rx: 0.02, ry: 0.50, role: 'lwb' },
    { rx: 0.37, ry: 0.44, role: 'six' },
    { rx: 0.63, ry: 0.44, role: 'eight' },
    { rx: 0.98, ry: 0.50, role: 'rwb' },
    { rx: 0.16, ry: 1,    role: 'lw' },
    { rx: 0.50, ry: 1,    role: 'nine' },
    { rx: 0.84, ry: 1,    role: 'rw' },
  ],
  '5-3-2': [
    { rx: 0.02, ry: 0.08, role: 'lwb' },
    { rx: 0.25, ry: 0,    role: 'lcb' },
    { rx: 0.50, ry: 0,    role: 'cb' },
    { rx: 0.75, ry: 0,    role: 'rcb' },
    { rx: 0.98, ry: 0.08, role: 'rwb' },
    { rx: 0.28, ry: 0.56, role: 'eight' },
    { rx: 0.50, ry: 0.52, role: 'six' },
    { rx: 0.72, ry: 0.56, role: 'eight2' },
    { rx: 0.40, ry: 1,    role: 'st' },
    { rx: 0.60, ry: 1,    role: 'st2' },
  ],
  /* The pyramid — two backs, three halves, five forwards. It is the shape the
     position numbers were assigned on, which is why chapter two starts here:
     the "inside-left" is number ten, and a hundred years later a commentator
     still calls the man in that space the ten. */
  '2-3-5': [
    { rx: 0.35, ry: 0,    role: 'lb', num: 3 },
    { rx: 0.65, ry: 0,    role: 'rb', num: 2 },
    { rx: 0.16, ry: 0.42, role: 'lh', num: 6 },
    { rx: 0.50, ry: 0.40, role: 'ch', num: 5 },
    { rx: 0.84, ry: 0.42, role: 'rh', num: 4 },
    { rx: 0.04, ry: 1,    role: 'outside-left', num: 11 },
    { rx: 0.28, ry: 0.94, role: 'inside-left', num: 10 },
    { rx: 0.50, ry: 1,    role: 'centre-forward', num: 9 },
    { rx: 0.72, ry: 0.94, role: 'inside-right', num: 8 },
    { rx: 0.96, ry: 1,    role: 'outside-right', num: 7 },
  ],
  /* Chapman's answer to the 1925 offside change: the centre-half drops in as
     a third back, the two inside forwards drop off, and the shape on paper
     spells W over M. The two dropped inside forwards are the whole letter. */
  wm: [
    { rx: 0.22, ry: 0,    role: 'lb', num: 3 },
    { rx: 0.50, ry: 0.05, role: 'stopper', num: 5 },
    { rx: 0.78, ry: 0,    role: 'rb', num: 2 },
    { rx: 0.30, ry: 0.34, role: 'lh', num: 6 },
    { rx: 0.70, ry: 0.34, role: 'rh', num: 4 },
    { rx: 0.32, ry: 0.70, role: 'inside-left', num: 10 },
    { rx: 0.68, ry: 0.70, role: 'inside-right', num: 8 },
    { rx: 0.08, ry: 1,    role: 'outside-left', num: 11 },
    { rx: 0.50, ry: 1,    role: 'centre-forward', num: 9 },
    { rx: 0.92, ry: 1,    role: 'outside-right', num: 7 },
  ],
  /* A libero behind four man-markers. The negative ry is the argument: he is
     not in the line, he is the spare man behind it, and that is exactly what
     "sweeper" means. */
  catenaccio: [
    { rx: 0.50, ry: -0.16, role: 'libero' },
    { rx: 0.10, ry: 0,     role: 'lb' },
    { rx: 0.36, ry: 0,     role: 'lcb' },
    { rx: 0.64, ry: 0,     role: 'rcb' },
    { rx: 0.90, ry: 0,     role: 'rb' },
    { rx: 0.22, ry: 0.52,  role: 'lm' },
    { rx: 0.50, ry: 0.50,  role: 'cm' },
    { rx: 0.78, ry: 0.52,  role: 'rm' },
    { rx: 0.40, ry: 1,     role: 'st' },
    { rx: 0.60, ry: 1,     role: 'st2' },
  ],
};

/** Spelling variants that mean the same shape. */
const ALIASES = {
  'back-three': '3-4-3',
  'back-five': '5-3-2',
  '3-2-2-3': 'wm',
  'w-m': 'wm',
  pyramid: '2-3-5',
  '1-4-3-2': 'catenaccio',
};

export function shapeNames() {
  return [...Object.keys(NAMED), ...Object.keys(ALIASES)];
}

function key(name) {
  const k = String(name ?? '').trim().toLowerCase();
  return ALIASES[k] || k;
}

/**
 * How wide a line of n players stands, as a fraction of the block's width.
 *
 * A front two is narrow and a back four is not, and an even spread across the
 * whole width for every line is the single thing that makes a generated shape
 * look wrong. These are the numbers a coach's board uses.
 */
function span(n, isFront) {
  if (n <= 1) return 0;
  if (n === 2) return 0.30;
  if (n === 3) return isFront ? 0.92 : 0.68;
  if (n === 4) return 0.82;
  return 0.96;
}

/**
 * Derive a shape from any digit string: "4-3-2-1" -> four units.
 *
 * Returns null when the digits do not describe ten outfield players, which is
 * the one thing worth refusing — "4-4-3" is a typo, and drawing eleven
 * outfielders would be a picture of something that cannot happen.
 */
function derive(name) {
  const digits = String(name ?? '').match(/\d+/g);
  if (!digits || digits.length < 2) return null;
  const units = digits.map(Number);
  if (units.some((n) => n < 1 || n > 6)) return null;
  if (units.reduce((a, b) => a + b, 0) !== 10) return null;

  const out = [];
  units.forEach((n, i) => {
    const ry = units.length === 1 ? 1 : i / (units.length - 1);
    const isFront = i === units.length - 1;
    const s = span(n, isFront);
    for (let j = 0; j < n; j += 1) {
      const t = n === 1 ? 0.5 : j / (n - 1);
      out.push({ rx: 0.5 + (t - 0.5) * s, ry });
    }
  });
  return out;
}

let warned = new Set();

/**
 * A shape, in metres, in the coordinates of the team that plays it.
 *
 * Returns eleven players: the keeper first, then the outfield in drawing
 * order. Every one carries `n` (1-11), and `role` where the position has a
 * name people say.
 *
 * The keeper's depth is DERIVED from the line rather than fixed, and that is
 * a teaching decision as much as a drawing one: push the line to fifty metres
 * and the keeper comes out to thirty, which is what a sweeper keeper is and
 * why a high line needs one. A fixed keeper on his six-yard box would draw
 * forty metres of undefended grass and call it normal.
 */
export function shapeOf(name, opts = {}) {
  const {
    line = 30,
    depth = 34,
    width = 0.88,
  } = opts;

  const k = key(name);
  let spec = NAMED[k] || derive(k);
  if (!spec) {
    if (!warned.has(k)) {
      warned.add(k);
      console.warn(`[pitch] no shape "${name}" — the digits must add up to ten `
        + `outfield players. Drawing 4-2-3-1.`);
    }
    spec = NAMED['4-2-3-1'];
  }

  const blockWidth = PITCH.width * Math.max(0.2, Math.min(1, width));
  const players = spec.map((p, i) => clampToPitch({
    // `n` is how a cue points at a player and is always 1-11 in drawing order.
    // `num` is the shirt on his back and is null unless the shape declares one.
    // Conflating the two put a 3 on the WM's centre-half. See the header.
    n: i + 2,
    num: p.num ?? null,
    role: p.role || null,
    x: HALF_W + (p.rx - 0.5) * blockWidth,
    y: line + p.ry * depth,
  }));

  // The keeper. Twenty metres behind his line, on his goal line at the deepest
  // and never past the halfway line at the highest.
  // The keeper is 1 in every shape there has ever been — but only when the
  // rest of the team is numbered, or a lone 1 sits on a pitch of blank dots.
  const numbered = spec.some((p) => p.num != null);
  const keeper = clampToPitch({
    n: 1,
    num: numbered ? 1 : null,
    role: 'gk',
    x: HALF_W,
    y: Math.max(3.5, Math.min(48, line - 20)),
  });

  return [keeper, ...players];
}

/**
 * Find one player in a shape.
 *
 * Accepts the number (1-11, the keeper is 1) or a role id. Returns the index
 * into the array, or -1 — never throws, because a cue naming a role a shape
 * does not have is an authoring mistake that must not take the chapter down.
 */
export function indexOf(players, who) {
  if (who == null) return -1;
  if (typeof who === 'number' || /^\d+$/.test(String(who))) {
    const n = Number(who);
    return players.findIndex((p) => p.n === n);
  }
  const role = String(who).trim().toLowerCase();
  return players.findIndex((p) => p.role === role);
}

/** For the lab and for error messages: what this shape can be pointed at by. */
export function rolesOf(players) {
  return players.map((p) => p.role).filter(Boolean);
}

/** Test seam: the warn-once set would otherwise leak between lab runs. */
export function resetShapeWarnings() { warned = new Set(); }
