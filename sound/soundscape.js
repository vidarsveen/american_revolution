/* ============================================================
   soundscape.js — music, ambience and one-shots under a narration.

   The ducking rule, which is the whole design:

       the music level is a function of time, not a response to a signal.

   The engine already knows every millisecond of speech — timing.<lang>.json
   gives every beat a start and a duration — so `schedule` is a list of
   speech intervals and tick(t) simply asks whether t is inside one. That
   makes the bed deterministic, testable with no audio at all, correct after
   a seek, and above all incapable of touching the narration: nothing here
   goes anywhere near the <audio> element the voice comes out of. It is the
   same rule engine/player.js keeps for the picture (see rebuildTo).

   A signal-based sidechain would need the voice routed through a
   MediaElementAudioSourceNode, which is a permanent capture of the element
   and can fail on iOS, before a gesture, or on an element that has not
   loaded — silently, and for the rest of the session. The README says audio
   failing is not the app failing. It has to be true for the voice above all.

   `instant` — the flag the player sets while rebuilding after a seek:

     · music and ambience take the new state with no fade. The picture after
       a seek is the end state; so is the mix.
     · one-shots are skipped entirely. Scrubbing back through Lexington must
       not fire forty muskets. engine/scenes/map.js flash() returns early on
       `instant` for exactly this reason; same discipline.
   ============================================================ */

/**
 * The bed only rides back up between two beats if it would stay up at least
 * this long. Anything shorter is pumping, and pumping draws far more
 * attention than the music ever did.
 */
const MIN_OPEN_MS = 500;

/**
 * Speech intervals from a compiled scene's beats.
 * `beats` is what engine/script.js produces: { start, dur, gapAfter, … }.
 */
export function scheduleFromBeats(beats = []) {
  return beats
    .filter((b) => b && b.dur > 0)
    .map((b) => ({ start: b.start, end: b.start + b.dur }));
}

export function createSoundscape({
  mixer,
  library,
  schedule = [],
  bedDb = -14,
  duckDb = -12,
  lookAheadMs = 250,
  attackTau = 0.08,
  releaseTau = 0.25,
} = {}) {
  let bed = bedDb;
  let duck = duckDb;
  let look = lookAheadMs / 1000;
  let attack = attackTau;
  let release = releaseTau;

  let raw = schedule;                 // as given; merging depends on look-ahead
  let intervals = merge(raw);
  let silent = false;                 // the player is in its timed fallback
  let lastDb = null;                  // last level actually asked for

  let music = null;                   // { name, src, gain }
  let ambience = null;
  const stats = { sfx: 0, sfxSkipped: 0, sfxUnavailable: 0 };

  /* ---------- schedule ------------------------------------- */

  function merge(list) {
    const sorted = (list || [])
      .filter((s) => s && Number.isFinite(s.start) && s.end > s.start)
      .map((s) => ({ start: s.start, end: s.end }))
      .sort((a, b) => a.start - b.start);
    const out = [];
    for (const s of sorted) {
      const prev = out[out.length - 1];
      // The bed is already falling `look` seconds before the next beat, so the
      // window it would actually spend open is the gap minus the look-ahead.
      // Measured against a real read, a 500 ms gap leaves 250 ms of music —
      // which is a bump, not a breath. Merge those; keep the real pauses.
      const open = prev ? s.start - look - prev.end : Infinity;
      if (prev && open < MIN_OPEN_MS / 1000) prev.end = Math.max(prev.end, s.end);
      else out.push(s);
    }
    return out;
  }

  function setSchedule(list) {
    raw = list || [];
    intervals = merge(raw);
    lastDb = null;
  }

  /** True if the voice is speaking at t, or is about to be. */
  function isSpeaking(t) {
    for (const s of intervals) {
      if (t < s.start - look) return false;   // sorted: nothing later can match
      if (t < s.end) return true;
    }
    return false;
  }

  /**
   * The music level at time t, in dB. Pure — no context, no clock, no state
   * beyond the settings. Everything about the ducker can be tested from a
   * command line with this one function.
   */
  function targetAt(t) {
    return isSpeaking(t) ? bed + duck : bed;
  }

  /* ---------- the ducker ----------------------------------- */

  /**
   * Move the music bus towards the level t asks for. Fast down, slow up —
   * the look-ahead means the bed is already falling before the first
   * syllable, and the slow release means it comes back without a swell in
   * the middle of a sentence.
   */
  function tick(t) {
    if (silent) return;
    const db = targetAt(t);
    if (db === lastDb) return;         // do not re-schedule an unchanged target
    const tau = lastDb === null ? 0.01 : (db < lastDb ? attack : release);
    lastDb = db;
    mixer.setGain('music', db, 0, { tau });
  }

  /* ---------- music ---------------------------------------- */

  async function playMusic(name = 'bedSolemn', { instant = false, fadeMs = 900, gainDb = 0 } = {}) {
    if (silent) return false;
    const ctx = mixer.context();
    if (!ctx || !mixer.ready()) return false;
    if (music && music.name === name) return true;

    const buf = await library.get(name, ctx);
    if (!buf) return false;
    // Let the outgoing bed fade under the incoming one. Cutting it dead is a
    // hole in the mix on every scene that changes its music.
    stopMusic({ instant, fadeMs });

    const voice = startLoop('music', name, buf, instant, fadeMs, gainDb);
    if (!voice) return false;
    music = voice;
    // The bus is where the ducking lives, so set it from the schedule rather
    // than opening at full and dropping a beat later.
    mixer.setGain('music', lastDb ?? bed, 0);
    return true;
  }

  function stopMusic({ instant = false, fadeMs = 600 } = {}) {
    music = fadeOut(music, instant, fadeMs);
  }

  /* ---------- ambience ------------------------------------- */

  /** `name` null stops it. Crossfades unless `instant`. */
  async function setAmbience(name, { instant = false, fadeMs = 1200, gainDb = 0 } = {}) {
    if (silent) return false;
    if (ambience && ambience.name === name) return true;
    if (!name) { ambience = fadeOut(ambience, instant, fadeMs); return true; }

    const ctx = mixer.context();
    if (!ctx || !mixer.ready()) return false;
    const buf = await library.get(name, ctx);
    if (!buf) return false;

    const old = ambience;
    const voice = startLoop('ambience', name, buf, instant, fadeMs, gainDb);
    if (!voice) return false;
    ambience = voice;
    fadeOut(old, instant, fadeMs);
    return true;
  }

  /* ---------- one-shots ------------------------------------ */

  /**
   * Fire an effect once. Returns false when nothing was played, including
   * the deliberate cases — a caller that wants to know why can read stats().
   */
  function playSfx(name, { instant = false, gainDb = 0, rate = 1 } = {}) {
    // First and before anything async: rebuilding the picture after a seek
    // must not queue up every shot the chapter has fired so far.
    if (instant) { stats.sfxSkipped += 1; return false; }
    if (silent) { stats.sfxSkipped += 1; return false; }
    const ctx = mixer.context();
    if (!ctx || !mixer.ready()) { stats.sfxUnavailable += 1; return false; }

    library.get(name, ctx).then((buf) => {
      const bus = mixer.bus('sfx');
      if (!buf || !bus || !mixer.ready()) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const gain = ctx.createGain();
        gain.gain.value = 10 ** (gainDb / 20);
        src.connect(gain).connect(bus);
        src.start(0);
        src.onended = () => { try { gain.disconnect(); } catch { /* gone */ } };
        stats.sfx += 1;
      } catch (err) {
        console.warn(`[sound] could not fire "${name}"`, err);
      }
    });
    return true;
  }

  /* ---------- state ---------------------------------------- */

  /**
   * The player could not get a voice out and is running the chapter on a
   * timer. A chapter with no narration must not play cannon over the
   * captions — the sound was there to support a voice that is not there.
   */
  function setSilent(on) {
    silent = Boolean(on);
    if (silent) {
      stopMusic({ instant: true });
      setAmbience(null, { instant: true });
    }
  }

  function setBed(db) { bed = db; lastDb = null; }

  /** Depth in dB (negative), or an object to change the ducker's shape. */
  function setDuck(dbOrOpts) {
    if (typeof dbOrOpts === 'number') { duck = dbOrOpts; }
    else if (dbOrOpts && typeof dbOrOpts === 'object') {
      if (Number.isFinite(dbOrOpts.db)) duck = dbOrOpts.db;
      if (Number.isFinite(dbOrOpts.attackTau)) attack = dbOrOpts.attackTau;
      if (Number.isFinite(dbOrOpts.releaseTau)) release = dbOrOpts.releaseTau;
      if (Number.isFinite(dbOrOpts.lookAheadMs)) {
        look = dbOrOpts.lookAheadMs / 1000;
        // Which pauses are worth opening for is a function of the look-ahead,
        // so the merge has to be redone from the schedule as given.
        intervals = merge(raw);
      }
    }
    lastDb = null;
  }

  function reset() {
    stopMusic({ instant: true });
    setAmbience(null, { instant: true });
    lastDb = null;
    stats.sfx = 0; stats.sfxSkipped = 0; stats.sfxUnavailable = 0;
  }

  function state() {
    return {
      ready: mixer.ready(),
      silent,
      bedDb: bed,
      duckDb: duck,
      lookAheadMs: look * 1000,
      music: music?.name ?? null,
      ambience: ambience?.name ?? null,
      targetDb: lastDb,
      busDb: mixer.levelOf ? mixer.levelOf('music') : null,
      intervals: intervals.length,
    };
  }

  /* ---------- helpers -------------------------------------- */

  /** One looping voice on a bus. Returns null rather than throwing. */
  function startLoop(busName, name, buf, instant, fadeMs, gainDb) {
    const ctx = mixer.context();
    const bus = mixer.bus(busName);
    if (!ctx || !bus) return null;
    try {
      const gain = ctx.createGain();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const target = 10 ** (gainDb / 20);
      const now = ctx.currentTime;
      if (instant) {
        gain.gain.setValueAtTime(target, now);
      } else {
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(target, now + fadeMs / 1000);
      }
      src.connect(gain).connect(bus);
      src.start(0);
      return { name, src, gain };
    } catch (err) {
      console.warn(`[sound] could not start "${name}"`, err);
      return null;
    }
  }

  function fadeOut(voice, instant, fadeMs) {
    if (!voice) return null;
    const ctx = mixer.context();
    try {
      if (!ctx || instant) {
        voice.src.stop();
      } else {
        const t = ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(t);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
        voice.gain.gain.linearRampToValueAtTime(0.0001, t + fadeMs / 1000);
        voice.src.stop(t + fadeMs / 1000 + 0.05);
      }
    } catch { /* already stopped, or the context went away */ }
    return null;
  }

  return {
    playMusic, stopMusic, playSfx, setAmbience, setDuck, tick, reset,
    setSchedule, setBed, setSilent, isSpeaking, targetAt, state,
    stats: () => ({ ...stats }),
    schedule: () => intervals.map((s) => ({ ...s })),
  };
}
