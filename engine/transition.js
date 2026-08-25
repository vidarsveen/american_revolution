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

/* All four numbers come from docs/design-direction.md, and they are one
   number: --t-turn, 1200 ms, the whole frame becoming something else.

   They used to be 320 / 2600 / 700 / 900, chosen alone. 320 ms in is a cut
   wearing a fade — the slowest thing on this screen is a 14 s drift on a
   still, so an arrival a fortieth of that length is from a different film.

       t = 0      the veil begins to close                     IN_MS
       t = 1200   the veil is opaque. The stage is rebuilt HERE.
                  The card is at rest: clock, then title.
       t = 2800   the veil begins to lift, the narrator speaks  OUT_MS
       t = 4000   the veil is gone, and the card went with it.

   The card is fully legible for 1.6 s and readable through both ramps —
   about 2.6 s, the same floor check-script.py puts on a portrait's name.
   Total 4.0 s against 3.62 before: the silence triples, the length barely
   moves.

   WHERE t = 0 IS. It used to be the instant the scene's audio ran out, so
   the whole first ramp happened after the last word — a second and a fifth
   of picture still moving over a dead soundtrack, and only then the cut.
   Player.tailFor() now starts the turn IN_MS EARLY, inside the trailing
   silence the mp3 already has (shortest measured: 1.250 s), so t = 1200 —
   veil opaque, stage rebuilt — lands exactly where the sound stops. */
/* `--t-turn` itself, named once. Both ramps of the scene turn are this
   number, and so are both ramps of the CHAPTER turn in engine/ending.js —
   which is the same event at the next scale up and must not invent a second
   answer to "how long does the frame take to become something else". */
export const TURN_MS = 1200;
export const IN_MS = TURN_MS;
const HOLD_MS = 1600;
const OUT_MS = TURN_MS;

/* Silence before the next scene speaks, so the card gets clear air.
   Without it the title appeared at the same instant the new sentence began,
   which is two things asking for attention at once.

   Measured from t = 0, the top of the table above -- so it is IN_MS + HOLD_MS
   by construction, and this line is the third place that number is written.
   If they ever disagree, the table is right. */
export const LEAD_IN_MS = IN_MS + HOLD_MS;   // 2800

/* And this is the number the PLAYER needs, which is not the same number.

   player.leadInMs is silence measured from the REBUILD, and the rebuild is
   already IN_MS late -- goToScene awaits coverMs first, then this. Handing it
   LEAD_IN_MS stacked the two: the narrator came in at t = 4000 instead of
   t = 2800, so the veil lifted over a silent stage and the voice arrived 1.2 s
   after the picture. The table says the lift and the voice are the same event,
   and they should be: a scene that opens in silence and then starts talking is
   two beginnings.

   It comes out as HOLD_MS, which is the check that the reading is right -- the
   card holds, and when it stops holding the voice is there. */
export const SPEAK_AFTER_MS = LEAD_IN_MS - IN_MS;   // 1600, i.e. HOLD_MS

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
 *
 * @returns true if a card is running, so the caller knows it has IN_MS of
 *          cover to rebuild the stage behind. Returning nothing was why the
 *          map's cut happened in FRONT of the device built to hide it.
 */
function announce(scene, { at = 0, playing = true, first = false } = {}) {
  if (!host || !scene) return false;
  // Not an opening, not running, or the very first scene of the chapter —
  // which already had a cover with the title on it two seconds ago.
  if (!playing || at > 1.5 || first) return false;
  if (!scene.title && !scene.clock) return false;
  // Reduced motion is NOT handled here any more. The card carries the scene's
  // title and clock, which is information, and suppressing it left a
  // reduced-motion viewer with LEAD_IN_MS of silence and no idea why. It cuts
  // instead of fading; css/story.css does that with `transition: none`.

  clear();
  host.querySelector('.scene-wipe__title').textContent = scene.title || '';
  host.querySelector('.scene-wipe__clock').textContent = scene.clock || '';

  // Force a reflow so the entry transition runs from the start even when two
  // scene changes land close together.
  void cardEl.offsetWidth;
  host.classList.add('is-on');

  timers.push(setTimeout(() => host?.classList.add('is-lifting'), IN_MS + HOLD_MS));
  timers.push(setTimeout(() => clear(), IN_MS + HOLD_MS + OUT_MS));
  return true;
}
