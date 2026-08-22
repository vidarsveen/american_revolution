/* ============================================================
   timeline.js — the vertical, chapter-grouped list view.
   ============================================================ */

import { state, set, subscribe, parseDate, FILTERS, matchesFilter } from './store.js';
import { t, tx, formatDate } from './i18n.js';
import { escapeHtml } from './map.js';

let root, listEl, filterEls = [];
let events = [];
let chapters = [];

export function initTimeline(container, allEvents, allChapters) {
  events = [...allEvents].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  chapters = allChapters;

  root = document.createElement('div');
  root.className = 'timeline scroll-y';
  root.innerHTML = `
    <div class="filters"></div>
    <div class="tl-list"></div>
  `;
  container.appendChild(root);
  listEl = root.querySelector('.tl-list');

  buildFilters(root.querySelector('.filters'));
  render();

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.tl-card');
    if (card) set({ selected: { type: 'event', id: card.dataset.id } });
  });

  subscribe((s, changed) => {
    if (changed.has('filter')) { syncFilters(); render(); }
    if (changed.has('lang')) { syncFilters(); render(); }
    if (changed.has('view') && s.view === 'timeline') scrollToDate(s.date);
  });

  return root;
}

function buildFilters(bar) {
  filterEls = FILTERS.map((f) => {
    const b = document.createElement('button');
    b.className = 'filter';
    b.type = 'button';
    b.dataset.id = f.id;
    b.dataset.label = f.label;
    b.textContent = t(f.label);
    b.setAttribute('aria-pressed', String(state.filter === f.id));
    b.addEventListener('click', () => set({ filter: f.id }));
    bar.appendChild(b);
    return b;
  });
}

function syncFilters() {
  for (const b of filterEls) {
    b.textContent = t(b.dataset.label);
    b.setAttribute('aria-pressed', String(state.filter === b.dataset.id));
  }
}

function render() {
  const shown = events.filter((ev) => matchesFilter(ev));
  const out = [];
  let currentChapter = null;

  for (const ev of shown) {
    const ch = chapterFor(ev);
    if (ch && ch !== currentChapter) {
      currentChapter = ch;
      out.push(`
        <div class="tl-chapter">
          <div class="tl-chapter__ep">${escapeHtml(episodeLabel(ch))}</div>
          <h2 class="tl-chapter__title">${escapeHtml(tx(ch.title))}</h2>
        </div>`);
    }
    out.push(cardHtml(ev));
  }

  listEl.innerHTML = out.join('') || `<p class="people__intro">—</p>`;
}

function episodeLabel(ch) {
  return state.lang === 'no' ? `Episode ${ch.ep}` : `Episode ${ch.ep}`;
}

function chapterFor(ev) {
  const d = parseDate(ev.date);
  return chapters.find((c) => d >= parseDate(c.from) && d <= parseDate(c.to)) || null;
}

function cardHtml(ev) {
  const side = ev.side || 'neutral';
  const imp = ev.importance === 3 ? ' tl-card--imp3' : '';
  const tag = ev.importance === 3
    ? `<span class="tl-card__tag">${escapeHtml(t('filterTurning'))}</span>` : '';
  return `
    <button class="tl-card${imp}" style="--side: var(--f-${side}, var(--rule-strong))" type="button" data-id="${escapeHtml(ev.id)}"
            data-at="${parseDate(ev.date)}">
      <span class="tl-card__node"></span>
      <span class="tl-card__body">
        <span class="tl-card__date">${escapeHtml(ev.dateDisplay ? tx(ev.dateDisplay) : formatDate(ev.date))}</span>
        <span class="tl-card__title">${escapeHtml(tx(ev.title))}</span>
        <span class="tl-card__hook">${escapeHtml(tx(ev.hook))}</span>
        ${tag}
      </span>
    </button>`;
}

/** Jump the list to roughly where the scrubber is, so the two views agree. */
export function scrollToDate(ms) {
  if (!listEl) return;
  const cards = [...listEl.querySelectorAll('.tl-card')];
  if (!cards.length) return;
  let target = cards[0];
  for (const c of cards) {
    if (Number(c.dataset.at) <= ms) target = c; else break;
  }
  const top = target.offsetTop - 90;
  root.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

/** Scroll to one specific event and flash it (used when arriving from the map). */
export function revealEvent(id) {
  if (!listEl) return;
  const card = listEl.querySelector(`.tl-card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  root.scrollTo({ top: Math.max(0, card.offsetTop - 90), behavior: 'smooth' });
}
