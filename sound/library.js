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

/**
 * A value that wanders and yet joins itself exactly at the loop point.
 *
 * Every weather bed here has to do two contradictory things: never repeat
 * audibly, and meet its own beginning at the seam. One LFO does the second
 * and fails the first — a 0.2 Hz sine is a machine breathing, and once you
 * have heard it you cannot stop hearing it, which is most of what was wrong
 * with the old wind. A random walk does the first and fails the second.
 *
 * Summing sinusoids whose periods are all exact divisions of the loop gives
 * both. The sum is a Fourier series, so it wanders; every term completes a
 * whole number of cycles, so shape(0) === shape(1) and the join is free.
 * Phases come from the seeded rng, so it is different per effect and the
 * same on every load.
 *
 * Returns a function of u in 0..1, valued roughly -1..1.
 */
function wobble(rnd, cycles = [1, 2, 3, 5, 8]) {
  const phase = cycles.map(() => rnd() * Math.PI * 2);
  const w = cycles.map((c) => 1 / Math.sqrt(c));
  const norm = w.reduce((a, b) => a + b, 0) || 1;
  return (u) => {
    let v = 0;
    for (let i = 0; i < cycles.length; i++) {
      v += w[i] * Math.sin(u * cycles[i] * Math.PI * 2 + phase[i]);
    }
    return v / norm;
  };
}

/**
 * Draw a shape onto a parameter over `dur`, rather than modulating it.
 *
 * setValueCurveAtTime rather than an oscillator, because the point of
 * wobble() is a shape that is not any one frequency — there is nothing to
 * wire an LFO to.
 */
function curveOn(param, { at = 0, dur = 1, mid = 0.5, depth = 0.4, shape, steps = 240, min = 0 }) {
  const arr = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) arr[i] = Math.max(min, mid + depth * shape(i / steps));
  try { param.setValueCurveAtTime(arr, Math.max(0, at), dur); } catch { /* param busy */ }
  return arr;
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

/* A bell is inharmonic, and — this is the part the first version missed — it
   BEATS. Two nominally identical modes of one lump of cast metal are never
   quite identical, so each partial is really a pair a fraction of a hertz
   apart, drifting in and out of phase a couple of times a second. That
   shimmer is most of what your ear uses to say "bell" rather than "organ".
   Eight clean sines gave the ratios and none of the sound.

   [ratio, amp, life, beatHz]. The ratios are the usual minor-third bell set:
   hum, prime, tierce, quint, nominal, and the four above it. The amplitudes
   are the other half of the character — the nominal is the loudest thing at
   the strike and one of the first to go, and the hum is barely there until
   everything else has died and then rings over the town for ten seconds. */
const BELL_PARTIALS = [
  [0.500, 0.60, 1.00, 0.6],
  [1.000, 0.82, 0.66, 0.9],
  [1.183, 0.66, 0.44, 1.5],
  [1.506, 0.50, 0.32, 1.9],
  [2.000, 0.95, 0.22, 2.4],
  [2.514, 0.34, 0.14, 3.2],
  [3.011, 0.25, 0.10, 3.9],
  [4.166, 0.18, 0.062, 5.1],
  [5.433, 0.12, 0.042, 6.4],
];

function bellStrike(ac, out, rnd, { at = 0, f0 = 233, decay = 7.0, peak = 1 }) {
  for (const [ratio, amp, life, beat] of BELL_PARTIALS) {
    const f = f0 * ratio;
    const a = amp * 0.19 * peak;
    // The pair. Splitting the amplitude keeps the partial's weight the same
    // as one oscillator would have had, so the balance above still reads.
    tone(ac, out, { at, dur: decay * life, freq: f, peak: a,
                    type: 'sine', attack: 0.003, detune: (rnd() - 0.5) * 4 });
    tone(ac, out, { at, dur: decay * life, freq: f + beat * (0.7 + rnd() * 0.6), peak: a,
                    type: 'sine', attack: 0.003 });
  }

  // The strike itself. A real bell is hit with several kilos of iron and for
  // about thirty milliseconds that is ALL you hear — bright, broadband and
  // violent. The old version gave it one quiet blip at 2.6 kHz, which is why
  // the bell seemed to fade in out of nowhere.
  hit(ac, out, { at, dur: 0.03, peak: 0.80 * peak, attack: 0.0005, type: 'bandpass', freq: f0 * 8.2, q: 0.7, rnd });
  hit(ac, out, { at, dur: 0.13, peak: 0.40 * peak, attack: 0.0008, type: 'bandpass', freq: f0 * 3.4, q: 1.1, rnd });
  hit(ac, out, { at, dur: 0.45, peak: 0.14 * peak, attack: 0.004, type: 'lowpass', freq: f0 * 1.7, q: 0.6, brown: 0.35, rnd });
}

/* A church bell tolling: struck slowly, left to ring right out. Two strikes,
   because one is a sound effect and two is a bell being rung. */
function sChurchBell(ac, out, rnd, { at = 0 } = {}) {
  bellStrike(ac, out, rnd, { at, f0: 233, decay: 9.0, peak: 1 });
  bellStrike(ac, out, rnd, { at: at + 3.7, f0: 233, decay: 8.0, peak: 0.78 });
}

/* The same bell rung as an alarm — hard, uneven, nobody counting. A different
   event from a bell tolling and it has to read as one; on 19 April the bells
   were the warning, not the hour.

   Slower than it was. The old one struck nine times in three seconds, which
   is a hand bell on a table: a church bell is a few hundred kilos on a wheel
   and a strong man cannot make it speak more than about once a second. The
   strikes now overlap instead of chattering, which is the actual sound of a
   town being woken. */
function sAlarmBell(ac, out, rnd, { at = 0 } = {}) {
  let t = at;
  for (let i = 0; i < 6; i++) {
    bellStrike(ac, out, rnd, { at: t, f0: 294, decay: 3.8, peak: 0.68 + rnd() * 0.32 });
    t += 0.80 + rnd() * 0.26;
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

/* One horse, not cavalry: this app needs Revere's ride far more than it needs
   a charge. Four beats and a gap — the gap is what makes it read as a horse
   rather than a drum.

   Slowed from a 0.60 s stride to 0.82 s, and the four footfalls stretched
   with it. The old one was a racing gallop, which is wrong twice over: it
   sounded frantic under a calm sentence, and no rider gallops flat out for
   twenty kilometres in the dark on a road he cannot see. This is a hand
   canter, which is what the night actually was.

   The stride length also breathes by a few percent. A perfectly even stride
   is a metronome, and a metronome under a loop is the most obvious tell
   there is that a sound was made by a computer. */
function sHooves(ac, out, rnd, { at = 0, dur = 3.3 } = {}) {
  const STRIDE = 0.82;
  // Fractions of a stride, so the pattern stretches with the tempo instead of
  // staying bunched at the front of a longer gap.
  const feet = [0, 0.135, 0.325, 0.455];
  let base = at;
  while (base < at + dur) {
    const stride = STRIDE * (0.965 + rnd() * 0.07);
    feet.forEach((o, i) => {
      const t = base + o * stride + (rnd() - 0.5) * 0.014;
      // The fourth foot is the one that lands hardest — it is the one the
      // horse pushes off from, and it is what gives a gallop its lilt.
      const p = (i === 3 ? 1 : 0.58 + rnd() * 0.24);
      hit(ac, out, { at: t, dur: 0.085, peak: p, attack: 0.0012, type: 'lowpass', freq: 210, q: 1.1, brown: 0.45, rnd });
      hit(ac, out, { at: t, dur: 0.030, peak: p * 0.34, attack: 0.0008, type: 'bandpass', freq: 980, q: 1.0, rnd });
      // A little grit: a hoof on a packed dirt road throws stones about.
      hit(ac, out, { at: t + 0.012, dur: 0.05, peak: p * 0.14, attack: 0.004, type: 'highpass', freq: 3200, q: 0.5, rnd });
    });
    base += stride;
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
  const ch = out.channelCount || 2;
  const swell = wobble(rnd, [1, 2, 3, 7]);

  // Two bands rather than one. A single 480 Hz band was the whole problem:
  // speech occupies a chest register and a mouth register at once, and a
  // crowd with only the first is a rumble, with only the second is static.
  for (const [freq, q, lvl] of [[240, 0.8, 0.30], [720, 0.7, 0.20]]) {
    const src = ac.createBufferSource();
    src.buffer = noise(ac, dur, rnd, ch, 0.3);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    curveOn(g.gain, { at, dur, mid: lvl, depth: lvl * 0.5, shape: swell, min: 0.02 });
    src.connect(f).connect(g).connect(out);
    src.start(at); src.stop(at + dur);
  }

  // The near voices. Uneven density is the point — people do not talk on a
  // Poisson process, they talk in clumps and then everybody stops at once.
  // Clustering the blips is the difference between a crowd and a noise gate.
  let t = at;
  while (t < at + dur) {
    const clump = 1 + Math.floor(rnd() * 4);
    const pitch = 190 + rnd() * 520;          // one speaker, several syllables
    for (let i = 0; i < clump; i++) {
      hit(ac, out, {
        at: t + i * (0.11 + rnd() * 0.13),
        dur: 0.09 + rnd() * 0.16,
        peak: 0.04 + rnd() * 0.10,
        attack: 0.025,
        type: 'bandpass',
        // Never a whole formant pair: the moment you can make out a word it
        // stops being a crowd and becomes one person you cannot understand.
        freq: pitch * (1 + rnd() * 0.35),
        q: 2.5 + rnd() * 3,
        rnd,
      });
    }
    t += 0.14 + rnd() * rnd() * 1.1;
  }
}

/* Wind. Three layers, because wind is not one sound: a rumble you feel more
   than hear, the body of it, and the thin edge it makes going past a corner.

   Two things were wrong with the old one and they were the same thing twice.
   Every movement came from a single sine LFO, so it breathed in and out on a
   perfect five-second cycle — mechanical, and the ear locks onto it within
   one loop. And the level and the brightness were modulated independently, at
   different rates, which no gust has ever done.

   Both are fixed by wobble(): a shape that wanders, repeats exactly once per
   loop, and — crucially — drives level AND cutoff AND the whistle from the
   SAME curve, so a gust arrives as one event. Louder, brighter and thinner
   all at once is what a gust is. */
function sWind(ac, out, rnd, { at = 0, dur = 9.3, level = 1 } = {}) {
  const gust = wobble(rnd, [1, 2, 3, 5, 8]);
  const drift = wobble(rnd, [1, 2, 5]);
  const ch = out.channelCount || 2;

  // The body of it.
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, ch, 0.8);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = 0.6;
  curveOn(f.frequency, { at, dur, mid: 540, depth: 400, shape: gust, min: 110 });
  const g = ac.createGain();
  curveOn(g.gain, { at, dur, mid: 0.40 * level, depth: 0.32 * level, shape: gust, min: 0.015 });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  // The rumble under it, on its own slower drift. This is the layer that
  // makes wind feel like weather rather than like tape hiss.
  const low = ac.createBufferSource();
  low.buffer = noise(ac, dur, rnd, ch, 0.95);
  const lf = ac.createBiquadFilter();
  lf.type = 'lowpass'; lf.frequency.value = 130; lf.Q.value = 0.5;
  const lg = ac.createGain();
  curveOn(lg.gain, { at, dur, mid: 0.34 * level, depth: 0.16 * level, shape: drift, min: 0.02 });
  low.connect(lf).connect(lg).connect(out);
  low.start(at); low.stop(at + dur);

  // The edge. Q 2.6 rather than 7: at 7 it is a tuned whistle and reads as a
  // theremin, and a swept theremin is exactly what the old wind had. And its
  // level rides the gust curve with a floor of zero, so it only exists at the
  // top of a gust — which is the only time you actually hear one.
  const w = ac.createBufferSource();
  w.buffer = noise(ac, dur, rnd, ch, 0);
  const wf = ac.createBiquadFilter();
  wf.type = 'bandpass'; wf.Q.value = 2.6;
  curveOn(wf.frequency, { at, dur, mid: 1150, depth: 520, shape: gust, min: 300 });
  const wg = ac.createGain();
  curveOn(wg.gain, { at, dur, mid: 0.018 * level, depth: 0.052 * level, shape: gust, min: 0 });
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
  // Was barely audible, and it was a level problem rather than a design one.
  // The library normalises each effect to an RMS ceiling; this bed was mostly
  // a very quiet wind, so its RMS was tiny and the normaliser tried to lift
  // the lot — until the peak of one hard block-knock hit the peak ceiling
  // first and capped the gain for the whole buffer. Louder wind and softer
  // knocks put RMS back in charge, which is the ceiling that should govern a
  // continuous bed.
  sWind(ac, out, rnd, { at, dur, level: 0.75 });
  let t = at + rnd() * 0.8;
  while (t < at + dur) {
    if (rnd() < 0.55) {
      // A rope taking a load: a resonant band falling in pitch. That fall IS
      // the sound of the load coming on.
      hit(ac, out, {
        at: t, dur: 0.35 + rnd() * 0.5, peak: 0.22 + rnd() * 0.18, attack: 0.06,
        type: 'bandpass', freq: 260 + rnd() * 260, q: 9, sweepTo: 150 + rnd() * 90, rnd,
      });
    } else {
      hit(ac, out, {
        at: t, dur: 0.13, peak: 0.20 + rnd() * 0.14, attack: 0.006,
        type: 'lowpass', freq: 520, q: 1.6, brown: 0.4, rnd,
      });
    }
    t += 0.5 + rnd() * 1.5;
  }
}

/* A music bed, not a tune.

   Everything here is a stack of held pitches with a slow filter breathing
   over it. No melody, deliberately: a bed has to be duckable and barely
   noticed, and the moment it has a tune it competes with the sentence it is
   under. What changes between moods is the HARMONY, not the arrangement —
   which interval you stack decides whether a scene feels open, held or
   grim, and it costs nothing to change.

   Frequencies are in D throughout, so cutting from one bed to another
   between scenes does not sound like a key change.

     · no third        -> neither major nor minor: open, unresolved
     · minor third     -> the default weight
     · tritone, quiet  -> unease, without announcing itself
     · two pitches a few cents apart -> a slow beat, which the ear reads as
       tension long before it can say why
*/
function drone(ac, out, rnd, {
  at = 0, dur = 16.4, level = 1,
  freqs = [73.42, 110.0, 146.83, 174.61, 220.0, 293.66],   // D minor
  amps = [1.0, 0.55, 0.42, 0.26, 0.18, 0.10],
  cutoff = 620, sweep = 240, sweepHz = 1 / 11.0,
  breathe = 0.13, breatheHz = 1 / 8.2,
  bright = 3,           // how many of the voices are sawtooth rather than triangle
} = {}) {
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.8;
  if (sweep) lfo(ac, f.frequency, { freq: sweepHz, amount: sweep, phaseAt: at });
  const g = ac.createGain();
  g.gain.value = 0.4 * level;
  if (breathe) lfo(ac, g.gain, { freq: breatheHz, amount: breathe * level, phaseAt: at });
  f.connect(g).connect(out);

  freqs.forEach((freq, i) => {
    const o = ac.createOscillator();
    o.type = i < bright ? 'sawtooth' : 'triangle';
    o.frequency.value = freq;
    o.detune.value = (rnd() - 0.5) * 9;
    const og = ac.createGain();
    og.gain.value = (amps[i] ?? 0.1) * 0.12;
    o.connect(og).connect(f);
    o.start(at); o.stop(at + dur);
  });
}

/* Weight and aftermath. D minor, the default. */
function sBedSolemn(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, { at, dur, level: 1 });
}

/* Wide and unresolved: root, fifth, octave and the ninth, and NO third at
   all. Without a third the ear cannot decide whether it is happy or sad,
   which is exactly right for an establishing scene that is explaining rather
   than mourning. Brighter cutoff, because this one is not supposed to feel
   heavy. */
function sBedOpen(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, {
    at, dur,
    freqs: [73.42, 110.0, 146.83, 220.0, 329.63, 440.0],   // D A D A E A
    amps: [1.0, 0.5, 0.38, 0.2, 0.13, 0.07],
    cutoff: 900, sweep: 300, sweepHz: 1 / 13.0, breathe: 0.1,
  });
}

/* Held breath. Two roots a few cents apart beat slowly against each other,
   and a tritone sits underneath too quietly to identify. Nothing resolves
   and nothing moves — the sound of a plan nobody has told you yet. */
function sBedTension(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, {
    at, dur,
    //     D2      D2 +7c   A2      G#2 (tritone) D3
    freqs: [73.42, 73.72, 110.0, 103.83, 146.83],
    amps: [1.0, 0.85, 0.3, 0.16, 0.22],
    cutoff: 380, sweep: 120, sweepHz: 1 / 17.0, breathe: 0.06, bright: 2,
  });
}

/* Movement without percussion. The same minor stack with a pulse ON THE
   DRONE rather than a drum over it, so it pushes without ever becoming a
   rhythm the narration has to fit around. Two pulses a second, which is
   roughly a fast walk. */
function sBedUrgent(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, {
    at, dur, level: 0.85,
    freqs: [73.42, 110.0, 146.83, 174.61, 220.0],
    amps: [1.0, 0.6, 0.45, 0.3, 0.16],
    cutoff: 700, sweep: 260, sweepHz: 1 / 6.5, breathe: 0,
  });
  // The pulse: a separate quiet voice that swells twice a second. Sine, so it
  // adds motion and no edge.
  const g = ac.createGain();
  g.gain.value = 0.05;
  lfo(ac, g.gain, { freq: 2.0, amount: 0.045, phaseAt: at });
  g.connect(out);
  for (const freq of [110.0, 220.0]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    o.start(at); o.stop(at + dur);
  }
}

/* Almost nothing. One low note and a thin shimmer five octaves up, beating
   very slowly. For a cold empty field before anyone has done anything —
   scene three opened on the same music as the epilogue, which flattened
   both. Normalisation brings every bed to the same RMS, so "quiet" here is
   a matter of texture, not level; the cue asks for a lower gainDb. */
function sBedStill(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, {
    at, dur,
    freqs: [73.42, 110.0, 587.33, 589.10],   // D2, A2, D5 and D5 beating
    amps: [1.0, 0.18, 0.05, 0.045],
    cutoff: 320, sweep: 90, sweepHz: 1 / 19.0, breathe: 0.05, bright: 1,
  });
}

/* The same weight with a slow field drum under it, for the marching
   stretches. The one bed that is allowed a pulse you can march to. */
function sBedMarch(ac, out, rnd, { at = 0, dur = 16.4 } = {}) {
  drone(ac, out, rnd, { at, dur, level: 0.8 });
  const pulse = 60 / 70;
  for (let t = at; t < at + dur; t += pulse) {
    tone(ac, out, { at: t, dur: 0.34, freq: 72, peak: 0.55, glideTo: 46, attack: 0.004 });
    hit(ac, out, { at: t, dur: 0.1, peak: 0.12, attack: 0.003, type: 'lowpass', freq: 300, q: 0.8, brown: 0.6, rnd });
  }
}

/* ------------------------------------------------------------
   Plucked strings — the second family of beds.

   Everything above this line is a drone, and every drone is in D on the
   same D–A–D–A–E–A stack. That was written for a war and it is one colour:
   six beds that differ only in which interval is missing. A pack about a
   wine valley reaching for `bedSolemn` gets a requiem under a sentence
   about fog, which is the sound equivalent of Join, or Die over the line
   about thirteen colonies.

   So: a second family, built on a plucked string rather than a held pitch.
   It is a different instrument, a different key family (A rather than D)
   and a different way of occupying time — a note, then air, then a note —
   which is what "a documentary score that carries a scene" sounds like
   when the scene is not a battle. Nothing here is a tune you could hum,
   for the same reason the drones are not: a bed with a melody competes
   with the sentence it is under.
   ------------------------------------------------------------ */

/**
 * One string, by Karplus–Strong.
 *
 * A short burst of noise into a delay line the length of one period, with
 * a two-sample average folded back in on every pass. The average is what
 * makes it a string: it delays by exactly one period and loses a little of
 * the top end each time round, so the note starts bright and goes warm as
 * it dies — which is the whole character of a plucked instrument and the
 * one thing an oscillator with an envelope cannot fake.
 *
 * Rendered straight into an AudioBuffer rather than wired as a feedback
 * graph, because a delay line shorter than a render quantum cannot be
 * built out of DelayNodes at all: 220 Hz is 218 samples and the minimum
 * is 128, with no guarantee below that.
 *
 * `colour` is the plectrum: 1 is raw noise and reads as a hard pick, 0.25
 * is the same burst smoothed and reads as a fingertip. `decay` is applied
 * once per period, so a low note rings longer than a high one from the
 * same number — which is what real strings do and what a per-second decay
 * would have got backwards.
 */
function stringBuffer(ac, rnd, { freq = 220, dur = 2.4, decay = 0.9965, colour = 0.6 }) {
  const sr = ac.sampleRate;
  const n = Math.max(2, Math.round(sr / Math.max(20, freq)));
  const len = Math.max(n + 2, Math.ceil(dur * sr));
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    last += colour * (w - last);
    d[i] = last;
  }
  for (let i = n; i < len; i++) d[i] = decay * 0.5 * (d[i - n] + d[i - n + 1]);
  return buf;
}

/** One note on that string, with a body filter, a tail and a place to sit. */
function pluck(ac, out, rnd, {
  at = 0, freq = 220, dur = 2.6, peak = 0.5,
  decay = 0.9965, colour = 0.6, tone: bright = 2400, pan = 0, send = null,
}) {
  at = Math.max(0, at);
  const src = ac.createBufferSource();
  src.buffer = stringBuffer(ac, rnd, { freq, dur, decay, colour });
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.005);
  // The string is already dying on its own; this only stops the buffer
  // ending on a non-zero sample, which is a click.
  g.gain.setValueAtTime(Math.max(0.0002, peak), at + Math.max(0.02, dur - 0.4));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g);

  let node = g;
  if (pan && typeof ac.createStereoPanner === 'function') {
    try {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    } catch { /* centre is not a failure */ }
  }
  node.connect(out);
  if (send) node.connect(send);
  src.start(at);
  src.stop(at + dur + 0.02);
  return g;
}

/**
 * A room to put the strings in.
 *
 * A short filtered feedback delay, not a reverb: the point is air around a
 * note, and `ctx.filter`-style expense is not available to us anyway. Keep
 * the tail well under SEAM so the loop still joins — a delay still ringing
 * at the fold is a tail crossfaded against a tail, which is fine, but only
 * because the pattern above it repeats at exactly the loop length.
 */
function room(ac, out, { time = 0.23, feedback = 0.30, level = 0.25, tone: damp = 2000 } = {}) {
  const send = ac.createGain();
  send.gain.value = 1;
  const d = ac.createDelay(2);
  d.delayTime.value = time;
  const fb = ac.createGain();
  fb.gain.value = feedback;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = damp; lp.Q.value = 0.3;
  const wet = ac.createGain();
  wet.gain.value = level;
  send.connect(d);
  d.connect(lp);
  lp.connect(fb);
  fb.connect(d);
  lp.connect(wet).connect(out);
  return send;
}

/**
 * The warmth under the strings.
 *
 * Triangles only and a low cutoff, so it reads as the room being warm
 * rather than as a synth pad holding a chord. Level rides one wobble()
 * curve, which means it breathes and still joins itself at the seam.
 */
function air(ac, out, rnd, {
  at = 0, dur = 16, freqs = [110, 164.81, 220], level = 1, cutoff = 700,
} = {}) {
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.4;
  const g = ac.createGain();
  g.gain.value = 0;
  curveOn(g.gain, {
    at, dur, mid: 0.055 * level, depth: 0.030 * level, min: 0.004,
    shape: wobble(rnd, [1, 2, 3, 5]),
  });
  f.connect(g).connect(out);
  freqs.forEach((freq, i) => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.detune.value = (rnd() - 0.5) * 8;
    const og = ac.createGain();
    og.gain.value = 0.7 / (i + 1.6);
    o.connect(og).connect(f);
    o.start(at); o.stop(at + dur);
  });
}

/**
 * Lay a chord pattern down, bar by bar, until `dur` is full.
 *
 * `bars` is a list of [bass, [upper…]] and the phrase length must divide
 * the catalogue duration exactly, or the loop joins one bar onto a
 * different one and you hear the seam every sixteen seconds.
 */
function figure(ac, out, rnd, {
  at, dur, bars, bar = 3.0, steps = [0, 0.25, 0.5, 0.75],
  send = null, bassPeak = 0.55, peak = 0.34, decay = 0.9965,
  colour = 0.6, tone: bright = 2800, bassTone = 1500, note = 2.6, sway = 0.018,
}) {
  for (let b = 0; b * bar < dur; b++) {
    const [bass, upper] = bars[b % bars.length];
    const t0 = at + b * bar;
    pluck(ac, out, rnd, {
      at: t0, freq: bass, dur: Math.min(note * 1.6, bar * 2.2), peak: bassPeak,
      decay: decay + (1 - decay) * 0.35, colour: colour * 0.6, tone: bassTone, send,
    });
    for (let i = 1; i < steps.length; i++) {
      const t = t0 + steps[i] * bar + (rnd() - 0.5) * sway;
      pluck(ac, out, rnd, {
        at: t, freq: upper[(i - 1) % upper.length], dur: note,
        peak: peak * (0.82 + rnd() * 0.3), decay, colour, tone: bright,
        // A guitarist's hand is one object; the strings are not in one
        // place. A little width is the difference between an instrument
        // in a room and a sample in the middle of your head.
        pan: (i % 2 ? 1 : -1) * 0.3,
        send,
      });
    }
  }
}

/* Sunlit and open. A major, a plagal rocking between the tonic and the
   fourth, and no minor anywhere: this is the bed for a scene that is
   explaining something good. Six bars of three seconds, so the phrase
   divides the loop. */
function sBedWarm(ac, out, rnd, { at = 0, dur = 18.0 } = {}) {
  const send = room(ac, out, { time: 0.21, feedback: 0.28, level: 0.24, tone: 2300 });
  const A = [110.00, [164.81, 220.00, 277.18]];       // A2 · E3 A3 C#4
  const D = [146.83, [220.00, 293.66, 369.99]];       // D3 · A3 D4 F#4
  const E = [82.41, [164.81, 207.65, 246.94]];        // E2 · E3 G#3 B3
  figure(ac, out, rnd, {
    at, dur, bar: 3.0, bars: [A, D, A, E, A, D], send,
    decay: 0.9962, colour: 0.55, tone: 3000, bassTone: 1500, note: 2.7,
  });
  air(ac, out, rnd, { at, dur, freqs: [110.00, 164.81, 220.00], level: 1.0, cutoff: 640 });
}

/* Weight without grief. A minor, an octave lower, twice as slow, and the
   strings damped — the bed for ground that has been there a long time and
   an argument that is going to take a while. */
function sBedPatient(ac, out, rnd, { at = 0, dur = 17.6 } = {}) {
  const send = room(ac, out, { time: 0.26, feedback: 0.32, level: 0.26, tone: 1500 });
  const Am = [110.00, [164.81, 220.00, 261.63]];      // A2 · E3 A3 C4
  const F = [87.31, [174.61, 220.00, 261.63]];        // F2 · F3 A3 C4
  const G = [98.00, [146.83, 196.00, 246.94]];        // G2 · D3 G3 B3
  figure(ac, out, rnd, {
    at, dur, bar: 4.4, steps: [0, 0.25, 0.5, 0.75], bars: [Am, F, Am, G], send,
    bassPeak: 0.5, peak: 0.28, decay: 0.9975, colour: 0.35, tone: 1500, bassTone: 900,
    note: 3.6,
  });
  air(ac, out, rnd, { at, dur, freqs: [110.00, 164.81, 220.00], level: 1.1, cutoff: 460 });
}

/* Almost nothing, and damp. One note every two and a half seconds, no
   third so it never decides how it feels, and a long room. For a scene
   where the picture is doing the work and the score's only job is to say
   the air is heavy. */
function sBedMist(ac, out, rnd, { at = 0, dur = 20.8 } = {}) {
  const send = room(ac, out, { time: 0.31, feedback: 0.36, level: 0.34, tone: 1200 });
  const notes = [110.00, 164.81, 220.00, 246.94, 164.81, 220.00, 110.00, 329.63];
  const step = 2.6;
  for (let i = 0; i * step < dur; i++) {
    const n = notes[i % notes.length];
    pluck(ac, out, rnd, {
      at: at + i * step + (rnd() - 0.5) * 0.05,
      freq: n, dur: 3.2, peak: 0.36 + rnd() * 0.1,
      decay: 0.998, colour: 0.22, tone: 900,
      pan: (i % 2 ? 1 : -1) * 0.25, send,
    });
  }
  air(ac, out, rnd, { at, dur, freqs: [55.00, 82.41, 110.00], level: 1.4, cutoff: 300 });
}

/* Under the ground. Low single notes with the room turned up, which is
   the one honest way to say "this is indoors and it is made of stone".
   Eight notes over sixteen seconds and nothing else. */
function sBedHollow(ac, out, rnd, { at = 0, dur = 16.0 } = {}) {
  const send = room(ac, out, { time: 0.37, feedback: 0.40, level: 0.26, tone: 900 });
  const notes = [55.00, 82.41, 110.00, 130.81, 55.00, 98.00, 110.00, 82.41];
  const step = 2.0;
  for (let i = 0; i * step < dur; i++) {
    pluck(ac, out, rnd, {
      at: at + i * step + (rnd() - 0.5) * 0.04,
      // Shorter than it looks it should be, and that is the whole fix.
      // The first version rang for 2.8 s on a 2.0 s step with a decay of
      // 0.9985, so every note was still at half strength when the next
      // one landed: measured in the band a phone can radiate, it had NO
      // detectable note attacks at all — eight plucks that arrived as one
      // continuous swell. A note now ends 0.2 s before the next begins
      // and the ROOM fills the gap, which is what a cellar actually does
      // and reads as nine attacks instead of none.
      freq: notes[i % notes.length], dur: 1.8, peak: 0.5,
      decay: 0.9955, colour: 0.32, tone: 820, send,
    });
  }
  air(ac, out, rnd, { at, dur, freqs: [55.00, 82.41], level: 1.2, cutoff: 240 });
}

/* The one with a pulse you could tap. A rocking six-eight on double stops
   a third apart, each note played as a COURSE — two strings a few cents
   apart, a few milliseconds apart — which is the whole sound of a
   mandolin and costs one extra call. Warm, evening, and still not a tune:
   two chords, no melody note held long enough to sing. */
function sBedLilt(ac, out, rnd, { at = 0, dur = 16.8 } = {}) {
  const send = room(ac, out, { time: 0.19, feedback: 0.26, level: 0.22, tone: 2600 });
  const A = [110.00, [277.18, 329.63]];               // A2 · C#4 E4
  const D = [146.83, [293.66, 369.99]];               // D3 · D4 F#4
  const E = [82.41, [246.94, 329.63]];                // E2 · B3 E4
  const bars = [A, D, A, E, A, D, A, A];
  const bar = 2.1;
  const course = (t, freq, peak, pan) => {
    for (const [c, k] of [[-4, 0], [4, 0.006]]) {
      pluck(ac, out, rnd, {
        at: t + k, freq: freq * 2 ** (c / 1200), dur: 1.5, peak: peak * 0.62,
        decay: 0.9945, colour: 0.85, tone: 4200, pan, send,
      });
    }
  };
  for (let b = 0; b * bar < dur; b++) {
    const [bass, pair] = bars[b % bars.length];
    const t0 = at + b * bar;
    for (const q of [0, 0.5]) {
      pluck(ac, out, rnd, {
        at: t0 + q * bar, freq: bass, dur: 1.6, peak: 0.42,
        decay: 0.997, colour: 0.4, tone: 1300, send,
      });
    }
    // Two, three | two, three: the second and third of each group are the
    // rock, and they are quieter than the one they hang off.
    const off = [1 / 6, 2 / 6, 4 / 6, 5 / 6];
    off.forEach((u, i) => {
      const t = t0 + u * bar + (rnd() - 0.5) * 0.012;
      course(t, pair[i % pair.length], (i % 2 ? 0.20 : 0.26) + rnd() * 0.04,
             (i % 2 ? 1 : -1) * 0.28);
    });
  }
  air(ac, out, rnd, { at, dur, freqs: [110.00, 164.81, 220.00], level: 0.8, cutoff: 700 });
}

/* ------------------------------------------------------------
   Things that happen in a kitchen rather than on a battlefield
   ------------------------------------------------------------ */

/* A cork drawn from a bottle. Two events, and the first one is the one
   everybody forgets: cork against wet glass squeals as it comes up the
   neck, in tiny jerks, rising in pitch as less of it is left inside.

   The pop itself is not the cork at all — it is the air column in the
   neck, which is why it has a pitch and why a big bottle pops lower than
   a small one. Around 230 Hz, falling fast, with a bright click on top. */
function sCorkDraw(ac, out, rnd, { at = 0 } = {}) {
  let t = at;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    hit(ac, out, {
      at: t, dur: 0.05 + rnd() * 0.05, peak: 0.14 + u * 0.22, attack: 0.006,
      type: 'bandpass', freq: 420 + u * 700 + rnd() * 90, q: 12, rnd,
    });
    t += 0.035 + rnd() * 0.045;
  }
  const pop = t + 0.05;
  tone(ac, out, { at: pop, dur: 0.16, freq: 232, peak: 0.90, glideTo: 150, attack: 0.0012 });
  tone(ac, out, { at: pop, dur: 0.09, freq: 464, peak: 0.26, glideTo: 320, attack: 0.001 });
  hit(ac, out, { at: pop, dur: 0.03, peak: 0.50, attack: 0.0006, type: 'bandpass', freq: 2600, q: 0.8, rnd });
  hit(ac, out, { at: pop + 0.01, dur: 0.28, peak: 0.10, attack: 0.012, type: 'lowpass', freq: 900, q: 0.6, brown: 0.4, rnd });
}

/* Wine going into a glass.

   The stream is a band of noise, and the band CLIMBS: as the glass fills,
   the air column above the wine gets shorter and the note it makes goes
   up. That rise is the entire difference between a glass being filled and
   a tap running, and it is free — one exponential ramp on a filter.

   The bubbles are the other half. A bubble's pitch RISES as it collapses,
   so each one is a very short sine gliding upward; scattered evenly they
   sound like a machine, so they come in clumps, the same reason the crowd
   above does. */
function sPour(ac, out, rnd, { at = 0, dur = 3.2 } = {}) {
  const ch = out.channelCount || 2;
  const body = dur - 0.45;
  const src = ac.createBufferSource();
  src.buffer = noise(ac, body, rnd, ch, 0.25);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 0.85;
  f.frequency.setValueAtTime(760, at);
  f.frequency.exponentialRampToValueAtTime(1500, at + body);
  const g = ac.createGain();
  curveOn(g.gain, { at, dur: body, mid: 0.30, depth: 0.10, min: 0.05,
                    shape: wobble(rnd, [1, 2, 3, 5]) });
  // A separate window, because curveOn keeps a floor and a stream that
  // starts at its floor starts with a click.
  const env = ac.createGain();
  const steps = 160;
  const arr = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    arr[i] = Math.min(1, u / 0.05) * Math.min(1, (1 - u) / 0.16);
  }
  try { env.gain.setValueCurveAtTime(arr, Math.max(0, at), body); } catch { /* busy */ }
  src.connect(f).connect(g).connect(env).connect(out);
  src.start(at); src.stop(at + body);

  let t = at + 0.10;
  while (t < at + body) {
    const clump = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < clump; i++) {
      const f0 = 480 + rnd() * 900;
      tone(ac, out, {
        at: t + i * (0.02 + rnd() * 0.03), dur: 0.03 + rnd() * 0.03,
        freq: f0, peak: 0.09 + rnd() * 0.13, glideTo: f0 * (1.4 + rnd() * 0.8),
        attack: 0.001,
      });
    }
    t += 0.05 + rnd() * rnd() * 0.28;
  }
  // The last glug, when the bottle comes back up.
  tone(ac, out, { at: at + body + 0.05, dur: 0.15, freq: 190, peak: 0.42, glideTo: 118, attack: 0.002 });
}

/* Perlage: the bead in a glass of something lightly sparkling. Each
   bubble is a pinhead and far too short to have a pitch, so this is a few
   hundred clicks whose density decays — a glass calms down, it does not
   fizz at a constant rate — over a thin sheet of high noise. */
function sFizz(ac, out, rnd, { at = 0, dur = 4.0 } = {}) {
  for (let i = 0; i < 520; i++) {
    // Exponentially weighted towards the front: most of the bead happens
    // in the first second, which is what pouring one actually sounds like.
    const u = Math.min(1, -Math.log(1 - rnd() * 0.985) / 3.2);
    hit(ac, out, {
      at: at + u * dur, dur: 0.004 + rnd() * 0.009, peak: 0.05 + rnd() * 0.12,
      attack: 0.0006, type: 'bandpass', freq: 2400 + rnd() * 5200, q: 3 + rnd() * 4, rnd,
    });
  }
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, out.channelCount || 2, 0);
  const f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 3200; f.Q.value = 0.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.09, at + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);
}

/* Open country in late summer, heard from inside it.

   Three layers and none of them loud. A vineyard in September is quiet,
   and the tell that a room was faked is always that the room is too loud.

   The cicadas are the interesting one: the buzz is not a pitch, it is a
   narrow band of noise CHOPPED at about forty a second. The chop is the
   insect and the band is how far away it is. */
function sVineyard(ac, out, rnd, { at = 0, dur = 12.0 } = {}) {
  const ch = out.channelCount || 2;
  const breeze = wobble(rnd, [1, 2, 3, 5]);

  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, ch, 0.85);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = 0.5;
  curveOn(f.frequency, { at, dur, mid: 340, depth: 180, shape: breeze, min: 90 });
  const g = ac.createGain();
  curveOn(g.gain, { at, dur, mid: 0.16, depth: 0.10, shape: breeze, min: 0.012 });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  const ci = ac.createBufferSource();
  ci.buffer = noise(ac, dur, rnd, ch, 0);
  const cf = ac.createBiquadFilter();
  cf.type = 'bandpass'; cf.frequency.value = 4600; cf.Q.value = 3.2;
  const cg = ac.createGain();
  cg.gain.value = 0.030;
  lfo(ac, cg.gain, { freq: 41, amount: 0.026, type: 'triangle', phaseAt: at });
  const swell = ac.createGain();
  swell.gain.value = 0;
  curveOn(swell.gain, { at, dur, mid: 0.6, depth: 0.4, min: 0.05,
                        shape: wobble(rnd, [1, 2, 5]) });
  ci.connect(cf).connect(cg).connect(swell).connect(out);
  ci.start(at); ci.stop(at + dur);

  // Two or three birds, a long way off. Short glides, in twos and threes,
  // with several seconds of nothing between: a bird you can hear clearly
  // is a bird in the microphone, not a bird in a field.
  let t = at + rnd() * 2.4;
  while (t < at + dur) {
    const calls = 2 + Math.floor(rnd() * 3);
    const f0 = 2600 + rnd() * 1500;
    for (let i = 0; i < calls; i++) {
      tone(ac, out, {
        at: t + i * (0.09 + rnd() * 0.07), dur: 0.05 + rnd() * 0.04,
        freq: f0 * (0.9 + rnd() * 0.25), peak: 0.05 + rnd() * 0.05,
        glideTo: f0 * (1.15 + rnd() * 0.3), attack: 0.008,
      });
    }
    t += 2.8 + rnd() * 3.4;
  }
}

/* A cellar cut into rock: no air movement, a lot of low end, a drip every
   few seconds and a barrel hoop taking up a load now and then. The drip
   rises in pitch, for the same reason the bubbles in the pour do. */
function sCellar(ac, out, rnd, { at = 0, dur = 12.0 } = {}) {
  const ch = out.channelCount || 2;
  const src = ac.createBufferSource();
  src.buffer = noise(ac, dur, rnd, ch, 0.95);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 120; f.Q.value = 0.5;
  const g = ac.createGain();
  curveOn(g.gain, { at, dur, mid: 0.34, depth: 0.10, min: 0.05,
                    shape: wobble(rnd, [1, 2, 3]) });
  src.connect(f).connect(g).connect(out);
  src.start(at); src.stop(at + dur);

  let t = at + 0.7 + rnd() * 2.0;
  while (t < at + dur) {
    const f0 = 900 + rnd() * 700;
    hit(ac, out, { at: t, dur: 0.012, peak: 0.20 + rnd() * 0.10, attack: 0.0008,
                   type: 'bandpass', freq: f0 * 2.4, q: 2.4, rnd });
    tone(ac, out, { at: t, dur: 0.08 + rnd() * 0.05, freq: f0, peak: 0.22,
                    glideTo: f0 * 1.9, attack: 0.001 });
    t += 2.4 + rnd() * 3.0;
  }

  let c = at + 1.6 + rnd() * 4.0;
  while (c < at + dur) {
    hit(ac, out, { at: c, dur: 0.45 + rnd() * 0.4, peak: 0.10 + rnd() * 0.07, attack: 0.07,
                   type: 'bandpass', freq: 210 + rnd() * 190, q: 8,
                   sweepTo: 130 + rnd() * 60, rnd });
    c += 5.0 + rnd() * 4.0;
  }
}

/* ------------------------------------------------------------
   Things that happen before gunpowder
   ------------------------------------------------------------ */

/** One note on a valveless brass horn. */
function brassNote(ac, out, rnd, { at, dur, freq, peak = 0.5 }) {
  at = Math.max(0, at);
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq * 0.985, at);
  o.frequency.exponentialRampToValueAtTime(freq, at + 0.09);
  lfo(ac, o.detune, { freq: 4.6, amount: 9, phaseAt: at });
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = 1.4;
  // Brass is the family whose brightness rides its loudness: it opens up
  // as it is pushed and closes as it is let go. A horn that gets louder
  // without opening up is an organ, which is what the first attempt was.
  f.frequency.setValueAtTime(freq * 2, at);
  f.frequency.linearRampToValueAtTime(freq * 9, at + 0.22);
  f.frequency.linearRampToValueAtTime(freq * 4, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.13);
  g.gain.setValueAtTime(Math.max(0.0002, peak), at + Math.max(0.15, dur - 0.30));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(f).connect(g).connect(out);
  o.start(at); o.stop(at + dur + 0.02);
  hit(ac, out, { at, dur: 0.10, peak: peak * 0.18, attack: 0.02,
                 type: 'bandpass', freq: freq * 6, q: 0.8, rnd });
}

/* The cornu. A Roman army had no drums and no bells: it was moved by
   horn, and this is the sound that has to do the work `drums`, `volley`
   and `cannon` were wrongly doing in 44 BC.

   A short low note and then a longer one a fifth up, each doubled a fifth
   above itself. Parallel fifths are what an instrument with no valves can
   actually play, and they are most of why this reads as ancient rather
   than as a hunting horn. */
function sWarHorn(ac, out, rnd, { at = 0 } = {}) {
  brassNote(ac, out, rnd, { at, dur: 0.95, freq: 98.00, peak: 0.55 });
  brassNote(ac, out, rnd, { at: at + 0.02, dur: 0.92, freq: 146.83, peak: 0.28 });
  brassNote(ac, out, rnd, { at: at + 1.02, dur: 1.90, freq: 146.83, peak: 0.60 });
  brassNote(ac, out, rnd, { at: at + 1.05, dur: 1.85, freq: 220.00, peak: 0.30 });
}

/* Two edges meeting. A blade is not tuned, so the partials are not a
   chord — the ratios below are deliberately irrational-looking. */
function clash(ac, out, rnd, { at, peak = 1 }) {
  const f0 = 1500 + rnd() * 1400;
  for (const [r, a, life] of [[1, 1, 0.28], [1.63, 0.6, 0.20], [2.41, 0.4, 0.14], [3.77, 0.22, 0.09]]) {
    tone(ac, out, { at, dur: life * (0.7 + rnd() * 0.6), freq: f0 * r,
                    peak: 0.16 * a * peak, attack: 0.0008 });
  }
  hit(ac, out, { at, dur: 0.035, peak: 0.55 * peak, attack: 0.0006,
                 type: 'bandpass', freq: 3400, q: 0.7, rnd });
  hit(ac, out, { at, dur: 0.10, peak: 0.16 * peak, attack: 0.002,
                 type: 'lowpass', freq: 700, q: 0.8, brown: 0.4, rnd });
}

/* Hand-to-hand: nine impacts over two seconds, a third of them a shield
   taking the blow rather than a blade. Ragged, because a line of men
   fighting is not a rhythm — the same reason `volley` is ragged. */
function sSwords(ac, out, rnd, { at = 0 } = {}) {
  let t = at + 0.02;
  for (let i = 0; i < 9; i++) {
    if (rnd() < 0.32) {
      tone(ac, out, { at: t, dur: 0.18, freq: 128, peak: 0.50, glideTo: 74, attack: 0.002 });
      hit(ac, out, { at: t, dur: 0.09, peak: 0.32, attack: 0.001,
                     type: 'lowpass', freq: 620, q: 1.2, brown: 0.5, rnd });
    } else {
      clash(ac, out, rnd, { at: t, peak: 0.6 + rnd() * 0.4 });
    }
    t += 0.09 + rnd() ** 2 * 0.34;
  }
}

/* ------------------------------------------------------------
   The catalogue

   `kind` decides three things at once: whether the buffer is looped, how
   loudly it is normalised, and whether it gets a seamless join.

   `years` is the span in which the thing existed, and it is the reason
   `content/roman-empire/chapter-44bc-octavian.json` could fire three
   cannon, a musket, two volleys and a church bell in 44 BC and validate
   clean: nothing checked. tools/check-script.py now refuses an effect
   whose years do not overlap the pack's era. Leave it off when the sound
   is timeless — wind, a crowd, the sea — because a range nobody can
   defend is worse than none. Music never carries one: a score is not
   diegetic and nobody thinks the mandolin is in the room.
   ------------------------------------------------------------ */

const CATALOGUE = {
  musket:     { kind: 'oneshot', dur: 1.10, years: [1400, 1900], synth: sMusket,     label: { no: 'Muskettskudd', en: 'Musket shot' } },
  volley:     { kind: 'oneshot', dur: 2.60, years: [1400, 1960], synth: sVolley,     label: { no: 'Salve', en: 'Volley' } },
  cannon:     { kind: 'oneshot', dur: 3.40, years: [1350, 2100], synth: sCannon,     label: { no: 'Kanon', en: 'Cannon' } },
  churchBell: { kind: 'oneshot', dur: 13.00, years: [500, 2100], synth: sChurchBell, label: { no: 'Kirkeklokke', en: 'Church bell' } },
  alarmBell:  { kind: 'oneshot', dur: 8.20, years: [500, 2100], synth: sAlarmBell,  label: { no: 'Alarmklokke', en: 'Alarm bell' } },
  fife:       { kind: 'oneshot', dur: 2.90, years: [1400, 2100], synth: sFife,       label: { no: 'Tverrfløyte', en: 'Fife' } },
  warHorn:    { kind: 'oneshot', dur: 3.30, years: [-1500, 1600], synth: sWarHorn,   label: { no: 'Krigshorn', en: 'War horn' } },
  swords:     { kind: 'oneshot', dur: 2.60, years: [-2000, 1900], synth: sSwords,    label: { no: 'Sverdkamp', en: 'Blades' } },
  corkDraw:   { kind: 'oneshot', dur: 1.40, years: [1650, 2100], synth: sCorkDraw,   label: { no: 'Kork som trekkes', en: 'A cork drawn' } },
  pour:       { kind: 'oneshot', dur: 3.20, synth: sPour,        label: { no: 'Vin i glass', en: 'Wine poured' } },
  fizz:       { kind: 'oneshot', dur: 4.00, years: [1650, 2100], synth: sFizz,       label: { no: 'Perling', en: 'Bead' } },

  drums:      { kind: 'loop', dur: 60 / 112 * 8, years: [1300, 2100], synth: sDrums, label: { no: 'Tromme', en: 'Drums' } },
  hooves:     { kind: 'loop', dur: 3.28,  synth: sHooves,        label: { no: 'Hovslag', en: 'Hooves' } },
  boots:      { kind: 'loop', dur: 4.00,  synth: sBoots,         label: { no: 'Marsjstøvler', en: 'Marching boots' } },
  crowd:      { kind: 'loop', dur: 8.00,  synth: sCrowd,         label: { no: 'Folkemengde', en: 'Crowd' } },
  wind:       { kind: 'loop', dur: 9.00,  synth: sWind,          label: { no: 'Vind', en: 'Wind' } },
  rain:       { kind: 'loop', dur: 6.00,  synth: sRain,          label: { no: 'Regn', en: 'Rain' } },
  sea:        { kind: 'loop', dur: 12.00, synth: sSea,           label: { no: 'Sjø', en: 'Sea' } },
  rigging:    { kind: 'loop', dur: 10.00, years: [-1000, 1950], synth: sRigging,     label: { no: 'Rigg', en: 'Rigging' } },
  vineyard:   { kind: 'loop', dur: 12.00, synth: sVineyard,      label: { no: 'Åpent lende', en: 'Open country' } },
  cellar:     { kind: 'loop', dur: 12.00, synth: sCellar,        label: { no: 'Kjeller', en: 'Cellar' } },

  bedSolemn:  { kind: 'music', dur: 16.00, synth: sBedSolemn,    label: { no: 'Underlag: alvor', en: 'Bed: solemn' } },
  bedMarch:   { kind: 'music', dur: 16.00, synth: sBedMarch,     label: { no: 'Underlag: marsj', en: 'Bed: march' } },
  bedOpen:    { kind: 'music', dur: 16.00, synth: sBedOpen,      label: { no: 'Underlag: åpent', en: 'Bed: open' } },
  bedTension: { kind: 'music', dur: 16.00, synth: sBedTension,   label: { no: 'Underlag: spenning', en: 'Bed: tension' } },
  bedUrgent:  { kind: 'music', dur: 16.00, synth: sBedUrgent,    label: { no: 'Underlag: hastverk', en: 'Bed: urgent' } },
  bedStill:   { kind: 'music', dur: 16.00, synth: sBedStill,     label: { no: 'Underlag: stillhet', en: 'Bed: stillness' } },

  // The plucked family. Same grammar, no vocabulary in common.
  bedWarm:    { kind: 'music', dur: 18.00, synth: sBedWarm,      label: { no: 'Underlag: varmt', en: 'Bed: warm' } },
  bedPatient: { kind: 'music', dur: 17.60, synth: sBedPatient,   label: { no: 'Underlag: tålmodig', en: 'Bed: patient' } },
  bedMist:    { kind: 'music', dur: 20.80, synth: sBedMist,      label: { no: 'Underlag: dis', en: 'Bed: mist' } },
  bedHollow:  { kind: 'music', dur: 16.00, synth: sBedHollow,    label: { no: 'Underlag: hulrom', en: 'Bed: hollow' } },
  bedLilt:    { kind: 'music', dur: 16.80, synth: sBedLilt,      label: { no: 'Underlag: vugging', en: 'Bed: lilt' } },
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
  let root = base;

  /**
   * Take a manifest after construction.
   *
   * A pack's sound.json arrives over the network, and the library has to
   * exist before that lands — the soundscape is built at mount time and the
   * first cue can fire seconds later. So the manifest is applied when it
   * turns up, and anything already rendered for those names is dropped so the
   * next request goes to the file instead of the synthesised version.
   *
   * If it never arrives, every effect is still synthesised and the chapter
   * sounds exactly as it did before. That is the fallback working, not a
   * failure to report.
   */
  function addManifest(m, { base: b } = {}) {
    if (b != null) root = b;
    const problems = validateManifest(m);
    for (const p of problems) console.warn(`[sound] manifest: ${p}`);
    let taken = 0;
    for (const [name, e] of Object.entries(m || {})) {
      if (!(e && e.file && e.licence && e.credit)) continue;
      files[name] = e;
      taken += 1;
      for (const key of [...cache.keys()]) {
        if (key.startsWith(`${name}@`)) cache.delete(key);
      }
    }
    return taken;
  }

  // Keyed by sample rate: an AudioBuffer rendered at 44.1k played through a
  // 48k context is the right sound at the wrong pitch.
  const cache = new Map();

  if (manifest) addManifest(manifest);

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
      // The span in which the thing existed, or null for a timeless one.
      // A pack's own entry may override it — a recorded bell for a
      // medieval pack is not the same bell as a synthesised one.
      years: f?.years ?? c?.years ?? null,
      source: f ? 'file' : 'synth',
      licence: f?.licence ?? 'Synthesised in this repository',
      // A synthesised effect has no author to credit. Naming a subject here
      // was a leak: the same catalogue serves every pack.
      credit: f?.credit ?? 'Synthesised',
    };
  }

  async function decodeFile(entry, ctx) {
    const res = await fetch(root + entry.file, { cache: 'force-cache' });
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

  return { names, meta, get, warm, addManifest,
           isLooping: (n) => (meta(n)?.kind ?? 'oneshot') !== 'oneshot' };
}

/** The catalogue keys, for anything that needs the list without a context. */
export const EFFECTS = Object.freeze(Object.keys(CATALOGUE));
