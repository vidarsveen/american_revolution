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
  // The head has to FLARE, not sharpen. This was wMax * 1.05, i.e. barbs 5%
  // wider than the shaft, which measured 26px of shaft narrowing to 10px —
  // a sharpened stick. An arrowhead reads as an arrowhead when its barbs are
  // roughly twice the shaft's half-width, so the flare is unmistakable at a
  // glance even when the arrow is small.
  const headLen = Math.min(wMax * 3.4, m.total * 0.32);
  const headHalf = wMax * 2.0;
  const sShaft = m.total - headLen;
  const wTail = wMax * 0.42;

  const halfWidth = (s) => {
    if (s <= sShaft) {
      const u = sShaft > 0 ? s / sShaft : 1;
      return wTail + (wMax - wTail) * smoothstep(0, 0.28, u);
    }
    return wMax;   // the shaft holds full width right up to the head base
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
                          { fill, line, strength, mpp, widthM, progress = 1, ghost }) {
  const wMax = widthForStrength(strength, mpp, widthM);
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
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = fill;
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 4.5;
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
  const path = new Path2D();
  for (const ring of screenRings) {
    if (ring.length < 3) continue;
    path.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
    path.closePath();
  }

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
