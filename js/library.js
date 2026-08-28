/* ============================================================
   library.js — everything this subject can tell you, browsable.

   Was people.js: a portrait grid, hardcoded to one pool. A subject with no
   people got nothing, which for a wine course meant its glossary existed and
   could not be opened except by catching a marked word as it went past.

   Now it renders whatever kinds the pack declares, in the pack's own words —
   "Personer" and "Tema" for a war, "Ordbok", "Druer" and "Viner" for wine —
   over one entry model. See core/entries.js for why.

   A kind with `portrait: true` keeps the face grid. Everything else gets a
   text card, because a glossary of forty terms as forty empty portrait
   frames is worse than a list.
   ============================================================ */

import { state, set, subscribe } from './store.js';
import { t, tx } from './i18n.js';
import { icoPersonPlaceholder } from '../core/icons.js';
import { escapeHtml } from './map.js';
import { searchEntries } from '../core/entries.js';

let root, bodyEl, introEl, searchEl;
let entries = null;
let portraitBase = './portraits/';
let activeKind = null;

/* TWO ORDERS, AND WHY BOTH.

   A glossary has exactly two useful orders and they answer different
   questions. "In order" is the order the course teaches them, which is what
   somebody wants who is half way through and cannot remember which word came
   before which. "A-Z" is what somebody wants who half-remembers a word and is
   looking for it.

   Course order is the order the pool FILE lists them in, not a sort — the
   author writes a glossary in teaching order, and nothing here should
   second-guess that. It is not left to hope, either: tools/outline.py checks
   that order against where each word is actually first marked in the chapters
   and prints the drift, the same way pack.json is checked against outline.md.

   Remembered per viewer, because it is a preference and not a fact about the
   subject. localStorage can throw outright in a private window, so both ends
   are wrapped; the fallback is course order, which is the author's. */
let order = readOrder();

function readOrder() {
  try { return localStorage.getItem('fortell:libraryOrder') === 'name' ? 'name' : 'course'; }
  catch { return 'course'; }
}

function writeOrder(value) {
  order = value;
  try { localStorage.setItem('fortell:libraryOrder', value); } catch { /* private window */ }
}

export function setPortraitBase(base) { portraitBase = base || './portraits/'; }

export function initLibrary(container, entryIndex) {
  entries = entryIndex;
  if (!entries || !entries.kinds.length) return null;
  activeKind = entries.kinds[0].id;

  root = document.createElement('div');
  root.className = 'library scroll-y';
  root.innerHTML = `
    <p class="library__intro"></p>
    <div class="library__filter" role="tablist"></div>
    <div class="library__sort" role="group"></div>
    <input class="library__search" type="search" autocomplete="off">
    <div class="library__body"></div>`;
  container.appendChild(root);
  introEl = root.querySelector('.library__intro');
  bodyEl = root.querySelector('.library__body');
  searchEl = root.querySelector('.library__search');

  render();

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('.library__kind');
    if (chip) {
      activeKind = chip.dataset.kind;
      searchEl.value = '';
      render();
      return;
    }
    const sort = e.target.closest('.library__sort button');
    if (sort) {
      writeOrder(sort.dataset.order);
      render();
      return;
    }
    const card = e.target.closest('[data-entry]');
    if (card) {
      const [kind, ...rest] = card.dataset.entry.split(':');
      set({ selected: { type: kind, id: rest.join(':') } });
    }
  });
  searchEl.addEventListener('input', render);
  subscribe((s, changed) => { if (changed.has('lang')) render(); });
  return root;
}

function render() {
  if (!entries) return;
  introEl.textContent = t('libraryIntro');
  searchEl.placeholder = t('librarySearch');

  const kinds = entries.kinds.filter((k) => k.browse);
  root.querySelector('.library__filter').innerHTML = kinds.length > 1
    ? kinds.map((k) => `
        <button class="library__kind${k.id === activeKind ? ' is-on' : ''}"
                type="button" role="tab" data-kind="${escapeHtml(k.id)}"
                aria-selected="${k.id === activeKind}">${escapeHtml(tx(k.label))}</button>`).join('')
    : '';

  // The sort only exists where it changes something: a face grid of thirty
  // people is browsed by looking, and two chips over it would be furniture.
  const spec0 = kindOf(activeKind);
  const sortEl = root.querySelector('.library__sort');
  const list0 = entries.byKind.get(activeKind) || [];
  sortEl.innerHTML = (!spec0?.portrait && list0.length > 3)
    ? [['course', 'libraryByCourse'], ['name', 'libraryByName']].map(([id, key]) => `
        <button class="library__order${id === order ? ' is-on' : ''}" type="button"
                data-order="${id}" aria-pressed="${id === order}">${escapeHtml(t(key))}</button>`).join('')
    : '';

  const q = searchEl.value.trim();
  if (q) {
    const hits = searchEntries(entries, q, state.lang);
    bodyEl.innerHTML = hits.length
      ? `<div class="library__grid">${hits.map((e) => cardHtml(e, kindOf(e.kind))).join('')}</div>`
      : `<p class="library__empty">${escapeHtml(t('librarySearchEmpty'))}</p>`;
    return;
  }

  const spec = spec0;
  const list = order === 'name' ? byName(list0) : list0;
  bodyEl.innerHTML =
    `<div class="library__grid${spec?.portrait ? ' library__grid--faces' : ''}">${
      list.map((e) => cardHtml(e, spec)).join('')}</div>`;
}

function kindOf(id) { return entries.kinds.find((k) => k.id === id) || null; }

/* Alphabetical in the language on screen, and localeCompare rather than < so
   that å sorts after z in Norwegian and after a in English, which is the
   whole point of having two languages. Copies before sorting: entries.byKind
   is the shared index and the course order is the other half of this control. */
function byName(list) {
  const lang = state.lang;
  return [...list].sort((a, b) => tx(a.name).localeCompare(tx(b.name), lang, { sensitivity: 'base' }));
}

function cardHtml(e, spec) {
  const ref = `${escapeHtml(e.kind)}:${escapeHtml(e.id)}`;
  const name = escapeHtml(tx(e.name));
  const side = e.side || 'neutral';

  // A face grid, but only where the pack asked for one. A glossary rendered
  // as empty portrait frames is worse than a list.
  if (spec?.portrait) {
    const img = e.portrait
      ? `<span class="pcard__img">
           <img src="${portraitBase}${escapeHtml(e.portrait)}" alt="${name}"
                loading="lazy" decoding="async">
           <span class="pcard__side"></span><span class="pcard__name">${name}</span>
         </span>`
      : `<span class="pcard__img pcard__img--none">${icoPersonPlaceholder}
           <span class="pcard__side"></span><span class="pcard__name">${name}</span>
         </span>`;
    return `
      <button class="pcard" type="button" data-entry="${ref}"
              style="--side: var(--f-${escapeHtml(side)}, var(--ink-faint))">
        ${img}
        <span class="pcard__meta">
          <span class="pcard__role">${escapeHtml(tx(e.role) || tx(e.hook))}</span>
          ${e.lived ? `<span class="pcard__lived">${escapeHtml(e.lived)}</span>` : ''}
        </span>
      </button>`;
  }

  return `
    <button class="ecard" type="button" data-entry="${ref}">
      <span class="ecard__name">${name}</span>
      <span class="ecard__hook">${escapeHtml(tx(e.hook))}</span>
    </button>`;
}
