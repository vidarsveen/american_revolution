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
import { styleValue } from '../style.js';

let mixer = null;
let scape = null;
let library = null;
let ticker = 0;
let currentScene = null;

export function mountSound(chapter) {
  if (scape) return scape;
  try {
    mixer = createMixer({ enabled: true });
    library = createLibrary();
    // A pack's own mix, over the module's defaults. The bed level is the one
    // number here a subject really does own: a wine course wants a different
    // weight of music from a battle, and it was a constant in a module.
    scape = createSoundscape({
      mixer,
      library,
      bedDb: styleValue('sound.bedDb', undefined),
      duckDb: styleValue('sound.duckDb', undefined),
    });
  } catch (err) {
    // Sound is an enhancement. Losing it must not take the chapter with it.
    console.warn('[sound] unavailable:', err && err.message);
    mixer = null;
    scape = null;
    library = null;
  }
  if (scape && chapter?.pack) loadPackSounds(chapter.pack, chapter.packInfo);
  return scape;
}

/**
 * A pack may override any synthesised effect with a recording.
 *
 * Deliberately fire-and-forget. The manifest is not needed until the first
 * cue asks for a sound, which is at the earliest a second after the cover is
 * tapped, and if it never arrives every effect is synthesised exactly as
 * before — the file-based path is an override, not a dependency. A pack with
 * no sound.json is the normal case and must not log anything alarming.
 */
async function loadPackSounds(pack, manifest) {
  const base = `./content/${pack}/`;
  // Only ask if the pack says it has one. The catch below always handled a
  // missing file correctly, but the browser still logged a 404 on every load
  // of a pack that ships no audio — which is the normal case, and a console
  // full of red for normal behaviour trains you to ignore it.
  const declared = manifest?.pools?.sound;
  if (manifest && !declared) return;
  try {
    const res = await fetch(`${base}${declared || 'sound.json'}`, { cache: 'no-cache' });
    if (!res.ok) return;                       // 404 is the normal case
    const taken = library.addManifest(await res.json(), { base });
    if (taken) console.info(`[sound] ${pack}: ${taken} recorded effect(s) override the synth`);
  } catch {
    /* no manifest, malformed manifest — the synthesised catalogue stands */
  }
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

/* What the cues have asked for, once they have all been replayed.

   Music and ambience are STATE, not events: the bed under a scene is a fact
   about that stretch of the chapter, the way the time of day is. Tearing it
   down in reset() and letting the cues build it back would be correct and
   would also be audible — the stage rebuilds on every scene change AND every
   scrub, so the bed would restart from its first bar every time you touched
   the scrubber. Instead reset() forgets what was wanted and resolves on the
   next turn, after the cues have replayed: whatever they asked for is already
   playing and stays playing, and anything they did not ask for stops. */
let wantMusic = null;
let wantAmbience = null;
let settle = 0;

/** Called before a rebuild replays the cues. */
export function resetSound() {
  if (!scape) return;
  wantMusic = null;
  wantAmbience = null;
  clearTimeout(settle);
  settle = setTimeout(resolveWanted, 0);
}

function resolveWanted() {
  if (!scape) return;
  // Fade, do not cut. A bed that stops dead at a scene boundary is the
  // "sound from the last section stops too quickly" complaint: the narration
  // has trailing silence baked into its mp3, so the music was the only thing
  // still sounding, and it vanished on a frame. stopMusic already knew how to
  // fade; this was asking it not to.
  // Four seconds, not 900 ms. A scene that carries no bed is a decision —
  // "at least one scene per chapter is unscored", and the wine chapter's
  // second scene is about people who never met each other — and a bed that
  // is gone within a sentence of the scene turning reads as the sound
  // breaking rather than as silence arriving. docs/design-direction.md §3:
  // a bed leaves over four seconds and never cuts.
  if (!wantMusic || !musicOn) scape.stopMusic({ fadeMs: 4000 });
  if (!wantAmbience) scape.setAmbience(null, { fadeMs: 2400 });
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

/**
 * The narration has stopped, but it is coming back.
 *
 * Stopping the clock only stops the ducker. The music and the ambience are
 * looping BufferSources and carry on regardless — which is how a paused
 * chapter, and a chapter left behind by switching to Explore, went on playing
 * a bed under a screen that was no longer telling a story.
 *
 * Suspending the whole context rather than tearing the beds down, because the
 * beds are state the cues resolved: stopping them here would leave nothing to
 * start them again short of a seek. Suspend is exactly "the same mix, paused".
 */
export function pauseSound() {
  mixer?.suspend();
}

export function resumeSound() {
  mixer?.resume();
}

/**
 * The chapter is over. Unlike a pause this is a real stop: the cover is back
 * and there is no narration for a bed to sit under.
 *
 * Safe to start again — reset() leaves the soundscape holding no voices, so
 * replaying the chapter rebuilds scene zero and its cues start the bed afresh.
 */
/**
 * Let the bed go, over four seconds, instead of cutting it.
 *
 * The end card holds until the viewer taps, and the music holds under it. The
 * hard `stopSound()` below is still right for a chapter being torn down or
 * switched away from; this is for the one place where the sound is part of
 * the ending rather than left over from it.
 */
export function fadeOutSound(ms = 4000) {
  stopSoundClock();
  clearTimeout(settle);
  wantMusic = null;
  wantAmbience = null;
  if (!scape) return;
  scape.stopMusic({ fadeMs: ms });
  scape.setAmbience(null, { fadeMs: ms });
}

export function stopSound() {
  stopSoundClock();
  clearTimeout(settle);
  wantMusic = null;
  wantAmbience = null;
  scape?.reset();
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
  wantAmbience = cue.id || null;
  scape.setAmbience(cue.id || null, { instant, gainDb: cue.gainDb ?? 0 });
}

/** The music bed. It ducks under the voice on its own. */
/* MUSIC OFF IS A READER'S DECISION, and it is not the same as sound off.
   The bed ducks 12 dB whenever anyone speaks, which is the grammar working as
   designed and reads to some ears as a hand on the volume knob all chapter.
   Reported exactly that way. So: a switch in the transport, remembered, and
   the effects and the ambience are untouched by it — an effect is a thing the
   narration just named, and a room is a room.

   `wantMusic` still records what the CUES asked for, so turning music back on
   in the middle of a scene starts the bed that scene declared rather than
   waiting for the next one. */
let musicOn = storedMusicOn();

/** Whatever you chose last time. Music defaults to on. */
function storedMusicOn() {
  try { return localStorage.getItem('fortell:music') !== '0'; }
  catch { return true; }
}

export function musicIsOn() { return musicOn; }

export function setMusicOn(on) {
  musicOn = Boolean(on);
  if (!scape) return;
  if (!musicOn) { scape.stopMusic({ fadeMs: 1200 }); return; }
  if (wantMusic) scape.playMusic(wantMusic, { gainDb: wantMusicGain });
}

let wantMusicGain = 0;

export function playMusicCue(cue, instant) {
  if (!scape) return;
  wantMusic = cue.id || null;
  wantMusicGain = cue.gainDb ?? 0;
  if (!cue.id) { scape.stopMusic({ instant }); return; }
  if (!musicOn) return;
  // Idempotent for the same bed, so replaying this cue after a seek does not
  // restart it — which is the whole point of the settle above.
  scape.playMusic(cue.id, { instant, gainDb: cue.gainDb ?? 0 });
}

/** Debug hook — the lab and tools/check-sound.py drive the stage through this. */
export function getSoundscape() { return scape; }

/* ------------------------------------------------------------
   The surface
   ------------------------------------------------------------ */

/**
 * Sound has no DOM and no z-order, so `unmount` is where a chapter's ears
 * close. Deliberately NOT tearing the mixer down: an AudioContext is
 * expensive to build, iOS only ever unlocks it on a user gesture, and
 * throwing it away on a chapter switch would mean the next chapter starts
 * silent until somebody taps again. Stopping everything playing is the whole
 * of what "unmount" can honestly mean here.
 */
export function unmountSound() {
  stopSoundClock();
  stopSound();
  currentScene = null;
}

export default {
  id: 'sound',
  // No layer that matters — it draws nothing. Last, so mountedSurfaces()
  // reads in the order things are on the screen and then the things that
  // are not.
  layer: 90,
  verbs: {
    // The soundscape enforces the one-shot rule itself, so these hand
    // `instant` straight through rather than guarding it a second time.
    'sound.play':     (c, i) => playSound(c, i),
    'sound.ambience': (c, i) => setAmbience(c, i),
    'sound.music':    (c, i) => playMusicCue(c, i),
  },
  mount(container, ch) { mountSound(ch); return null; },
  reset() { resetSound(); },
  unmount() { unmountSound(); },
};
