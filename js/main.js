/* ============================================================
   main.js — load the data, build the shell, wire the views.
   ============================================================ */

import {
  state, set, subscribe, loadPrefs, savePrefs,
  initRouting, readHash, parseDate, onNextFrame,
} from './store.js';
import { t } from './i18n.js';
import { icoMap, icoTimeline, icoPeople, icoSun, icoMoon } from './icons.js';
import { initMap, drawPlaces, drawColonies, flyToEvent, mountTools, mapHeight, refreshTileTheme } from './map.js';
import { initRoutes } from './routes.js';
import { initScrubber } from './scrubber.js';
import { initTimeline, scrollToDate } from './timeline.js';
import { initPeople } from './people.js';
import { initSheet } from './sheet.js';
import * as tour from './tour.js';

const VIEWS = [
  { id: 'map', label: 'tabMap', icon: icoMap },
  { id: 'timeline', label: 'tabTimeline', icon: icoTimeline },
  { id: 'people', label: 'tabPeople', icon: icoPeople },
];

let data = { events: [], people: [], chapters: [], places: [], colonies: null, routes: null };
let tabEls = [];

boot();

async function boot() {
  loadPrefs();
  applyTheme();
  applyLangAttr();

  data = await loadData();

  buildTopbar();
  buildTabs();

  const mapView = document.querySelector('.view--map');
  const tlView = document.querySelector('.view--timeline');
  const peopleView = document.querySelector('.view--people');

  initMap(data.events, { onSelect: onMarkerTap });
  drawColonies(data.colonies);
  drawPlaces(data.places);
  initRoutes(data.routes);
  mountTools(mapView);

  initScrubber(mapView, data.events, data.chapters, {
    onPlayToggle: (force) => tour.toggle(force),
  });
  tour.initTour(mapView, data.events);

  initTimeline(tlView, data.events, data.chapters);
  initPeople(peopleView, data.people);
  initSheet(data.events, data.people, { onShowOnMap: showOnMap });

  initRouting();
  watchSystemTheme();
  readHash();
  syncViews();

  subscribe((s, changed) => {
    if (changed.has('view')) syncViews();
    if (changed.has('lang')) { applyLangAttr(); relabelChrome(); savePrefs(); }
    if (changed.has('theme')) { applyTheme(); refreshTileTheme(); savePrefs(); }
  });

  // Start just before the first event so the map is not empty on arrival.
  if (!state.selected) {
    const first = [...data.events].sort((a, b) => parseDate(a.date) - parseDate(b.date))[0];
    if (first) set({ date: parseDate(first.date) }, { silent: true });
  }

  finishBoot();
}

/* ------------------------------------------------------------
   Data
   ------------------------------------------------------------ */

async function loadData() {
  const grab = async (path, fallback) => {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      console.warn(`[data] could not load ${path}`, err);
      return fallback;
    }
  };

  const [events, people, chapters, places, colonies, routes] = await Promise.all([
    grab('./data/events.json', []),
    grab('./data/people.json', []),
    grab('./data/chapters.json', []),
    grab('./data/geo/places.json', []),
    grab('./data/geo/colonies.geojson', null),
    grab('./data/geo/routes.json', { routes: [], theatres: [] }),
  ]);

  return {
    events: events.sort((a, b) => parseDate(a.date) - parseDate(b.date)),
    people, chapters, places, colonies, routes,
  };
}

/* ------------------------------------------------------------
   Chrome
   ------------------------------------------------------------ */

function buildTopbar() {
  const bar = document.querySelector('.topbar');

  const mark = document.createElement('h1');
  mark.className = 'wordmark';
  bar.appendChild(mark);

  const lang = document.createElement('button');
  lang.className = 'chip-btn lang-toggle';
  lang.type = 'button';
  lang.addEventListener('click', () => set({ lang: state.lang === 'no' ? 'en' : 'no' }));
  bar.appendChild(lang);

  const theme = document.createElement('button');
  theme.className = 'chip-btn theme-toggle';
  theme.type = 'button';
  theme.addEventListener('click', () => {
    set({ theme: isDark() ? 'light' : 'dark' });
  });
  bar.appendChild(theme);

  relabelChrome();
}

function relabelChrome() {
  const mark = document.querySelector('.wordmark');
  if (mark) mark.innerHTML = `${t('appTitle')} <span>${t('appYears')}</span>`;

  const lang = document.querySelector('.lang-toggle');
  if (lang) {
    lang.innerHTML = state.lang === 'no'
      ? `<b>NO</b><i>/EN</i>` : `<i>NO/</i><b>EN</b>`;
    lang.setAttribute('aria-label', t('langLabel'));
  }

  const theme = document.querySelector('.theme-toggle');
  if (theme) {
    theme.innerHTML = isDark() ? icoSun : icoMoon;
    theme.setAttribute('aria-label', t('themeLabel'));
  }

  for (const b of tabEls) b.querySelector('.tab__label').textContent = t(b.dataset.label);
  document.title = `${t('appTitle')} ${t('appYears')}`;
}

function buildTabs() {
  const bar = document.querySelector('.tabbar');
  tabEls = VIEWS.map((v) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.dataset.id = v.id;
    b.dataset.label = v.label;
    b.setAttribute('role', 'tab');
    b.innerHTML = `<span class="tab__ico">${v.icon}</span><span class="tab__label">${t(v.label)}</span>`;
    b.addEventListener('click', () => {
      if (state.playing) tour.toggle(false);
      set({ view: v.id, selected: null });
    });
    bar.appendChild(b);
    return b;
  });
}

function syncViews() {
  for (const b of tabEls) {
    b.setAttribute('aria-selected', String(b.dataset.id === state.view));
  }
  for (const el of document.querySelectorAll('.view')) {
    el.classList.toggle('is-active', el.dataset.view === state.view);
  }
  if (state.view === 'timeline') scrollToDate(state.date);
}

/* ------------------------------------------------------------
   Cross-view actions
   ------------------------------------------------------------ */

function onMarkerTap(id) {
  set({ selected: { type: 'event', id } });
  // Lift the marker into the strip of map the sheet leaves visible.
  onNextFrame(() => flyToEvent(id, { offsetY: -mapHeight() * 0.26 }));
}

function showOnMap(id) {
  const ev = data.events.find((e) => e.id === id);
  if (!ev) return;
  if (state.playing) tour.toggle(false);
  set({ view: 'map', selected: null, date: parseDate(ev.date) });
  setTimeout(() => flyToEvent(id, { zoom: 7.5 }), 60);
}

/* ------------------------------------------------------------
   Theme & language plumbing
   ------------------------------------------------------------ */

function isDark() {
  if (state.theme === 'dark') return true;
  if (state.theme === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark() ? '#14161b' : '#efe6d4');

  const toggle = document.querySelector('.theme-toggle');
  if (toggle) toggle.innerHTML = isDark() ? icoSun : icoMoon;
}

function watchSystemTheme() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme !== 'auto') return;
    applyTheme();
    refreshTileTheme();
  });
}

function applyLangAttr() {
  document.documentElement.lang = state.lang === 'no' ? 'nb' : 'en';
}

function finishBoot() {
  const boot = document.querySelector('.boot');
  if (!boot) return;
  onNextFrame(() => {
    boot.classList.add('is-done');
    setTimeout(() => boot.remove(), 500);
  });
}
