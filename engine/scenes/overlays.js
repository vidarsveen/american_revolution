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

let root = null;
let portraitEl = null;
let imageEl = null;
let quoteEl = null;
let statsEl = null;
let noteEl = null;

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
      <div class="ov-image"></div>
    </div>
    <div class="ov-deck ov-deck--mid">
      <div class="ov-note"></div>
      <div class="ov-quote"></div>
    </div>
    <div class="ov-deck ov-deck--lower">
      <div class="ov-portrait"></div>
      <div class="ov-stats"></div>
    </div>
  `;
  container.appendChild(root);

  portraitEl = root.querySelector('.ov-portrait');
  imageEl = root.querySelector('.ov-image');
  quoteEl = root.querySelector('.ov-quote');
  statsEl = root.querySelector('.ov-stats');
  noteEl = root.querySelector('.ov-note');
}

export function resetOverlays() {
  storyRoot?.classList.remove('has-portrait');
  for (const el of [portraitEl, imageEl, quoteEl, noteEl]) {
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

export function showPortrait(cue, instant) {
  const p = people.get(cue.id);
  if (!p) return;
  const img = p.portrait
    ? `<img src="./assets/portraits/${esc(p.portrait)}" alt="${esc(pick(p.name))}" decoding="async">`
    : `<span class="ov-portrait__none">${SILHOUETTE}</span>`;
  show(portraitEl, `
    <figure class="ov-portrait__card side--${esc(p.side || 'neutral')}">
      <span class="ov-portrait__frame">${img}</span>
      <figcaption>
        <b>${esc(pick(p.name))}</b>
        <span>${esc(pick(p.role))}</span>
        ${p.lived ? `<i>${esc(p.lived)}</i>` : ''}
      </figcaption>
    </figure>`, instant);
  // The caption strip lifts out of the way while a face is on screen.
  storyRoot?.classList.add('has-portrait');
}

export function hidePortrait() {
  hide(portraitEl);
  storyRoot?.classList.remove('has-portrait');
}

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
  const side = cue.side ? ` stat-chip--${esc(cue.side)}` : '';
  const chip = document.createElement('div');
  chip.className = `stat-chip${side}${instant || reduced() ? ' is-instant' : ''}`;
  chip.innerHTML = `<b>${esc(cue.value)}</b><span>${esc(pick(cue.label))}</span>`;
  statsEl.appendChild(chip);
  statsEl.classList.add('is-on');
}

export function clearStats() {
  if (!statsEl) return;
  statsEl.innerHTML = '';
  statsEl.classList.remove('is-on');
}

/* ---------- Passing note ------------------------------------ */

export function showNote(cue, instant) {
  const text = pick(cue.value);
  if (!text) { hide(noteEl); return; }
  show(noteEl, `<span class="ov-note__pill">${esc(text)}</span>`, instant);
  clearTimeout(showNote._t);
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
