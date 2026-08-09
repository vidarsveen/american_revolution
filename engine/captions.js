/* ============================================================
   captions.js — the spoken line on screen, with the current word lit.

   Word timings come free from the narration tool, so this is close to exact.
   It also means the whole thing works with the sound off, which matters more
   than it sounds: half of phone viewing is muted.
   ============================================================ */

let root = null;
let lineEl = null;
let on = true;
let currentBeat = null;
let slot = null;

export function mountCaptions(container) {
  root = document.createElement('div');
  root.className = 'captions';
  root.innerHTML = `<p class="captions__line"></p>`;
  container.appendChild(root);
  lineEl = root.querySelector('.captions__line');
  slot = container;
  // Watch our own height, the way the transport publishes --transport-h.
  // ResizeObserver rather than a measurement after each render: a caption
  // reflows when the window turns, when the font finishes loading, and when
  // the viewer changes the text size, none of which are render events here.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(publishHeight).observe(root);
  }
  addEventListener('resize', publishHeight);
  publishHeight();
  return root;
}

/**
 * How tall the caption is, as --caption-h on the story root.
 *
 * The stats deck and the caption box were both anchored to the transport, so
 * they occupied the same strip of screen and the caption — a later element
 * with a higher z-index — sat on top. Every number the chapter shows was
 * drawn underneath it: seventy-seven against seven hundred, the eight dead on
 * the green, the British losses. All of them present, none of them visible.
 *
 * Zero when captions are off, because then there is nothing to clear.
 */
function publishHeight() {
  if (!root || !slot) return;
  const story = slot.closest('.story') || slot.parentElement;
  if (!story) return;
  const h = on ? Math.round(root.getBoundingClientRect().height) : 0;
  story.style.setProperty('--caption-h', `${h}px`);
}

export function setCaptionsOn(value) {
  on = Boolean(value);
  root?.classList.toggle('is-off', !on);
  // Turning captions off gives the numbers the whole strip back.
  publishHeight();
}

/** Whatever you chose last time. Captions default to on. */
export function storedCaptionsOn() {
  try { return localStorage.getItem('revolusjonen:captions') !== '0'; }
  catch { return true; }
}

export function captionsOn() { return on; }

/** Called every frame the beat or word changes. */
export function renderCaption(beat, wordIndex) {
  if (!lineEl) return;

  if (beat !== currentBeat) {
    currentBeat = beat;
    if (!beat) { lineEl.innerHTML = ''; return; }
    // Rebuild only when the beat changes; highlighting is then a class swap.
    // Wrap the *written* tokens, not the spoken ones — the TTS word list has
    // the punctuation stripped, and a caption without full stops reads badly.
    const written = beat.text.split(/\s+/).filter(Boolean);
    lineEl.innerHTML = (beat.words.length && written.length === beat.words.length)
      ? written.map((w, i) => `<span data-w="${i}">${esc(w)}</span>`).join(' ')
      : (beat.words.length
          ? beat.words.map((w, i) => `<span data-w="${i}">${esc(w.w)}</span>`).join(' ')
          : esc(beat.text));
    lineEl.classList.remove('is-in');
    void lineEl.offsetWidth;
    lineEl.classList.add('is-in');
  }

  const spans = lineEl.children;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const said = i <= wordIndex;
    s.classList.toggle('is-said', said);
    s.classList.toggle('is-now', i === wordIndex);
  }
}

export function clearCaption() {
  currentBeat = null;
  if (lineEl) lineEl.innerHTML = '';
}

/* ------------------------------------------------------------
   Transcript — the whole chapter as readable text
   ------------------------------------------------------------ */

export function transcriptHtml(chapter) {
  return chapter.scenes.map((scene) => `
    <section class="transcript__scene" data-scene="${esc(scene.id)}">
      <h3>${esc(scene.title)}</h3>
      ${scene.clock ? `<p class="transcript__clock">${esc(scene.clock)}</p>` : ''}
      ${scene.beats.map((b) => `
        <p class="transcript__beat" data-beat="${esc(b.id)}"
           data-scene="${esc(scene.id)}" data-at="${b.start}">${esc(b.text)}</p>`).join('')}
    </section>`).join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
