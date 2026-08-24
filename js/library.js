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

  const q = searchEl.value.trim();
  if (q) {
    const hits = searchEntries(entries, q, state.lang);
    bodyEl.innerHTML = hits.length
      ? `<div class="library__grid">${hits.map((e) => cardHtml(e, kindOf(e.kind))).join('')}</div>`
      : `<p class="library__empty">${escapeHtml(t('librarySearchEmpty'))}</p>`;
    return;
  }

  const spec = kindOf(activeKind);
  const list = entries.byKind.get(activeKind) || [];
  bodyEl.innerHTML =
    `<div class="library__grid${spec?.portrait ? ' library__grid--faces' : ''}">${
      list.map((e) => cardHtml(e, spec)).join('')}</div>`;
}

function kindOf(id) { return entries.kinds.find((k) => k.id === id) || null; }

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
