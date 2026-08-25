/* ============================================================
   ending.js — the last thing a chapter does.

   THE PROBLEM

   A chapter stopped on its final beat, cut the sound dead, and put the cover
   back: `stopSound(); showCover('replay')`. That is not an ending, it is the
   film running out. Fourteen minutes of building a picture, and the picture
   was thrown away in one frame for a menu.

   THE DEVICE

   Two seconds of silence first — nothing moves, the last picture holds, and
   the viewer gets to notice that it is over before being told. Then a veil,
   deliberately NOT opaque, because the arc of redoubts or the two villages
   the chapter spent its length drawing is the ground this card belongs on.
   The bed comes up underneath: the ducking schedule stops with the clock, so
   the music rises on its own the moment the voice is gone, which is the one
   piece of this the engine was already doing for free.

   And it is HELD. The narrator set the pace for fourteen minutes; this is the
   one moment the viewer holds, so it waits for a tap and never times out.

   THE CHAPTER TURN

   And then a door. Scene → scene has a designed device; chapter → chapter
   had none — openChapter() emptied .story__stage and the screen passed
   through a blank on its way to the next cover, throwing this card away in
   the same frame. So the card becomes the device: the veil it already has
   closes to opaque over --t-turn, the next chapter is built behind it, and
   it lifts onto that chapter's cover. Same grammar as the scene turn, one
   scale up, and the same two ramps of --t-turn.

   The awkward part is that the thing it is covering is its OWN teardown.
   closeVeil() therefore hands the element over: the module forgets it, so
   the next mountEnding() builds a fresh card while the old node stays on
   screen as a plain veil until the caller takes it away. That is the same
   reasoning that makes this a sibling of .story__stage rather than a child.

   RULE 1

   Not stage state, not a cue: it is driven by the player reaching the end,
   it takes itself away, and it refuses to exist the moment the chapter is
   running again. A cue would replay on every seek, which is the musket
   problem — scrubbing past the end must not stack end cards.
   ============================================================ */

import { TURN_MS } from './transition.js';

/* The last word, and then nothing. Long enough to read as deliberate, short
   enough that nobody wonders whether the app has crashed. */
const SILENCE_MS = 2000;

/* The veil is NOT opaque — the chapter's own last picture is the ground this
   card sits on, and throwing it away for a cover was the worst thing the old
   ending did. Its value lives in css/story.css (`.story-end__veil`), in one
   place, because it is a paint decision and the browser is the only thing that
   needs it. The chapter turn below reads it off the element.

   There was a `VEIL = 0.62` here, exported and imported by nobody, while the
   stylesheet painted .52 and BACKLOG.md recorded .52 and
   docs/design-direction.md section 4 prescribed .62. Three places, two answers,
   and the only one anyone could see was the stylesheet. Deleted rather than
   corrected: a constant nothing reads cannot be right, it can only be stale. */

let host = null;
let timer = 0;
let onAct = null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountEnding(storyRoot, handler) {
  unmountEnding();
  onAct = handler;
  host = document.createElement('div');
  host.className = 'story-end';
  host.hidden = true;
  storyRoot.appendChild(host);
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-end]');
    if (!btn) return;
    onAct?.(btn.dataset.end);
  });
  return { show, cancel };
}

export function unmountEnding() {
  cancel();
  host?.remove();
  host = null;
  onAct = null;
}

/** Take it down, and stop one that has not arrived yet. */
export function cancel() {
  clearTimeout(timer);
  timer = 0;
  if (!host) return;
  host.classList.remove('is-on');
  host.hidden = true;
}

/**
 * @param chapter  the compiled chapter — title, subtitle and `ending` come
 *                 from it. `ending` is METADATA and optional: a sentence and
 *                 a number if the author wrote them, nothing if not. It is
 *                 not a cue, because a cue would replay on every seek.
 * @param opts.next   title of the next chapter, or null
 * @param opts.t      the i18n lookup
 */
function show(chapter, { next = null, t = (k) => k } = {}) {
  if (!host || !chapter) return false;
  cancel();

  const end = chapter.ending || {};
  // NOT a fallback to the subtitle: the subtitle is already the kicker above
  // the title, and falling back printed "Italia, og først Piemonte" twice,
  // once in caps and once not. A chapter with no written ending simply has
  // no sentence here.
  const sentence = end.say || '';
  const fig = end.figure || null;

  host.innerHTML = `
    <div class="story-end__veil"></div>
    <div class="story-end__card" role="dialog" aria-modal="false">
      ${chapter.subtitle ? `<p class="story-end__when">${esc(chapter.subtitle)}</p>` : ''}
      <h2 class="story-end__title">${esc(chapter.title || '')}</h2>
      ${sentence ? `<p class="story-end__say">${esc(sentence)}</p>` : ''}
      ${fig ? `<p class="story-end__fig"><b>${esc(fig.value)}</b>
                  <span>${esc(fig.label)}</span></p>` : ''}
      <div class="story-end__doors">
        ${next ? `<button class="story-end__door story-end__door--go" type="button"
                    data-end="next">${esc(t('endNext'))}<i>${esc(next)}</i></button>` : ''}
        <button class="story-end__door" type="button"
                data-end="replay">${esc(t('replay'))}</button>
        <button class="story-end__door" type="button"
                data-end="overview">${esc(t('endOverview'))}</button>
      </div>
    </div>`;

  // The silence is the first half of the device, so the card is scheduled
  // rather than shown. cancel() clears the timer, which is what stops an end
  // card arriving two seconds after the viewer scrubbed back into the chapter.
  timer = setTimeout(() => {
    if (!host) return;
    host.hidden = false;
    void host.offsetWidth;          // let the fade run from the start
    host.classList.add('is-on');
    host.querySelector('.story-end__door')?.focus({ preventScroll: true });
  }, SILENCE_MS);
  return true;
}

/* ------------------------------------------------------------
   The chapter turn — see the header
   ------------------------------------------------------------ */

/**
 * Close the end card's veil over the whole frame, and hand it over.
 *
 * The card the viewer just tapped becomes the cover for the change: its
 * veil goes from the .52 the stylesheet paints to opaque over --t-turn, and
 * the words on it go the other way, because they are about the chapter being
 * left. TURN_MS later there is a solid frame to rebuild everything behind.
 *
 * Ownership goes with it. The next chapter's openChapter() runs
 * unmountEnding() as part of tearing this one down, so a veil the module
 * still held would be removed by the very change it exists to hide; after
 * this the module has forgotten the node and mountEnding() is free to build
 * a fresh card beside it. The caller is left holding a plain element and
 * must give it to liftVeil() — nothing else will ever take it away.
 *
 * The fade stays a fade under prefers-reduced-motion: the concern there is
 * vestibular, and nothing here moves through space.
 *
 * @returns the detached node, or null when there is no card to turn — in
 *          which case the caller has no cover and should just switch.
 */
export function closeVeil() {
  if (!host) return null;
  const node = host;
  clearTimeout(timer);
  timer = 0;
  host = null;
  onAct = null;

  // Nothing on it is a target any more; the doors are on their way out.
  node.style.pointerEvents = 'none';
  node.setAttribute('aria-hidden', 'true');

  const ramp = 'opacity var(--t-turn) var(--ease-in-out)';
  for (const [sel, to] of [['.story-end__veil', '1'], ['.story-end__card', '0']]) {
    const el = node.querySelector(sel);
    if (!el) continue;
    el.style.transition = ramp;
    // Commit the transition property before the value changes, or the two
    // land in the same style recalculation and the browser has nothing to
    // interpolate from — which is a cut wearing a fade's name.
    void el.offsetWidth;
    el.style.opacity = to;
  }
  return node;
}

/**
 * Lift it again, onto whatever was built underneath, and take it away.
 *
 * `remove()` is on a timer rather than on `transitionend`: a backgrounded
 * tab delivers no frames and therefore no transition events, and a veil that
 * never leaves is a chapter you cannot see. Rule 2 — timers are the contract.
 */
export function liftVeil(node) {
  if (!node) return;
  node.style.transition = 'opacity var(--t-turn) var(--ease-in-out)';
  void node.offsetWidth;
  node.style.opacity = '0';
  setTimeout(() => node.remove(), TURN_MS);
}
