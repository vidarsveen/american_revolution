/* ============================================================
   sheet.js — the drag-up detail panel used by every view.
   ============================================================ */

import { state, set, subscribe } from './store.js';
import { t, tx, formatDate, formatNumber, KIND_LABEL, SIDE_LABEL } from './i18n.js';
import { icoClose, icoPin, icoBook, icoCaret, icoExternal, icoPersonPlaceholder } from './icons.js';
import { getSummary } from './wiki.js';
import { escapeHtml } from './map.js';

const PEEK = 40;   // % of sheet height hidden when peeking
let backdrop, sheet, scroller, gripEl;
let events = new Map();
let people = new Map();
let onShowOnMap = () => {};
let renderToken = 0;

export function initSheet(allEvents, allPeople, handlers = {}) {
  events = new Map(allEvents.map((e) => [e.id, e]));
  people = new Map(allPeople.map((p) => [p.id, p]));
  onShowOnMap = handlers.onShowOnMap || (() => {});

  backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.addEventListener('click', close);

  sheet = document.createElement('aside');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = `
    <div class="sheet__grip" aria-hidden="true"></div>
    <button class="sheet__close" type="button">${icoClose}</button>
    <div class="sheet__scroll scroll-y"></div>
  `;

  document.body.append(backdrop, sheet);
  scroller = sheet.querySelector('.sheet__scroll');
  gripEl = sheet.querySelector('.sheet__grip');

  sheet.querySelector('.sheet__close').addEventListener('click', close);
  sheet.querySelector('.sheet__close').setAttribute('aria-label', t('close'));

  wireDrag();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selected) close();
  });

  subscribe((s, changed) => {
    if (changed.has('selected')) render();
    if (changed.has('lang') && s.selected) render();
  });

  render();
}

export function close() {
  set({ selected: null });
}

/* ------------------------------------------------------------
   Render
   ------------------------------------------------------------ */

function render() {
  const sel = state.selected;
  const open = Boolean(sel);

  document.body.classList.toggle('sheet-open', open);
  backdrop.classList.toggle('is-on', open);
  sheet.setAttribute('aria-hidden', String(!open));

  if (!open) {
    sheet.classList.remove('is-open', 'is-full');
    sheet.style.removeProperty('transform');
    return;
  }

  const html = sel.type === 'person'
    ? renderPerson(people.get(sel.id))
    : renderEvent(events.get(sel.id));

  if (html === null) { set({ selected: null }); return; }

  scroller.innerHTML = html;
  scroller.scrollTop = 0;
  sheet.style.removeProperty('transform');
  sheet.classList.remove('is-full');
  sheet.classList.add('is-open');
  sheet.style.setProperty('--sheet-y', `${PEEK}%`);

  wireBody();
}

function renderEvent(ev) {
  if (!ev) return null;
  const side = ev.side || 'neutral';

  return `
    <div class="sheet__kicker side--${side}">
      <span class="dot"></span>
      <span>${escapeHtml(t(KIND_LABEL[ev.kind] || 'kindBattle'))}</span>
      <span aria-hidden="true">·</span>
      <span class="sheet__date">${escapeHtml(ev.dateDisplay ? tx(ev.dateDisplay) : formatDate(ev.date))}</span>
    </div>
    <h2 class="sheet__title">${escapeHtml(tx(ev.title))}</h2>
    <p class="sheet__hook">${escapeHtml(tx(ev.hook))}</p>
    ${statsHtml(ev)}
    <div class="sheet__body">${prose(tx(ev.body))}</div>
    ${calloutHtml('why', t('why'), tx(ev.why))}
    ${calloutHtml('fact', t('fact'), tx(ev.fact))}
    ${peopleChips(ev.people, t('peopleHere'))}
    ${wikiBlock(ev.wiki)}
    <div class="sheet__actions">
      ${ev.coords ? `<button class="btn btn--primary" data-map="${escapeHtml(ev.id)}">
        ${icoPin}<span>${escapeHtml(t('showOnMap'))}</span></button>` : ''}
    </div>
  `;
}

function renderPerson(p) {
  if (!p) return null;
  const side = p.side || 'neutral';
  const img = p.portrait
    ? `<img class="sheet__portrait" src="./assets/portraits/${escapeHtml(p.portrait)}"
            alt="${escapeHtml(tx(p.name))}" loading="lazy" decoding="async">`
    : `<div class="sheet__portrait sheet__portrait--none">${icoPersonPlaceholder}</div>`;

  return `
    ${img}
    <div class="sheet__kicker side--${side}">
      <span class="dot"></span>
      <span>${escapeHtml(tx(p.role))}</span>
      ${p.lived ? `<span aria-hidden="true">·</span><span class="sheet__date">${escapeHtml(p.lived)}</span>` : ''}
    </div>
    <h2 class="sheet__title">${escapeHtml(tx(p.name))}</h2>
    <p class="sheet__hook">${escapeHtml(tx(p.hook))}</p>
    <div class="sheet__body">${prose(tx(p.body))}</div>
    ${calloutHtml('fact', t('fact'), tx(p.fact))}
    ${eventChips(p.events, t('partOf'))}
    ${wikiBlock(p.wiki)}
  `;
}

/* ---------- Pieces ----------------------------------------- */

function statsHtml(ev) {
  const n = ev.numbers;
  if (!n) return '';
  const cells = [];
  if (n.britishForces) cells.push(`<div class="stat stat--british"><span class="stat__k">${escapeHtml(t('statBritish'))}</span><span class="stat__v">${formatNumber(n.britishForces)}</span></div>`);
  if (n.americanForces) cells.push(`<div class="stat stat--patriot"><span class="stat__k">${escapeHtml(t('statPatriot'))}</span><span class="stat__v">${formatNumber(n.americanForces)}</span></div>`);
  if (n.frenchForces) cells.push(`<div class="stat"><span class="stat__k">${escapeHtml(t('statFrench'))}</span><span class="stat__v">${formatNumber(n.frenchForces)}</span></div>`);
  if (n.outcome) {
    const key = { british: 'outBritish', patriot: 'outPatriot', draw: 'outDraw' }[n.outcome];
    if (key) cells.push(`<div class="stat"><span class="stat__k">${escapeHtml(t('statOutcome'))}</span><span class="stat__v">${escapeHtml(t(key))}</span></div>`);
  }
  return cells.length ? `<div class="stats">${cells.join('')}</div>` : '';
}

function calloutHtml(kind, label, text) {
  if (!text) return '';
  return `<div class="callout callout--${kind}">
    <span class="callout__k">${escapeHtml(label)}</span>${prose(text, true)}
  </div>`;
}

function peopleChips(ids, label) {
  if (!ids || !ids.length) return '';
  const items = ids.map((id) => people.get(id)).filter(Boolean);
  if (!items.length) return '';
  const chips = items.map((p) => {
    const av = p.portrait
      ? `<img class="chip__av" src="./assets/portraits/${escapeHtml(p.portrait)}" alt="" loading="lazy" decoding="async">`
      : `<span class="chip__av chip__av--none">${icoPersonPlaceholder}</span>`;
    return `<button class="chip" type="button" data-person="${escapeHtml(p.id)}">${av}<span>${escapeHtml(tx(p.name))}</span></button>`;
  }).join('');
  return `<div class="chips__k">${escapeHtml(label)}</div><div class="chips">${chips}</div>`;
}

function eventChips(ids, label) {
  if (!ids || !ids.length) return '';
  const items = ids.map((id) => events.get(id)).filter(Boolean);
  if (!items.length) return '';
  const chips = items.map((e) =>
    `<button class="chip chip--plain" type="button" data-event="${escapeHtml(e.id)}">${escapeHtml(tx(e.title))}</button>`
  ).join('');
  return `<div class="chips__k">${escapeHtml(label)}</div><div class="chips">${chips}</div>`;
}

function wikiBlock(titles) {
  if (!titles || (!titles.no && !titles.en)) return '';
  const payload = escapeHtml(JSON.stringify(titles));
  return `
    <div class="wiki" data-wiki="${payload}">
      <button class="wiki__toggle" type="button" aria-expanded="false">
        <span class="w-ico">${icoBook}</span>
        <span>${escapeHtml(t('readMore'))}</span>
        <span class="w-caret">${icoCaret}</span>
      </button>
      <div class="wiki__panel"><div class="wiki__inner"><div class="wiki__pad"></div></div></div>
    </div>`;
}

/** Escape, split blank-line-separated paragraphs, allow *emphasis*. */
function prose(text, inline = false) {
  if (!text) return '';
  const paras = String(text).split(/\n\s*\n/).map((p) => {
    const safe = escapeHtml(p.trim()).replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return inline ? safe : `<p>${safe}</p>`;
  });
  return inline ? paras.join('<br>') : paras.join('');
}

/* ---------- Delegated interactions ------------------------- */

function wireBody() {
  const token = ++renderToken;

  scroller.addEventListener('click', onBodyClick);

  const wiki = scroller.querySelector('.wiki');
  if (!wiki) return;
  const toggle = wiki.querySelector('.wiki__toggle');
  const pad = wiki.querySelector('.wiki__pad');
  let loaded = false;

  toggle.addEventListener('click', async () => {
    const open = !wiki.classList.contains('is-open');
    wiki.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (!open || loaded) return;
    loaded = true;

    pad.innerHTML = `<div class="wiki__skel"><span></span><span></span><span></span></div>`;

    let titles = null;
    try { titles = JSON.parse(wiki.dataset.wiki); } catch { /* malformed data attr */ }
    const data = await getSummary(titles);

    if (token !== renderToken) return;   // the user moved on while we waited

    if (!data) {
      pad.innerHTML = `<p class="wiki__extract">${escapeHtml(t('wikiNone'))}</p>`;
      return;
    }

    const thumb = data.thumb
      ? `<img class="wiki__thumb" src="${escapeHtml(data.thumb)}" alt="" loading="lazy" decoding="async">`
      : '';
    const flag = data.fallback
      ? `<span class="wiki__lang">${escapeHtml(t('wikiInEnglish'))}</span>` : '';

    pad.innerHTML = `
      ${thumb}
      <p class="wiki__extract">${escapeHtml(data.extract)}</p>
      <div class="wiki__foot">
        <span>${escapeHtml(t('wikiCredit'))} ${flag}</span>
        <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">
          <span>${escapeHtml(t('wikiOpen'))}</span>${icoExternal}
        </a>
      </div>`;
  });
}

function onBodyClick(e) {
  const person = e.target.closest('[data-person]');
  if (person) { set({ selected: { type: 'person', id: person.dataset.person } }); return; }

  const ev = e.target.closest('[data-event]');
  if (ev) { set({ selected: { type: 'event', id: ev.dataset.event } }); return; }

  const toMap = e.target.closest('[data-map]');
  if (toMap) { onShowOnMap(toMap.dataset.map); }
}

/* ------------------------------------------------------------
   Dragging: grip always; the scroll area only when already at top.
   ------------------------------------------------------------ */

function wireDrag() {
  let startY = 0, startTop = 0, dragging = false, lastY = 0, lastT = 0, velocity = 0;

  const height = () => sheet.getBoundingClientRect().height;
  const currentTop = () => {
    const m = /translateY\(([-\d.]+)px\)/.exec(sheet.style.transform || '');
    if (m) return Number(m[1]);
    return sheet.classList.contains('is-full') ? 0 : height() * (PEEK / 100);
  };

  const begin = (e) => {
    if (!state.selected) return;
    dragging = true;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    startTop = currentTop();
    sheet.classList.add('is-dragging');
  };

  const move = (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = (e.clientY - lastY) / dt;      // px per ms
    lastY = e.clientY; lastT = e.timeStamp;

    let top = startTop + dy;
    if (top < 0) top = top * 0.28;            // rubber-band at the top
    sheet.style.transform = `translateY(${top}px)`;
    e.preventDefault();
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    sheet.style.removeProperty('transform');

    const h = height();
    const top = currentTopFromLast();
    const peekPx = h * (PEEK / 100);

    // A decisive flick beats position.
    if (velocity > 0.7) { snapDown(top, peekPx); return; }
    if (velocity < -0.7) { toFull(); return; }

    if (top > peekPx + h * 0.18) close();
    else if (top > peekPx * 0.5) toPeek();
    else toFull();

    function currentTopFromLast() {
      return Math.max(0, startTop + (lastY - startY));
    }
  };

  const snapDown = (top, peekPx) => {
    if (top > peekPx * 0.75) close(); else toPeek();
  };

  const toFull = () => { sheet.classList.add('is-full'); };
  const toPeek = () => { sheet.classList.remove('is-full'); };

  const attach = (el, guard) => {
    el.addEventListener('pointerdown', (e) => {
      if (guard && !guard(e)) return;
      begin(e);
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  attach(gripEl);
  // Pull the sheet down by dragging the content, but only from the very top.
  attach(scroller, () => scroller.scrollTop <= 0);

  // Reaching the top of the content and continuing to pull should feel connected.
  scroller.addEventListener('scroll', () => {
    if (scroller.scrollTop > 12 && !sheet.classList.contains('is-full')) {
      sheet.classList.add('is-full');
    }
  }, { passive: true });
}
