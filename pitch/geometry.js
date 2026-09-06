/* ============================================================
   pitch/geometry.js — the ground a football course is drawn on.

   The map module's counterpart, and deliberately much smaller: a pitch has no
   projection, no tiles and no level of detail. It is a rectangle with known
   markings, and every number in here is a real one from the Laws of the Game.

   ------------------------------------------------------------
   THE COORDINATE SYSTEM, AND WHY IT IS THE WAY UP IT IS
   ------------------------------------------------------------

       x   0 .. 68     across, 0 = left touchline
       y   0 .. 105    along,  0 = OWN goal line, 105 = THEIRS

   So +y is the attacking direction, and the pitch is drawn PORTRAIT: the
   phone is held upright, the team attacks up the screen.

   That is not a compromise for a small screen, it is the better drawing, and
   three things fall out of it:

   · A landscape pitch inside a 390 x 734 stage is 253 px tall. Two thirds of
     the screen would be furniture and paper. Turned upright it is 390 x 602
     and the dots are big enough to tell apart.
   · The vocabulary becomes literal. A defensive line that "steps up" steps up
     the screen. A "high" line is high. A team that "drops off" drops.
   · The five lanes are vertical stripes, which is how every coach draws them,
     and the half-spaces line up with the edges of the penalty area exactly as
     they do on a tactics board.

   The cost is that a viewer used to television sees the pitch rotated. That
   is a real cost and it is paid once, in the first ten seconds of chapter one,
   in exchange for every diagram after it being twice the size.

   ------------------------------------------------------------
   ONE TEAM'S POINT OF VIEW
   ------------------------------------------------------------

   These coordinates belong to the team the course is talking about. The
   opposition is drawn in the same frame with its own positions mirrored
   through `flip()` — an opponent's back four sits at THEIR y = 30, which is
   our y = 75. Nothing in the drawing code knows about sides; it is given
   points and it draws them.
   ============================================================ */

/** The pitch itself, in metres. The Laws allow a range; these are the
 *  dimensions every professional ground is built to. */
export const PITCH = Object.freeze({
  width: 68,
  length: 105,
  /** Penalty area: 40.32 m across, 16.5 m deep. */
  boxWidth: 40.32,
  boxDepth: 16.5,
  /** Goal area (the six-yard box): 18.32 m across, 5.5 m deep. */
  goalAreaWidth: 18.32,
  goalAreaDepth: 5.5,
  /** The goal itself. */
  goalWidth: 7.32,
  /** Penalty spot, and the radius that draws both the centre circle and the D. */
  spot: 11,
  circle: 9.15,
  cornerArc: 1,
});

export const HALF_W = PITCH.width / 2;
export const HALF_L = PITCH.length / 2;

/** x of the penalty-area edges — also the boundary of the half-spaces. */
export const BOX_X0 = HALF_W - PITCH.boxWidth / 2;      // 13.84
export const BOX_X1 = HALF_W + PITCH.boxWidth / 2;      // 54.16
/** x of the six-yard-box edges — the boundary of the central lane. */
export const GOAL_AREA_X0 = HALF_W - PITCH.goalAreaWidth / 2;   // 24.84
export const GOAL_AREA_X1 = HALF_W + PITCH.goalAreaWidth / 2;   // 43.16

/**
 * The five lanes.
 *
 * Not fifths of the width — that is the drawing people assume and it is
 * wrong. The lanes are defined by the markings that are already on the grass:
 * the wings are outside the penalty area, the half-spaces are the strips
 * between the penalty area and the six-yard box extended, and the centre is
 * as wide as the goal area. That is why a half-space is a real place and not
 * a diagram convention — a ball played into one arrives at the corner of the
 * box, which is the single most dangerous piece of ground on the pitch.
 */
export const LANES = Object.freeze([
  { id: 'wing-left',       x0: 0,            x1: BOX_X0 },
  { id: 'half-space-left', x0: BOX_X0,       x1: GOAL_AREA_X0 },
  { id: 'centre',          x0: GOAL_AREA_X0, x1: GOAL_AREA_X1 },
  { id: 'half-space-right',x0: GOAL_AREA_X1, x1: BOX_X1 },
  { id: 'wing-right',      x0: BOX_X1,       x1: PITCH.width },
]);

/**
 * Named areas a cue can point at, as [x0, y0, x1, y1] in metres.
 *
 * A chapter writes `area: "final-third"` and never four numbers, for the same
 * reason it writes `shape: "4-4-2"` and never eleven pairs. The explicit form
 * still works when a cue needs a box nothing has a name for.
 */
export const AREAS = Object.freeze({
  'final-third':      [0, PITCH.length * 2 / 3, PITCH.width, PITCH.length],
  'middle-third':     [0, PITCH.length / 3, PITCH.width, PITCH.length * 2 / 3],
  'defensive-third':  [0, 0, PITCH.width, PITCH.length / 3],
  'their-half':       [0, HALF_L, PITCH.width, PITCH.length],
  'own-half':         [0, 0, PITCH.width, HALF_L],
  box:                [BOX_X0, PITCH.length - PITCH.boxDepth, BOX_X1, PITCH.length],
  'own-box':          [BOX_X0, 0, BOX_X1, PITCH.boxDepth],
  ...Object.fromEntries(LANES.map((l) => [l.id, [l.x0, 0, l.x1, PITCH.length]])),
});

/**
 * How much of the pitch a panel shows, as [y0, y1] in metres.
 *
 * Cropping is the phone's other half of the answer. A full pitch at 390 px
 * wide puts eleven dots in 602 px of height; the final third alone puts four
 * of them in the same space, which is the difference between "there is a
 * shape there" and "I can see who is where".
 */
export const VIEWS = Object.freeze({
  full:          [0, PITCH.length],
  'own-half':    [0, HALF_L + 6],
  'their-half':  [HALF_L - 6, PITCH.length],
  'final-third': [PITCH.length * 2 / 3 - 4, PITCH.length],
  middle:        [PITCH.length / 4, PITCH.length * 3 / 4],
});

/** Mirror a point into the opposition's frame (and back — it is its own inverse). */
export function flip(pt) {
  return { ...pt, x: PITCH.width - pt.x, y: PITCH.length - pt.y };
}

export function flipY(y) { return PITCH.length - y; }

/**
 * Fit a view of the pitch into a box of screen pixels.
 *
 * Returns the transform every draw call goes through. `pad` is in pixels and
 * is applied after the fit, so a pitch never touches the edge of its panel.
 *
 * The scale is uniform: a pitch drawn with different x and y scales is not a
 * pitch, and every angle in it — the diagonal of a switch, the arc of a run —
 * would be a lie about the ground.
 */
export function fitView(box, view = VIEWS.full, pad = 10) {
  const [y0, y1] = view;
  const spanY = Math.max(1, y1 - y0);
  const spanX = PITCH.width;
  const w = Math.max(1, box.w - pad * 2);
  const h = Math.max(1, box.h - pad * 2);
  const scale = Math.min(w / spanX, h / spanY);
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  /* Centred across, and held HIGH down the frame rather than centred.

     A cropped view is a landscape band on a portrait screen, so it never fills
     the box: `middle` is 52 m of a 105 m pitch and comes out about 290 px tall
     in 530. Centred, that leaves a gap above it and a gap below it and the
     picture reads as unfinished. Held at 28% of the slack, the leftover is one
     block underneath — which is where the caption sits anyway — and the band
     reads as a deliberate crop instead of a small picture adrift.

     A full view nearly fills the box, so this changes it by a few pixels. */
  const left = box.x + pad + (w - drawnW) / 2;
  const top = box.y + pad + (h - drawnH) * 0.28;
  return {
    scale,
    view: [y0, y1],
    box: { x: left, y: top, w: drawnW, h: drawnH },
    /** metres -> pixels. +y is up the screen, so screen y is inverted. */
    px: (x, y) => [left + x * scale, top + (y1 - y) * scale],
    /** a length in metres -> pixels. */
    len: (m) => m * scale,
  };
}

/**
 * Is this point inside the part of the pitch the panel is showing?
 *
 * Used to decide whether a label is worth drawing at all. A dot that is
 * cropped out still exists — the shape is still correct — but a name floating
 * over the edge of the panel is the CLIPPED finding tools/check-legible.py
 * exists to report, one surface over.
 */
export function inView(pt, view) {
  return pt.y >= view[0] && pt.y <= view[1] && pt.x >= 0 && pt.x <= PITCH.width;
}

/** Clamp a point onto the pitch. A shape placed too high would otherwise
 *  draw its forwards in the crowd behind the goal. */
export function clampToPitch(pt) {
  return {
    ...pt,
    x: Math.min(PITCH.width, Math.max(0, pt.x)),
    y: Math.min(PITCH.length, Math.max(0, pt.y)),
  };
}

/** Straight-line distance in metres. */
export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Linear interpolation between two points — the whole of the morph. */
export function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * A quadratic bend for a run.
 *
 * A run is not a straight line and drawing it as one makes it a pass. The
 * control point is pushed off the chord by `bend` times its length, on the
 * left or the right depending on the sign, which is enough to say "round the
 * outside" without the author placing a third point.
 */
export function bendControl(a, b, bend = 0.18) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // The normal, pointing left of travel.
  return { x: mx - (dy / len) * len * bend, y: my + (dx / len) * len * bend };
}

/** Point on a quadratic Bézier — used to put an arrowhead on a curve. */
export function quadAt(a, c, b, t) {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** Resolve a named area, or pass an explicit [x0,y0,x1,y1] straight through. */
export function areaOf(name) {
  if (Array.isArray(name) && name.length === 4) {
    const [x0, y0, x1, y1] = name.map(Number);
    return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
  }
  return AREAS[name] ? AREAS[name].slice() : null;
}
