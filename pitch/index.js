/* ============================================================
   pitch/index.js — a football pitch with players on it.

       const pitch = createPitch(host, { panels: 1 });
       pitch.team({ side: 'team', shape: '4-2-3-1', line: 34 });
       pitch.team({ side: 'opponent', shape: '4-4-2', line: 28 });
       pitch.zone({ id: 'trap', area: 'wing-left' });
       pitch.pass({ from: 'gk', to: 'lcb', side: 'team' });

   The map module's opposite number, and the third drawing surface in the app.
   It exists because a course about tactics is eleven dots in a shape that
   MORPHS into another shape with a press closing round it, and neither the
   map (which draws countries) nor the chart (which draws bars) can say that.
   A formation that cannot move cannot show a press.

   ------------------------------------------------------------
   RULE 1: THERE ARE NO EVENTS IN HERE, ONLY STATE
   ------------------------------------------------------------

   Everything on this surface is DECLARED and persists until it is cleared or
   replaced: a shape, a zone, a line, an arrow, the ball. Nothing is a one-shot.

   That is a deliberate design decision and not an accident of what was easy.
   The map has muzzle flashes, and every one of them needed the `if (instant)
   return early` guard that CLAUDE.md's first corollary describes, because
   scrubbing back through Lexington must not fire forty muskets. A tactics
   diagram has no equivalent: a pass ARROW is not the event of a pass, it is a
   drawing of one, and a drawing should still be there when you scrub back to
   the sentence that put it up. So this module has no one-shot path at all,
   and therefore no way to get that guard wrong.

   What animates is only how a thing ARRIVES. Every animated value is a pair
   (from, to) plus a start time, read against the wall clock at draw time — so:

   · a synchronous draw at any instant is correct (rule 2). Frames make it
     smooth; they are never what makes it right, and once `over` has elapsed
     the interpolation returns `to` whether or not a frame ever fired.
   · `instant` collapses from onto to. A seek draws the finished picture.
   · replaying the cue list from the start reproduces the state exactly,
     because every verb either sets a keyed slot or clears one. Two `team`
     cues for the same side is the second one, never both.

   ------------------------------------------------------------
   PORTRAIT, AND WHY THE PANELS STACK
   ------------------------------------------------------------

   pitch/geometry.js has the argument for drawing the pitch upright. The
   consequence here is that panels stack vertically on a phone and sit side by
   side only when the host is wider than it is tall — which is a pure function
   of the host's size, so it is layout and not state, and a seek cannot
   disagree with a play about it.

   Three panels of a full pitch on a 390 px phone is 158 px of width each and
   is not worth drawing; that is what `view` is for. Chapter six compares three
   leagues on a cropped middle band, not on three whole pitches.

   ------------------------------------------------------------
   GRASS, AND WHY IT IS NOT PAPER
   ------------------------------------------------------------

   It was built paper-coloured, on the argument that every other surface in the
   app is paper and ink and a green rectangle in the middle is a different
   film. That argument lost to one sentence — "why not make the pitch green,
   that is simpler and more realistic anyway" — and it was right: a viewer
   reads green with white lines as a pitch instantly and reads a beige
   rectangle as a diagram of one. The turf, its mown stripe and the line colour
   are all tokens in css/pitch.css, so they still flip with the theme and dark
   mode still costs nothing. A team's colour comes from the pack's factions
   like every other side in this framework.
   ============================================================ */

import {
  PITCH, HALF_W, BOX_X0, BOX_X1, GOAL_AREA_X0, GOAL_AREA_X1,
  LANES, VIEWS, areaOf, fitView, flip, lerpPoint, bendControl, quadAt, numbersIn,
} from './geometry.js';
import { shapeOf, indexOf } from './formations.js';

const now = () => performance.now();

/** Clamp to 0..1 and ease. The one easing curve the app uses for arrivals. */
function ease(t) {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - ((-2 * c + 2) ** 3) / 2;
}

/**
 * An animated value: where it was, where it is going, and when it started.
 *
 * `at(time)` is the whole contract. There is no tick, no callback and nothing
 * to unsubscribe — which is why a draw can be called from a timer, from a
 * frame, or from a headless probe and give the same answer.
 */
function motion(to, from = null, over = 0) {
  return { from: from ?? to, to, t0: now(), over: Math.max(0, over) * 1000 };
}
function at(m, mix = lerpPoint) {
  if (!m) return null;
  if (!m.over) return m.to;
  const t = ease((now() - m.t0) / m.over);
  return t >= 1 ? m.to : mix(m.from, m.to, t);
}
/**
 * Where a value is GOING, as opposed to where it is.
 *
 * The distinction cost the bench its first red run, and it is worth the four
 * lines. `pitch.move` edits one player and leaves the other ten alone — so it
 * has to build the new arrangement from the previous TARGET, not from the
 * half-finished picture on screen. Reading the interpolated state instead
 * froze anybody still in flight wherever they had got to and made that their
 * destination: a chapter with a second move in the next beat left the first
 * player stranded two thirds of the way, and every seek drew the position the
 * script asked for while every play drew a different one.
 *
 * The `from` of the new motion is still the interpolated value — that is what
 * keeps it smooth — but the `to` must come from here.
 */
function target(m) { return m ? m.to : null; }

function mixNumber(a, b, t) { return a + (b - a) * t; }
function mixPlayers(a, b, t) {
  return b.map((p, i) => {
    const was = a[i] || p;
    return { ...p, x: was.x + (p.x - was.x) * t, y: was.y + (p.y - was.y) * t };
  });
}
function mixArea(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export function createPitch(host, opts = {}) {
  const {
    panels: panelCount = 1,
    view = 'full',
    numbers = false,
    lang = 'no',
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.className = 'stage-pitch__canvas';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let size = { w: 1, h: 1 };
  let dpr = 1;
  let panels = [];
  let showNumbers = !!numbers;
  let ids = 0;
  let language = lang;

  /* ---------------- panels and state ---------------- */

  function blankPanel(v) {
    return {
      view: VIEWS[v] ? v : 'full',
      /** side id -> { shape, line, depth, width, facing, players: motion } */
      teams: new Map(),
      /** which way each side attacks; first side placed goes up the screen. */
      facing: new Map(),
      zones: new Map(),
      lines: new Map(),
      arrows: new Map(),
      ball: null,
      /* What the sentence is about, and therefore what everything else is
         not. See focus(). Null means everything is lit equally, which is the
         right default and the wrong thing to leave on for a whole chapter. */
      focus: null,
    };
  }

  function setPanels(n, views) {
    const want = Math.max(1, Math.min(3, Number(n) || 1));
    const next = [];
    for (let i = 0; i < want; i += 1) {
      const v = Array.isArray(views) ? views[i] : (i === 0 ? view : undefined);
      // Keep whatever a surviving panel already had — changing the panel
      // COUNT should not wipe panel one's shapes.
      next.push(panels[i] ? { ...panels[i], view: v || panels[i].view }
        : blankPanel(v || view));
    }
    panels = next;
    schedule();
  }

  const panelAt = (i) => panels[Math.max(0, Math.min(panels.length - 1, Number(i) || 0))];

  /* ---------------- sizing ---------------- */

  function resize() {
    const r = host.getBoundingClientRect();
    size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    // SYNCHRONOUSLY, not scheduled. Assigning canvas.width clears the canvas,
    // so deferring the redraw to the next animation frame leaves one blank
    // frame on screen — which is exactly what a flicker is. Rule 2 says a draw
    // must be callable synchronously; this is the call that needs it.
    draw();
  }

  /* How much of the bottom the caption needs, as a HIGH-WATER MARK.
     
     Measured off the caption element rather than summed from --floor and
     --caption-h, for the reason --caption-reach exists: a sum of parts is wrong
     the moment a part moves. And kept as a maximum rather than read live,
     because the caption is one to three lines and a pitch that re-fits itself
     every time the line count changes is a pitch that jumps mid-sentence.
     It settles on the first three-line caption and then never moves again. */
  let floorMark = 0;
  function floorReserve() {
    const cap = document.querySelector('.captions');
    if (cap) {
      const c = cap.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      if (c.height > 0 && c.top > h.top) {
        floorMark = Math.max(floorMark, Math.round(h.bottom - c.top) + 8);
      }
    }
    // Never eat more than half the stage: a caption that tall is a different
    // problem and hiding the pitch behind it does not help anybody.
    return Math.min(floorMark, size.h * 0.5);
  }

  /**
   * Where each panel's box is.
   *
   * Stacked when the host is portrait, side by side when it is landscape.
   * Pure function of the host's size — a seek and a play cannot disagree.
   */
  function boxes() {
    const gap = panels.length > 1 ? 10 : 0;
    const usable = Math.max(80, size.h - floorReserve());
    const stack = usable >= size.w;
    const out = [];
    for (let i = 0; i < panels.length; i += 1) {
      if (stack) {
        const h = (usable - gap * (panels.length - 1)) / panels.length;
        out.push({ x: 0, y: i * (h + gap), w: size.w, h });
      } else {
        const w = (size.w - gap * (panels.length - 1)) / panels.length;
        out.push({ x: i * (w + gap), y: 0, w, h: usable });
      }
    }
    return out;
  }

  /* ---------------- colours ---------------- */

  let css = null;
  function refreshTheme() { css = null; schedule(); }
  function token(name, fallback) {
    css = css || getComputedStyle(host);
    const v = css.getPropertyValue(name).trim();
    return v || fallback;
  }

  /**
   * A side's colour.
   *
   * `--f-<side>` is published on :root by core/palette.js from the pack's
   * factions, and re-published on every theme change. A bench that mounts this
   * module without a pack has none of them — the same hole chart.js records —
   * so each side falls back through a palette ROLE and then through a design
   * token, both of which css/tokens.css always defines.
   */
  const ROLE_FALLBACK = ['--tone-blue', '--tone-red', '--tone-gold', '--tone-sage'];
  const sideOrder = new Map();
  function sideColor(side) {
    const id = String(side || 'team').replace(/[^a-z0-9]+/gi, '-');
    const declared = token(`--f-${id}`, '');
    if (declared) return declared;
    if (!sideOrder.has(id)) sideOrder.set(id, sideOrder.size);
    return token(ROLE_FALLBACK[sideOrder.get(id) % ROLE_FALLBACK.length], '#4a6fa5');
  }
  function toneColor(tone) {
    if (!tone) return token('--tone-gold', '#b8860b');
    if (/^#|^rgb|^hsl/.test(tone)) return tone;
    return token(`--tone-${tone}`, token(`--f-${tone}`, token('--tone-gold', '#b8860b')));
  }

  /* ---------------- drawing ---------------- */

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; draw(); });
  }

  /** True while any animation is still running — the lab asserts on this. */
  function settling() {
    const t = now();
    const live = (m) => m && m.over && t < m.t0 + m.over;
    return panels.some((p) => (
      [...p.teams.values()].some((s) => live(s.players))
      || [...p.zones.values()].some((z) => live(z.area) || live(z.alpha))
      || [...p.lines.values()].some((l) => live(l.at))
      || [...p.arrows.values()].some((a) => live(a.grow))
      || live(p.ball?.pos)
    ));
  }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const rects = boxes();
    panels.forEach((panel, i) => drawPanel(panel, rects[i]));
    // Rule 2: the timer, not the frame, is the contract — but while something
    // is mid-flight another frame is how it stays smooth. Once everything has
    // landed this stops asking, so an idle pitch costs nothing.
    if (settling()) schedule();
  }

  function drawPanel(panel, box) {
    const t = fitView(box, VIEWS[panel.view] || VIEWS.full, 8);
    /* CLIP TO THE PANEL, and it is not tidiness.

       `view` crops by changing the transform, which puts the band being shown
       in the right place and does nothing whatever to stop the rest of the
       pitch being painted below it. So a final-third view drew its own ground
       correctly and then laid the whole 105 m of markings and full-length
       lane washes across the panel underneath, and the picture read as an
       ordinary full pitch nudged down the screen — which is exactly what it
       looked like in the first screenshot, and what no assertion in the bench
       was asking about until one was added.

       It is also what keeps two panels apart. Without it, panel one's shapes
       paint over panel two. */
    ctx.save();
    ctx.beginPath();
    const r = Math.min(6, t.len(2));
    if (ctx.roundRect) ctx.roundRect(t.box.x, t.box.y, t.box.w, t.box.h, r);
    else ctx.rect(t.box.x, t.box.y, t.box.w, t.box.h);
    ctx.clip();

    drawGround(t);
    drawMarkings(t);
    drawDirection(t, panel);
    if (panel.focus?.area) drawFocusArea(t, panel.focus.area);
    for (const zone of panel.zones.values()) drawZone(t, zone);
    for (const line of panel.lines.values()) drawLine(t, line);
    drawCompactness(t, panel);
    for (const arrow of panel.arrows.values()) drawArrow(t, arrow);
    for (const [side, team] of panel.teams) drawTeam(t, side, team, panel);
    if (panel.ball) drawBall(t, panel.ball);
    /* Every label, after every dot.

       They used to be drawn inline, so a player drawn later covered the name
       of one drawn earlier — invisible in a shape where nobody is labelled,
       and immediately obvious in the one screenshot that named two players.
       Text is the top layer on this surface, always. */
    flushLabels();
    ctx.restore();
  }

  function drawGround(t) {
    const { x, y, w, h } = t.box;
    const r = Math.min(6, t.len(2));
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fillStyle = token('--pitch-turf', '#4a7c3c');
    ctx.fill();

    /* Mown stripes. Six bands of 17.5 m across the length of the pitch, which
       is what a roller actually leaves and what makes a green rectangle read
       as a football pitch rather than as a green rectangle. They run across
       the screen because the pitch is drawn portrait.

       Clipped to the panel and drawn in view coordinates, so a cropped view
       shows the stripes that belong to the band it is showing and not a fresh
       set starting at its own top edge. */
    ctx.save();
    ctx.clip();
    ctx.fillStyle = token('--pitch-turf-alt', '#52863f');
    const band = PITCH.length / 6;
    for (let i = 0; i < 6; i += 2) {
      const [, y0] = t.px(0, i * band);
      const [, y1] = t.px(0, (i + 1) * band);
      ctx.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0));
    }
    ctx.restore();

    /* The edge. On a full pitch the touchlines say where the grass stops; on a
       cropped one they are outside the frame, and three stacked bands of turf
       merged into one field with dots scattered down it. */
    ctx.strokeStyle = token('--pitch-line-soft', 'rgba(255,255,255,.34)');
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The markings, from the Laws of the Game.
   *
   * Drawn faint on purpose: they are the reference grid, not the subject. A
   * penalty area at full ink strength competes with the dots for attention,
   * and the dots are the sentence.
   */
  function drawMarkings(t) {
    const ink = token('--pitch-line', 'rgba(255,255,255,.78)');
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.75, t.len(0.22));
    ctx.globalAlpha = 0.85;

    const line = (x0, y0, x1, y1) => {
      ctx.beginPath();
      ctx.moveTo(...t.px(x0, y0));
      ctx.lineTo(...t.px(x1, y1));
      ctx.stroke();
    };
    const rect = (x0, y0, x1, y1) => {
      const [ax, ay] = t.px(x0, y0);
      const [bx, by] = t.px(x1, y1);
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    };

    rect(0, 0, PITCH.width, PITCH.length);
    line(0, PITCH.length / 2, PITCH.width, PITCH.length / 2);

    // Centre circle and spot.
    ctx.beginPath();
    ctx.arc(...t.px(HALF_W, PITCH.length / 2), t.len(PITCH.circle), 0, Math.PI * 2);
    ctx.stroke();
    dot(t.px(HALF_W, PITCH.length / 2), Math.max(1, t.len(0.35)), ink);

    for (const end of [0, 1]) {
      const gy = end ? PITCH.length : 0;
      const inward = end ? -1 : 1;
      rect(BOX_X0, gy, BOX_X1, gy + inward * PITCH.boxDepth);
      rect(GOAL_AREA_X0, gy, GOAL_AREA_X1, gy + inward * PITCH.goalAreaDepth);
      const spotY = gy + inward * PITCH.spot;
      dot(t.px(HALF_W, spotY), Math.max(1, t.len(0.35)), ink);

      // The D: the part of the penalty arc outside the box.
      const [cx, cy] = t.px(HALF_W, spotY);
      const boxEdgeY = gy + inward * PITCH.boxDepth;
      const dy = Math.abs(t.px(HALF_W, boxEdgeY)[1] - cy);
      const r = t.len(PITCH.circle);
      if (r > dy) {
        const a = Math.acos(dy / r);
        ctx.beginPath();
        // Screen angles: end 1 attacks up, so the arc opens downward on screen.
        const base = end ? Math.PI / 2 : -Math.PI / 2;
        ctx.arc(cx, cy, r, base - a, base + a);
        ctx.stroke();
      }

      // The goal, drawn as a heavier stub on the line.
      ctx.save();
      ctx.lineWidth = Math.max(1.6, t.len(0.6));
      ctx.globalAlpha = 1;
      line(HALF_W - PITCH.goalWidth / 2, gy, HALF_W + PITCH.goalWidth / 2, gy);
      ctx.restore();

      /* A quarter, not a circle. Drawn as a full circle it spills outside the
         touchline and the goal line — which is four small rings sitting in the
         crowd, and it is the first thing that looks wrong to anybody who has
         seen a pitch. The quadrant is the one that opens INTO the pitch, and
         because +y is up the screen the screen angles differ per corner. */
      for (const cx0 of [0, PITCH.width]) {
        // Written out rather than derived. Screen angles go clockwise from
        // +x, the pitch is drawn with +y up, and the arithmetic that folds
        // those two facts together got one of the four corners wrong on the
        // first try. A table of four cannot.
        const left = cx0 === 0;
        const [a0, a1] = end
          ? (left ? [0, Math.PI / 2] : [Math.PI / 2, Math.PI])          // far end
          : (left ? [-Math.PI / 2, 0] : [Math.PI, Math.PI * 1.5]);      // near end
        ctx.beginPath();
        ctx.arc(...t.px(cx0, gy), t.len(PITCH.cornerArc), a0, a1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function dot(pt, r, fill) {
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /**
   * Which way are we playing?
   *
   * Reported after eight chapters shipped: "you say the keeper plays it to the
   * defender and someone is attacking him, and the position is basically the
   * initial position — there is something lacking there." Half of that is
   * content and half is this: twenty-two dots on a green rectangle say nothing
   * about which end anybody is trying to reach, and every sentence in a
   * tactics course is about direction.
   *
   * Nothing here is a cue and nothing here animates. It is drawn from
   * `panel.facing`, which the team verb already maintains, so it is a pure
   * function of the state and correct after a seek by construction.
   *
   * Two signals, because one was not enough when it was tried:
   *
   * - **The goals are real goals**, drawn OUTSIDE the goal line as a box with
   *   net lines, and filled in the colour of the side that DEFENDS that end.
   *   A stub on the line reads as a marking; a goal reads as a goal, and a
   *   goal in your colour reads as yours.
   * - **Chevrons on both touchlines**, in the attacking side's colour, at the
   *   middle of whatever band the view is showing — so a cropped view still
   *   carries them.
   */
  function drawDirection(t, panel) {
    // A side facing 'up' attacks y = 105 and therefore defends y = 0.
    const defender = { 0: null, 1: null };
    for (const [side, facing] of panel.facing) {
      if (!panel.teams.has(side)) continue;
      if (facing === 'down') defender[1] = side; else defender[0] = side;
    }
    const ink = token('--pitch-line', 'rgba(255,255,255,.78)');
    /* STRADDLING the goal line, not behind it.

       Drawn wholly outside — which is where a goal is — it was invisible in
       every cropped view, because `own-half` is [0, 58.5] and anything at
       y = -2 is off the canvas. That is most of chapter one. Half in and half
       out keeps the shape of a goal and guarantees a band of it is on screen
       whatever the crop. */
    const depth = 1.7;                 // metres each side of the goal line
    const half = PITCH.goalWidth / 2;

    for (const end of [0, 1]) {
      const gy = end ? PITCH.length : 0;
      const side = defender[end];
      const [ax, ay] = t.px(HALF_W - half, gy - depth);
      const [bx, by] = t.px(HALF_W + half, gy + depth);
      const x = Math.min(ax, bx);
      const y = Math.min(ay, by);
      const w = Math.abs(bx - ax);
      const h = Math.abs(by - ay);
      if (h < 2) continue;

      ctx.save();
      if (side) {
        ctx.fillStyle = sideColor(side);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
      // The net. Three uprights and one crossbar is enough of a goal at
      // 390 px; more of it turns into a grey smear.
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1, t.len(0.28));
      ctx.globalAlpha = 0.7;
      for (let i = 1; i < 4; i += 1) {
        const nx = x + (w * i) / 4;
        ctx.beginPath(); ctx.moveTo(nx, y); ctx.lineTo(nx, y + h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1.6, t.len(0.5));
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    /* The chevrons. Drawn for the side that attacks UP the screen, which is
       the side the course is talking about — `team` unless a cue said
       otherwise. Two of them, at the middle of the VISIBLE band, so a
       final-third crop carries the same signal as a full pitch. */
    const up = [...panel.facing].find(([s, f]) => f === 'up' && panel.teams.has(s));
    if (!up) return;
    const [y0, y1] = t.view;
    const midY = (y0 + y1) / 2;
    const colour = sideColor(up[0]);
    const wide = Math.max(11, t.len(3.8));
    const tall = Math.max(8, t.len(2.8));
    const gap = Math.max(10, t.len(3.4));
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2.6, t.len(0.55));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 0.55 was invisible on a 390 px screenshot against the mown stripes,
    // which is the whole point of the thing. Looked at, not reasoned about.
    ctx.globalAlpha = 0.8;
    for (const cx of [3.4, PITCH.width - 3.4]) {
      const [px] = t.px(cx, midY);
      for (let i = 0; i < 2; i += 1) {
        // Screen y grows downward and the side attacks up, so the point of
        // the chevron is the SMALLER screen y.
        const [, base] = t.px(cx, midY);
        const yb = base + gap * (i - 0.5) + tall / 2;
        ctx.beginPath();
        ctx.moveTo(px - wide / 2, yb);
        ctx.lineTo(px, yb - tall);
        ctx.lineTo(px + wide / 2, yb);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---------------- zones ---------------- */

  function drawZone(t, zone) {
    const area = at(zone.area, mixArea);
    const alpha = at(zone.alpha, mixNumber);
    if (!area || alpha <= 0.001) return;
    const [x0, y0, x1, y1] = area;
    const [ax, ay] = t.px(x0, y0);
    const [bx, by] = t.px(x1, y1);
    const x = Math.min(ax, bx);
    const y = Math.min(ay, by);
    const w = Math.abs(bx - ax);
    const h = Math.abs(by - ay);
    const colour = toneColor(zone.tone);

    ctx.save();
    ctx.globalAlpha = alpha * 0.20;
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    if (zone.label) {
      label(pick(zone.label), x + w / 2, y + Math.min(14, h / 2) + 2, colour, alpha, 'center');
    }
  }

  /** The ground the sentence is about, lifted out of the rest. */
  function drawFocusArea(t, area) {
    const [x0, y0, x1, y1] = area;
    const [ax, ay] = t.px(x0, y0);
    const [bx, by] = t.px(x1, y1);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.min(ax, bx), Math.min(ay, by),
      Math.abs(bx - ax), Math.abs(by - ay));
    ctx.restore();
  }

  /* ---------------- tactical lines ---------------- */

  function drawLine(t, spec) {
    const y = at(spec.at, mixNumber);
    if (y == null) return;
    const colour = toneColor(spec.tone);
    const [x0, sy] = t.px(0, y);
    const [x1] = t.px(PITCH.width, y);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 5]);
    ctx.beginPath();
    ctx.moveTo(x0, sy);
    ctx.lineTo(x1, sy);
    ctx.stroke();
    ctx.restore();
    // Clear of the line, not straddling it. At -6 the backing plate sat on the
    // dashes and on whichever dot happened to be at that end.
    if (spec.label) label(pick(spec.label), x0 + 8, sy - 13, colour, 1, 'left');
  }

  /**
   * The band between the deepest and the highest line a team is holding.
   *
   * This is compactness, and it is drawn as a measured distance with the
   * number on it because chapter four's whole claim is that the number is the
   * thing being defended. Only drawn when a cue asked for it — `pitch.team`
   * sets `compact: true` — because on every shape all the time it would be
   * furniture rather than an argument.
   */
  function drawCompactness(t, panel) {
    for (const [side, team] of panel.teams) {
      if (!team.compact) continue;
      const players = at(team.players, mixPlayers);
      if (!players) continue;
      const outfield = players.filter((p) => p.role !== 'gk');
      const lo = Math.min(...outfield.map((p) => p.y));
      const hi = Math.max(...outfield.map((p) => p.y));
      const colour = sideColor(side);
      const [lx, ly] = t.px(PITCH.width, lo);
      const [, hy] = t.px(PITCH.width, hi);
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.5;
      const x = lx - 10;
      ctx.beginPath();
      ctx.moveTo(x, ly); ctx.lineTo(x, hy);
      ctx.moveTo(x - 4, ly); ctx.lineTo(x + 4, ly);
      ctx.moveTo(x - 4, hy); ctx.lineTo(x + 4, hy);
      ctx.stroke();
      ctx.restore();
      label(`${Math.round(hi - lo)} m`, x - 6, (ly + hy) / 2, colour, 1, 'right');
    }
  }

  /* ---------------- arrows ---------------- */

  /**
   * A pass and a run must not look the same.
   *
   * A pass is the ball moving: a straight solid line with a filled head. A run
   * is a person moving: bent, dashed, with an open chevron. Chapters three and
   * five are almost entirely these two marks, and a diagram that drew both as
   * "an arrow" would make the third-man run — a pass one way and a run the
   * other, at the same moment — unreadable, which is the one thing it is
   * there to explain.
   */
  function drawArrow(t, arrow) {
    const grow = at(arrow.grow, mixNumber);
    if (grow <= 0.001) return;
    const colour = arrow.tone ? toneColor(arrow.tone)
      : (arrow.side ? sideColor(arrow.side) : toneColor(null));
    const isRun = arrow.kind === 'run';
    /* Stop short of both ends.

       A run now carries the player who makes it, so the head lands exactly
       where the dot lands and is drawn UNDER it — three arrows converging on
       the ball came out as three dashed lines with no points on them, which is
       the one part of an arrow that says which way. Trimming 1.6 m off each
       end is also what a tactics board does by hand: the line belongs between
       the two men, not on top of them. */
    const [a, b] = trimmed(arrow.from, arrow.to, 1.6);
    const bend = arrow.bend ?? (isRun ? 0.16 : (arrow.kind === 'cross' ? 0.10 : 0));
    const c = bend ? bendControl(a, b, bend) : null;

    // Where the drawn part of the path ends right now.
    const end = c ? quadAt(a, c, b, grow) : lerpPoint(a, b, grow);
    const cEnd = c ? quadAt(a, c, b, grow * 0.5) : lerpPoint(a, b, grow * 0.5);

    const path = () => {
      ctx.beginPath();
      ctx.moveTo(...t.px(a.x, a.y));
      if (c) ctx.quadraticCurveTo(...t.px(cEnd.x, cEnd.y), ...t.px(end.x, end.y));
      else ctx.lineTo(...t.px(end.x, end.y));
    };

    ctx.save();
    ctx.lineCap = 'round';
    /* A dark casing under the ink.

       A faction colour is chosen by the pack, and red on green is the one
       pair that reliably disappears — the same argument the white outline on
       a dot makes, one layer out. Measured on a screenshot of chapter one: a
       red run across the mown stripes was legible on the light band and gone
       on the dark one. The casing is drawn first and wider, so the arrow has
       an edge whatever it crosses. */
    ctx.strokeStyle = 'rgba(0,0,0,.32)';
    ctx.lineWidth = (isRun ? 3.4 : 4.4) + 2.2;
    if (isRun) ctx.setLineDash([7, 6]);
    path();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = colour;
    // Measured at 390 px wide: 2.2 px of ink across a 68 m pitch is a hair,
    // and 3.2 was still being read as an annotation rather than as the
    // sentence. An arrow IS the sentence.
    ctx.lineWidth = isRun ? 3.4 : 4.4;
    if (isRun) ctx.setLineDash([7, 6]);
    path();
    ctx.stroke();
    ctx.restore();

    // The head, pointing along the last bit of the path.
    const back = c ? quadAt(a, c, b, Math.max(0, grow - 0.06)) : lerpPoint(a, b, Math.max(0, grow - 0.06));
    head(t, back, end, colour, isRun);

    /* A ball riding the head while a pass is in flight.

       The head alone moves, but a 12 px chevron sliding ten metres across a
       390 px pitch was not something a viewer noticed — the complaint was
       that nothing appeared to happen. A white disc is the thing the eye
       actually follows in a match, and it costs nothing: it is a pure
       function of `grow`, so it is absent at grow = 1 and absent after a seek,
       which is the same rule the muzzle flash obeys. */
    if (!isRun && arrow.carry !== false && grow > 0.02 && grow < 0.995) {
      const [hx, hy] = t.px(end.x, end.y);
      const br = Math.max(3.5, t.len(1.05));
      ctx.save();
      ctx.beginPath(); ctx.arc(hx, hy, br + 1.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy, br, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    }
    if (arrow.label) {
      const mid = c ? quadAt(a, c, b, 0.5) : lerpPoint(a, b, 0.5);
      const [mx, my] = t.px(mid.x, mid.y);
      label(pick(arrow.label), mx, my - 8, colour, grow, 'center');
    }
  }

  /** Pull both ends of a path in by `m` metres, when there is room for it. */
  function trimmed(from, to, m) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < m * 2.6) return [from, to];
    const ux = (dx / len) * m;
    const uy = (dy / len) * m;
    return [{ x: from.x + ux, y: from.y + uy }, { x: to.x - ux, y: to.y - uy }];
  }

  function head(t, from, to, colour, open) {
    const [x0, y0] = t.px(from.x, from.y);
    const [x1, y1] = t.px(to.x, to.y);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const s = open ? 14 : 16;
    const spread = open ? 0.5 : 0.42;
    ctx.save();
    // Same casing argument as the shaft: the head is the part that says which
    // way, and it was the part most often crossing a mown stripe.
    ctx.strokeStyle = 'rgba(0,0,0,.42)';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1 - s * Math.cos(ang - spread), y1 - s * Math.sin(ang - spread));
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - s * Math.cos(ang + spread), y1 - s * Math.sin(ang + spread));
    ctx.stroke();
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1 - s * Math.cos(ang - spread), y1 - s * Math.sin(ang - spread));
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - s * Math.cos(ang + spread), y1 - s * Math.sin(ang + spread));
    if (open) ctx.stroke(); else { ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  /* ---------------- players ---------------- */

  function drawTeam(t, side, team, panel) {
    const players = at(team.players, mixPlayers);
    if (!players) return;
    const colour = sideColor(side);
    const base = Math.max(4.5, Math.min(11, t.len(1.6)));
    for (const p of players) {
      const [x, y] = t.px(p.x, p.y);
      const on = lit(panel, side, p);
      const r = panel.focus && on ? base * FOCUS_GROW : base * 0.9;
      ctx.save();
      // A ring in the ground colour lifts a dot off a zone wash it is standing
      // in. Without it, a marker inside a shaded pressing trap loses its edge
      // and the two read as one blob.
      /* A halo on whatever the sentence is about.
         
         Dimming the other twenty-one was not enough on its own: it made the
         subject relatively brighter, which is a weaker signal than making it
         absolutely louder, and it was reported as the indications not being
         clear enough. A ring outside the dot in the line colour reads at phone
         size against turf whatever the faction colour is. */
      if (panel.focus && on) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = token('--pitch-line', 'rgba(255,255,255,.78)');
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      /* Dim by MIXING, never by alpha.

         Alpha over turf takes the hue out: at 0.32 and again at 0.45 the
         nineteen unlit dots came out as identical olive smudges and the two
         teams stopped being two teams — which is a worse failure than not
         focusing at all, and it is what "the pitch is not always easy to
         understand" was partly about. The stripes made it worse, because the
         same dot read differently depending on which mown band it stood on.
         Mixing toward the turf keeps the hue direction, is uniform across the
         stripes, and leaves the white outline at full strength. */
      const turf = token('--pitch-turf', '#4a7c3c');
      const fill = p.dim ? mixHex(colour, turf, 0.55) : colour;
      ctx.fillStyle = on ? fill : mixHex(fill, turf, FOCUS_DIM);
      ctx.fill();
      // A thin white outline, always. A faction colour is chosen by the pack
      // and can be any hue; red on green is the one pair that reliably fails
      // for a colour-blind viewer, and an outline settles it without the
      // framework having an opinion about what a side may be coloured.
      ctx.strokeStyle = p.mark ? toneColor('gold')
        : token('--pitch-line', 'rgba(255,255,255,.78)');
      ctx.lineWidth = p.mark ? 2.6 : 1.4;
      if (!on) ctx.globalAlpha = 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();

      if (p.label) {
        label(pick(p.label), x, y + r + 11, colour,
          on ? 1 : FOCUS_DIM, 'center');
      } else if ((showNumbers || team.numbers) && p.num != null) {
        // p.num, never p.n. The index is how a cue points at a dot; the shirt
        // is what the viewer reads, and only some shapes have one.
        ctx.save();
        if (!on) ctx.globalAlpha = FOCUS_DIM;
        numberIn(String(p.num), x, y, r);
        ctx.restore();
      }
    }
    void panel;
  }

  function numberIn(text, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.15)}px ${fontStack()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  function drawBall(t, ball) {
    const pos = at(ball.pos);
    if (!pos) return;
    const [x, y] = t.px(pos.x, pos.y);
    const r = Math.max(3, t.len(0.9));
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + 1.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- text ---------------- */

  function fontStack() {
    return token('--font-ui', 'system-ui, -apple-system, "Segoe UI", sans-serif');
  }

  /**
   * A label with a paper backing plate.
   *
   * The plate is not decoration. A zone name over a shaded wash over the
   * markings is three layers of low-contrast ink, and the repo has already
   * paid for one label that was drawn, measured, ranked and unreadable.
   */
  /** Queued by label(), painted by flushLabels() at the end of the panel. */
  let labelQueue = [];
  function label(...args) { labelQueue.push(args); }
  function flushLabels() {
    const queued = labelQueue;
    labelQueue = [];
    for (const args of queued) paintLabel(...args);
  }

  function paintLabel(text, x, y, colour, alpha = 1, align = 'center') {
    if (!text || alpha <= 0.05) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    const px = Math.max(10, Math.round(parseFloat(token('--fs-3xs', '11px'))) || 11);
    ctx.font = `600 ${px}px ${fontStack()}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    const padX = 4;
    const bx = align === 'center' ? x - w / 2 - padX
      : align === 'right' ? x - w - padX : x - padX;
    ctx.fillStyle = token('--paper-raised', '#f8f3e7');
    ctx.globalAlpha = Math.min(1, alpha) * 0.88;
    const bh = px + 6;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(bx, y - bh / 2, w + padX * 2, bh, 4);
      ctx.fill();
    } else {
      ctx.fillRect(bx, y - bh / 2, w + padX * 2, bh);
    }
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function pick(field) {
    if (field == null) return '';
    if (typeof field === 'string' || typeof field === 'number') return String(field);
    return field[language] ?? field.no ?? field.en ?? '';
  }

  /** Blend two CSS colours without a canvas round-trip for the common case. */
  function mixHex(a, b, t) {
    const pa = parseColor(a);
    const pb = parseColor(b);
    if (!pa || !pb) return a;
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function parseColor(c) {
    const s = String(c).trim();
    let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m) return m[1].split(/[,\s/]+/).slice(0, 3).map(Number);
    return null;
  }

  /* ---------------- resolving what a cue points at ---------------- */

  /**
   * A point, from whatever the cue gave.
   *
   * `[x, y]` in metres, `{x, y}`, or a player: `{ who: 'six', side: 'team' }`
   * — or just a role string when the cue already names a side. Returns null
   * rather than guessing, and every caller treats null as "do nothing", so a
   * mistyped role is a missing arrow and never a broken chapter.
   */
  function pointOf(spec, panel, defaultSide) {
    if (spec == null) return null;
    if (typeof spec === 'object' && !Array.isArray(spec) && spec.x != null && spec.y != null) {
      return { x: Number(spec.x), y: Number(spec.y) };
    }
    // Two numbers, however they arrived. See numbersIn(): the prose format has
    // no arrays, so `to=[34,22]` reaches here as text and used to resolve to
    // nothing at all.
    const n = (Array.isArray(spec) || typeof spec === 'string') ? numbersIn(spec, 2) : null;
    if (n) return { x: n[0], y: n[1] };
    const who = typeof spec === 'object' ? spec.who : spec;
    const side = (typeof spec === 'object' && spec.side) || defaultSide;
    const team = panel.teams.get(side);
    if (!team) return null;
    // The TARGET, for the same reason move() uses it: an arrow drawn from the
    // six to the eight while the shape is still morphing must point at where
    // they are going, or a seek and a play disagree about where it starts.
    const players = target(team.players);
    const i = indexOf(players, who);
    if (i < 0) return null;
    return { x: players[i].x, y: players[i].y };
  }

  /* ---------------- the verbs, as methods ---------------- */

  /**
   * Place or re-place a team.
   *
   * Calling it twice for the same side is a MORPH: the previous positions
   * become the `from` and the new ones the `to`. That is the only way chapter
   * two exists — 2-3-5 becoming a WM has to be one shape turning into another,
   * not a cut between two pictures.
   */
  function team(spec = {}) {
    const panel = panelAt(spec.panel);
    const side = String(spec.side || 'team');
    if (!panel.facing.has(side)) {
      /* Take the direction nobody has taken.

         This was "the first side goes up, everyone after goes down", which is
         right until the first cue says `facing: 'down'` itself — and then the
         second team took `down` as well, both shapes attacked the same way,
         and one of them was drawn off the end of a cropped view and simply
         was not there. Found by looking at a screenshot with eleven dots in
         it that should have had twenty-two.

         Still deterministic in cue order, which is what a replay needs. */
      const taken = new Set(panel.facing.values());
      panel.facing.set(side, taken.has('up') ? 'down' : 'up');
    }
    const facing = spec.facing || panel.facing.get(side);
    panel.facing.set(side, facing);

    const shape = spec.shape || panel.teams.get(side)?.shape || '4-2-3-1';
    const conf = {
      line: spec.line ?? panel.teams.get(side)?.line ?? 30,
      depth: spec.depth ?? panel.teams.get(side)?.depth ?? 34,
      width: spec.width ?? panel.teams.get(side)?.width ?? 0.88,
    };
    let players = shapeOf(shape, conf);
    if (facing === 'down') players = players.map((p) => ({ ...flip(p), n: p.n, role: p.role }));

    const prev = panel.teams.get(side);
    const from = prev ? at(prev.players, mixPlayers) : null;
    panel.teams.set(side, {
      shape, ...conf, facing,
      numbers: spec.numbers ?? prev?.numbers ?? false,
      compact: spec.compact ?? prev?.compact ?? false,
      players: motion(players, from, spec.instant ? 0 : (spec.over ?? 0)),
    });
    schedule();
  }

  function clearTeam(spec = {}) {
    const panel = panelAt(spec.panel);
    if (spec.side) panel.teams.delete(String(spec.side));
    else { panel.teams.clear(); panel.facing.clear(); }
    schedule();
  }

  /**
   * Move one player, or mark one.
   *
   * The false nine, the full-back stepping inside, the six dropping between
   * the centre-backs — every one of them is one dot leaving the shape it was
   * drawn in, and that is the picture the sentence is making.
   */
  function move(spec = {}) {
    const panel = panelAt(spec.panel);
    const side = String(spec.side || 'team');
    const entry = panel.teams.get(side);
    if (!entry) return;
    // Where everybody is going, and separately where they are right now. See
    // target() — building `next` from the on-screen positions is the bug the
    // bench caught first.
    const going = target(entry.players);
    const current = at(entry.players, mixPlayers);
    const i = indexOf(going, spec.who);
    if (i < 0) return;
    const next = going.map((p) => ({ ...p }));
    if (spec.to) {
      const pt = pointOf(spec.to, panel, side);
      if (pt) { next[i].x = pt.x; next[i].y = pt.y; }
    }
    if (spec.label !== undefined) next[i].label = spec.label;
    if (spec.mark !== undefined) next[i].mark = !!spec.mark;
    if (spec.dim !== undefined) next[i].dim = !!spec.dim;
    panel.teams.set(side, {
      ...entry,
      players: motion(next, current, spec.instant ? 0 : (spec.over ?? 0)),
    });
    schedule();
  }

  /** Did `spec.from` name a PLAYER, rather than give metres? */
  function playerRef(from, defaultSide) {
    if (from == null) return null;
    if (Array.isArray(from)) return null;
    // Two numbers is a place, not a person, however it arrived.
    if (typeof from === 'string' && numbersIn(from, 2)) return null;
    if (typeof from === 'object') {
      if (from.x != null && from.y != null) return null;
      return from.who != null ? { side: String(from.side || defaultSide), who: from.who } : null;
    }
    return { side: String(defaultSide), who: from };
  }

  /**
   * An arrow, and the thing the arrow is a drawing OF.
   *
   * The pitch shipped eight chapters drawing arrows over a shape that never
   * moved, and it was reported exactly right: "there is someone attacking him
   * and the position is basically the initial position — something is
   * lacking." An arrow was a caption on a still picture.
   *
   * So the two arrows that describe motion now cause it, over the arrow's own
   * duration so the two agree frame for frame:
   *
   * - a **run** carries the player who starts it, because that is what a run
   *   is. Only when `from` NAMES a player — an explicit [x, y] is a drawing of
   *   a run by nobody in particular, which several chapters use deliberately.
   * - a **pass** or a **cross** carries the ball, when there is a ball on the
   *   pitch to carry.
   *
   * Both go through the existing `move()` and `ball()`, so both are motions
   * built from the TARGET and both land exactly on it under `instant` — which
   * is what keeps a seek and a play agreeing (rule 1). `carry: false` opts
   * out, for the case where the arrow really is only an annotation.
   */
  function arrow(spec = {}, kind) {
    const panel = panelAt(spec.panel);
    const side = spec.side ? String(spec.side) : null;
    const from = pointOf(spec.from, panel, side || 'team');
    const to = pointOf(spec.to, panel, side || 'team');
    if (!from || !to) return;
    const id = spec.id || `a${ids += 1}`;
    const over = spec.over ?? 0.6;
    panel.arrows.set(id, {
      from, to, kind, side, tone: spec.tone, bend: spec.bend, label: spec.label,
      carry: spec.carry,
      grow: motion(1, 0, spec.instant ? 0 : over),
    });

    if (spec.carry !== false) {
      if (kind === 'run') {
        const ref = playerRef(spec.from, side || 'team');
        if (ref) {
          move({ side: ref.side, who: ref.who, to: [to.x, to.y],
            over, instant: spec.instant, panel: spec.panel });
        }
      } else if (panel.ball) {
        ball({ at: [to.x, to.y], over, instant: spec.instant, panel: spec.panel });
      }
    }
    schedule();
  }

  function zone(spec = {}) {
    const panel = panelAt(spec.panel);
    const area = areaOf(spec.area);
    if (!area) return;
    const id = spec.id || `z${ids += 1}`;
    const prev = panel.zones.get(id);
    panel.zones.set(id, {
      tone: spec.tone, label: spec.label,
      area: motion(area, prev ? at(prev.area, mixArea) : area,
        spec.instant ? 0 : (spec.over ?? 0)),
      alpha: motion(1, prev ? at(prev.alpha, mixNumber) : 0,
        spec.instant ? 0 : (spec.over ?? 0.5)),
    });
    schedule();
  }

  function lanes(spec = {}) {
    // The five-lane pitch, as five zones with one cue. Chapter five draws it
    // once and then talks about lane two for four beats.
    LANES.forEach((l, i) => zone({
      ...spec,
      id: `lane-${i}`,
      area: l.id,
      tone: i % 2 ? 'sage' : 'gold',
      label: undefined,
    }));
  }

  function hideZone(spec = {}) {
    const panel = panelAt(spec.panel);
    if (!spec.id) { panel.zones.clear(); schedule(); return; }
    const z = panel.zones.get(spec.id);
    if (!z) return;
    z.alpha = motion(0, at(z.alpha, mixNumber), spec.instant ? 0 : (spec.over ?? 0.4));
    schedule();
  }

  function line(spec = {}) {
    const panel = panelAt(spec.panel);
    const id = spec.id || `l${ids += 1}`;
    const prev = panel.lines.get(id);
    const y = spec.at != null ? Number(spec.at) : null;
    if (y == null) return;
    panel.lines.set(id, {
      tone: spec.tone, label: spec.label,
      at: motion(y, prev ? at(prev.at, mixNumber) : y, spec.instant ? 0 : (spec.over ?? 0)),
    });
    schedule();
  }

  function ball(spec = {}) {
    const panel = panelAt(spec.panel);
    const pt = pointOf(spec.at ?? spec.who ?? spec, panel, spec.side || 'team');
    if (!pt) return;
    const prev = panel.ball;
    panel.ball = { pos: motion(pt, prev ? at(prev.pos) : pt, spec.instant ? 0 : (spec.over ?? 0)) };
    schedule();
  }

  /**
   * Say where to look.
   *
   * The signalling principle, and the gap that made a whole chapter mute: the
   * narration said "somebody behind is now free" over twenty-two identical
   * dots and pointed at none of them. A diagram that shows everything equally
   * is a diagram that shows nothing, and the viewer spends their attention
   * finding the subject instead of understanding it.
   *
   * `who` is a list of roles or shirt numbers on `side`; `area` is a named
   * area or four metres. Everything not named draws at `FOCUS_DIM`. Called
   * with neither, it clears — and it must be cleared, because a focus left
   * standing across a scene is a permanent dimming nobody asked for.
   *
   * State, not an effect: keyed on the panel, replayed identically after a
   * seek, and `instant` has nothing to do because there is nothing to animate
   * except the opacity the stylesheet already owns.
   */
  function focus(spec = {}) {
    const panel = panelAt(spec.panel);
    const who = spec.who == null ? []
      : (Array.isArray(spec.who) ? spec.who : String(spec.who).split(/[,\s]+/));
    const area = spec.area ? areaOf(spec.area) : null;
    panel.focus = (who.length || area)
      ? { side: spec.side ? String(spec.side) : null, who, area }
      : null;
    schedule();
  }

  /* How far back an unlit thing goes. Not zero: it is still the picture.

     How far an unlit dot is mixed TOWARD the turf — not an alpha. See the
     fill in drawTeam() for why that distinction is the whole point — it was one of
     the things behind "the pitch is not always easy to understand". The lit
     dots grow instead (see FOCUS_GROW), because making the subject louder is
     a stronger signal than making everything else quieter. */
  const FOCUS_DIM = 0.5;

  /** How much bigger the thing the sentence is about is drawn. */
  const FOCUS_GROW = 1.22;

  /** Is this player the one being talked about? */
  function lit(panel, side, player) {
    const f = panel.focus;
    if (!f) return true;
    if (f.side && f.side !== side) return false;
    if (!f.who.length) return false;
    return f.who.some((w) => String(w) === String(player.n)
      || String(w).toLowerCase() === String(player.role || '').toLowerCase());
  }

  function clear(spec = {}) {
    const panel = panelAt(spec.panel);
    panel.arrows.clear();
    panel.zones.clear();
    panel.lines.clear();
    panel.ball = null;
    panel.focus = null;
    schedule();
  }

  /**
   * Back to the slate this pitch was mounted with.
   *
   * NOT back to whatever was on it a moment ago, which is what this did first
   * and is a rule-1 violation with a long fuse. `resetStage()` runs before a
   * seek replays a scene's cues, so if it kept the panel count, a scene that
   * says `pitch.show` without saying `panels` would get three panels when you
   * played into it from a three-panel scene and one when you seeked straight
   * to it. Same cue list, two pictures, and nothing in the chapter to hint at
   * it. The slate is the pack's default, always.
   */
  function reset() {
    ids = 0;
    sideOrder.clear();
    showNumbers = !!numbers;
    panels = [];
    setPanels(panelCount, Array.isArray(view) ? view : null);
    schedule();
  }

  /* ---------------- lifecycle ---------------- */

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(host);
  setPanels(panelCount, Array.isArray(view) ? view : null);
  resize();

  /**
   * What is on screen, as data.
   *
   * dev/pitch-lab.html compares this between playing forward and seeking, so
   * it deliberately leaves out everything that is a statement about DRAWING
   * TIME rather than about identity: no `t0`, no `over`, no in-flight
   * interpolation. Positions are rounded to a tenth of a metre, which is a
   * twentieth of a pixel at phone size and well under anything a viewer could
   * see — comparing raw floats would report easing arithmetic as a defect.
   */
  function snapshot() {
    const r1 = (v) => Math.round(v * 10) / 10;
    return panels.map((p) => ({
      view: p.view,
      focus: p.focus ? { side: p.focus.side, who: p.focus.who.map(String),
                         area: p.focus.area ? p.focus.area.map(r1) : null } : null,
      teams: [...p.teams].map(([side, s]) => ({
        side, shape: s.shape, line: s.line, depth: s.depth, width: s.width,
        facing: s.facing, compact: !!s.compact,
        players: (at(s.players, mixPlayers) || []).map((q) => ({
          n: q.n, num: q.num ?? null, role: q.role, x: r1(q.x), y: r1(q.y),
          lit: lit(p, side, q),
          label: q.label ? pick(q.label) : undefined,
          mark: q.mark || undefined, dim: q.dim || undefined,
        })),
      })),
      zones: [...p.zones].map(([id, z]) => ({
        id, tone: z.tone || null, label: z.label ? pick(z.label) : null,
        area: (at(z.area, mixArea) || []).map(r1),
        on: at(z.alpha, mixNumber) > 0.5,
      })),
      lines: [...p.lines].map(([id, l]) => ({
        id, at: r1(at(l.at, mixNumber)), tone: l.tone || null,
        label: l.label ? pick(l.label) : null,
      })),
      arrows: [...p.arrows].map(([id, a]) => ({
        id, kind: a.kind, side: a.side || null,
        from: { x: r1(a.from.x), y: r1(a.from.y) },
        to: { x: r1(a.to.x), y: r1(a.to.y) },
        label: a.label ? pick(a.label) : null,
      })),
      ball: p.ball ? (() => { const b = at(p.ball.pos); return { x: r1(b.x), y: r1(b.y) }; })() : null,
    }));
  }

  return {
    team, clearTeam, move, zone, lanes, hideZone, line, ball, focus, clear, reset,
    pass: (s) => arrow(s, 'pass'),
    run: (s) => arrow(s, 'run'),
    cross: (s) => arrow(s, 'cross'),
    setPanels,
    setView(i, v) { panelAt(i).view = VIEWS[v] ? v : 'full'; schedule(); },
    setNumbers(on) { showNumbers = !!on; schedule(); },
    setLang(l) { language = l || language; schedule(); },
    invalidate: resize,
    refreshTheme,
    /** Nothing is fetched, so the ground is always there. Kept for symmetry
     *  with the map, whose ready() every probe in this repo waits on. */
    ready: () => true,
    settling,
    draw,
    snapshot,
    /** Where each panel's pitch is actually drawn, in CSS pixels. The lab
     *  measures ink outside these to prove that `view` crops rather than
     *  merely repositions — which is what it did until it was measured. */
    frames: () => boxes().map((b, i) => fitView(b, VIEWS[panels[i].view] || VIEWS.full, 8).box),
    panelCount: () => panels.length,
    destroy() { ro?.disconnect(); canvas.remove(); },
  };
}
