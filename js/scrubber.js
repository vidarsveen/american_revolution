/* ============================================================
   scrubber.js — the year rail that drives the map.
   ============================================================ */

import {
  state, set, subscribe, era,
  fracToDate, dateToFrac, yearOf, parseDate,
} from './store.js';
import { t, tx, formatYear } from './i18n.js';
import { fromJD, niceStep, tickYears, jdOfYear } from '../core/era.js';
import { icoPlay, icoPause } from '../core/icons.js';

let root, trackEl, railEl, fillEl, thumbEl, yearEl, chapEl, countEl, playBtn;
let events = [];
let chapters = [];
let onPlayToggle = () => {};

export function initScrubber(container, allEvents, allChapters, handlers = {}) {
  events = allEvents;
  chapters = allChapters;
  onPlayToggle = handlers.onPlayToggle || (() => {});

  root = document.createElement('div');
  root.className = 'scrubber';
  root.innerHTML = `
    <div class="scrubber__head">
      <button class="play-btn" type="button">
        <span class="ico-play">${icoPlay}</span>
        <span class="ico-pause">${icoPause}</span>
      </button>
      <div class="scrubber__now">
        <div class="scrubber__year"></div>
        <div class="scrubber__chapter"></div>
      </div>
      <div class="scrubber__count"><b></b><span></span></div>
    </div>
    <div class="scrubber__track" role="slider"
         aria-valuemin="${era.jdStart}" aria-valuemax="${era.jdEnd}" tabindex="0">
      <div class="scrubber__rail"><div class="scrubber__fill"></div></div>
    </div>
    <div class="scrubber__scale">${scaleHtml()}</div>
  `;
  container.appendChild(root);

  trackEl = root.querySelector('.scrubber__track');
  railEl  = root.querySelector('.scrubber__rail');
  fillEl  = root.querySelector('.scrubber__fill');
  yearEl  = root.querySelector('.scrubber__year');
  chapEl  = root.querySelector('.scrubber__chapter');
  countEl = root.querySelector('.scrubber__count');
  playBtn = root.querySelector('.play-btn');

  buildTicks();
  buildDots();
  addThumb();
  wireDrag();
  wireKeys();

  playBtn.addEventListener('click', () => onPlayToggle());

  subscribe((s, changed) => {
    if (changed.has('date')) render();
    if (changed.has('lang')) { render(); syncLabels(); }
    if (changed.has('playing')) root.classList.toggle('is-playing', s.playing);
    if (changed.has('filter')) render();
  });

  syncLabels();
  render();
  return root;
}

function syncLabels() {
  playBtn.setAttribute('aria-label', state.playing ? t('pause') : t('play'));
  trackEl.setAttribute('aria-label', t('scrubberLabel'));
}

/* Three labels across the rail: where the era starts, the middle, and where
   it ends. Was three literals reading 1763, 1773, 1783 — which is a fact
   about one subject, and wrong by seventeen centuries for the next. */
function scaleHtml() {
  const mid = fromJD(era.jdStart + era.span / 2).y;
  return [era.start?.y, mid, era.end?.y]
    .map((y) => `<span>${escapeHtml(formatYear(y))}</span>`).join('');
}

function buildTicks() {
  // A tick per year over twenty years; one per century over seventeen of
  // them. niceStep picks, and tickYears counts through BC without ever
  // landing on the year zero that does not exist.
  const years = Math.abs((era.end?.y ?? 0) - (era.start?.y ?? 0)) + 1;
  // About two dozen ticks whatever the era: one a year across twenty years,
  // one a century across seventeen of them. Majors about every fifth tick.
  const step = niceStep(years, 24);
  const major = Math.max(step, niceStep(years, 5));
  for (const y of tickYears(step)) {
    const tick = document.createElement('div');
    const isMajor = y % major === 0 || y === era.start?.y || y === era.end?.y;
    tick.className = 'scrubber__tick' + (isMajor ? ' scrubber__tick--major' : '');
    tick.style.left = pct(jdOfYear(y));
    trackEl.appendChild(tick);
  }
}

function buildDots() {
  for (const ev of events) {
    const dot = document.createElement('div');
    dot.className = 'scrubber__dot' + (ev.importance === 3 ? ' scrubber__dot--imp3' : '');
    dot.style.left = pct(parseDate(ev.date));
    dot.dataset.id = ev.id;
    dot.dataset.at = String(parseDate(ev.date));
    trackEl.appendChild(dot);
  }
}

function addThumb() {
  thumbEl = document.createElement('div');
  thumbEl.className = 'scrubber__thumb';
  trackEl.appendChild(thumbEl);
}

const pct = (ms) => `${dateToFrac(ms) * 100}%`;

/* ---------- Rendering -------------------------------------- */

function render() {
  const f = dateToFrac(state.date);
  fillEl.style.width = `${f * 100}%`;
  thumbEl.style.left = `${f * 100}%`;

  const year = yearOf(state.date);
  yearEl.textContent = year;

  const ch = chapterAt(state.date);
  chapEl.textContent = ch ? tx(ch.title) : '';

  const seen = events.filter((ev) => parseDate(ev.date) <= state.date);
  countEl.querySelector('b').textContent = seen.length;
  countEl.querySelector('span').textContent =
    seen.length === 1 ? t('eventSoFar') : t('eventsSoFar');

  for (const dot of trackEl.querySelectorAll('.scrubber__dot')) {
    dot.classList.toggle('scrubber__dot--seen', Number(dot.dataset.at) <= state.date);
  }

  trackEl.setAttribute('aria-valuenow', String(state.date));
  trackEl.setAttribute('aria-valuetext', String(year));
}

export function chapterAt(ms) {
  return chapters.find((c) => ms >= parseDate(c.from) && ms <= parseDate(c.to)) || chapters[0];
}

/* ---------- Dragging --------------------------------------- */

function fracFromClientX(x) {
  const r = railEl.getBoundingClientRect();
  return (x - r.left) / r.width;
}

function wireDrag() {
  let dragging = false;

  const move = (e) => {
    if (!dragging) return;
    e.preventDefault();
    set({ date: fracToDate(fracFromClientX(e.clientX)) });
  };

  const up = (e) => {
    if (!dragging) return;
    dragging = false;
    trackEl.classList.remove('is-dragging');
    trackEl.releasePointerCapture?.(e.pointerId);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };

  trackEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    trackEl.classList.add('is-dragging');
    trackEl.setPointerCapture?.(e.pointerId);
    // Any touch on the rail stops the guided tour — you have taken over.
    if (state.playing) onPlayToggle(false);
    set({ date: fracToDate(fracFromClientX(e.clientX)) });
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

function wireKeys() {
  // Julian days, so a step is a day. It used to be milliseconds.
  trackEl.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 365 : 30;
    let d = state.date;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d += step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d -= step;
    else if (e.key === 'Home') d = era.jdStart;
    else if (e.key === 'End') d = era.jdEnd;
    else return;
    e.preventDefault();
    set({ date: Math.max(era.jdStart, Math.min(era.jdEnd, d)) });
  });
}

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- For the tour ----------------------------------- */

export function scrubberEl() { return root; }
