/* ============================================================
   sound-lab.js — drives the bench.

   Every capability the sound module has gets one control here, and the two
   claims that are easy to make and hard to believe get a picture: that the
   music bed really is a function of time, and that a one-shot really is
   suppressed when the player is rebuilding after a seek.

   The clock is a setInterval, not requestAnimationFrame. A backgrounded tab
   stops getting frames and the whole point of this page is what happens on a
   timeline. Frames only draw; the timer decides.
   ============================================================ */

import { createMixer } from '../sound/mixer.js';
import { createLibrary, EFFECTS } from '../sound/library.js';
import { createSoundscape } from '../sound/soundscape.js';

const $ = (s) => document.querySelector(s);

/* A stand-in for timing.no.json: beats with the gaps a real read has. The
   ducker never sees narration, only intervals, so this is the same input the
   chapter gives it. */
const SPEECH = [
  { start: 0.8,  end: 4.4 },
  { start: 4.9,  end: 8.2 },
  { start: 8.5,  end: 13.1 },
  { start: 14.6, end: 17.4 },
  { start: 17.7, end: 22.0 },
  { start: 23.4, end: 27.0 },
];
const SPAN = 28;                 // seconds; the clock wraps here

const AMBIENCE = ['wind', 'rain', 'sea', 'crowd', 'rigging', 'boots', 'hooves', 'drums'];

/* ------------------------------------------------------------
   The module under test — rebuildable, because one of the switches
   takes AudioContext away and the mixer only looks for it once.
   ------------------------------------------------------------ */

const library = createLibrary();
let mixer = null;
let scape = null;

let t = 0;
let running = false;
let instant = false;
let noCtx = false;
let silent = false;
let savedAC = null;
let savedWebkitAC = null;

const trace = [];               // [t, measured dB] as the clock runs

function build() {
  mixer?.dispose();
  mixer = createMixer({ enabled: true });
  scape = createSoundscape({
    mixer,
    library,
    schedule: SPEECH,
    bedDb: Number($('#bed').value),
    duckDb: Number($('#duck').value),
    lookAheadMs: Number($('#look').value),
  });
  scape.setSilent(silent);
  trace.length = 0;
  window.lab = { mixer, scape, library, SPEECH, SPAN, at: () => t };
}

build();

/* ------------------------------------------------------------
   Buttons built from the library, not from a hand-written list —
   an effect that exists and has no button is an effect nobody hears.
   ------------------------------------------------------------ */

const label = (name) => library.meta(name)?.label?.no || name;

for (const name of EFFECTS.filter((n) => library.meta(n).kind !== 'music')) {
  const b = document.createElement('button');
  b.textContent = label(name);
  b.dataset.sfx = name;
  b.title = `${name} — ${library.meta(name).licence}`;
  $('#sfxBtns').append(b);
}

for (const name of EFFECTS.filter((n) => library.meta(n).kind === 'music')) {
  const b = document.createElement('button');
  b.textContent = label(name);
  b.dataset.music = name;
  $('#musicBtns').append(b);
}
{
  const b = document.createElement('button');
  b.textContent = 'Stopp';
  b.dataset.music = '';
  $('#musicBtns').append(b);
}

for (const name of ['', ...AMBIENCE]) {
  const b = document.createElement('button');
  b.textContent = name ? label(name) : 'Ingen';
  b.dataset.amb = name;
  if (!name) b.classList.add('on');
  $('#ambBtns').append(b);
}

/* ------------------------------------------------------------
   Wiring
   ------------------------------------------------------------ */

$('#unlock').addEventListener('click', async () => {
  const ok = await mixer.unlock();
  $('#mixState').textContent = ok
    ? 'Låst opp. Dette er den gesten appen allerede har: startknappen på forsiden.'
    : 'Ingen lyd tilgjengelig. Alt annet fortsetter som før — det er hele poenget.';
});

$('#run').addEventListener('click', () => {
  running = !running;
  $('#run').textContent = running ? 'Stopp manuset' : 'Spill av manuset';
  $('#run').classList.toggle('on', running);
});

$('#instant').addEventListener('click', () => {
  instant = !instant;
  $('#instant').textContent = `instant: ${instant ? 'på' : 'av'}`;
  $('#instant').classList.toggle('on', instant);
});

$('#silent').addEventListener('click', () => {
  silent = !silent;
  scape.setSilent(silent);
  $('#silent').textContent = `Stille reserve: ${silent ? 'på' : 'av'}`;
  $('#silent').classList.toggle('on', silent);
  if (silent) markAmb('');
});

/* Take AudioContext away and rebuild. The mixer looks the constructor up
   when it builds its graph, so this is the same situation as a browser that
   simply does not have Web Audio. */
$('#noctx').addEventListener('click', () => {
  noCtx = !noCtx;
  if (noCtx) {
    savedAC = globalThis.AudioContext;
    savedWebkitAC = globalThis.webkitAudioContext;
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
  } else {
    if (savedAC) globalThis.AudioContext = savedAC;
    if (savedWebkitAC) globalThis.webkitAudioContext = savedWebkitAC;
  }
  build();
  markAmb('');
  $('#noctx').textContent = `AudioContext: ${noCtx ? 'mangler' : 'finnes'}`;
  $('#noctx').classList.toggle('on', noCtx);
  $('#mixState').textContent = noCtx
    ? 'Mikseren er bygget uten AudioContext. Trykk på hva du vil — ingenting kaster.'
    : 'Bygget på nytt. Lås opp igjen.';
});

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;

  if (b.dataset.themeSet) {
    document.documentElement.setAttribute('data-theme', b.dataset.themeSet);
    mark('#theme', b);
    draw();
  }
  if (b.dataset.sfx) scape.playSfx(b.dataset.sfx, { instant });
  if ('music' in b.dataset) {
    mark('#musicBtns', b);
    if (b.dataset.music) scape.playMusic(b.dataset.music, { instant });
    else scape.stopMusic({ instant });
  }
  if ('amb' in b.dataset) {
    mark('#ambBtns', b);
    scape.setAmbience(b.dataset.amb || null, { instant });
  }
  if (b.dataset.do === 'suspend') mixer.suspend();
  if (b.dataset.do === 'resume') mixer.resume();
  if (b.dataset.do === 'rewind') { t = 0; trace.length = 0; }
  if (b.dataset.do === 'reset') { scape.reset(); trace.length = 0; markAmb(''); }
});

$('#bed').addEventListener('input', (ev) => {
  scape.setBed(Number(ev.target.value));
  $('#bedOut').textContent = `${fmtDb(Number(ev.target.value))} dB`;
});
$('#duck').addEventListener('input', (ev) => {
  scape.setDuck(Number(ev.target.value));
  $('#duckOut').textContent = `${fmtDb(Number(ev.target.value))} dB`;
});
$('#look').addEventListener('input', (ev) => {
  scape.setDuck({ lookAheadMs: Number(ev.target.value) });
  $('#lookOut').textContent = `${ev.target.value} ms`;
});
$('#scrub').addEventListener('input', (ev) => {
  t = Number(ev.target.value) / 100;
  trace.length = 0;
});

function mark(group, btn) {
  for (const b of document.querySelectorAll(`${group} button`)) b.classList.remove('on');
  btn.classList.add('on');
}
function markAmb(name) {
  for (const b of document.querySelectorAll('#ambBtns button')) {
    b.classList.toggle('on', (b.dataset.amb || '') === name);
  }
}

/* ------------------------------------------------------------
   Read-outs
   ------------------------------------------------------------ */

const FLOOR = -46;   // the bottom of every meter and of the graph

function readout(measured) {
  const s = scape.state();
  const target = scape.targetAt(t);
  const speaking = scape.isSpeaking(t);

  $('#mMeasured').textContent = mixer.ready() ? `${fmtDb(measured)} dB` : '—';
  $('#mTarget').textContent = `${fmtDb(target)} dB`;
  $('#mTime').textContent = `${t.toFixed(1).replace('.', ',')} s`;
  $('#tOut').textContent = `${t.toFixed(1).replace('.', ',')} s`;

  $('#barMeasured').style.width = `${pct(measured) * 100}%`;
  $('#barTarget').style.width = `${pct(target) * 100}%`;

  const flag = $('#duckFlag');
  flag.textContent = speaking ? 'dukket' : 'åpen';
  flag.classList.toggle('is-on', speaking);

  $('#rReady').textContent = String(s.ready);
  $('#rMusic').textContent = s.music || '—';
  $('#rAmb').textContent = s.ambience || '—';
  $('#rInt').textContent = String(s.intervals);
  const st = scape.stats();
  $('#rSfx').textContent = String(st.sfx);
  $('#rSkip').textContent = String(st.sfxSkipped);
  $('#rUnav').textContent = String(st.sfxUnavailable);
}

const pct = (db) => Math.max(0, Math.min(1, (db - FLOOR) / (0 - FLOOR)));
const fmtDb = (db) => (db <= FLOOR ? '−∞' : db.toFixed(1).replace('.', ',').replace('-', '−'));

/* ------------------------------------------------------------
   The graph — the whole argument on one picture
   ------------------------------------------------------------ */

function draw() {
  const cv = $('#trace');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim();
  const rule = css.getPropertyValue('--rule').trim();
  const blue = css.getPropertyValue('--blue').trim();
  const gold = css.getPropertyValue('--gold').trim();
  const red = css.getPropertyValue('--red').trim();
  const faint = css.getPropertyValue('--ink-faint').trim();

  const x = (s) => (s / SPAN) * w;
  const y = (db) => h - pct(db) * (h - 18) - 9;

  /* speech intervals, merged the way the ducker merges them */
  ctx.fillStyle = blue;
  ctx.globalAlpha = 0.22;
  for (const s of scape.schedule()) ctx.fillRect(x(s.start), 0, x(s.end - s.start), h);
  ctx.globalAlpha = 1;

  /* grid */
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  ctx.fillStyle = faint;
  ctx.font = '10px system-ui, sans-serif';
  for (let db = 0; db >= FLOOR; db -= 12) {
    const yy = Math.round(y(db)) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
    ctx.fillText(`${db} dB`, 3, yy - 3);
  }

  /* the target: computed straight from targetAt for every pixel, which is
     the claim being made — the level is a function of time and nothing else */
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  for (let px = 0; px <= w; px++) {
    const s = (px / w) * SPAN;
    const yy = y(scape.targetAt(s));
    if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  /* what the GainNode actually did */
  if (trace.length > 1) {
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    let prevT = -1;
    for (const [ts, db] of trace) {
      const yy = y(db);
      if (!started || ts < prevT) { ctx.moveTo(x(ts), yy); started = true; }
      else ctx.lineTo(x(ts), yy);
      prevT = ts;
    }
    ctx.stroke();
  }

  /* now */
  ctx.strokeStyle = red;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Math.round(x(t)) + 0.5, 0);
  ctx.lineTo(Math.round(x(t)) + 0.5, h);
  ctx.stroke();
}

/* ------------------------------------------------------------
   The clock — a timer, deliberately.

   Started last, after every const above it. A module body runs top to
   bottom, and a timer or a frame callback fired from the middle of it
   reaches declarations that do not exist yet — which is exactly the
   temporal-dead-zone error this page threw on its first run.
   ------------------------------------------------------------ */

const STEP = 40;

setInterval(() => {
  if (running) {
    t = (t + STEP / 1000) % SPAN;
    $('#scrub').value = String(Math.round(t * 100));
  }
  scape.tick(t);

  const measured = mixer.levelOf('music');
  // Skip repeats, or a paused clock buries the curve under a few thousand
  // identical points at one x.
  const last = trace[trace.length - 1];
  if (!last || last[0] !== t || Math.abs(last[1] - measured) > 0.02) {
    trace.push([t, measured]);
    if (trace.length > SPAN * 1000 / STEP) trace.shift();
  }
  readout(measured);
}, STEP);

/* Frames only draw. */
(function frame() {
  draw();
  requestAnimationFrame(frame);
}());
