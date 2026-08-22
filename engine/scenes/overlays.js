/* ============================================================
   scenes/overlays.js — the cards over the map.

   Laid out in three decks so nothing ever lands on top of anything else:

     top    pictures
     mid    quotes
     lower  the person being talked about, and any running numbers

   The lower deck sits above the transport, whose height it reads from
   --transport-h. That variable is why portraits stopped disappearing behind
   the controls on a phone.

   Every function is idempotent and there is a reset(), because the player
   rebuilds the picture on every backwards seek.
   ============================================================ */

import { portraitUrl } from '../../core/paths.js';

let root = null;
let portraitEl = null;
let imageEl = null;
let quoteEl = null;
let statsEl = null;
let noteEl = null;
let compareEl = null;

let people = new Map();
let chapter = null;
let lang = 'no';
let storyRoot = null;

export function mountOverlays(container, ch, allPeople, language) {
  chapter = ch;
  lang = language;
  people = new Map((allPeople || []).map((p) => [p.id, p]));

  storyRoot = container.closest('.story') || container;
  root = document.createElement('div');
  root.className = 'stage-overlays';
  root.innerHTML = `
    <div class="ov-deck ov-deck--top">
      <div class="ov-portrait"></div>
      <div class="ov-image"></div>
    </div>
    <div class="ov-deck ov-deck--mid">
      <div class="ov-note"></div>
      <div class="ov-compare"></div>
      <div class="ov-quote"></div>
    </div>
    <div class="ov-deck ov-deck--lower">
      <div class="ov-stats"></div>
    </div>
  `;
  container.appendChild(root);

  portraitEl = root.querySelector('.ov-portrait');
  imageEl = root.querySelector('.ov-image');
  quoteEl = root.querySelector('.ov-quote');
  statsEl = root.querySelector('.ov-stats');
  noteEl = root.querySelector('.ov-note');
  compareEl = root.querySelector('.ov-compare');
}

export function resetOverlays() {
  for (const el of [portraitEl, imageEl, quoteEl, noteEl, compareEl]) {
    if (!el) continue;
    el.classList.remove('is-on');
    el.innerHTML = '';
  }
  if (statsEl) { statsEl.innerHTML = ''; statsEl.classList.remove('is-on'); }
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function show(el, html, instant) {
  if (!el) return;
  el.innerHTML = html;
  if (instant || reduced()) {
    el.classList.add('is-instant', 'is-on');
    requestAnimationFrame(() => el.classList.remove('is-instant'));
  } else {
    el.classList.remove('is-on');
    void el.offsetWidth;            // restart the entry transition
    el.classList.add('is-on');
  }
}

const hide = (el) => el?.classList.remove('is-on');

/* ---------- Portrait ----------------------------------------
   Upright, and big enough to actually look at. A face is one of the few
   things on screen that is not a diagram.
   ------------------------------------------------------------ */

/* Where this pack keeps its faces. Declared, because a global
   assets/portraits/ is fine with one subject and wrong with two — the Roman
   pack has its own Caesar and no interest in ours. */
function portraitDir() {
  return chapter?.packInfo?.pools?.portraits || 'portraits/';
}

/* Said when there is no likeness. Not every face in this story survives: no
   portrait of Samuel Prescott is known, and there never was one. */
const NO_LIKENESS = { no: 'Ikke noe kjent portrett', en: 'No known likeness' };

export function showPortrait(cue, instant) {
  const p = people.get(cue.id);
  if (!p) return;

  // An empty frame with a silhouette in it reads as a picture that failed to
  // load, which is a bug the viewer has to forgive. The absence is real and
  // worth a line: no portrait of Samuel Prescott was ever made. So the card
  // drops the frame entirely and says so.
  const frame = p.portrait
    ? `<span class="ov-portrait__frame"><img src="${portraitUrl(chapter?.pack, p.portrait, portraitDir())}"
         alt="${esc(pick(p.name))}" decoding="async"></span>`
    : '';
  show(portraitEl, `
    <figure class="ov-portrait__card${p.portrait ? '' : ' is-faceless'}"
            style="--side: var(--f-${esc(p.side || 'neutral')}, var(--ink-faint))"
            data-tap="person:${esc(p.id)}" role="button" tabindex="0"
            aria-label="${esc(pick(p.name))}">
      ${frame}
      <figcaption>
        <b>${esc(pick(p.name))}</b>
        <span>${esc(pick(p.role))}</span>
        ${p.lived ? `<i>${esc(p.lived)}</i>` : ''}
        ${/* The line that makes you care. A name, a job title and two dates
              is a filing card; people.json already carries one sentence per
              person that says why they matter, and the card was throwing it
              away. "Hersker over det rikeste landet ved Middelhavet, og den
              siste i sitt dynasti" is worth more than "Dronning av Egypt". */''}
        ${pick(p.hook) ? `<q>${esc(pick(p.hook))}</q>` : ''}
        ${p.portrait ? '' : `<u>${esc(NO_LIKENESS[lang] || NO_LIKENESS.en)}</u>`}
      </figcaption>
    </figure>`, instant);
}

export function hidePortrait() { hide(portraitEl); }

/* ---------- Picture ----------------------------------------- */

export function showImage(cue, instant) {
  const m = (chapter.media || {})[cue.id];
  if (!m) return;
  const mode = cue.mode === 'full' ? 'is-full' : 'is-inset';
  show(imageEl, `
    <figure class="ov-image__card ${mode}">
      <img src="./content/${esc(chapter.pack)}/media/${esc(m.file)}"
           alt="${esc(pick(m.title))}" decoding="async">
      <figcaption>${esc(pick(m.title))}${m.year ? `, ${esc(m.year)}` : ''}</figcaption>
    </figure>`, instant);
}

export function hideImage() { hide(imageEl); }

/* ---------- Quote ------------------------------------------- */

export function showQuote(cue, instant) {
  const q = (chapter.quotes || {})[cue.id];
  if (!q) return;
  show(quoteEl, `
    <blockquote class="ov-quote__card">
      <p>${esc(pick(q.text))}</p>
      <cite>${esc(pick(q.by))}</cite>
    </blockquote>`, instant);
}

export function hideQuote() { hide(quoteEl); }

/* ---------- Numbers ----------------------------------------- */

export function showStat(cue, instant) {
  if (!statsEl) return;
  const chip = document.createElement('div');
  chip.className = `stat-chip${instant || reduced() ? ' is-instant' : ''}`;
  // The colour rides in as a variable rather than a class, so how many sides
  // there are is a property of the pack and not of the stylesheet. Pointing
  // at the published --f-<side> rather than at a resolved hex keeps it
  // flipping with the theme.
  if (cue.side) {
    chip.style.setProperty('--side', `var(--f-${cue.side.replace(/[^a-z0-9]+/gi, '-')}, inherit)`);
  }
  chip.innerHTML = `<b>${esc(cue.value)}</b><span>${esc(pick(cue.label))}</span>`;
  statsEl.appendChild(chip);
  statsEl.classList.add('is-on');
}

export function clearStats() {
  if (!statsEl) return;
  statsEl.innerHTML = '';
  statsEl.classList.remove('is-on');
}

/* ---------- Comparison --------------------------------------
   Two or three quantities as ONE picture.

   "Seventy-seven against seven hundred" is the whole argument of Lexington
   Green, and as two separate chips it reads as trivia — the eye has no way
   to put them next to each other. Drawn as bars against the largest, the
   ratio is the thing you see first, which is the thing that matters.
   ------------------------------------------------------------ */

/** The number that sizes a bar. `n` if given, otherwise dug out of `value`. */
function partSize(part) {
  if (typeof part.n === 'number') return part.n;
  const digits = String(part.value ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export function showCompare(cue, instant) {
  if (!compareEl) return;
  const parts = (cue.parts || []).filter(Boolean);
  if (parts.length < 2) return;

  const max = Math.max(...parts.map(partSize), 1);
  const ratio = cue.mode === 'ratio';
  const total = parts.reduce((n, p) => n + partSize(p), 0) || 1;
  const over = instant || reduced() ? 0 : (cue.over ?? 1.1);

  const rows = parts.map((part) => {
    // In `bar` mode each is measured against the largest, so the biggest
    // fills the width. In `ratio` mode they share one width between them,
    // which is the right picture for shares of a whole.
    const pct = ratio
      ? (partSize(part) / total) * 100
      : (partSize(part) / max) * 100;
    const side = part.side || (part.tone ? `tone-${part.tone}` : 'neutral');
    return `
      <div class="ov-cmp__row" style="--side: var(--f-${esc(String(side).replace(/[^a-z0-9]+/gi, '-'))}, var(--ink-faint))">
        <span class="ov-cmp__k">${esc(pick(part.label))}</span>
        <span class="ov-cmp__track">
          <span class="ov-cmp__fill" style="width:${pct.toFixed(1)}%;
                transition-duration:${over}s"></span>
        </span>
        <b class="ov-cmp__v">${esc(part.value ?? partSize(part))}</b>
      </div>`;
  }).join('');

  show(compareEl, `
    <div class="ov-cmp${ratio ? ' ov-cmp--ratio' : ''}">
      ${rows}
      ${cue.note ? `<p class="ov-cmp__note">${esc(pick(cue.note))}</p>` : ''}
    </div>`, instant);
}

export function clearCompare() { hide(compareEl); }

/* ---------- Passing note ------------------------------------ */

export function showNote(cue, instant) {
  const text = pick(cue.value);
  clearTimeout(showNote._t);
  // A note is a one-shot effect: it shows itself for four seconds and takes
  // itself away again. Rebuilding the picture after a seek replays every cue
  // in the scene, so re-showing it here put a note back on screen at a time
  // it had already gone — the "1763-1775" pill was still sitting over Boston
  // two beats after the years it labelled. Same rule as the musket flash:
  // anything that undoes itself on a timer must not be replayed.
  if (instant || !text) { hide(noteEl); return; }
  show(noteEl, `<span class="ov-note__pill">${esc(text)}</span>`, instant);
  showNote._t = setTimeout(() => hide(noteEl), 4200);
}

/* ------------------------------------------------------------ */

function pick(field) {
  if (field == null) return '';
  if (typeof field === 'string' || typeof field === 'number') return String(field);
  return field[lang] ?? field.no ?? field.en ?? '';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const SILHOUETTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="8.6" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
