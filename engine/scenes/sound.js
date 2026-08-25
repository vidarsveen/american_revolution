/* ============================================================
   scenes/sound.js — a handle on the sound surface.

   The module moved to engine/surfaces/sound.js. engine/story.js imports nine
   functions from this path — the clock, the scene schedule, the unlock, the
   pause pair, the two stops — and it does so for every pack, so this stays a
   handle rather than a re-export. See the header of scenes/map.js.

   Rule 3 lands here almost for free: a pack that does not declare the sound
   surface gets null from every call, and a chapter with no sound is a chapter
   that still runs on its timer with the captions carrying the words. That is
   the same answer the module already gives when the AudioContext will not
   start.

   It goes away the day engine/story.js imports ../surfaces/sound.js.
   ============================================================ */

import { surfaceModule } from '../surfaces/registry.js';

const S = () => surfaceModule('sound');

export function unlockSound() { return S()?.unlockSound() ?? Promise.resolve(false); }
export function soundScene(scene, opts) { S()?.soundScene(scene, opts); }
export function setSilentSound(on) { S()?.setSilentSound(on); }
export function startSoundClock(getTime) { S()?.startSoundClock(getTime); }
export function stopSoundClock() { S()?.stopSoundClock(); }
export function pauseSound() { S()?.pauseSound(); }
export function resumeSound() { S()?.resumeSound(); }
export function stopSound() { S()?.stopSound(); }
export function fadeOutSound(ms) { S()?.fadeOutSound(ms); }
export function getSoundscape() { return S()?.getSoundscape() ?? null; }
