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

   RULE 1

   Not stage state, not a cue: it is driven by the player reaching the end,
   it takes itself away, and it refuses to exist the moment the chapter is
   running again. A cue would replay on every seek, which is the musket
   problem — scrubbing past the end must not stack end cards.
   ============================================================ */

/* The last word, and then nothing. Long enough to read as deliberate, short
   enough that nobody wonders whether the app has crashed. */
const SILENCE_MS = 2000;

/** Not opaque. The chapter's own last picture is the ground this sits on. */
export const VEIL = 0.62;

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
