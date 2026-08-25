/* ============================================================
   turn-lab.js — the bench for the two joins.

   TWO QUESTIONS, both falsifiable, both measured on what the browser
   actually paints rather than on a class name. That distinction is the whole
   reason this file exists: `.ov-fact` was reported fixed four times running
   because every probe asked the DOM what class it had.

   1. SCENE -> SCENE. Is the stage rebuilt at the instant the scene's audio
      stops, with the veil already opaque — or --t-turn after it?

      tools/check-turn.py answers half of this already: it drives goToScene()
      by hand and measures the veil at the rebuild. What it cannot see is
      WHEN the turn starts, because it never plays a scene to its end. The
      scene used to end the instant its audio did, so all 1200 ms of the veil
      closing happened after the last word — a camera flight cued late ran on
      over a dead soundtrack and then stopped. Player.tailFor() moves the
      whole device IN_MS earlier, into the trailing silence the recording
      already has.

   2. CHAPTER -> CHAPTER. Between the tap on "next chapter" and the next
      chapter's cover, is there a frame showing neither the veil, nor a
      stage, nor a cover?

      There was, and it was not subtle: openChapter() ran teardown(), which
      emptied .story__stage and removed the end card in the same breath, and
      then AWAITED a fetch of the next chapter. So the blank lasted as long
      as the download. The measurement is one line: whenever the stage is
      empty, something opaque must be over it.

   HOW IT DRIVES

   The real app, in an iframe, same origin — not a re-implementation of the
   shell. A chapter turn is a property of engine/story.js's teardown and of
   the stylesheet's stacking order, and neither exists in a hand-built
   harness. dev/engine-lab.html mounts the stage directly because its
   question is about cues; this one's question is about the shell.

   PUT THE BUG BACK

   Both defects can be reintroduced from the panel, because a bench that has
   never been seen to fail is a bench nobody has tested. `tailFor -> 0` is
   the 1a bug exactly; throwing the card away on tap is what 1b did.
   ============================================================ */

import { IN_MS, TURN_MS } from '../engine/transition.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const el = {
  frame: $('#app'), out: $('#out'), status: $('#status'), pack: $('#pack'),
};

function status(s) { el.status.textContent = s; }
function report(html) { el.out.insertAdjacentHTML('beforeend', html); }

/**
 * Effective opacity: display, visibility and every ancestor's opacity folded
 * in. Reading `.is-on` off the node tells you what the author intended; this
 * tells you what the viewer sees.
 */
function eff(node, win) {
  if (!node) return 0;
  let o = 1;
  for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
    const cs = win.getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    o *= Number(cs.opacity);
  }
  return o;
}

async function until(fn, ms = 20000, step = 50) {
  const t0 = performance.now();
  for (;;) {
    const got = fn();
    if (got) return got;
    if (performance.now() - t0 > ms) throw new Error('timed out waiting');
    await sleep(step);
  }
}

/* ------------------------------------------------------------
   Booting the real app
   ------------------------------------------------------------ */

function reload(src) {
  return new Promise((resolve) => {
    el.frame.addEventListener('load', () => resolve(), { once: true });
    el.frame.src = src;
  });
}

async function boot(pack) {
  status('booting the app…');
  // Cache-bust so a run always starts from the front door, whatever the
  // previous run left in the URL or in the module graph.
  await reload(`../index.html?lab=${Date.now()}`);
  const doc = el.frame.contentDocument;
  const btn = await until(() => doc.querySelector(`.subject[data-pack="${pack}"]`));
  btn.click();
  await until(() => doc.querySelector('#story-map') && !doc.querySelector('.boot'), 30000);
  await sleep(1200);
  return doc;
}

/**
 * engine/story.js AS THE APP HAS IT — the live module, not a second copy.
 *
 * The eval runs in the iframe's realm, so the module registry it reaches is
 * the app's; only the URL is resolved against THIS script, which is why the
 * specifier is written from dev/ and not from the site root. Importing
 * `./engine/story.js` here asks for `/dev/engine/story.js` and 404s.
 */
function api() {
  return el.frame.contentWindow.eval("import('../engine/story.js')");
}

/* ------------------------------------------------------------
   1. The scene turn, and its tail
   ------------------------------------------------------------ */

async function sceneTurn({ bug = false } = {}) {
  const doc = el.frame.contentDocument;
  const win = el.frame.contentWindow;
  const S = await api();
  const p = S.getPlayer();
  if (!p) throw new Error('no player');

  // Any scene with one after it. Scene 1 rather than 0, because scene 0 is
  // deliberately not announced — the cover was its card.
  const i = 1;
  const scene = p.chapter.scenes[i];
  const spoken = scene.beats.at(-1);
  const silence = scene.dur - (spoken.start + spoken.dur);

  if (bug) p.tailFor = () => 0;              // the defect, exactly

  const ev = [];
  const veilNow = () => eff(doc.querySelector('.scene-wipe__veil'), win);
  const gts = p.goToScene.bind(p);
  p.goToScene = (n, o) => {
    ev.push({ kind: 'goto', n, sceneTime: p.now(), ms: performance.now() });
    return gts(n, o);
  };
  const rb = p.rebuildTo.bind(p);
  p.rebuildTo = (t, o) => {
    ev.push({ kind: 'rebuild', t, veil: veilNow(), ms: performance.now() });
    return rb(t, o);
  };

  doc.querySelector('.story__cover')?.classList.remove('is-on');
  status(`scene ${i} → ${i + 1}: running the last seconds of the audio…`);
  await p.goToScene(i, { autoplay: false, at: Math.max(0, scene.dur - 4) });
  await p.play();

  await until(() => ev.some((e) => e.kind === 'goto' && e.n === i + 1), 20000);
  await sleep(IN_MS + 600);
  p.pause();

  const turn = ev.find((e) => e.kind === 'goto' && e.n === i + 1);
  // The rebuild that belongs to the new scene: t = 0, after the turn began.
  const built = ev.find((e) => e.kind === 'rebuild' && e.ms > turn.ms);

  // Where the OLD scene's clock stood when the picture was cut. The player
  // stops reporting it the moment sceneIndex moves, so it is carried across
  // on wall time — which is the same clock the veil is fading on.
  const cutAt = built ? turn.sceneTime + (built.ms - turn.ms) / 1000 : null;
  const want = IN_MS / 1000;

  const rows = [
    ['scene', `${scene.id} — ${scene.dur.toFixed(2)} s, ${silence.toFixed(2)} s of trailing silence`],
    ['tail asked for', `${p.tailFor(scene).toFixed(2)} s`],
    ['turn began', `${(scene.dur - turn.sceneTime).toFixed(2)} s before the audio ends`],
    ['stage rebuilt at', cutAt === null ? '—' : `${cutAt.toFixed(2)} s (audio ends at ${scene.dur.toFixed(2)})`],
    ['veil at the rebuild', built ? built.veil.toFixed(3) : '—'],
    ['landed on scene', String(p.sceneIndex)],
  ];

  const fails = [];
  if (!built) fails.push('the stage was never rebuilt — the probe is testing air');
  if (built && built.veil < 0.99) {
    fails.push(`the picture was cut at veil ${built.veil.toFixed(3)} — the cut is in `
      + 'front of the device built to hide it');
  }
  if (Math.abs((scene.dur - turn.sceneTime) - want) > 0.3) {
    fails.push(`the turn began ${(scene.dur - turn.sceneTime).toFixed(2)} s before the audio `
      + `ends, not ${want.toFixed(2)} — the veil has ${want.toFixed(1)} s of closing still `
      + 'to do when the picture is already gone');
  }
  if (cutAt !== null && Math.abs(cutAt - scene.dur) > 0.35) {
    fails.push(`the stage was rebuilt ${(cutAt - scene.dur).toFixed(2)} s after the audio `
      + 'stopped, not with it');
  }
  if (silence < want) {
    fails.push(`only ${silence.toFixed(2)} s of trailing silence — a ${want.toFixed(1)} s `
      + 'tail would eat the last word');
  }
  if (p.sceneIndex !== i + 1) fails.push(`landed on scene ${p.sceneIndex}, not ${i + 1}`);

  return { title: 'Scene → scene: is the cut where the sound stops?', rows, fails };
}

/* ------------------------------------------------------------
   2. The chapter turn
   ------------------------------------------------------------ */

async function chapterTurn({ bug = false } = {}) {
  const doc = el.frame.contentDocument;
  const win = el.frame.contentWindow;
  const S = await api();
  const p = S.getPlayer();
  if (!p) throw new Error('no player');
  const from = S.getChapter()?.id;

  doc.querySelector('.story__cover')?.classList.remove('is-on');
  status('reaching the end of the chapter…');
  // The end, without playing fourteen minutes to get there. `onState` IS the
  // handler openChapter installed, so this is the same route the last scene
  // takes — not a second implementation of the ending.
  p.onState({ ...p.state(), finished: true });
  // Wait for the card to be VISIBLE, not merely present. show() writes the
  // markup immediately and only reveals it two seconds later, so the door is
  // in the DOM — and clickable, because `.story-end`'s own `display: grid`
  // beats the `hidden` attribute — a full 2 s before anyone can see it. A
  // probe that clicked it then was testing a card nobody had been shown.
  const card = await until(() => {
    const c = doc.querySelector('.story-end.is-on');
    return c && eff(c, win) > 0.9 ? c : null;
  }, 10000);
  const door = card.querySelector('.story-end__door--go');
  if (!door) {
    // A one-chapter pack has no next door, so there is no turn to measure.
    // Saying so is not the same as passing, and it is certainly not failing.
    return {
      title: 'Chapter → chapter: is there a blank frame?',
      rows: [['pack', 'one chapter only — no door to turn through']],
      fails: [],
    };
  }

  // Highest of whatever is there: during the turn the outgoing veil and the
  // incoming chapter's fresh (empty) card are both `.story-end`.
  const topmost = (sel) => Math.max(0,
    ...[...doc.querySelectorAll(sel)].map((n) => eff(n, win)));
  const shot = () => ({
    ms: performance.now(),
    veil: topmost('.story-end__veil'),
    cover: topmost('.story__cover'),
    stage: (doc.querySelector('.story__stage')?.innerHTML || '').length,
    ends: doc.querySelectorAll('.story-end').length,
  });

  const samples = [];
  // A 40 ms sampler cannot be trusted to catch this: the stage is emptied by
  // teardown() and refilled after an awaited fetch, and on a warm localhost
  // that gap is a handful of milliseconds — which is still a blank frame,
  // and still lasts as long as the download on a phone. So the moment the
  // stage changes is caught by a MutationObserver and measured THERE, and
  // the sampler only draws the shape around it.
  const obs = new win.MutationObserver(() => samples.push(shot()));
  obs.observe(doc.querySelector('.story__stage'), { childList: true });
  const timer = setInterval(() => samples.push(shot()), 40);
  const t0 = performance.now();
  samples.push(shot());

  status('tapping “next chapter”…');
  door.click();
  // The defect: the card is thrown away in the same breath as the stage.
  if (bug) doc.querySelector('.story-end')?.remove();

  await sleep(TURN_MS * 2 + 3500);
  clearInterval(timer);
  obs.disconnect();
  samples.sort((a, b) => a.ms - b.ms);
  const to = (await api()).getChapter()?.id;

  // The one assertion: whenever the stage is empty, something opaque is over
  // it. `cover` counts because the cover IS the destination — a browser will
  // not start audio without a gesture, so the turn lands on it.
  const bare = samples.filter((s) => s.stage === 0 && Math.max(s.veil, s.cover) < 0.99);
  // How long each uncovered sample stood for, i.e. until the next one. The
  // samples are not evenly spaced — the observer fires where it fires.
  const blankMs = Math.round(bare.reduce((n, s) => {
    const next = samples[samples.indexOf(s) + 1];
    return n + (next ? next.ms - s.ms : 0);
  }, 0));
  const emptyFrom = samples.find((s) => s.stage === 0);
  const worst = bare.length ? Math.min(...bare.map((s) => Math.max(s.veil, s.cover))) : 1;

  const rows = [
    ['chapter', `${from} → ${to || '—'}`],
    ['stage emptied at', emptyFrom ? `+${Math.round(emptyFrom.ms - t0)} ms` : 'never'],
    ['frames with an empty stage', String(samples.filter((s) => s.stage === 0).length)],
    ['…of those, uncovered', `${bare.length} (~${blankMs} ms)`],
    ['thinnest cover over a blank', worst.toFixed(3)],
    ['end cards at rest', String(samples.at(-1).ends)],
    ['peak veil', Math.max(...samples.map((s) => s.veil)).toFixed(3)],
  ];

  const fails = [];
  if (!emptyFrom) fails.push('the stage was never emptied — the probe is testing air');
  if (bare.length) {
    fails.push(`${bare.length} frame(s) (~${blankMs} ms) showed an empty stage through a `
      + `cover of only ${worst.toFixed(3)} — the screen passes through a blank`);
  }
  if (to && from && to === from) fails.push('the chapter never changed');
  if (samples.at(-1).ends > 1) {
    fails.push(`${samples.at(-1).ends} end cards left standing — a card that outlives its `
      + 'chapter is the musket problem in a bigger shape');
  }
  if (Math.max(...samples.map((s) => s.veil)) < 0.99) {
    fails.push('the veil never reached opaque, so it never covered anything');
  }

  return { title: 'Chapter → chapter: is there a blank frame?', rows, fails };
}

/* ------------------------------------------------------------
   Running
   ------------------------------------------------------------ */

function render(res) {
  const body = res.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  const verdict = res.fails.length
    ? res.fails.map((f) => `<p class="bad">FAIL — ${f}</p>`).join('')
    : '<p class="good">Yes.</p>';
  report(`<h3>${res.title}</h3><table>${body}</table>${verdict}`);
}

async function run(which) {
  el.out.innerHTML = '';
  const pack = el.pack.value;
  const bugTail = $('#bug-tail').checked;
  const bugChapter = $('#bug-chapter').checked;
  const results = [];
  try {
    if (which !== 'chapter') {
      await boot(pack);
      const r = await sceneTurn({ bug: bugTail });
      render(r); results.push(r);
    }
    if (which !== 'scene') {
      await boot(pack);
      const r = await chapterTurn({ bug: bugChapter });
      render(r); results.push(r);
    }
  } catch (err) {
    report(`<p class="bad">FAIL — ${err.message}</p>`);
    results.push({ title: 'run', rows: [], fails: [err.message] });
  }
  const bad = results.reduce((n, r) => n + r.fails.length, 0);
  status(bad ? `${bad} problem(s)` : 'both turns are covered');
  window.turnLab.results = results;
  window.turnLab.done = true;
  window.turnLab.failures = bad;
  return results;
}

/* Headless entry point, the shape tools/ drives the other labs by. */
window.turnLab = { run, results: null, done: false, failures: null };

(async function init() {
  // The pack list comes from the app itself rather than from a second copy
  // of content/packs.json — one registry, as engine/pack.js says.
  const packs = await fetch('../content/packs.json').then((r) => r.json());
  const ids = (packs.packs || packs).map((p) => p.id || p);
  el.pack.innerHTML = ids.map((id) => `<option value="${id}">${id}</option>`).join('');
  $('#run-all').addEventListener('click', () => run('all'));
  $('#run-scene').addEventListener('click', () => run('scene'));
  $('#run-chapter').addEventListener('click', () => run('chapter'));
  status('ready');
}());
