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
let factEl = null;
let entries = null;
let factBeat = null;

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
    <!-- The fact box lives DOWN HERE, not in the middle deck.

         A definition is an aside. It was sitting at top:32% -- the middle of
         the map -- so at s2.b7 of the wine chapter the line "Og Piemonte,
         helt nordvest, har Nebbiolo" put the card explaining Nebbiolo squarely
         on top of Piemonte. The picture must show the thing the sentence is
         talking about, and the overlay explaining it was covering it.

         Bottom-left, opposite the stats, above the caption: it interrupts the
         picture's EDGE and nothing else, which is what
         docs/design-direction.md says a fact box is allowed to do. -->
    <div class="ov-deck ov-deck--lower">
      <div class="ov-fact"></div>
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
  factEl = root.querySelector('.ov-fact');
}

export function resetOverlays() {
  factBeat = null;
  for (const el of [portraitEl, imageEl, quoteEl, noteEl, compareEl, factEl]) {
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

/* How sure we are that anybody said this.

   Every quote in every pack carries a `kind`, and for a long time NOTHING
   read it -- so on screen Percy's genuine letter of 20 April 1775, a line
   somebody's grandson wrote down fifty years later, and a slogan nobody in
   particular ever said were typographically identical. In an app whose whole
   argument is that you should ask where a source comes from, that was the
   one thing it refused to tell you.

   `said` gets no mark: a real quotation is the default and does not need
   apologising for. The other three do. */
const QUOTE_KIND = {
  attributed: { no: 'Gjengitt av andre', en: 'As others reported it' },
  later:      { no: 'Nedtegnet lenge etterpå', en: 'Written down long afterwards' },
  slogan:     { no: 'Slagord — ingen bestemt opphavsmann',
                en: 'A slogan — nobody in particular said it' },
};

export function showQuote(cue, instant) {
  const q = (chapter.quotes || {})[cue.id];
  if (!q) return;
  const mark = QUOTE_KIND[q.kind];
  show(quoteEl, `
    <blockquote class="ov-quote__card${mark ? ' is-hedged' : ''}">
      ${mark ? `<p class="ov-quote__kind">${esc(pick(mark))}</p>` : ''}
      <p>${esc(pick(q.text))}</p>
      <cite>${esc(pick(q.by))}</cite>
    </blockquote>`, instant);
}

export function hideQuote() { hide(quoteEl); }

/* ---------- Fact boxes -------------------------------------- */

/** The entry index, handed in at mount so this module does no fetching. */
export function useEntries(index) { entries = index; }

/**
 * A short definition, on screen while the word is being said.
 *
 * term.mark already made a word tappable, and tapping is a thing almost
 * nobody does while a voice is running -- the reader is listening, not
 * hunting for underlines. So the definition was there and was never seen.
 * This puts it on the screen at the moment the word is spoken, which is the
 * only moment it is wanted.
 *
 * Deliberately the HOOK and not the body. A fact box is a glance: one line
 * that lets you keep listening. The body is what the library and the dossier
 * are for, and the card says so.
 *
 * It is stage state, not a one-shot: shown by a cue and hidden by a cue, so
 * seeking to the middle of a definition shows the definition. That is the
 * same contract as quote.show and the reason this is not a caption.note.
 */
export function showFact(cue, instant) {
  if (!factEl) return;
  const e = entries?.get(cue.kind, cue.id);
  if (!e) return;
  factBeat = cue.beat ?? null;
  const label = KIND_LABEL[cue.kind];
  show(factEl, `
    <aside class="ov-fact__card" data-tap="${esc(cue.kind)}:${esc(cue.id)}"
           role="button" tabindex="0">
      ${label ? `<p class="ov-fact__kind">${esc(pick(label))}</p>` : ''}
      <p class="ov-fact__name">${esc(pick(e.name))}</p>
      <p class="ov-fact__hook">${esc(pick(e.hook))}</p>
    </aside>`, instant);
}

export function hideFact() { factBeat = null; hide(factEl); }

/**
 * The box belongs to the sentence that said the word.
 *
 * Called on every tick with the beat the caption is showing. If that is not
 * the beat the box was raised in, the box goes — whatever the cue timeline
 * happens to say.
 *
 * This is a belt as well as braces. compile() already caps the derived hide
 * at the end of its own beat, so in a correct build this never fires. It
 * exists because the bug that would not die was exactly this shape: a hide
 * that never ran, and a definition sitting over a sentence it had nothing to
 * do with while three different "fixes" measured the cue list and pronounced
 * it fine. A rule this simple should be enforced where it can be SEEN to
 * hold, not only where it is calculated.
 *
 * Safe under rule 1: "visible only during the beat it was shown in" is a
 * function of time, not of history. Seeking to a later beat hides it, exactly
 * as playing to one does.
 */
export function factBeatIs(beatId) {
  if (!factBeat || beatId === undefined || beatId === factBeat) return;
  hideFact();
}

/* What to call each kind on the card. A reader should know whether they are
   being told about a word, a plant or a place before they read the line. */
const KIND_LABEL = {
  term:  { no: 'Ord', en: 'Term' },
  grape: { no: 'Drue', en: 'Grape' },
  wine:  { no: 'Vin', en: 'Wine' },
  topic: { no: 'Tema', en: 'Topic' },
  place: { no: 'Sted', en: 'Place' },
  person: { no: 'Person', en: 'Person' },
};

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
