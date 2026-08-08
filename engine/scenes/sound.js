/* ============================================================
   scenes/sound.js — the story stage's ears, as an adapter.

   Same shape as scenes/map.js: cue objects in, sound-module calls out. The
   mixer, the synthesised effect library and the ducker all live in sound/ and
   are developed against dev/sound-lab.html without the app anywhere near them.

   Three things this file exists to get right, all of them rules from the
   engine rather than preferences:

   1. The narration <audio> element is never routed through this graph. It
      stays a plain element playing a plain file. A Web Audio graph is one
      more thing that can fail silently and permanently on iOS, and it must
      never be between the listener and the voice. Effects and music get their
      own context; if it dies, the chapter still runs.

   2. Ducking is computed from the script's word timings, not from listening
      to the voice. That makes it deterministic and — more importantly —
      correct when you seek: the music knows the voice is about to start
      because the schedule says so, not because it heard it.

   3. A one-shot effect must return early when `instant` is true. Rebuilding
      the picture after a seek replays every cue in the scene, and scrubbing
      back through Lexington must not fire forty muskets. The soundscape
      enforces this itself; the verbs below simply pass `instant` through and
      do not try to be clever about it.
   ============================================================ */

import { createMixer } from '../../sound/mixer.js';
import { createLibrary } from '../../sound/library.js';
import { createSoundscape, scheduleFromBeats } from '../../sound/soundscape.js';

let mixer = null;
let scape = null;
let ticker = 0;
let currentScene = null;

export function mountSound() {
  if (scape) return scape;
  try {
    mixer = createMixer({ enabled: true });
    scape = createSoundscape({ mixer, library: createLibrary() });
  } catch (err) {
    // Sound is an enhancement. Losing it must not take the chapter with it.
    console.warn('[sound] unavailable:', err && err.message);
    mixer = null;
    scape = null;
  }
  return scape;
}

/**
 * Call from a real user gesture — the cover's start button.
 *
 * Browsers will not build an audio context without one, and Safari only
 * counts the gesture once something has actually been scheduled on it, which
 * mixer.unlock() handles.
 */
export async function unlockSound() {
  if (!mixer) return false;
  try { return await mixer.unlock(); } catch { return false; }
}

/**
 * The ducking schedule for a scene: when the voice is speaking.
 *
 * Taken from the beats rather than from the audio, so it is right the instant
 * a scene is selected and stays right through any amount of scrubbing.
 */
export function soundScene(scene, { silent = false } = {}) {
  if (!scape) return;
  currentScene = scene;
  scape.setSilent(silent);
  scape.setSchedule(scene ? scheduleFromBeats(scene.beats) : []);
}

/** Stop everything still ringing. Called before a rebuild replays the cues. */
export function resetSound() {
  if (scape) scape.reset();
}

export function setSilentSound(on) {
  if (scape) scape.setSilent(on);
}

/**
 * Drive the ducker.
 *
 * On its own 100 ms interval, deliberately NOT from the player's onTick:
 * onTick only fires when the beat or the word changes, so between two long
 * words the music would sit at whatever level it was last told, and the
 * look-ahead that lowers the bed before a sentence starts would arrive late.
 * A timer is also the engine's contract — animation frames stop in a
 * backgrounded tab, and the audio does not.
 */
export function startSoundClock(getTime) {
  stopSoundClock();
  if (!scape) return;
  ticker = setInterval(() => {
    const t = getTime();
    if (Number.isFinite(t)) scape.tick(t);
  }, 100);
}

export function stopSoundClock() {
  clearInterval(ticker);
  ticker = 0;
}

/* ------------------------------------------------------------
   Verbs
   ------------------------------------------------------------ */

/** A single event: a shot, a bell, a fife. Never replayed on a seek. */
export function playSound(cue, instant) {
  if (!scape || !cue.id) return;
  const times = Math.max(1, Math.min(12, cue.times || 1));
  const spread = Math.max(0, cue.spread ?? 0);
  for (let i = 0; i < times; i++) {
    const at = times === 1 ? 0 : (spread * 1000 * i) / (times - 1);
    const opts = {
      instant,
      gainDb: cue.gainDb ?? 0,
      // A shot is never quite the same shot twice. Without this, "guns are
      // fired into the air" is one sample stuttering, which reads as a glitch.
      rate: times === 1 ? (cue.rate ?? 1) : (cue.rate ?? 1) * (0.94 + 0.12 * ((i * 7) % 5) / 4),
    };
    if (!at) scape.playSfx(cue.id, opts);
    else if (!instant) setTimeout(() => scape.playSfx(cue.id, opts), at);
  }
}

/** A continuous bed of place: wind, sea, a crowd. `id` null stops it. */
export function setAmbience(cue, instant) {
  if (!scape) return;
  scape.setAmbience(cue.id || null, { instant, gainDb: cue.gainDb ?? 0 });
}

/** The music bed. It ducks under the voice on its own. */
export function playMusicCue(cue, instant) {
  if (!scape) return;
  if (!cue.id) { scape.stopMusic({ instant }); return; }
  scape.playMusic(cue.id, { instant, gainDb: cue.gainDb ?? 0 });
}

/** Debug hook — the lab and tools/check-sound.py drive the stage through this. */
export function getSoundscape() { return scape; }
