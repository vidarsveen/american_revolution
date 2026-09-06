/* ============================================================
   pitch-lab.js — the bench for pitch/.

   SEVEN FALSIFIABLE QUESTIONS. A lab that is only a gallery will rot, so the
   gallery is underneath and these are the point. The fifth was added after
   looking at a screenshot: four green assertions and a picture that was
   plainly wrong, which is the whole argument for still looking.

   1. Does a picture reached by PLAYING match the one reached by SEEKING?
      Rule 1, for this surface. Every scenario is run twice — once with real
      durations and waited out, once with `instant` — and the two snapshots
      must be identical. A morph is the interesting case: 2-3-5 becoming a WM
      over 1.2 s has to land on exactly the WM that `instant` draws.

   2. Is every player actually ON the pitch? A shape is placed against a line
      and a depth a cue chooses, and a high line with a deep block would
      otherwise draw its forwards in the crowd behind the goal. Checked across
      every shipped shape at the extremes of both numbers.

   3. Do the five lanes tile the width exactly? They are defined by the
      markings rather than as fifths, so a gap or an overlap between two of
      them is an arithmetic mistake that would be invisible on screen and
      would put the half-space in the wrong place.

   4. Can two dots be told apart on a phone? Measured in PIXELS at 390 x 700 —
      the height a phone browser actually hands the page, not the 844 of the
      device — for every shape, at the full view, which is the tightest one.
      Two dots closer than their own diameter are one blob and the shape is
      unreadable.

   5. Does `view` actually CROP, or does it only reposition? Measured on the
      pixels, because the other four all measure metres and none of them could
      see a full pitch's worth of markings hanging out of the bottom of a
      final-third panel. It is the same measurement that keeps two panels from
      painting over each other.

   6. Do two teams on one panel attack in opposite directions? Trivial, and it
      was wrong: an opposition placed first with an explicit `facing: 'down'`
      handed `down` to the other side as well, and on a cropped view one whole
      team was drawn outside the band and silently absent.

   `window.__pitchLab` carries the result so tools/check-pitch.py can drive
   this headless and fail a build.
   ============================================================ */

import { createPitch } from '../pitch/index.js';
import { shapeNames, shapeOf } from '../pitch/formations.js';
import { PITCH, LANES, VIEWS, fitView } from '../pitch/geometry.js';

const $ = (s) => document.querySelector(s);

/* The phone this app is designed against. CLAUDE.md: test a cover at 700 px,
   not at the device height — the address bar takes the rest. Same number here
   for the same reason. */
const PHONE = { w: 390, h: 700 };

/* ------------------------------------------------------------
   The scenarios both passes run
   ------------------------------------------------------------ */

/**
 * Each scenario is a list of [method, args]. The `over` values are real, so
 * the played pass genuinely animates and genuinely has to be waited out.
 *
 * They are chosen to cover every kind of state the surface holds: a morph, a
 * per-player move, arrows of both kinds, zones, a line that steps, the ball,
 * and more than one panel.
 */
const SCENARIOS = {
  'a shape morphing': [
    ['team', { side: 'team', shape: '2-3-5', line: 28, depth: 40 }],
    ['team', { side: 'opponent', shape: '4-4-2', line: 30 }],
    ['team', { side: 'team', shape: 'wm', line: 24, depth: 34, over: 1.2 }],
  ],
  'a press closing': [
    ['team', { side: 'team', shape: '4-3-3', line: 52, depth: 30, compact: true }],
    ['team', { side: 'opponent', shape: '4-2-3-1', line: 22 }],
    ['zone', { id: 'trap', area: 'wing-left', tone: 'gold', label: 'Pressfelle', over: 0.5 }],
    ['line', { id: 'high', at: 52, label: 'Forsvarslinja', tone: 'blue' }],
    ['line', { id: 'high', at: 60, over: 0.9 }],
    ['pass', { from: [10, 20], to: [10, 44], side: 'opponent', over: 0.6 }],
    ['run', { from: [30, 50], to: [14, 42], side: 'team', over: 0.6 }],
  ],
  'the final third': [
    ['team', { side: 'team', shape: '4-2-3-1', line: 60, depth: 38 }],
    ['lanes', { over: 0.4 }],
    ['zone', { id: 'box', area: 'box', tone: 'red', over: 0.4 }],
    ['cross', { from: [58, 100], to: [34, 94], tone: 'gold', label: 'Tilbakelegg', over: 0.7 }],
    ['ball', { at: [58, 100], over: 0.5 }],
  ],
  'one player leaving the shape': [
    ['team', { side: 'team', shape: '4-3-3', line: 40, numbers: true }],
    ['move', { side: 'team', who: 'nine', to: [34, 62], label: 'Falsk nier', over: 0.8 }],
    ['move', { side: 'team', who: 'six', mark: true }],
    ['move', { side: 'team', who: 'lb', dim: true }],
  ],
  'three panels': [
    ['setPanels', 3],
    ['team', { side: 'team', shape: '4-4-2', line: 34, panel: 0 }],
    ['team', { side: 'team', shape: '4-3-3', line: 44, panel: 1 }],
    ['team', { side: 'team', shape: '5-3-2', line: 24, panel: 2 }],
    ['zone', { area: 'middle-third', panel: 1, tone: 'sage', over: 0.4 }],
  ],
};

function apply(pitch, steps, instant) {
  for (const [method, args] of steps) {
    if (method === 'setPanels') { pitch.setPanels(args); continue; }
    pitch[method]({ ...args, ...(instant ? { instant: true, over: 0 } : {}) });
  }
}

function offscreenHost(w = PHONE.w, h = PHONE.h) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}px;height:${h}px;`;
  document.body.appendChild(el);
  return el;
}

const settle = (pitch) => new Promise((resolve) => {
  const tick = () => {
    // Draw explicitly rather than trusting a frame to have happened: rule 2
    // says a synchronous draw is the contract, and this asserts it.
    pitch.draw();
    if (pitch.settling()) requestAnimationFrame(tick);
    else resolve();
  };
  tick();
});

/* ------------------------------------------------------------
   1. Seek against play
   ------------------------------------------------------------ */

function diff(a, b, path = '') {
  const out = [];
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null) {
    return [`${path || '(root)'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  }
  if (typeof a !== 'object') {
    return a === b ? out : [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) out.push(...diff(a[k], b[k], path ? `${path}.${k}` : k));
  return out;
}

async function seekMatchesPlay() {
  const results = [];
  for (const [name, steps] of Object.entries(SCENARIOS)) {
    const hostA = offscreenHost();
    const hostB = offscreenHost();
    const played = createPitch(hostA, {});
    const seeked = createPitch(hostB, {});

    apply(played, steps, false);
    await settle(played);

    apply(seeked, steps, true);
    seeked.draw();

    const problems = diff(played.snapshot(), seeked.snapshot());
    results.push({ name, ok: !problems.length, problems: problems.slice(0, 6) });

    // And the corollary: an instant cue must leave nothing in flight. A
    // surface that animated anyway would agree with the snapshot above and
    // still show a fade after a seek.
    if (seeked.settling()) {
      results.push({ name: `${name} — nothing animating after instant`, ok: false,
        problems: ['settling() is still true'] });
    }

    played.destroy(); seeked.destroy();
    hostA.remove(); hostB.remove();
  }
  return results;
}

/**
 * A reset must leave no trace of the scene before it.
 *
 * This is the other half of rule 1 and the seek/play comparison above cannot
 * see it, because each pass gets a brand-new pitch. The app does not: a seek
 * calls `resetStage()` on the pitch that is already up, and then replays.
 *
 * So: run A, reset, run B — against a fresh pitch running only B. They must
 * be identical. `reset()` keeping the panel count was enough to break this,
 * and the symptom would have been a scene drawing three pitches when you
 * played into it and one when you scrubbed to it.
 */
async function resetLeavesNothing() {
  const names = Object.keys(SCENARIOS);
  const results = [];
  for (let i = 0; i < names.length; i += 1) {
    const before = names[i];
    const after = names[(i + 1) % names.length];
    const hostA = offscreenHost();
    const hostB = offscreenHost();
    const reused = createPitch(hostA, {});
    const fresh = createPitch(hostB, {});

    apply(reused, SCENARIOS[before], false);
    await settle(reused);
    reused.reset();
    apply(reused, SCENARIOS[after], true);
    reused.draw();

    apply(fresh, SCENARIOS[after], true);
    fresh.draw();

    const problems = diff(reused.snapshot(), fresh.snapshot());
    results.push({ name: `${before} → reset → ${after}`, ok: !problems.length,
      problems: problems.slice(0, 4) });
    reused.destroy(); fresh.destroy();
    hostA.remove(); hostB.remove();
  }
  return results;
}

/* ------------------------------------------------------------
   2. Every dot on the pitch
   ------------------------------------------------------------ */

function everyoneOnThePitch() {
  const problems = [];
  let checked = 0;
  for (const shape of shapeNames()) {
    for (const line of [0, 12, 30, 48, 62, 75]) {
      for (const depth of [10, 24, 34, 46, 58]) {
        for (const width of [0.4, 0.88, 1]) {
          const players = shapeOf(shape, { line, depth, width });
          checked += 1;
          for (const p of players) {
            if (p.x < 0 || p.x > PITCH.width || p.y < 0 || p.y > PITCH.length) {
              problems.push(`${shape} line=${line} depth=${depth} w=${width}: `
                + `${p.role || p.n} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
            }
          }
          if (players.length !== 11) {
            problems.push(`${shape}: ${players.length} players, not 11`);
          }
          // A declared numbering must be the eleven shirts, each once. A
          // typo here would put two number sixes on a pitch, which is the
          // sort of thing that survives every other check and then appears
          // in the one picture chapter two is built on.
          const nums = players.map((q) => q.num).filter((v) => v != null);
          if (nums.length && (nums.length !== 11
              || new Set(nums).size !== 11
              || Math.min(...nums) !== 1 || Math.max(...nums) !== 11)) {
            problems.push(`${shape}: shirts are ${nums.sort((a, b) => a - b).join(',')}`);
          }
        }
      }
    }
  }
  return { checked, problems: problems.slice(0, 8), ok: !problems.length };
}

/* ------------------------------------------------------------
   3. The lanes tile the pitch
   ------------------------------------------------------------ */

function lanesTile() {
  const problems = [];
  if (LANES[0].x0 !== 0) problems.push(`first lane starts at ${LANES[0].x0}, not 0`);
  const last = LANES[LANES.length - 1];
  if (Math.abs(last.x1 - PITCH.width) > 1e-9) {
    problems.push(`last lane ends at ${last.x1}, not ${PITCH.width}`);
  }
  for (let i = 1; i < LANES.length; i += 1) {
    const gap = LANES[i].x0 - LANES[i - 1].x1;
    if (Math.abs(gap) > 1e-9) {
      problems.push(`${LANES[i - 1].id} -> ${LANES[i].id}: ${gap.toFixed(4)} m of `
        + `${gap > 0 ? 'gap' : 'overlap'}`);
    }
  }
  const total = LANES.reduce((a, l) => a + (l.x1 - l.x0), 0);
  if (Math.abs(total - PITCH.width) > 1e-9) {
    problems.push(`the five lanes add up to ${total.toFixed(3)} m, not ${PITCH.width}`);
  }
  return { ok: !problems.length, problems, widths: LANES.map((l) => +(l.x1 - l.x0).toFixed(2)) };
}

/* ------------------------------------------------------------
   4. Two dots, one phone
   ------------------------------------------------------------ */

/**
 * The nearest two players in any shape, in pixels, at phone size.
 *
 * The dot radius the module draws is min(11, max(4.5, 1.6 m)), so at the full
 * view on a 390 px phone it is about 6 px and two dots need roughly 13 px
 * between their centres before they stop being one shape. Reported as a
 * number rather than only a pass/fail, because "the worst pair is 14.2 px"
 * is the sort of measurement this repo keeps having to re-derive.
 */
function dotsReadable() {
  const t = fitView({ x: 0, y: 0, w: PHONE.w, h: PHONE.h }, VIEWS.full, 8);
  const r = Math.max(4.5, Math.min(11, t.len(1.6)));
  const floor = r * 2 + 1;
  const rows = [];
  for (const shape of shapeNames()) {
    const players = shapeOf(shape, { line: 30, depth: 34, width: 0.88 });
    let worst = Infinity;
    let pair = '';
    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const [ax, ay] = t.px(players[i].x, players[i].y);
        const [bx, by] = t.px(players[j].x, players[j].y);
        const d = Math.hypot(ax - bx, ay - by);
        if (d < worst) { worst = d; pair = `${players[i].role || players[i].n}/${players[j].role || players[j].n}`; }
      }
    }
    rows.push({ shape, px: +worst.toFixed(1), pair, ok: worst >= floor });
  }
  rows.sort((a, b) => a.px - b.px);
  return { radius: +r.toFixed(1), floor: +floor.toFixed(1), rows,
    ok: rows.every((x) => x.ok) };
}

/* ------------------------------------------------------------
   5. Cropping actually crops
   ------------------------------------------------------------ */

/**
 * Is there any ink outside the panels?
 *
 * `view` crops by moving the transform, which places the band correctly and
 * does nothing at all to stop the rest of the pitch being painted below it.
 * The first screenshot of a final-third view was a whole pitch nudged down the
 * screen — the ground was the right 39 m band and the markings were all 105 m
 * of it, hanging out of the bottom. Nothing in the other four questions could
 * see that, because every one of them measures metres and this is a fact
 * about pixels.
 *
 * It is also what keeps two panels from painting over each other, which is why
 * the scenario below uses two with content deliberately outside both.
 */
function croppingCrops() {
  const host = offscreenHost();
  const p = createPitch(host, {});
  p.setPanels(2, ['final-third', 'own-half']);
  // Every one of these lives mostly outside the band its panel is showing.
  p.team({ side: 'team', shape: '4-4-2', line: 2, depth: 50, panel: 0, instant: true });
  p.lanes({ panel: 0, instant: true });
  p.zone({ area: 'own-half', tone: 'red', panel: 0, instant: true });
  p.line({ id: 'x', at: 10, panel: 0, instant: true });
  p.team({ side: 'team', shape: '4-4-2', line: 70, depth: 30, panel: 1, instant: true });
  p.pass({ from: [4, 4], to: [64, 100], panel: 1, instant: true });
  p.draw();

  const canvas = host.querySelector('.stage-pitch__canvas');
  const scale = canvas.width / host.getBoundingClientRect().width;
  const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const frames = p.frames();
  /* A pixel is an AREA, not a point, and the first version of this compared
     its top-left corner. A panel fitted to y = 366.63 then made the whole of
     row 366 "outside" while it was more than a third inside — 362 antialiased
     pixels at alpha 16, reported as a crop failure that was really a rounding
     mistake in the probe. Same family as every other measurement in this repo
     that was read at the wrong moment or against the wrong box. */
  const inside = (x, y) => {
    const x0 = x / scale;
    const y0 = y / scale;
    const x1 = (x + 1) / scale;
    const y1 = (y + 1) / scale;
    return frames.some((f) => x1 > f.x && x0 < f.x + f.w && y1 > f.y && y0 < f.y + f.h);
  };

  let outside = 0;
  let firstAt = null;
  const sample = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (inside(x, y)) continue;
      const a = img[(y * canvas.width + x) * 4 + 3];
      if (a > 8) {
        outside += 1;
        if (!firstAt) firstAt = `${Math.round(x / scale)},${Math.round(y / scale)}`;
        if (sample.length < 12) sample.push(`${(x / scale).toFixed(1)},${(y / scale).toFixed(1)} a=${a}`);
      }
    }
  }
  p.destroy();
  host.remove();
  return {
    ok: outside === 0,
    outside,
    firstAt,
    sample,
    exact: frames.map((f) => `x${f.x.toFixed(2)} y${f.y.toFixed(2)} w${f.w.toFixed(2)} h${f.h.toFixed(2)}`),
    scale,
    frames: frames.map((f) => `${Math.round(f.w)}x${Math.round(f.h)} at ${Math.round(f.x)},${Math.round(f.y)}`),
  };
}

/* ------------------------------------------------------------
   6. Two teams never attack the same way
   ------------------------------------------------------------ */

/**
 * A panel with two sides on it must have one attacking up and one down.
 *
 * Cheap, and it is here because the automatic answer got it wrong in the one
 * case that matters: the cue that places the opposition FIRST and says
 * `facing: 'down'` explicitly. The old rule handed `down` to the second side
 * as well, both shapes pointed the same way, and on a cropped view one of
 * them was drawn outside the band and was silently not on screen at all. No
 * error, no warning, eleven dots where there should have been twenty-two.
 */
function facingsOppose() {
  const cases = [
    ['team first, implicit', [{ side: 'team' }, { side: 'opponent' }]],
    ['opponent first, explicit down', [{ side: 'opponent', facing: 'down' }, { side: 'team' }]],
    ['team first, explicit down', [{ side: 'team', facing: 'down' }, { side: 'opponent' }]],
    ['both explicit', [{ side: 'team', facing: 'up' }, { side: 'opponent', facing: 'down' }]],
  ];
  const problems = [];
  for (const [name, specs] of cases) {
    const host = offscreenHost();
    const p = createPitch(host, {});
    for (const s of specs) p.team({ shape: '4-4-2', line: 30, instant: true, ...s });
    const facings = p.snapshot()[0].teams.map((t) => `${t.side}:${t.facing}`);
    const dirs = new Set(p.snapshot()[0].teams.map((t) => t.facing));
    if (dirs.size !== 2) problems.push(`${name} — ${facings.join(', ')}`);
    p.destroy(); host.remove();
  }
  return { ok: !problems.length, problems, checked: cases.length };
}

/* ------------------------------------------------------------
   7. Focus lights exactly what it names
   ------------------------------------------------------------ */

/**
 * `pitch.focus` is the surface's answer to the signalling principle, and the
 * thing it must not do is quietly light the wrong dot. Checked on the
 * snapshot's `lit` flag rather than on pixels, because the question is which
 * player the surface BELIEVES is the subject; whether that reads on screen is
 * assertion 4's job and a screenshot's.
 *
 * Also checks that it clears. A focus left standing is a chapter dimmed for
 * the rest of its scene, which is worse than no focus at all.
 */
function focusLightsWhatItNames() {
  const host = offscreenHost();
  const p = createPitch(host, {});
  p.team({ side: 'team', shape: '4-3-3', line: 30, instant: true });
  p.team({ side: 'opponent', shape: '4-4-2', line: 30, instant: true });
  const problems = [];

  const litOf = () => {
    const t = p.snapshot()[0].teams;
    return Object.fromEntries(t.map((x) => [x.side,
      x.players.filter((q) => q.lit).map((q) => q.role || q.n)]));
  };

  let all = litOf();
  if (all.team.length !== 11 || all.opponent.length !== 11) {
    problems.push(`with no focus, ${all.team.length}+${all.opponent.length} lit, not 11+11`);
  }

  p.focus({ side: 'team', who: 'six' });
  all = litOf();
  if (all.team.join() !== 'six') problems.push(`focus who=six lit [${all.team}]`);
  if (all.opponent.length) problems.push(`focus on team also lit ${all.opponent.length} opponents`);

  p.focus({ side: 'team', who: ['lb', 3] });
  all = litOf();
  if (all.team.length !== 2) problems.push(`focus on two lit ${all.team.length}`);

  p.focus({ side: 'team', who: 'nobody-by-that-name' });
  all = litOf();
  if (all.team.length !== 0) problems.push(`an unknown role lit ${all.team.length} players`);

  p.focus({});
  all = litOf();
  if (all.team.length !== 11 || all.opponent.length !== 11) {
    problems.push(`focus did not clear: ${all.team.length}+${all.opponent.length} lit`);
  }

  p.destroy(); host.remove();
  return { ok: !problems.length, problems, checked: 5 };
}

/* ------------------------------------------------------------
   Running it
   ------------------------------------------------------------ */

async function run() {
  $('#status').textContent = 'running';
  const rule1 = [...await seekMatchesPlay(), ...await resetLeavesNothing()];
  const onPitch = everyoneOnThePitch();
  const lanes = lanesTile();
  const dots = dotsReadable();
  const crop = croppingCrops();
  const facing = facingsOppose();
  const focus = focusLightsWhatItNames();

  const result = {
    rule1: { ok: rule1.every((r) => r.ok), cases: rule1 },
    onPitch,
    lanes,
    dots,
    crop,
    facing,
    focus,
  };
  result.ok = result.rule1.ok && onPitch.ok && lanes.ok && dots.ok && crop.ok && facing.ok && focus.ok;
  window.__pitchLab = result;
  render(result);
  $('#status').textContent = result.ok ? 'pass' : 'FAIL';
  $('#status').className = result.ok ? 'ok' : 'bad';
  return result;
}

function render(r) {
  const line = (ok, text) => `<li class="${ok ? 'ok' : 'bad'}">`
    + `<b>${ok ? 'PASS' : 'FAIL'}</b> ${text}</li>`;
  const out = [];

  out.push('<h3>1 · seeking matches playing</h3><ul>');
  for (const c of r.rule1.cases) {
    out.push(line(c.ok, `${c.name}${c.problems.length ? `<br><code>${c.problems.join('<br>')}</code>` : ''}`));
  }
  out.push('</ul>');

  out.push('<h3>2 · every player on the pitch</h3><ul>');
  out.push(line(r.onPitch.ok, `${r.onPitch.checked} placements`
    + `${r.onPitch.problems.length ? `<br><code>${r.onPitch.problems.join('<br>')}</code>` : ''}`));
  out.push('</ul>');

  out.push('<h3>3 · the five lanes tile the width</h3><ul>');
  out.push(line(r.lanes.ok, `widths ${r.lanes.widths.join(' / ')} m`
    + `${r.lanes.problems.length ? `<br><code>${r.lanes.problems.join('<br>')}</code>` : ''}`));
  out.push('</ul>');

  out.push(`<h3>4 · two dots on a ${PHONE.w}×${PHONE.h} phone</h3>`
    + `<p class="note">dot radius ${r.dots.radius} px, so two centres need ${r.dots.floor} px</p><ul>`);
  for (const row of r.dots.rows) {
    out.push(line(row.ok, `${row.shape} — closest pair ${row.pair} at <b>${row.px} px</b>`));
  }
  out.push('</ul>');

  out.push('<h3>5 · cropping actually crops</h3><ul>');
  out.push(line(r.crop.ok, `${r.crop.outside} lit pixels outside the panels`
    + `${r.crop.firstAt ? ` — first at ${r.crop.firstAt}` : ''}`
    + `<br><code>${r.crop.frames.join('<br>')}</code>`));
  out.push('</ul>');

  out.push('<h3>6 · two teams never attack the same way</h3><ul>');
  out.push(line(r.facing.ok, `${r.facing.checked} arrangements`
    + `${r.facing.problems.length ? `<br><code>${r.facing.problems.join('<br>')}</code>` : ''}`));
  out.push('</ul>');

  out.push('<h3>7 · focus lights exactly what it names</h3><ul>');
  out.push(line(r.focus.ok, `${r.focus.checked} cases`
    + `${r.focus.problems.length ? `<br><code>${r.focus.problems.join('<br>')}</code>` : ''}`));
  out.push('</ul>');

  $('#out').innerHTML = out.join('');
}

/* ------------------------------------------------------------
   The gallery — underneath, and not the point
   ------------------------------------------------------------ */

let live = null;

function mountLive() {
  const host = $('#frame');
  host.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'stage-pitch is-on';
  el.style.cssText = 'position:absolute;inset:0;';
  host.appendChild(el);
  live = createPitch(el, {});
  return live;
}

function scenario(name) {
  live.reset();
  live.setPanels(1);
  const steps = SCENARIOS[name];
  // The first two cues place the shapes; the rest is what the sentence does.
  apply(live, steps.slice(0, 2), true);
  setTimeout(() => apply(live, steps.slice(2), false), 250);
}

function gallery() {
  const wrap = $('#shapes');
  wrap.innerHTML = '';
  for (const shape of shapeNames()) {
    const cell = document.createElement('figure');
    cell.className = 'cell';
    cell.innerHTML = `<figcaption>${shape}</figcaption>`;
    const box = document.createElement('div');
    box.className = 'cellbox stage-pitch is-on';
    cell.appendChild(box);
    wrap.appendChild(cell);
    const p = createPitch(box, {});
    p.team({ side: 'team', shape, line: 26, depth: 40, instant: true, numbers: true });
    p.draw();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  mountLive();
  gallery();
  $('#run').addEventListener('click', () => run());
  for (const name of Object.keys(SCENARIOS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => scenario(name));
    $('#scenarios').appendChild(b);
  }
  $('#theme').addEventListener('click', () => {
    const now = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', now === 'dark' ? 'light' : 'dark');
    live?.refreshTheme();
    gallery();
  });
  scenario('a press closing');
  $('#status').textContent = 'ready';
});

window.__pitchLabRun = run;
