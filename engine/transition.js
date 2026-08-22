/* ============================================================
   transition.js — the join between two scenes.

   THE PROBLEM, MEASURED

   The complaint was that the voice "suddenly stops and then starts another
   one". The obvious suspect was audio loading, so that got measured first:
   the gap between asking for the next scene and hearing sound again is 60 to
   325 ms. That is not audible as a stutter.

   What is actually happening is that nothing is there. A scene's mp3 ends
   with its last beat's trailing silence baked in, then the next file starts
   hard on a new sentence — and at the same instant resetStage() wipes the map
   and the new scene rebuilds it somewhere else entirely. Two abrupt edges,
   about two seconds apart, with no bridge.

   So this is not a bug to shave milliseconds off. It is a missing device.

   THE DEVICE

   A documentary does not hide a scene change, it announces one. Every chapter
   already carries a title and a clock per scene — "Verden delt i tre",
   "November 43 f.Kr." — and until now they appeared only in the episode list,
   which is the one place nobody is looking while watching.

   So: dim the stage, put the title and the date on it, hold, and lift. The
   map's jump happens behind the dim, the ear gets a visual equivalent of the
   pause it was already hearing, and the two abrupt edges become one
   deliberate one.

   RULE 1

   This is not stage state and not a cue. It is triggered by the player
   changing scene, it removes itself on a timer, and it refuses to run when
   the picture is being rebuilt — the same discipline as caption.note and the
   musket flash. Scrubbing through four scenes must not leave four title cards
   stacked on the screen.
   ============================================================ */

const IN_MS = 320;
/* Long enough to read a title, look at it, and register the date underneath.
   1500 ms was measured against nothing and felt rushed: a viewer has to
   notice the card, read two lines, and understand that a section has ended —
   and the narration is arriving underneath while they do it. */
const HOLD_MS = 2600;
const OUT_MS = 700;

/* Silence before the next scene speaks, so the card gets clear air.
   Without it the title appeared at the same instant the new sentence began,
   which is two things asking for attention at once. */
export const LEAD_IN_MS = 900;

let host = null;
let cardEl = null;
let timers = [];

export function mountTransition(storyRoot) {
  unmountTransition();
  host = document.createElement('div');
  host.className = 'scene-wipe';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = `
    <div class="scene-wipe__veil"></div>
    <div class="scene-wipe__card">
      <p class="scene-wipe__clock"></p>
      <h2 class="scene-wipe__title"></h2>
    </div>`;
  storyRoot.appendChild(host);
  cardEl = host.querySelector('.scene-wipe__card');
  return { announce, cancel: clear };
}

export function unmountTransition() {
  clear();
  host?.remove();
  host = null;
  cardEl = null;
}

function clear() {
  for (const t of timers) clearTimeout(t);
  timers = [];
  host?.classList.remove('is-on', 'is-lifting');
}

/**
 * Announce a scene.
 *
 * @param scene    the compiled scene — title and clock come from it
 * @param opts.at  where in the scene we landed. A card is an opening, so
 *                 arriving in the middle of a scene gets none: seeking to
 *                 04:12 is not the scene beginning, it is you looking for
 *                 something.
 * @param opts.silent  no card when the chapter is not actually running.
 */
function announce(scene, { at = 0, playing = true, first = false } = {}) {
  if (!host || !scene) return;
  // Not an opening, not running, or the very first scene of the chapter —
  // which already had a cover with the title on it two seconds ago.
  if (!playing || at > 1.5 || first) return;
  if (!scene.title && !scene.clock) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  clear();
  host.querySelector('.scene-wipe__title').textContent = scene.title || '';
  host.querySelector('.scene-wipe__clock').textContent = scene.clock || '';

  // Force a reflow so the entry transition runs from the start even when two
  // scene changes land close together.
  void cardEl.offsetWidth;
  host.classList.add('is-on');

  timers.push(setTimeout(() => host?.classList.add('is-lifting'), IN_MS + HOLD_MS));
  timers.push(setTimeout(() => clear(), IN_MS + HOLD_MS + OUT_MS));
}
