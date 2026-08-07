/* ============================================================
   people.js — the portrait grid.
   ============================================================ */

import { state, set, subscribe } from './store.js';
import { t, tx } from './i18n.js';
import { icoPersonPlaceholder } from './icons.js';
import { escapeHtml } from './map.js';

let root, gridEl, introEl;
let people = [];

export function initPeople(container, allPeople) {
  people = allPeople;

  root = document.createElement('div');
  root.className = 'people scroll-y';
  root.innerHTML = `
    <p class="people__intro"></p>
    <div class="people__grid"></div>
  `;
  container.appendChild(root);
  gridEl = root.querySelector('.people__grid');
  introEl = root.querySelector('.people__intro');

  render();

  gridEl.addEventListener('click', (e) => {
    const card = e.target.closest('.pcard');
    if (card) set({ selected: { type: 'person', id: card.dataset.id } });
  });

  subscribe((s, changed) => { if (changed.has('lang')) render(); });

  return root;
}

function render() {
  introEl.textContent = t('peopleIntro');
  gridEl.innerHTML = people.map(cardHtml).join('');
}

function cardHtml(p) {
  const side = p.side || 'neutral';
  const img = p.portrait
    ? `<span class="pcard__img">
         <img src="./assets/portraits/${escapeHtml(p.portrait)}"
              alt="${escapeHtml(tx(p.name))}" loading="lazy" decoding="async">
         <span class="pcard__side"></span>
         <span class="pcard__name">${escapeHtml(tx(p.name))}</span>
       </span>`
    : `<span class="pcard__img pcard__img--none">
         ${icoPersonPlaceholder}
         <span class="pcard__side"></span>
         <span class="pcard__name">${escapeHtml(tx(p.name))}</span>
       </span>`;

  return `
    <button class="pcard pcard--${side}" type="button" data-id="${escapeHtml(p.id)}">
      ${img}
      <span class="pcard__meta">
        <span class="pcard__role">${escapeHtml(tx(p.role))}</span>
        ${p.lived ? `<span class="pcard__lived">${escapeHtml(p.lived)}</span>` : ''}
      </span>
    </button>`;
}
