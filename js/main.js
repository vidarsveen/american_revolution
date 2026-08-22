/* ============================================================
   main.js — load the data, build the shell, wire the views.
   ============================================================ */

import {
  state, set, subscribe, loadPrefs, savePrefs,
  initRouting, readHash, parseDate, onNextFrame, era,
} from './store.js';
import { t, setSubject } from './i18n.js';
import { icoStory, icoMap, icoTimeline, icoPeople, icoSun, icoMoon } from '../core/icons.js';
import { initMap, drawPlaces, drawColonies, flyToEvent, mountTools, mapHeight, refreshMapTheme, usePack } from './map.js';
import { initRoutes } from './routes.js';
import { initScrubber } from './scrubber.js';
import { initTimeline, scrollToDate } from './timeline.js';
import { initPeople, setPortraitBase as setPeoplePortraits } from './people.js';
import { initSheet, setPortraitBase as setSheetPortraits } from './sheet.js';
import * as tour from './tour.js';
import { initStory, storyPause, storyInvalidate, storyRefreshTheme,
         storySetLang, setLangHandler } from '../engine/story.js';
import { defaultPack, loadPack, poolUrl } from '../engine/pack.js';
import { packUrl } from '../core/paths.js';
import { setEra } from '../core/era.js';
import { derivePalette, toneFactions, applyPaletteVars } from '../core/palette.js';
import { isDark as domIsDark } from '../core/theme.js';

const VIEWS = [
  { id: 'story', label: 'tabStory', icon: icoStory },
  { id: 'map', label: 'tabMap', icon: icoMap },
  { id: 'timeline', label: 'tabTimeline', icon: icoTimeline },
  { id: 'people', label: 'tabPeople', icon: icoPeople },
];

let data = { pack: null, manifest: null, events: [], people: [], chapters: [],
             places: [], colonies: null, routes: null };
let tabEls = [];

boot();

async function boot() {
  loadPrefs();
  applyTheme();
  applyLangAttr();

  data = await loadData();
  // The pack has to reach the map before it is created, and the palette has
  // to be on :root before anything that references --f-<side> is rendered.
  // Before the topbar, the document title or the boot line are written.
  setSubject(data.manifest);
  usePack(data.manifest);
  // The timeline's span comes from the pack, not from two constants that said
  // 1763 and 1783. Before anything reads state.date, which is now a Julian day.
  setEra(data.manifest?.era);
  set({ date: era.jdStart }, { silent: true });
  publishPalette();
  const faces = packUrl(data.pack, data.manifest?.pools?.portraits || 'portraits/');
  setPeoplePortraits(faces);
  setSheetPortraits(faces);

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

  // Fortell is the front door; Explore lives behind the other tabs.
  setLangHandler((next) => set({ lang: next }));
  initStory(document.querySelector('.view--story'), data.people, state.lang)
    .catch((err) => console.error('[story] failed to start', err));

  initRouting();
  watchSystemTheme();
  readHash();
  syncViews();

  subscribe((s, changed) => {
    if (changed.has('view')) syncViews();
    if (changed.has('lang')) {
      applyLangAttr(); relabelChrome(); savePrefs();
      // The narration is a different recording, not a different label.
      storySetLang(s.lang);
    }
    if (changed.has('theme')) { applyTheme(); refreshMapTheme(); storyRefreshTheme(); savePrefs(); }
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

  // Which pack, and which files inside it, both come from the manifest. This
  // was six hardcoded './content/american-revolution/…' paths, which is the
  // single largest reason `grep -r american-revolution --include=*.js` used
  // to find anything at all.
  const pack = await defaultPack();
  const manifest = pack ? await loadPack(pack) : null;
  const pool = (name, fallback) => {
    const url = poolUrl(manifest, pack, name);
    return url ? grab(url, fallback) : Promise.resolve(fallback);
  };

  const [events, people, chapters, places, colonies, routes] = await Promise.all([
    pool('events', []),
    pool('people', []),
    pool('episodes', []),
    pool('places', []),
    pool('areas', null),
    pool('routes', { routes: [], theatres: [] }),
  ]);

  return {
    pack, manifest,
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

/**
 * Does this pack have anything to put in that view?
 *
 * A pack does not have to be everything. The Roman one is a narrated chapter
 * and a set of people; it has no event list and no period place labels, so
 * Explore's map and timeline would have been two empty screens with a
 * scrubber over nothing. A tab that opens on nothing is worse than a tab that
 * is not there.
 */
function viewHasContent(id) {
  if (id === 'story') return true;                       // always
  if (id === 'people') return (data.people || []).length > 0;
  // The map and the timeline are both driven by the event list. Provinces
  // alone are a picture, not a thing to browse.
  return (data.events || []).length > 0;
}

function buildTabs() {
  const bar = document.querySelector('.tabbar');
  tabEls = VIEWS.filter((v) => viewHasContent(v.id)).map((v) => {
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
  // One view left means no tab bar at all — a row of one is just chrome.
  bar.classList.toggle('is-single', tabEls.length < 2);
  document.querySelector('.app')?.classList.toggle('app--single-view', tabEls.length < 2);
}

function syncViews() {
  for (const b of tabEls) {
    b.setAttribute('aria-selected', String(b.dataset.id === state.view));
  }
  for (const el of document.querySelectorAll('.view')) {
    el.classList.toggle('is-active', el.dataset.view === state.view);
  }
  if (state.view === 'timeline') scrollToDate(state.date);
  if (state.view === 'story') storyInvalidate();
  else storyPause();     // never leave a voice talking in a hidden tab
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

/**
 * Publish the pack's palette as --f-<side> on :root.
 *
 * The stylesheets used to carry one rule per side (.mk--british, .stat--patriot,
 * .pcard--french …), which bakes "there are four sides and they are these"
 * into CSS — and how many sides there are is a property of the subject. Now a
 * DOM node carries `--side: var(--f-british)` and the count stops mattering.
 * Republished on every theme change, which is why the elements reference the
 * variable rather than a colour resolved once.
 */
function publishPalette() {
  const el = document.documentElement;
  applyPaletteVars(el, {
    ...derivePalette(data.manifest?.factions, { el, dark: domIsDark(el) }),
    ...toneFactions(el),
  });
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
  publishPalette();

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark() ? '#14161b' : '#efe6d4');

  const toggle = document.querySelector('.theme-toggle');
  if (toggle) toggle.innerHTML = isDark() ? icoSun : icoMoon;
}

function watchSystemTheme() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme !== 'auto') return;
    applyTheme();
    refreshMapTheme();
    storyRefreshTheme();
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
