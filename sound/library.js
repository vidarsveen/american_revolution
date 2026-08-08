/* ============================================================
   library.js — the effects, synthesised rather than shipped.

   Every default effect is built in Web Audio at run time: noise through
   filtered envelopes, a few oscillators, additive partials for the bells.
   The reasons are practical, not clever.

     · No licensing question to answer, and none to answer again in a year.
     · Nothing to download. A period sound pack that actually covered this
       subject would be tens of megabytes; this is a few hundred lines.
     · It fits the no-build-step rule. There is no encoder, no asset step,
       no binary in the repository.

   Rendering happens once per effect in an OfflineAudioContext and the
   AudioBuffer is cached, so a musket costs a few milliseconds on its first
   shot and nothing after that.

   Randomness is seeded, not Math.random. A volley has to be ragged — seven
   hundred men do not fire in unison and a volley that does sounds like a
   sample played twice — but it must be the *same* raggedness every load, or
   a screenshot test can never compare two runs.

   File-based packs are still supported. Pass a manifest in the shape of
   content/<pack>/media.json, where `licence` and `credit` are mandatory:

     { "musket": { "file": "sound/musket.mp3",
                   "title": { "no": "…", "en": "…" },
                   "licence": "CC0", "credit": "…", "source": "https://…" } }

   An entry with a file but no licence or credit is refused and the
   synthetic one is used, so an unattributed recording can never sneak into
   a build by being present on disk.
   ============================================================ */

/* ------------------------------------------------------------
   Deterministic noise source
   ------------------------------------------------------------ */

/** mulberry32 — small, fast, and the same sequence in every browser. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * A buffer of noise. `brown` from 0..1 leans it towards the low end — white
 * noise is a hiss, and nothing in the eighteenth century is a hiss.
 */
function noise(ac, secs, rnd, channels = 1, brown = 0) {
  const len = Math.max(1, Math.ceil(secs * ac.sampleRate));
  const buf = ac.createBuffer(channels, len, ac.sampleRate);
  for (let c = 0; c < channels; c++) {
    const d = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      last = (last + 0.028 * w) / 1.028;
      d[i] = brown ? w * (1 - brown) + last * 12 * brown : w;
    }
  }
  return buf;
}

/* ------------------------------------------------------------
   Two primitives. Everything below is made of these.
   ------------------------------------------------------------ */

/** A shaped burst of filtered noise — the backbone of every impact here. */
function hit(ac, out, {
  at = 0, dur = 0.2, peak = 1, attack = 0.0015,
  type = 'bandpass', freq = 1200, q = 1, sweepTo = 0, brown = 0, rnd,
}) {
  // Several of these place events with a random jitter around a beat, and the
  // first beat of a pattern sits at zero. A negative start time is a thrown
  // RangeError from setValueAtTime, i.e. one silent effect in the library.
  at = Math.max(0, at);
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur + 0.03, rnd, 1, brown);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  if (sweepTo) {
    f.frequency.setValueAtTime(freq, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), at + dur);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.03);
  return g;
}

/** A pitched voice with a decay. `glideTo` is what makes a boom a boom. */
function tone(ac, out, {
  at = 0, dur = 0.4, freq = 220, peak = 0.5, type = 'sine',
  attack = 0.004, glideTo = 0, detune = 0,
}) {
  at = Math.max(0, at);
  const o = ac.createOscillator();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(10, glideTo), at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
  return g;
}

/** A slow oscillator wired onto somebody else's parameter. */
function lfo(ac, param, { freq = 0.2, amount = 1, type = 'sine', phaseAt = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = amount;
  o.connect(g).connect(param);
  o.start(phaseAt);
  return o;
}

/* ------------------------------------------------------------
   The effects
   ------------------------------------------------------------ */

/* A flintlock musket: a hard crack with almost no body, then the report
   coming back off the trees. The low thump is the charge, not the ball. */
function sMusket(ac, out, rnd, { at = 0, pitch = 1, peak = 1 } = {}) {
  hit(ac, out, { at, dur: 0.15, peak: 1.0 * peak, attack: 0.0012, type: 'bandpass', freq: 1500 * pitch, q: 0.7, rnd });
  hit(ac, out, { at, dur: 0.05, peak: 0.75 * peak, attack: 0.0008, type: 'highpass', freq: 3400 * pitch, q: 0.5, rnd });
  tone(ac, out, { at, dur: 0.12, freq: 116 * pitch, peak: 0.5 * peak, glideTo: 52 * pitch, attack: 0.001 });
  hit(ac, out, { at: at + 0.035, dur: 0.7, peak: 0.11 * peak, attack: 0.03, type: 'lowpass', freq: 850, q: 0.6, rnd });
}

/* A volley. Eleven muskets over about a third of a second, with the gaps
   drawn from a squared random so most are tight and a few are late — which
   is what a nervous line actually sounds like. Perfect unison sounds fake
   and, worse, sounds like one loud musket. */
function sVolley(ac, out, rnd, { at = 0 } = {}) {
  let t = at;
  for (let i = 0; i < 11; i++) {
    sMusket(ac, out, rnd, {
      at: t,
      pitch: 0.88 + rnd() * 0.26,
      peak: 0.55 + rnd() * 0.45,
    });
    t += 0.010 + rnd() ** 2 * 0.115;
  }
  // Two stragglers, well behind the line.
  sMusket(ac, out, rnd, { at: t + 0.18 + rnd() * 0.1, pitch: 0.95, peak: 0.5 });
  sMusket(ac, out, rnd, { at: t + 0.4 + rnd() * 0.2, pitch: 1.05, peak: 0.4 });
}

/* A field gun. Nearly all of it is below 200 Hz, and the long part is the
   roll rather than the bang. */
function sCannon(ac, out, rnd, { at = 0 } = {}) {
  tone(ac, out, { at, dur: 1.5, freq: 52, peak: 1.0, glideTo: 26, attack: 0.006 });
  hit(ac, out, { at, dur: 2.1, peak: 0.8, attack: 0.004, type: 'lowpass', freq: 190, q: 0.9, brown: 0.7, rnd });
  hit(ac, out, { at, dur: 0.1, peak: 0.45, attack: 0.001, type: 'bandpass', freq: 750, q: 0.8, rnd });
  hit(ac, out, { at: at + 0.06, dur: 2.9, peak: 0.22, attack: 0.18, type: 'lowpass', freq: 340, q: 0.5, sweepTo: 90, brown: 0.5, rnd });
}

/* A bell is inharmonic — that is the whole character of one. These ratios
   are the usual hum/prime/tierce/quint/nominal set, each with its own
   decay, because the high partials die first and the hum note is what is
   left ringing over the town. */
const BELL_PARTIALS = [
  [0.5, 0.55, 1.00], [1.0, 1.00, 0.85], [1.2, 0.62, 0.60],
  [1.5, 0.48, 0.45], [2.0, 0.38, 0.38], [2.5, 0.22, 0.22],
  [3.0, 0.16, 0.16], [4.2, 0.10, 0.10],
];

function bellStrike(ac, out, rnd, { at = 0, f0 = 168, decay = 5.5, peak = 1 }) {
  for (const [ratio, amp, life] of BELL_PARTIALS) {
    tone(ac, out, {
      at, dur: decay * life, freq: f0 * ratio, peak: amp * 0.34 * peak,
      type: 'sine', attack: 0.004, detune: (rnd() - 0.5) * 8,
    });
  }
  // The clapper itself: metal on metal, gone in a moment.
  hit(ac, out, { at, dur: 0.05, peak: 0.3 * peak, attack: 0.001, type: 'bandpass', freq: 2600, q: 1.4, rnd });
}

/* A church bell tolling: struck slowly, left to ring out. */
function sChurchBell(ac, out, rnd, { at = 0 } = {}) {
  bellStrike(ac, out, rnd, { at, f0: 168, decay: 5.6, peak: 1 });
  bellStrike(ac, out, rnd, { at: at + 2.7, f0: 168, decay: 4.6, peak: 0.72 });
}

/* The same bell rung as an alarm — fast, uneven, nobody counting. This is a
   different event from a bell tolling and reads as one; on 19 April the
   bells were the warning, not the hour. */
function sAlarmBell(ac, out, rnd, { at = 0 } = {}) {
  let t = at;
  for (let i = 0; i < 9; i++) {
    bellStrike(ac, out, rnd, { at: t, f0: 214, decay: 1.9, peak: 0.6 + rnd() * 0.4 });
    t += 0.30 + rnd() * 0.13;
  }
}

/* One snare hit: head, wires, and a little stick. */
function snare(ac, out, rnd, { at, peak = 1 }) {
  hit(ac, out, { at, dur: 0.085, peak: 0.85 * peak, attack: 0.001, type: 'bandpass', freq: 1900, q: 0.7, rnd });
  hit(ac, out, { at, dur: 0.16, peak: 0.3 * peak, attack: 0.002, type: 'highpass', freq: 5200, q: 0.5, rnd });
  tone(ac, out, { at, dur: 0.06, freq: 195, peak: 0.35 * peak, glideTo: 150, attack: 0.001 });
}

/* A marching cadence at 112 to the minute, two bars, made to loop. Accents
   on the beat, ghost notes between, a flam at the top of the second bar and
   a short roll to bring it round. Nothing here is a quoted tune. */
function sDrums(ac, out, rnd, { at = 0, dur = 60 / 112 * 8 } = {}) {
  const beat = 60 / 112;
  const s16 = beat / 4;
  //            1 e & a   2 e & a   3 e & a   4 e & a
  const bars = [
    'X..x X.x. X..x X.x.',
    'X..x X.x. X..x xxXx',
  ];
  // Keep laying bars down past `dur`. The overhang is what gets folded back
  // over the head to make the loop join; without it the first beat fades in.
  for (let b = 0; b * 4 * beat < dur; b++) {
    const cells = bars[b % bars.length].replace(/ /g, '').split('');
    const barAt = at + b * 4 * beat;
    cells.forEach((c, i) => {
      if (c === '.') return;
      const t = barAt + i * s16;
      if (c === 'X') {
        // A flam on the downbeat of the second bar: two sticks, not quite together.
        if (b % 2 === 1 && i === 0) snare(ac, out, rnd, { at: t - 0.028, peak: 0.4 });
        snare(ac, out, rnd, { at: t, peak: 1 });
      } else {
        snare(ac, out, rnd, { at: t, peak: 0.3 + rnd() * 0.12 });
      }
    });
    // Bass drum on one and three — the thing you feel in a column.
    for (const q of [0, 2]) {
      tone(ac, out, { at: barAt + q * beat, dur: 0.24, freq: 76, peak: 0.7, glideTo: 48, attack: 0.003 });
    }
  }
}

/* A fife. Almost a sine with a hard edge and a lot of breath — the breath
   is most of why a fife carries. The figure is written for this app; it is
   a plain rise and fall in D, not a quotation of anything. */
function sFife(ac, out, rnd, { at = 0 } = {}) {
  const D6 = 1174.66;
  const phrase = [[0, 0.26], [2, 0.26], [4, 0.26], [7, 0.38], [4, 0.26], [2, 0.26], [0, 0.30], [-5, 0.62]];
  let t = at;
  for (const [semi, dur] of phrase) {
    const f = D6 * 2 ** (semi / 12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.setValueAtTime(0.5, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);

    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    lfo(ac, o.detune, { freq: 5.4, amount: 14, phaseAt: t });
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.02);

    const edge = ac.createOscillator();
    edge.type = 'square';
    edge.frequency.value = f;
    const eg = ac.createGain();
    eg.gain.value = 0.09;
    edge.connect(eg).connect(g);
    edge.start(t); edge.stop(t + dur + 0.02);

    hit(ac, g, { at: t, dur, peak: 0.13, attack: 0.02, type: 'highpass', freq: 4200, q: 0.6, rnd });
    t += dur;
  }
}

/* One horse at a gallop, not cavalry: this app needs Revere's ride far more
   than it needs a charge. A gallop is four beats and a gap, not an even
   trot, and the gap is what makes it read as speed. */
function sHooves(ac, out, rnd, { at = 0, dur = 2.4 } = {}) {
  const stride = 0.60;
  const feet = [0, 0.095, 0.235, 0.335];
  for (let s = 0; s * stride < dur; s++) {
    const base = at + s * stride;
    feet.forEach((o, i) => {
      const t = base + o + (rnd() - 0.5) * 0.012;
      const p = (i === 3 ? 1 : 0.62 + rnd() * 0.22);
      hit(ac, out, { at: t, dur: 0.075, peak: p, attack: 0.001, type: 'lowpass', freq: 240, q: 1.1, brown: 0.4, rnd });
      hit(ac, out, { at: t, dur: 0.022, peak: p * 0.4, attack: 0.0008, type: 'bandpass', freq: 1150, q: 1.2, rnd });
    });
  }
}

/* A column on the march: 120 paces to the minute, and every step is several
   hundred boots that do not land together. Five jittered thuds per step is
   the difference between a column and one man in a corridor. */
function sBoots(ac, out, rnd, { at = 0, dur = 4 } = {}) {
  const step = 0.5;
  for (let s = 0; s * step < dur; s++) {
    const base = at + s * step;
    for (let k = 0; k < 5; k++) {
      const t = base + (rnd() - 0.5) * 0.055;
      hit(ac, out, { at: t, dur: 0.09, peak: 0.35 + rnd() * 0.3, attack: 0.002, type: 'lowpass', freq: 380, q: 0.8, brown: 0.5, rnd });
      hit(ac, out, { at: t, dur: 0.045, peak: 0.1 + rnd() * 0.08, attack: 0.001, type: 'bandpass', freq: 2300, q: 0.7, rnd });
    }
  }
}

/* A crowd heard from across a square: a band of noise where speech lives,
   wobbling, with short blips at speech-shaped rates on top. No words — the
   moment you can make out a word it stops being a crowd. */
function sCrowd(ac, out, rnd, { at = 0, dur = 8.4 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0.25);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 0.55;
  const g = ac.createGain();
  g.gain.value = 0.34;
  lfo(ac, g.gain, { freq: 0.19, amount: 0.12, phaseAt: at });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  for (let i = 0; i < 90; i++) {
    hit(ac, out, {
      at: at + rnd() * dur,
      dur: 0.12 + rnd() * 0.3,
      peak: 0.05 + rnd() * 0.09,
      attack: 0.04,
      type: 'bandpass',
      freq: 280 + rnd() * 700,
      q: 3 + rnd() * 4,
      rnd,
    });
  }
}

/* Wind: brown noise through a filter that breathes, plus a thin whistle for
   the edge of a building. A flat noise bed does not sound like weather. */
function sWind(ac, out, rnd, { at = 0, dur = 9.3, level = 1 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0.85);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 0.9;
  lfo(ac, f.frequency, { freq: 0.215, amount: 330, phaseAt: at });
  const g = ac.createGain();
  g.gain.value = 0.7 * level;
  lfo(ac, g.gain, { freq: 0.111, amount: 0.28 * level, phaseAt: at });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  const w = ac.createBufferSource();
  w.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0);
  const wf = ac.createBiquadFilter();
  wf.type = 'bandpass'; wf.frequency.value = 1250; wf.Q.value = 7;
  lfo(ac, wf.frequency, { freq: 0.086, amount: 420, phaseAt: at });
  const wg = ac.createGain();
  wg.gain.value = 0.06 * level;
  lfo(ac, wg.gain, { freq: 0.13, amount: 0.05 * level, phaseAt: at });
  w.connect(wf).connect(wg).connect(out);
  w.start(at); w.stop(at + dur);
}

/* Rain: a high bed for the sheet of it and a few hundred droplets for the
   things it is landing on. */
function sRain(ac, out, rnd, { at = 0, dur = 6.3 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0);
  const f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 1400; f.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.value = 0.42;
  lfo(ac, g.gain, { freq: 0.16, amount: 0.09, phaseAt: at });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  const low = ac.createBufferSource();
  low.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0.7);
  const lf = ac.createBiquadFilter();
  lf.type = 'lowpass'; lf.frequency.value = 420;
  const lg = ac.createGain();
  lg.gain.value = 0.25;
  low.connect(lf).connect(lg).connect(out);
  low.start(at); low.stop(at + dur);

  for (let i = 0; i < 420; i++) {
    hit(ac, out, {
      at: at + rnd() * dur, dur: 0.012 + rnd() * 0.02,
      peak: 0.05 + rnd() * 0.13, attack: 0.001,
      type: 'bandpass', freq: 2600 + rnd() * 4800, q: 2 + rnd() * 3, rnd,
    });
  }
}

/* Sea from a deck or a shore: a swell with a period of several seconds, and
   hiss only on the crest. The period is the point — a constant wash is a
   waterfall, not the Atlantic. */
function sSea(ac, out, rnd, { at = 0, dur = 12.4 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0.8);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.7;
  const g = ac.createGain();
  g.gain.value = 0.55;
  lfo(ac, g.gain, { freq: 1 / 6.2, amount: 0.42, phaseAt: at });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  const crest = ac.createBufferSource();
  crest.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0);
  const cf = ac.createBiquadFilter();
  cf.type = 'highpass'; cf.frequency.value = 1900;
  const cg = ac.createGain();
  cg.gain.value = 0.10;
  // Slightly faster and out of step, so crest and swell drift against each
  // other instead of pumping in lockstep.
  lfo(ac, cg.gain, { freq: 1 / 5.3, amount: 0.10, phaseAt: at });
  crest.connect(cf).connect(cg).connect(out);
  crest.start(at); crest.stop(at + dur);
}

/* A ship at anchor: rope, blocks and timber over a quiet wind. Creaks are a
   resonant band swept downward — that falling pitch is the sound of a load
   coming onto a rope. */
function sRigging(ac, out, rnd, { at = 0, dur = 10.4 } = {}) {
  sWind(ac, out, rnd, { at, dur, level: 0.45 });
  let t = at + rnd() * 0.8;
  while (t < at + dur) {
    if (rnd() < 0.55) {
      hit(ac, out, {
        at: t, dur: 0.35 + rnd() * 0.5, peak: 0.35 + rnd() * 0.3, attack: 0.06,
        type: 'bandpass', freq: 260 + rnd() * 260, q: 11, sweepTo: 150 + rnd() * 90, rnd,
      });
    } else {
      hit(ac, out, {
        at: t, dur: 0.11, peak: 0.4 + rnd() * 0.3, attack: 0.002,
        type: 'lowpass', freq: 520, q: 1.6, brown: 0.4, rnd,
      });
    }
    t += 0.5 + rnd() * 1.5;
  }
}

/* A music bed, not a tune. A stack of sawtooths on D with the fifth and the
   minor third, filtered down to something that sits under a voice, and a
   slow swell so it is never quite still. Anything with a melody would fight
   the narration; this is meant to be ducked and barely noticed. */
function drone(ac, out, rnd, { at = 0, dur = 16.4, level = 1 } = {}) {
  const freqs = [73.42, 110.0, 146.83, 174.61, 220.0, 293.66];
  const amps = [1.0, 0.55, 0.42, 0.26, 0.18, 0.10];
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 0.8;
  lfo(ac, f.frequency, { freq: 1 / 11.0, amount: 240, phaseAt: at });
  const g = ac.createGain();
  g.gain.value = 0.4 * level;
  lfo(ac, g.gain, { freq: 1 / 8.2, amount: 0.13 * level, phaseAt: at });
  f.connect(g).connect(out);

  freqs.forEach((freq, i) => {
    const o = ac.createOscillator();
    o.type = i < 3 ? 'sawtooth' : 'triangle';
    o.frequency.value = freq;
    o.detune.value = (rnd() - 0.5) * 9;
    const og = ac.createGain();
    og.gain.value = amps[i] * 0.12;
    o.connect(og).connect(f);
    o.start(at); o.stop(at + dur);
  });
}

function sBedSolemn(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, { at, dur, level: 1 });
}

/* The same bed with a slow field drum under it, for the marching stretches. */
function sBedMarch(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, { at, dur, level: 0.8 });
  const pulse = 60 / 70;
  for (let t = at; t < at + dur; t += pulse) {
    tone(ac, out, { at: t, dur: 0.34, freq: 72, peak: 0.55, glideTo: 46, attack: 0.004 });
    hit(ac, out, { at: t, dur: 0.1, peak: 0.12, attack: 0.003, type: 'lowpass', freq: 300, q: 0.8, brown: 0.6, rnd });
  }
}

/* ------------------------------------------------------------
   The catalogue

   `kind` decides three things at once: whether the buffer is looped, how
   loudly it is normalised, and whether it gets a seamless join.
   ------------------------------------------------------------ */

const CATALOGUE = {
  musket:     { kind: 'oneshot', dur: 1.10, synth: sMusket,     label: { no: 'Muskettskudd', en: 'Musket shot' } },
  volley:     { kind: 'oneshot', dur: 2.60, synth: sVolley,     label: { no: 'Salve', en: 'Volley' } },
  cannon:     { kind: 'oneshot', dur: 3.40, synth: sCannon,     label: { no: 'Kanon', en: 'Cannon' } },
  churchBell: { kind: 'oneshot', dur: 8.00, synth: sChurchBell, label: { no: 'Kirkeklokke', en: 'Church bell' } },
  alarmBell:  { kind: 'oneshot', dur: 5.60, synth: sAlarmBell,  label: { no: 'Alarmklokke', en: 'Alarm bell' } },
  fife:       { kind: 'oneshot', dur: 2.90, synth: sFife,       label: { no: 'Tverrfløyte', en: 'Fife' } },

  drums:      { kind: 'loop', dur: 60 / 112 * 8, synth: sDrums,  label: { no: 'Tromme', en: 'Drums' } },
  hooves:     { kind: 'loop', dur: 2.40,  synth: sHooves,        label: { no: 'Hovslag', en: 'Hooves' } },
  boots:      { kind: 'loop', dur: 4.00,  synth: sBoots,         label: { no: 'Marsjstøvler', en: 'Marching boots' } },
  crowd:      { kind: 'loop', dur: 8.00,  synth: sCrowd,         label: { no: 'Folkemengde', en: 'Crowd' } },
  wind:       { kind: 'loop', dur: 9.00,  synth: sWind,          label: { no: 'Vind', en: 'Wind' } },
  rain:       { kind: 'loop', dur: 6.00,  synth: sRain,          label: { no: 'Regn', en: 'Rain' } },
  sea:        { kind: 'loop', dur: 12.00, synth: sSea,           label: { no: 'Sjø', en: 'Sea' } },
  rigging:    { kind: 'loop', dur: 10.00, synth: sRigging,       label: { no: 'Rigg', en: 'Rigging' } },

  bedSolemn:  { kind: 'music', dur: 16.00, synth: sBedSolemn,    label: { no: 'Underlag: alvor', en: 'Bed: solemn' } },
  bedMarch:   { kind: 'music', dur: 16.00, synth: sBedMarch,     label: { no: 'Underlag: marsj', en: 'Bed: march' } },
};

/**
 * Ceilings per kind: a peak so nothing clips, and an RMS so nothing shouts.
 *
 * Both are needed. Peak alone makes a fife roughly ten times louder than a
 * musket with the identical peak, because one is a sustained tone and the
 * other is a crack with air around it — measured at 0.38 RMS against 0.03.
 * Whichever ceiling bites first wins.
 */
const PEAK = { oneshot: 0.90, loop: 0.55, music: 0.50 };
const RMS = { oneshot: 0.12, loop: 0.11, music: 0.10 };
/** How much extra tail is rendered and folded back over the head of a loop. */
const SEAM = 0.30;

/* ------------------------------------------------------------
   Rendering
   ------------------------------------------------------------ */

function offlineCtor() {
  return globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
}

async function synthesise(name, entry, sampleRate) {
  const OAC = offlineCtor();
  if (typeof OAC !== 'function') return null;

  const oneshot = entry.kind === 'oneshot';
  const channels = oneshot ? 1 : 2;
  const seam = oneshot ? 0 : SEAM;
  const outLen = Math.ceil(entry.dur * sampleRate);
  const ac = new OAC(channels, outLen + Math.ceil(seam * sampleRate), sampleRate);

  const out = ac.createGain();
  out.channelCount = channels;
  out.gain.value = 1;
  out.connect(ac.destination);
  // Loops are asked to fill dur + seam so there is real material to fold back.
  entry.synth(ac, out, rng(hash(name)), { at: 0, dur: entry.dur + seam });

  const raw = await ac.startRendering();
  const buf = ac.createBuffer(channels, outLen, sampleRate);
  const seamLen = Math.min(Math.floor(seam * sampleRate), outLen);

  let peak = 0;
  let square = 0;
  for (let c = 0; c < channels; c++) {
    const src = raw.getChannelData(c);
    const dst = buf.getChannelData(c);
    dst.set(src.subarray(0, outLen));
    // Fold the overhang back over the head with an equal-power crossfade, so
    // the loop joins without the click you get from cutting a noise bed at an
    // arbitrary sample.
    for (let i = 0; i < seamLen; i++) {
      const w = i / seamLen;
      dst[i] = dst[i] * Math.sqrt(w) + src[outLen + i] * Math.sqrt(1 - w);
    }
    for (let i = 0; i < outLen; i++) {
      const a = Math.abs(dst[i]);
      if (a > peak) peak = a;
      square += dst[i] * dst[i];
    }
  }

  // Normalise on the way out rather than hand-tuning a gain inside every
  // synth. Twenty effects each tuned by ear against nothing is how a library
  // ends up with one effect that clips and one nobody can hear.
  const rms = Math.sqrt(square / (outLen * channels));
  const k = Math.min(
    peak > 0.0001 ? (PEAK[entry.kind] ?? 0.8) / peak : 1,
    rms > 0.0001 ? (RMS[entry.kind] ?? 0.11) / rms : 1,
  );
  if (k !== 1) {
    for (let c = 0; c < channels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < outLen; i++) d[i] *= k;
    }
  }
  return buf;
}

/* ------------------------------------------------------------
   Manifest — the one path a file-based pack takes
   ------------------------------------------------------------ */

/**
 * An entry may ship a file instead of being synthesised, but only with its
 * paperwork. Same shape and same rules as content/<pack>/media.json.
 */
export function validateManifest(manifest, { onProblem } = {}) {
  const problems = [];
  for (const [name, e] of Object.entries(manifest || {})) {
    if (!e || typeof e !== 'object') { problems.push(`${name}: not an object`); continue; }
    if (!e.file) { problems.push(`${name}: no file — drop the entry and the synthetic effect is used`); continue; }
    if (!e.licence) problems.push(`${name}: no licence`);
    if (!e.credit) problems.push(`${name}: no credit`);
  }
  if (onProblem) problems.forEach(onProblem);
  return problems;
}

/* ------------------------------------------------------------
   The library
   ------------------------------------------------------------ */

export function createLibrary({ manifest = null, base = '' } = {}) {
  const files = {};
  if (manifest) {
    const problems = validateManifest(manifest);
    for (const p of problems) console.warn(`[sound] manifest: ${p}`);
    for (const [name, e] of Object.entries(manifest)) {
      if (e && e.file && e.licence && e.credit) files[name] = e;
    }
  }

  // Keyed by sample rate: an AudioBuffer rendered at 44.1k played through a
  // 48k context is the right sound at the wrong pitch.
  const cache = new Map();

  function names() {
    return [...new Set([...Object.keys(CATALOGUE), ...Object.keys(files)])];
  }

  function meta(name) {
    const c = CATALOGUE[name];
    const f = files[name];
    if (!c && !f) return null;
    return {
      name,
      kind: c?.kind ?? 'oneshot',
      dur: c?.dur ?? 0,
      label: f?.title ?? c?.label ?? { no: name, en: name },
      source: f ? 'file' : 'synth',
      licence: f?.licence ?? 'Synthesised in this repository',
      credit: f?.credit ?? 'Den amerikanske revolusjonen',
    };
  }

  async function decodeFile(entry, ctx) {
    const res = await fetch(base + entry.file, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`${res.status} ${entry.file}`);
    const bytes = await res.arrayBuffer();
    return await ctx.decodeAudioData(bytes);
  }

  /**
   * The buffer for `name`, or null. Never throws and never rejects: a
   * missing effect must cost silence, not a chapter.
   */
  function get(name, ctx) {
    if (!ctx) return Promise.resolve(null);
    const key = `${name}@${ctx.sampleRate}`;
    if (cache.has(key)) return cache.get(key);

    const entry = CATALOGUE[name];
    const file = files[name];
    if (!entry && !file) {
      console.warn(`[sound] no effect named "${name}"`);
      const miss = Promise.resolve(null);
      cache.set(key, miss);
      return miss;
    }

    const p = (file
      ? decodeFile(file, ctx)
      : synthesise(name, entry, ctx.sampleRate)
    ).catch((err) => {
      console.warn(`[sound] "${name}" could not be prepared`, err);
      // Fall back to the synthetic one when a shipped file lets us down.
      return file && entry ? synthesise(name, entry, ctx.sampleRate).catch(() => null) : null;
    });

    cache.set(key, p);
    return p;
  }

  /** Render a set up front, e.g. the ones a scene is about to need. */
  function warm(ctx, list = names()) {
    return Promise.all(list.map((n) => get(n, ctx)));
  }

  return { names, meta, get, warm, isLooping: (n) => (meta(n)?.kind ?? 'oneshot') !== 'oneshot' };
}

/** The catalogue keys, for anything that needs the list without a context. */
export const EFFECTS = Object.freeze(Object.keys(CATALOGUE));
