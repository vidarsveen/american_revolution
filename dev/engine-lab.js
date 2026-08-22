/* ============================================================
   engine-lab.js — the bench for the rule the whole engine rests on.

   ONE QUESTION:

     Does rebuildTo(t) produce the same picture as playing forward to t?

   Rule 1 says the picture is a function of time, not a history of events.
   Seeking wipes the stage and re-applies every cue up to that point with
   `instant: true`; playing forward applies the same cues with `instant:
   false`. If those two ever disagree about WHAT IS ON THE STAGE, scrubbing
   shows something that never happened — and every bug of that shape has so
   far been found by eye, late, after an afternoon of looking.

   The comparison is a *stage signature*: every layer, every artifact, every
   declared property, serialised in a fixed order. Two things are deliberately
   left out of it:

     t0, instant   the animation phase. Playing forward starts a 2.6 s march;
                   seeking draws it whole. That difference is the design, not
                   a defect — what must match is the artifact and its
                   properties, not how far along it happens to be.

     the camera    a continuous value the engine animates on purpose, and a
                   seek re-applies the framing cues anyway. dev/map-lab.html
                   is where the camera is measured. A lab that answers two
                   questions answers neither.

   Everything else is in, including the overlay DOM, because a stat chip that
   survives a seek is exactly the kind of thing that used to.
   ============================================================ */

import { loadChapter } from '../engine/script.js';
import { mountStage, resetStage, applyCue } from '../engine/stage.js';
import { getStoryMap } from '../engine/scenes/map.js';
import { getSoundscape } from '../engine/scenes/sound.js';
import { Player } from '../engine/player.js';
import { allChapters, useRegistry } from '../engine/pack.js';
import { mountDepth, unmountDepth, open as openDepth,
         depthIsOpen } from '../engine/depth.js';
import * as era from '../core/era.js';

/* Every narrated chapter of every pack, from content/packs.json. Filled in
   at boot, so this page never knows what subject it is benching. */
let CHAPTERS = [];

/* Layer order is fixed so the signature is stable across runs. */
const LAYERS = ['areas', 'roads', 'fronts', 'marches', 'arrows', 'crossings',
  'battles', 'places', 'units', 'regions', 'markers', 'highlights',
  'pins', 'glows'];

/* The animation phase, and nothing else. See the header.

   `over` is in here because some handlers derive it from `instant` —
   engine/scenes/map.js:507 sets `over: instant ? 0 : 0.7` on the battle
   glyph, which is the same statement as `t0`: how long this takes to draw
   itself in. Comparing it would report the correct behaviour as a defect,
   which the first run of this bench duly did. */
const VOLATILE = new Set(['t0', 'instant', 'over']);

/* One-shot surfaces. A note shows itself for four seconds and takes itself
   away; a rebuild must NOT put it back. So the two passes are *supposed* to
   differ here, and including them in the signature would flag the rule being
   kept as the rule being broken. They get their own check instead. */
const ONE_SHOT_DOM = ['.ov-note', '.atlas__flash'];

const $ = (sel) => document.querySelector(sel);
const el = {
  stage: null, out: null, status: null, chapter: null,
};

let chapter = null;
let player = null;
let people = [];

/* ------------------------------------------------------------
   The signature
   ------------------------------------------------------------ */

/** A short, order-independent digest of a coordinate list. */
function hashCoords(v) {
  let h = 2166136261;
  const walk = (x) => {
    if (Array.isArray(x)) { for (const y of x) walk(y); return; }
    // Round before hashing: a coordinate that survives a round trip through
    // JSON must hash the same as one that did not.
    const n = typeof x === 'number' ? Math.round(x * 1e6) : String(x).length;
    h = Math.imul(h ^ (n & 0xff), 16777619);
    h = Math.imul(h ^ ((n >>> 8) & 0xff), 16777619);
    h = Math.imul(h ^ ((n >>> 16) & 0xff), 16777619);
  };
  walk(v);
  return (h >>> 0).toString(36);
}

function fieldSig(key, value) {
  if (value == null) return `${key}=null`;
  if (Array.isArray(value)) return `${key}=[${value.length}:${hashCoords(value)}]`;
  if (typeof value === 'object') return `${key}={${hashCoords(Object.values(value))}}`;
  return `${key}=${value}`;
}

function specSig(spec) {
  const keys = Object.keys(spec).filter((k) => !VOLATILE.has(k)).sort();
  return keys.map((k) => fieldSig(k, spec[k])).join(' ');
}

/**
 * Everything standing on the stage, as one comparable string.
 *
 * Sorted by id within each layer, because insertion order is a history of
 * events and this is supposed to be a function of time. A picture that only
 * matches when the cues arrived in one particular order is exactly the bug.
 */
function signature() {
  const map = getStoryMap();
  const lines = [];
  if (map) {
    for (const name of LAYERS) {
      const layer = map[name];
      if (!layer) continue;
      const all = layer.all().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      for (const spec of all) lines.push(`${name}/${spec.id}  ${specSig(spec)}`);
    }
  }
  // The overlay decks are stage state too — a stat chip or a portrait that
  // survives a seek is the same class of defect as an arrow that does. The
  // one-shot surfaces are deliberately absent; see ONE_SHOT_DOM.
  for (const sel of ['.ov-deck--upper', '.ov-deck--lower', '.ov-portrait',
    '.ov-image', '.ov-quote']) {
    for (const node of document.querySelectorAll(sel)) {
      lines.push(`dom/${sel}  ${stateClasses(node)}  ${normaliseHtml(node.innerHTML)}`);
    }
  }
  // The plate is the whole screen, and it was not in here at all. It was
  // added after this bench was written, so for two subjects and four
  // chapters the one surface that can hide the entire map was the one
  // surface nothing checked. Which picture, and whether it is up -- but NOT
  // the inline transform, which is the drift, and therefore animation phase:
  // the same exclusion as `over` on a route.
  for (const node of document.querySelectorAll('.stage-plate')) {
    const img = node.querySelector('.plate__img');
    const src = ((img && img.getAttribute('src')) || '').split('/').pop();
    lines.push(`dom/.stage-plate  ${stateClasses(node)}  src=${src}`);
  }
  return lines.join('\n');
}

/**
 * Overlay markup, with the one-frame marker taken out of every class list.
 *
 * `is-instant` says "this appeared without animating", which is exactly the
 * intended difference between seeking and playing — so comparing it reports
 * the rule being kept as the rule being broken. stateClasses() strips it from
 * the container; this strips it from every element INSIDE the container,
 * which is where the stat chip carries it.
 *
 * It hid for a while because engine/scenes/overlays.js sets `is-instant` when
 * `instant || reduced()`, so under prefers-reduced-motion BOTH passes get it
 * and the two agree by accident. The bench only ever ran with reduced motion
 * forced. tools/check-engine.py now runs both ways for that reason.
 *
 * Classes are sorted while we are here: their order is an implementation
 * detail, not part of the picture.
 */
function normaliseHtml(html) {
  return String(html)
    .replace(/class="([^"]*)"/g, (_, list) => {
      const kept = list.split(/\s+/).filter((c) => c && c !== 'is-instant').sort();
      return `class="${kept.join(' ')}"`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * An overlay's classes, minus the one that lasts a single frame.
 *
 * show() in engine/scenes/overlays.js adds `is-instant` and removes it on the
 * next animation frame, so whether it is present says only whether a frame
 * happened to fire between applying the cue and looking — not what is on
 * screen. It landed on the played side in one scene and the sought side in
 * the next, which is what a race looks like when you write it down.
 */
function stateClasses(node) {
  return [...node.classList].filter((c) => c !== 'is-instant').sort().join(' ');
}

/* ------------------------------------------------------------
   Driving the engine
   ------------------------------------------------------------ */

/**
 * Let pending work land.
 *
 * `region.show` awaits a memoised promise, so the picture is one or two
 * microtask turns behind the last cue — not a timer. Draining microtasks
 * rather than sleeping matters more than it looks: at one setTimeout per
 * sample this bench spent seven and a half minutes waiting for the event loop
 * and about ten seconds comparing anything.
 */
async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
}

/** A real wait, for when something is genuinely on a timer. */
const settleSlow = (ms = 40) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until the picture stops changing, and say so if it never does.
 *
 * "Settled" has to be measured, not assumed after a round number of
 * milliseconds. The first version of the epoch check took its baseline 400 ms
 * after a cold seek and reported the engine as broken, when what had actually
 * happened was that a 372 KB region file had not finished parsing yet — the
 * bench racing the thing it was timing.
 */
async function quiesce({ every = 120, tries = 25, stable = 2 } = {}) {
  let last = signature();
  let same = 0;
  for (let i = 0; i < tries; i += 1) {
    await settleSlow(every);
    const now = signature();
    same = now === last ? same + 1 : 0;
    last = now;
    // Two consecutive matches, not one: a slow fetch that has not resolved
    // yet also looks perfectly stable, and did.
    if (same >= stable) return { sig: now, settled: true };
  }
  return { sig: last, settled: false };
}

/** Wait for a condition, or give up and say so. */
async function until(fn, ms = 6000, every = 50) {
  for (let waited = 0; waited < ms; waited += every) {
    if (fn()) return true;
    await settleSlow(every);
  }
  return false;
}

/**
 * Play the scene through once, snapshotting at each sample time.
 *
 * One pass, cues applied once as the clock passes them — which is what
 * "playing forward" actually means. The first version of this reset the stage
 * and replayed every cue from zero at every sample time, which is not playing
 * forward at all (it is a rebuild with `instant: false`), took O(cues x
 * samples), and timed the bench out at seven minutes. It also could not have
 * caught an accumulation bug, because it wiped the accumulation each time.
 */
async function playThrough(scene, times) {
  resetStage();
  await settle();
  const out = [];
  let cursor = 0;
  for (const t of times) {
    while (cursor < scene.cues.length && scene.cues[cursor].t <= t) {
      applyCue(scene.cues[cursor], false);
      cursor += 1;
    }
    await settle();
    out.push(signature());
  }
  return out;
}

/** Seek to t, the way the player does. */
async function seekTo(sceneIndex, t) {
  player.sceneIndex = sceneIndex;
  player.rebuildTo(t);
  await settle();
  return signature();
}

/**
 * Where to sample.
 *
 * Every cue time, and a hair either side of it — an off-by-one on `<=` versus
 * `<` only shows up within a few milliseconds of the boundary — plus a coarse
 * grid so a long quiet stretch is not skipped entirely.
 */
function sampleTimes(scene) {
  const times = new Set([0]);
  const end = Math.max(scene.dur || 0, ...scene.cues.map((c) => c.t), 0);
  for (const cue of scene.cues) {
    for (const d of [-0.04, 0, 0.04]) {
      const t = Math.round((cue.t + d) * 1000) / 1000;
      if (t >= 0 && t <= end) times.add(t);
    }
  }
  // A coarse grid as well, so a long quiet stretch between cues is not
  // skipped entirely. One second, not a half: the cue boundaries above are
  // where the bugs are, and this only has to notice a picture that drifts.
  for (let t = 0; t <= end; t += 1) times.add(Math.round(t * 1000) / 1000);
  return [...times].sort((a, b) => a - b);
}

/* ------------------------------------------------------------
   The checks
   ------------------------------------------------------------ */

async function checkSeekMatchesPlay() {
  const failures = [];
  let samples = 0;

  for (let i = 0; i < chapter.scenes.length; i += 1) {
    const scene = chapter.scenes[i];
    const times = sampleTimes(scene);

    // Two passes, not interleaved: a seek wipes the stage, so it cannot share
    // a run with a forward play that has to keep accumulating.
    const played = await playThrough(scene, times);

    for (let k = 0; k < times.length; k += 1) {
      samples += 1;
      const sought = await seekTo(i, times[k]);
      if (played[k] !== sought) {
        failures.push({
          scene: scene.id, t: times[k], played: played[k], sought,
          cue: cueNear(scene, times[k]),
        });
        // One report per scene. Forty samples of the same broken cue is noise.
        break;
      }
    }
    status(`sweeping… ${scene.id} (${samples} samples, ${failures.length} failing)`);
  }
  return { samples, failures };
}

/** The last cue at or before t — the one a mismatch is most likely about. */
function cueNear(scene, t) {
  let last = null;
  for (const cue of scene.cues) {
    if (cue.t > t) break;
    last = cue;
  }
  return last ? `${last.do} @${last.t.toFixed(2)}s (${last.beat})` : '(no cue yet)';
}

/**
 * One-shot effects must return early when instant.
 *
 * Scrubbing back through Lexington must not fire forty muskets, and must not
 * leave a flash on screen or a note card standing. The soundscape counts what
 * it skipped, so this is measurable rather than a matter of listening.
 */
async function checkOneShots() {
  const problems = [];
  const scene = chapter.scenes.find((s) => s.cues.some((c) => ONE_SHOT.has(c.do)))
    || chapter.scenes[0];
  const index = chapter.scenes.indexOf(scene);
  const before = getSoundscape()?.stats?.() || {};

  const end = Math.max(scene.dur || 0, ...scene.cues.map((c) => c.t), 0);
  for (const t of [end, end / 2, end, 0, end]) {
    await seekTo(index, t);
  }

  const after = getSoundscape()?.stats?.() || {};
  const played = (after.played || 0) - (before.played || 0);
  if (played > 0) {
    problems.push(`${played} sound one-shot(s) played while rebuilding — `
      + 'sound.play must return early when instant');
  }
  // The elements always exist; what matters is whether a rebuild lit one.
  // Testing for the node rather than the class reported the note as standing
  // when it was correctly hidden — the first thing this bench got wrong.
  for (const sel of ONE_SHOT_DOM) {
    const node = document.querySelector(sel);
    if (node && node.classList.contains('is-on')) {
      problems.push(`${sel} is showing after a rebuild — `
        + 'a one-shot effect must return early when instant');
    }
  }
  const nOneShots = chapter.scenes.reduce(
    (n, s) => n + s.cues.filter((c) => ONE_SHOT.has(c.do)).length, 0);
  return { problems, nOneShots, skipped: (after.skipped || 0) - (before.skipped || 0) };
}

const ONE_SHOT = new Set(['map.flash', 'sound.play', 'caption.note']);

/**
 * The epoch guard, under a slow network.
 *
 * `region.show` awaits a fetch while `region.clear` is instant, so a clear in
 * a later beat can run first and an earlier show can resolve after it and
 * undo the clear. That is how seeking to the end of the intro left
 * Massachusetts washed blue over the whole map. It only reproduces when the
 * fetch is slow, so the fetch is made slow.
 */
async function checkEpochGuard(rounds = 10) {
  const scene = chapter.scenes.find((s) => s.cues.some((c) => c.do === 'region.show'));
  if (!scene) return { skipped: true, problems: [] };
  const index = chapter.scenes.indexOf(scene);
  const end = Math.max(scene.dur || 0, ...scene.cues.map((c) => c.t), 0);

  const real = window.fetch;
  let n = 0;
  window.fetch = (...args) => new Promise((resolve, reject) => {
    // Vary the delay so shows and clears interleave differently each round.
    // Deterministic sequence, so a failure can be reproduced.
    n += 1;
    const delay = 10 + ((n * 37) % 60);
    // .call(window, …) matters: fetch detached from window throws "Illegal
    // invocation", ensureRegions() catches it and MEMOISES the null, and the
    // regions then never load at all. Which this bench duly reported as an
    // epoch violation, having caused it.
    setTimeout(() => real.call(window, ...args).then(resolve, reject), delay);
  });

  const problems = [];
  let diff = null;
  try {
    // Remount, so `regionsReady` is null and the fetch is really made. Without
    // this the promise is already resolved from the warm-up in load() and the
    // delay above is never on the path at all — the test would pass by
    // measuring nothing, which is worse than failing.
    el.stage.innerHTML = '';
    mountStage(el.stage, chapter, people, chapter.narrationLang || 'no');

    // The settled truth: land on the end and wait for the picture to stop
    // moving, however long the cold fetch and the parse actually take.
    //
    // Waiting on the geometry explicitly, not just on the picture holding
    // still: a region file that has not arrived yet looks exactly like a
    // picture that has finished, and 372 KB of GeoJSON takes longer to parse
    // than any round number of milliseconds you would have guessed.
    await seekTo(index, end);
    const loaded = await until(() => (getStoryMap()?.regionNames?.() || []).length > 0);
    if (!loaded) {
      problems.push('the region set never loaded, so this proves nothing — '
        + 'check the fetch, not the epoch guard');
    }
    await seekTo(index, end);
    const base = await quiesce();
    const settled = base.sig;
    if (!base.settled) {
      problems.push('the picture never stopped changing at the end of the scene, '
        + 'even with nothing else happening — something is redrawing on a loop');
    }

    for (let i = 0; i < rounds; i += 1) {
      // Scrub about while the fetch is still out, then land back on the same
      // place. The picture must be the same picture however you arrived.
      await seekTo(index, (i * 0.37 * end) % end);
      await seekTo(index, end * 0.2);
      await seekTo(index, end);
      const { sig: got } = await quiesce();
      if (got !== settled) {
        problems.push(`round ${i + 1}: landing on ${end.toFixed(2)}s gave a different `
          + 'picture after scrubbing — an await is outliving its epoch');
        diff = { scene: scene.id, t: end, settled, got };
        break;
      }
    }
  } finally {
    window.fetch = real;
    // Leave a clean, warm stage behind for whatever runs next.
    el.stage.innerHTML = '';
    mountStage(el.stage, chapter, people, chapter.narrationLang || 'no');
    await settleSlow(300);
  }
  return { skipped: false, problems, diff };
}

/**
 * The date parser, against the fixture tools/era.py checks itself with.
 *
 * Two implementations of one calendar is the engine/verbs.json mistake
 * waiting to happen again — two copies, one of them quietly wrong. The
 * fixture carries every date in every pack as it rendered before core/era.js
 * existed, so the era model cannot silently change how an existing subject
 * reads, and it carries 44 BC so the next one works at all.
 */
async function checkEra() {
  const cases = await fetch('./content/_test/era-cases.json').then((r) => r.json())
    .catch(() => null);
  if (!cases) return { skipped: true, problems: [], n: 0 };

  const L = {
    no: { months: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli',
                   'august', 'september', 'oktober', 'november', 'desember'],
          join: (d, m, y) => `${d}. ${m} ${y}`, bc: 'f.Kr.', ad: 'e.Kr.' },
    en: { months: ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                   'August', 'September', 'October', 'November', 'December'],
          join: (d, m, y) => `${d} ${m} ${y}`, bc: 'BC', ad: 'AD' },
  };

  const problems = [];
  let n = 0;

  for (const [text, want] of cases.parse) {
    n += 1;
    const got = era.parseDate(text);
    if (want === null) {
      if (got) problems.push(`parse "${text}": expected a rejection`);
      continue;
    }
    if (!got) { problems.push(`parse "${text}": rejected, expected ${JSON.stringify(want)}`); continue; }
    for (const k of Object.keys(want)) {
      if (got[k] !== want[k]) problems.push(`parse "${text}": ${k} is ${got[k]}, expected ${want[k]}`);
    }
  }

  for (const [a, b] of cases.order) {
    n += 1;
    if (!(era.parseDate(a).jd < era.parseDate(b).jd)) {
      problems.push(`order: ${a} should sort before ${b}`);
    }
  }

  for (const [lang, rows] of Object.entries(cases.format)) {
    for (const [text, want] of rows) {
      n += 1;
      const got = era.formatDate(text, L[lang]);
      if (got !== want) problems.push(`format ${lang} "${text}": "${got}", expected "${want}"`);
    }
  }

  for (const y of [-500, -44, -2, -1, 1, 2, 14, 1775, 2026]) {
    n += 1;
    const back = era.fromJD(era.toJD({ y, m: 3, d: 15 }));
    if (back.y !== y || back.m !== 3 || back.d !== 15) {
      problems.push(`round trip ${y}-03-15 came back as ${back.y}-${back.m}-${back.d}`);
    }
  }
  return { skipped: false, problems, n };
}

/**
 * Does opening a card change the picture?
 *
 * It must not. The dossier reads records and renders them into a sibling of
 * the stage; if the stage signature moves when a card opens, something in the
 * depth layer has started writing stage state, and rule 1 is one refactor
 * away from breaking in a way nobody would see until they scrubbed.
 *
 * Also checks the clock: opening a card pauses, and pausing must not seek.
 */
async function checkDepthIsNotStageState() {
  const problems = [];
  const scene = chapter.scenes.find((s) => s.beats.some((b) => (b.terms || []).length));
  if (!scene) return { skipped: true, problems: [] };
  const index = chapter.scenes.indexOf(scene);
  const beat = scene.beats.find((b) => (b.terms || []).length);
  const term = beat.terms[0];
  const at = beat.start + Math.max(0.2, beat.dur * 0.5);

  const before = await seekTo(index, at);
  const posBefore = player.now();

  const opened = openDepth({ kind: term.kind, id: term.id });
  if (!opened) return { skipped: true, problems: [] };
  await settleSlow(120);
  const withCard = signature();
  if (withCard !== before) {
    problems.push('opening a card changed the stage — the depth layer is '
      + 'writing stage state, which rule 1 does not allow');
  }
  if (Math.abs(player.now() - posBefore) > 0.25) {
    problems.push(`opening a card moved the playhead by `
      + `${(player.now() - posBefore).toFixed(2)}s — pausing must not seek`);
  }

  // And a seek with the card open must still rebuild correctly.
  const sought = await seekTo(index, at);
  if (sought !== before) {
    problems.push('seeking with a card open gave a different picture');
  }
  // Close it the way a reader would.
  document.querySelector('.dossier .sheet__close')?.click();
  await settleSlow(120);
  return { skipped: false, problems };
}

/** Anchors that fell back to the start of their beat. Only a console warning today. */
function checkAnchors() {
  return (chapter.warnings || []).slice();
}

/**
 * A beat whose picture is identical to the beat before it.
 *
 * Not a defect — plenty of beats are meant to sit still — but it is the map
 * not earning its place for a sentence, and there is currently no way to see
 * that except by watching the whole chapter.
 */
async function checkBeatsEarnTheirPlace() {
  const idle = [];
  for (let i = 0; i < chapter.scenes.length; i += 1) {
    const scene = chapter.scenes[i];
    let prev = null;
    for (const beat of scene.beats) {
      const at = beat.start + beat.dur;
      const sig = await seekTo(i, at);
      if (prev !== null && sig === prev) idle.push(beat.id);
      prev = sig;
    }
  }
  return idle;
}

/* ------------------------------------------------------------
   Reporting
   ------------------------------------------------------------ */

function status(text) { el.status.textContent = text; }

function report(html) { el.out.insertAdjacentHTML('beforeend', html); }

function firstDifference(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const out = [];
  for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
    if (la[i] !== lb[i]) {
      out.push(`  played: ${la[i] ?? '(nothing)'}`);
      out.push(`  sought: ${lb[i] ?? '(nothing)'}`);
      if (out.length >= 6) break;
    }
  }
  return out.join('\n') || '  (identical line by line — a length difference)';
}

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

async function load(which) {
  const spec = CHAPTERS[which];
  status(`loading ${spec.id}…`);
  el.out.innerHTML = '';

  if (player) player.destroy();
  unmountDepth();
  el.stage.innerHTML = '';

  people = await fetch(`./content/${spec.pack}/people.json`)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  chapter = await loadChapter(spec.pack, spec.id, 'no');
  mountStage(el.stage, chapter, people, chapter.narrationLang || 'no');
  player = new Player(chapter, {});

  // The depth layer is mounted for real, so the assertion that a card does not
  // touch the stage is measuring the actual thing rather than a stub.
  unmountDepth();
  mountDepth(document.querySelector('.stagewrap'), {
    chapter,
    people,
    get player() { return player; },
    t: (k) => k,
    tx: (v) => (typeof v === 'string' ? v : (v?.no ?? v?.en ?? '')),
    lang: () => 'no',
  });

  // Warm the region file before measuring, so the sweep is testing the engine
  // and not the network. The epoch check puts the delay back on purpose.
  const regionCue = chapter.scenes.flatMap((s) => s.cues).find((c) => c.do === 'region.show');
  if (regionCue) { applyCue(regionCue, true); await settle(24); }
  resetStage();
  await settle();

  el.chapter.textContent = `${spec.id} · ${chapter.scenes.length} scenes · `
    + `${chapter.scenes.reduce((n, s) => n + s.cues.length, 0)} cues`;
  status('ready');
}

async function runAll() {
  const t0 = performance.now();
  el.out.innerHTML = '';
  status('sweeping…');

  const sweep = await checkSeekMatchesPlay();
  const oneShots = await checkOneShots();
  const epoch = await checkEpochGuard();
  const anchors = checkAnchors();
  const dates = await checkEra();
  const depth = await checkDepthIsNotStageState();
  const idle = await checkBeatsEarnTheirPlace();

  const fails = sweep.failures.length + oneShots.problems.length
    + epoch.problems.length + dates.problems.length + depth.problems.length;

  report(`<h2 class="${fails ? 'bad' : 'good'}">
    ${fails ? `${fails} rule-1 violation(s)` : 'Rule 1 holds'}
    <small>${sweep.samples} samples in ${((performance.now() - t0) / 1000).toFixed(1)}s</small>
  </h2>`);

  report(`<h3>Does rebuildTo(t) match playing forward to t?</h3>`);
  if (!sweep.failures.length) {
    report(`<p class="good">Yes, at all ${sweep.samples} sample times.</p>`);
  } else {
    for (const f of sweep.failures) {
      report(`<div class="fail">
        <b>${esc(f.scene)} at ${f.t.toFixed(2)}s</b> — last cue ${esc(f.cue)}
        <pre>${esc(firstDifference(f.played, f.sought))}</pre>
      </div>`);
    }
  }

  report(`<h3>Do one-shots stay silent under instant?</h3>`);
  report(oneShots.problems.length
    ? oneShots.problems.map((p) => `<div class="fail">${esc(p)}</div>`).join('')
    : `<p class="good">Yes — ${oneShots.nOneShots} one-shot cue(s) in the chapter,
       ${oneShots.skipped} skipped, 0 played across five rebuilds.</p>`);

  report(`<h3>Does the epoch guard hold when the network is slow?</h3>`);
  report(epoch.skipped
    ? `<p class="note">No region.show in this chapter — nothing to guard.</p>`
    : (epoch.problems.length
      ? epoch.problems.map((p) => `<div class="fail">${esc(p)}</div>`).join('')
      : `<p class="good">Yes — the same picture every time, with the fetch delayed.</p>`));

  report(`<h3>Does the date parser agree with tools/era.py?</h3>`);
  report(dates.skipped
    ? `<p class="note">No content/_test/era-cases.json — nothing to check against.</p>`
    : (dates.problems.length
      ? dates.problems.map((p) => `<div class="fail">${esc(p)}</div>`).join('')
      : `<p class="good">Yes — ${dates.n} cases, including every date in every
         pack and 44 BC.</p>`));

  report(`<h3>Does opening a card leave the stage alone?</h3>`);
  report(depth.skipped
    ? `<p class="note">No marked terms in this chapter — nothing to open.</p>`
    : (depth.problems.length
      ? depth.problems.map((p) => `<div class="fail">${esc(p)}</div>`).join('')
      : `<p class="good">Yes — same picture, same playhead, and a seek with the
         card open still rebuilds correctly.</p>`));

  report(`<h3>Did every word anchor resolve?</h3>`);
  report(anchors.length
    ? `<div class="warn">${anchors.length} fell back to the start of the beat:
       <pre>${esc(anchors.slice(0, 20).join('\n'))}</pre></div>`
    : `<p class="good">Yes — no cue fell back to the start of its beat.</p>`);

  report(`<h3>Is any beat's picture identical to the one before it?</h3>`);
  report(idle.length
    ? `<div class="warn">${idle.length} beat(s) change nothing on the stage:
       <pre>${esc(idle.join('\n'))}</pre>
       <p>Not a defect. It is the map sitting out a sentence.</p></div>`
    : `<p class="good">No — every beat moves the picture.</p>`);

  status(fails ? `${fails} violation(s)` : 'clean');
  // The screenshot harness reads this.
  window.__engineLab = { fails, sweep, oneShots, epoch, dates, depth, anchors, idle };
}

async function boot() {
  el.stage = $('#stage');
  el.out = $('#out');
  el.status = $('#status');
  el.chapter = $('#chapter');

  // Everything on disk, not just what ships — see useRegistry.
  useRegistry('./content/packs.dev.json');
  CHAPTERS = await allChapters();
  const pick = $('#pick');
  CHAPTERS.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = c.id;
    pick.appendChild(opt);
  });
  pick.addEventListener('change', () => load(Number(pick.value)));
  $('#run').addEventListener('click', runAll);

  load(0);
}

boot();
