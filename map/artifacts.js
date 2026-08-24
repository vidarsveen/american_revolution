/* ============================================================
   artifacts.js — everything drawn on top of the ground.

   All of these work in screen pixels, because their weight is a function of
   how big the screen is, not how big the world is: an army arrow must read
   as army-sized at every zoom, not thin out to a hairline when you pull back.

   Every one takes a `progress` in 0..1 so it can draw itself in, and every
   one is a pure function of (data, camera, progress). Nothing accumulates.
   That is what makes seeking correct: wipe the stage, replay the cues with
   progress = 1, and you get the same picture you would have got by waiting.
   ============================================================ */

import { catmullRom, arcLength, normals, smoothstep, takeFraction, clamp } from './geo.js';

/* ------------------------------------------------------------
   Broad army arrows
   ------------------------------------------------------------ */

const REF_STRENGTH = 5000;   // a "typical" force; width is relative to this
const REF_METRES = 620;      // half-width ON THE GROUND for that force
const MIN_PX = 5;            // at theatre zoom an arrow is a symbol, not a hairline
const MAX_PX = 120;          // still an arrow, not a wall, at street zoom
// And never wider than this fraction of the shorter side of the viewport.
// MAX_PX alone is a fixed 240 px ribbon: a reasonable arrow on a desktop map
// and most of a phone screen. Four hundred New Hampshire men coming over
// Charlestown Neck buried the hill they were marching to, and the head flares
// to twice the shaft, so what the eye actually measures is four times this.
// The ground-truth model is right and stays — this is the screen it is being
// drawn on getting a say, which is the one thing it could not previously do.
const MAX_VIEWPORT_FRACTION = 0.05;

/**
 * Width from strength, in METRES OF GROUND — then converted to pixels by the
 * caller's scale.
 *
 * This used to be a pixel width with a token zoom term, which was a modelling
 * error: it grew 12% between zoom 10 and 14 while the map grew 1600%, so the
 * arrow was pinned to the screen and slid over the landscape as you zoomed.
 * An army is a body of men standing on actual ground. Zoom in and it must get
 * bigger, exactly like the road it is marching along.
 *
 * Strength scales as the square root, so ten thousand men are not ten times
 * wider than one thousand and cannot swallow the frame. The clamps are the
 * only screen-space part left, and they exist so the arrow survives being
 * looked at from orbit or from a field.
 */
export function widthForStrength(strength = REF_STRENGTH, metresPerPixel = 50, overrideM) {
  const metres = overrideM != null
    ? overrideM
    : REF_METRES * Math.sqrt((strength || REF_STRENGTH) / REF_STRENGTH);
  return clamp(metres / (metresPerPixel || 50), MIN_PX, MAX_PX);
}

/**
 * Build the closed outline of a broad, swelling, tapered arrow.
 *
 * @param screenPts  the route in screen pixels
 * @param wMax       half-width at the shoulder, px
 * @param progress   0..1, how much of the advance has happened
 * @returns Path2D | null
 */
export function arrowPath(screenPts, wMax, progress = 1) {
  if (screenPts.length < 2) return null;

  const smooth = catmullRom(screenPts, 140);
  const { cum, total } = arcLength(smooth);
  if (total < 4) return null;

  // Grow head-first: rebuild the whole ribbon for a shorter centreline. A
  // filled polygon cannot be revealed with a dash offset, and a clip would
  // slice the head in half instead of moving it.
  const pts = progress >= 1 ? smooth : takeFraction(smooth, cum, total, Math.max(0.02, progress));
  const m = arcLength(pts);
  if (m.total < 4) return null;

  const norm = normals(pts);
  /* An arrow wider than it is long is a blob, not an arrow.

     Width comes from strength in metres of ground, which is right — but a
     large force moving a short distance at street zoom asks for exactly that
     shape. Four hundred militia walking the nine hundred metres down to the
     North Bridge came out as a blue lozenge with no direction in it at all.
     So the width is also bounded by the length of the march. */
  const w = Math.min(wMax, m.total * 0.13);

  // The head has to FLARE, not sharpen. This was wMax * 1.05, i.e. barbs 5%
  // wider than the shaft, which measured 26px of shaft narrowing to 10px —
  // a sharpened stick. An arrowhead reads as an arrowhead when its barbs are
  // roughly twice the shaft's half-width, so the flare is unmistakable at a
  // glance even when the arrow is small.
  const headLen = Math.min(w * 3.4, m.total * 0.32);
  const headHalf = Math.min(w * 2.0, m.total * 0.22);
  const sShaft = m.total - headLen;
  const wTail = w * 0.42;

  const halfWidth = (s) => {
    if (s <= sShaft) {
      const u = sShaft > 0 ? s / sShaft : 1;
      return wTail + (w - wTail) * smoothstep(0, 0.28, u);
    }
    // The shaft holds full width right up to the head base. `w`, not `wMax`:
    // wMax is what strength asked for before the length cap above, and using
    // it here would have let a short march escape its own cap. Unreachable as
    // the loops are written today — they stop at sShaft — but it is the kind
    // of thing that becomes reachable the day somebody changes the loop.
    return w;
  };

  const path = new Path2D();
  const shaft = [];
  for (let i = 0; i < pts.length; i++) {
    if (m.cum[i] > sShaft) break;
    shaft.push(i);
  }
  if (shaft.length < 2) shaft.push(0, 1);

  // Left edge, forward.
  for (let k = 0; k < shaft.length; k++) {
    const i = shaft[k];
    const w = halfWidth(m.cum[i]);
    const x = pts[i][0] + norm[i][0] * w;
    const y = pts[i][1] + norm[i][1] * w;
    if (k === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }

  // The head: barb, tip, barb.
  const j = shaft[shaft.length - 1];
  const tip = pts[pts.length - 1];
  path.lineTo(pts[j][0] + norm[j][0] * headHalf, pts[j][1] + norm[j][1] * headHalf);
  path.lineTo(tip[0], tip[1]);
  path.lineTo(pts[j][0] - norm[j][0] * headHalf, pts[j][1] - norm[j][1] * headHalf);

  // Right edge, back.
  for (let k = shaft.length - 1; k >= 0; k--) {
    const i = shaft[k];
    const w = halfWidth(m.cum[i]);
    path.lineTo(pts[i][0] - norm[i][0] * w, pts[i][1] - norm[i][1] * w);
  }

  path.closePath();
  return path;
}

export function drawArrow(ctx, screenPts,
                          { fill, line, strength, mpp, widthM, viewport, progress = 1, ghost }) {
  let wMax = widthForStrength(strength, mpp, widthM);
  if (viewport > 0) wMax = Math.min(wMax, viewport * MAX_VIEWPORT_FRACTION);
  const path = arrowPath(screenPts, wMax, progress);
  if (!path) return;

  ctx.save();
  if (ghost) {
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.6;
    ctx.stroke(path);
  } else {
    // A soft halo underneath gives the mass a real campaign map has. This
    // used to be ctx.filter = 'blur(5px)', which measured 39 ms PER FRAME on
    // its own — canvas filters blur the whole surface, so one arrow dropped
    // panning from 50 fps to 17. A wide translucent stroke of the same path
    // reads almost identically and costs nothing.
    // Scaled to the arrow, not fixed. At 9 px this halo was a soft glow around
    // a big arrow and a second arrow around a small one: at theatre zoom the
    // shaft clamps to 5 px, so a fixed halo more than doubled its apparent
    // width and twelve militia columns converging on Boston came out as a
    // tangle of fat blue swooshes instead of twelve arrows.
    const halo = Math.min(9, Math.max(2.5, wMax * 1.1));
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = fill;
    ctx.lineWidth = halo;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = halo * 0.5;
    ctx.stroke(path);

    ctx.globalAlpha = 0.86;
    ctx.fillStyle = fill;
    ctx.fill(path);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.25;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   Marches — a thin line drawing itself along a road
   ------------------------------------------------------------ */

export function drawMarch(ctx, screenPts, { line, progress = 1, naval, width = 3.2 }) {
  if (screenPts.length < 2) return;
  const smooth = catmullRom(screenPts, 120);
  const { cum, total } = arcLength(smooth);
  const pts = progress >= 1 ? smooth : takeFraction(smooth, cum, total, progress);
  if (pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (naval) ctx.setLineDash([1, 7]);

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  // A small head so direction is never ambiguous.
  if (!naval && pts.length > 2 && progress > 0.06) {
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const s = width * 2.6;
    ctx.setLineDash([]);
    ctx.fillStyle = line;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(b[0] - s * Math.cos(ang - 0.42), b[1] - s * Math.sin(ang - 0.42));
    ctx.lineTo(b[0] - s * Math.cos(ang + 0.42), b[1] - s * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   Fronts — a line with ticks on the side it faces
   ------------------------------------------------------------ */

export function drawFront(ctx, screenPts, { line, facing = 1, progress = 1, fluid }) {
  if (screenPts.length < 2) return;
  const smooth = catmullRom(screenPts, 130);
  const { cum, total } = arcLength(smooth);
  const pts = progress >= 1 ? smooth : takeFraction(smooth, cum, total, progress);
  if (pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = fluid ? 2.2 : 3;
  ctx.lineCap = 'round';
  if (fluid) ctx.setLineDash([9, 7]);

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  // Ticks every ~22px along the line, on the owning side.
  ctx.setLineDash([]);
  ctx.lineWidth = 2.2;
  const norm = normals(pts);
  const step = arcLength(pts);
  let next = 14;
  for (let i = 0; i < pts.length; i++) {
    if (step.cum[i] < next) continue;
    next += 22;
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i][0] + norm[i][0] * 7 * facing, pts[i][1] + norm[i][1] * 7 * facing);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   Control areas — a wash plus a hatch, so both themes read
   ------------------------------------------------------------ */

const hatches = new Map();

function hatchFor(colour) {
  if (hatches.has(colour)) return hatches.get(colour);
  const tile = document.createElement('canvas');
  tile.width = tile.height = 8;
  const c = tile.getContext('2d');
  c.strokeStyle = colour;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-2, 10); c.lineTo(10, -2);
  c.moveTo(2, 14); c.lineTo(14, 2);
  c.stroke();
  const pat = c.canvas;
  hatches.set(colour, pat);
  return pat;
}

export function drawArea(ctx, screenRings,
                         { fill, line, progress = 1, solid, strength = 1 }) {
  if (!screenRings.length) return;
  const path = ringPath(screenRings);
  if (!path) return;

  ctx.save();
  // Restrained on purpose. A control area covers most of the frame by
  // definition, so anything heavier tints the whole map and the ground stops
  // reading as ground — which looked exactly like the low-contrast basemap
  // this module was built to replace.
  ctx.globalAlpha = 0.13 * strength * progress;
  ctx.fillStyle = fill;
  ctx.fill(path, 'evenodd');

  if (!solid) {
    ctx.globalAlpha = 0.16 * strength * progress;
    const pattern = ctx.createPattern(hatchFor(line), 'repeat');
    if (pattern) { ctx.fillStyle = pattern; ctx.fill(path, 'evenodd'); }
  }

  ctx.globalAlpha = 0.85 * progress;
  ctx.strokeStyle = line;
  ctx.lineWidth = solid ? 1.2 : 1.6;
  // A control area is a claim and reads dashed; an administrative region is
  // a fact on the ground and reads solid.
  ctx.setLineDash(solid ? [] : [6, 4]);
  ctx.stroke(path);
  ctx.restore();
}

/* ------------------------------------------------------------
   Theatre glow — where the weight of the war sits
   ------------------------------------------------------------ */

/**
 * A soft radial wash marking the theatre a given year belongs to.
 *
 * Deliberately edgeless. A ring would say the fighting stopped at a line, and
 * it did not; this says "the weight is about here" and nothing more precise
 * than that, which is all anyone can honestly claim about a whole year of a
 * war fought across a seaboard.
 */
export function drawGlow(ctx, [x, y], radius, { fill, progress = 1 }) {
  if (!(radius > 0) || progress <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, fill);
  g.addColorStop(0.55, fill);
  g.addColorStop(1, fill);
  ctx.save();
  // The stops carry the shape; globalAlpha carries the strength, so the
  // colour can stay a plain token instead of needing an alpha variant.
  ctx.globalAlpha = 0.16 * progress;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  // A second, tighter pass gives the centre weight without a visible edge.
  ctx.globalAlpha = 0.1 * progress;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------
   Named regions — the political shape of the ground
   ------------------------------------------------------------ */

/**
 * Draw a whole set of named regions at once.
 *
 * Taking the set rather than one region is the point, and it is about the
 * borders. Massachusetts' western edge and New York's eastern edge are the
 * same line. Stroke each region separately and that line is painted twice,
 * a translucent stroke over a translucent stroke, so every internal border
 * comes out darker and thicker than the coastline while the outer edge of
 * the group stays thin. Thirteen colonies drawn that way look like they are
 * fighting each other for the same pixels — which is exactly what they are
 * doing.
 *
 * One stroke() call over one Path2D fixes it. Canvas builds the stroke of an
 * entire path and fills that region ONCE, so two coincident subpaths inside a
 * single call composite as one line. (Two separate calls do not, whatever the
 * geometry.) The fills still happen per region, because the colour is the
 * whole reason to tell them apart.
 *
 * This only works if the geometry actually agrees with itself: two borders a
 * few metres apart are two lines, not one, and no amount of careful drawing
 * merges them. tools/build-colonies.py simplifies the border network as a
 * network so that they do, and report_seams() there fails the build if they
 * ever stop agreeing.
 */
export function drawRegions(ctx, regions, { line, width = 1.2 } = {}) {
  if (!regions.length) return;

  const edges = new Path2D();
  let strongest = 0;

  for (const r of regions) {
    const progress = r.progress ?? 1;
    if (progress <= 0) continue;
    const path = ringPath(r.rings);
    if (!path) continue;
    strongest = Math.max(strongest, progress);
    edges.addPath(path);

    ctx.save();
    // A named region carries its identity in this fill, so it has to survive
    // being laid over olive ground. At 0.39 — what a control-area wash uses —
    // thirteen distinctly different colours arrived on screen only 4 deltaE
    // apart, because every one of them had been pulled two thirds of the way
    // back to the land underneath. Measured again at 0.62 they hold. The
    // ground still reads through it: coast, rivers and lakes are all drawn
    // darker than the wash is strong.
    ctx.globalAlpha = clamp01(0.2 * (r.strength ?? 1) * progress);
    ctx.fillStyle = r.fill;
    ctx.fill(path, 'evenodd');
    ctx.restore();
  }

  if (!strongest) return;
  ctx.save();
  ctx.globalAlpha = 0.85 * strongest;
  ctx.strokeStyle = line;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.stroke(edges);
  ctx.restore();
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Closed Path2D through a list of screen-space rings. */
function ringPath(rings) {
  const path = new Path2D();
  let any = false;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    path.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
    path.closePath();
    any = true;
  }
  return any ? path : null;
}

/* ------------------------------------------------------------
   Water crossings — chevrons pointing the way over
   ------------------------------------------------------------ */

export function drawCrossing(ctx, from, to, { line, progress = 1 }) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) * progress;
  if (len < 4) return;

  ctx.save();
  ctx.translate(from[0], from[1]);
  ctx.rotate(ang);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';

  // Two rails, then chevrons between them.
  for (const off of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(0, off);
    ctx.lineTo(len, off);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let d = 9; d < len - 3; d += 11) {
    ctx.beginPath();
    ctx.moveTo(d - 4, -4);
    ctx.lineTo(d, 0);
    ctx.lineTo(d - 4, 4);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   Battle glyphs
   ------------------------------------------------------------ */

export function drawBattle(ctx, [x, y], { line, fill, scale = 2, kind = 'battle', progress = 1 }) {
  const r = (5 + scale * 3.4) * (0.4 + 0.6 * progress);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = line;
  ctx.fillStyle = fill;
  ctx.lineWidth = 1.8;

  if (kind === 'siege') {
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'camp') {
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    // A starburst: the classic "here they met" mark.
    const spikes = 9;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? r * 0.44 : r;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   Fleets
   ------------------------------------------------------------ */

/* How big each kind of ship draws, in pixels, and how long its wake runs.

   A land march gets a thick arrow whose width means men per metre of front.
   A squadron has no front and no width — ten destroyers in a fjord are ten
   objects in a line, and drawing them as one fat arrow says something untrue
   about what was there. So a fleet is drawn as ships.

   The sizes are deliberately not to scale with each other: at the zoom a
   fjord is read at, a real destroyer is under a pixel. These are symbols
   sized to be legible and to rank correctly against each other. */
const HULLS = {
  destroyer:  { len: 15, beam: 5.0, wake: 30 },
  battleship: { len: 24, beam: 8.0, wake: 46 },
  convoy:     { len: 13, beam: 6.5, wake: 20 },
  submarine:  { len: 12, beam: 4.0, wake: 14 },
};

/**
 * A squadron under way along a track.
 *
 * The ships sit on the part of the path already travelled, in line ahead,
 * with the leader at the head of the advance — so `progress` moves the whole
 * formation up the fjord and the wakes trail behind it. Everything is derived
 * from (coords, progress), nothing accumulates, and `progress: 1` draws the
 * finished picture, which is what a seek has to produce.
 *
 * `ships` is how many are actually drawn, capped: past about eight, another
 * lozenge adds no information and the line stops reading as a line.
 */
export function drawFleet(ctx, screenPts, {
  line, fill, halo, progress = 1, ships = 3, kind = 'destroyer', spacing = 26,
} = {}) {
  if (screenPts.length < 2) return;
  const hull = HULLS[kind] || HULLS.destroyer;
  const smooth = catmullRom(screenPts, 160);
  const { cum, total } = arcLength(smooth);
  if (!total) return;

  const head = Math.max(0, Math.min(1, progress)) * total;
  const n = Math.max(1, Math.min(8, Math.round(ships)));

  // Where along the path each ship is, and which way it is pointing.
  const at = (d) => {
    const t = Math.max(0, Math.min(total, d));
    let i = 1;
    while (i < cum.length && cum[i] < t) i++;
    const a = smooth[Math.max(0, i - 1)], b = smooth[Math.min(smooth.length - 1, i)];
    const span = (cum[i] ?? total) - (cum[i - 1] ?? 0) || 1;
    const f = (t - (cum[i - 1] ?? 0)) / span;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f,
            Math.atan2(b[1] - a[1], b[0] - a[0])];
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let k = 0; k < n; k++) {
    const d = head - k * spacing;
    if (d < 0) break;                       // astern of the start: not yet under way
    const [x, y, ang] = at(d);

    // The wake first, so the hull sits on top of its own water.
    const wake = Math.min(hull.wake, d);
    if (wake > 2) {
      const [wx, wy] = at(d - wake);
      const grad = ctx.createLinearGradient(x, y, wx, wy);
      grad.addColorStop(0, line);
      grad.addColorStop(1, 'transparent');
      ctx.strokeStyle = grad;
      ctx.lineWidth = hull.beam * 0.55;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(wx, wy);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // A hull: pointed bow, square stern. Not a chevron — a chevron reads as
    // an arrowhead, and this line already has one meaning too many.
    const L = hull.len, B = hull.beam;
    // save/restore around the rotation. Composing the inverse by hand is how
    // you end up drawing the ground at half size -- setTransform REPLACES the
    // DPR transform rather than composing with it, which this repo has paid
    // for once already.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);                 // bow
    ctx.lineTo(L * 0.05, -B * 0.5);
    ctx.lineTo(-L * 0.5, -B * 0.42);
    ctx.lineTo(-L * 0.5, B * 0.42);
    ctx.lineTo(L * 0.05, B * 0.5);
    ctx.closePath();
    // A halo first, so a hull reads as an object sitting ON the track rather
    // than as a fatter dash in it. Measured the hard way: the first version
    // drew the ships in the same colour as the line they follow, and at fjord
    // zoom they were indistinguishable from the dashes.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = halo || 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = fill || line;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
