/* ============================================================
   store.js — one small state object, a pub/sub, and hash routing.
   No framework; every view subscribes and re-renders what changed.
   ============================================================ */

/* The timeline runs on Julian day numbers, not milliseconds, and the span
   comes from the pack rather than from two literals that said 1763 and 1783.
   A millisecond count cannot hold 44 BC — see the header of core/era.js, and
   note that `Date.UTC(-44, …)` does not mean what it looks like it means. */
export { era, fracToJD, jdToFrac, yearOf, parseRange } from '../core/era.js';
import { parseDate as parseFull } from '../core/era.js';

/**
 * A date string to one orderable number — its Julian day.
 *
 * Every caller in js/ compares and subtracts these ("is this event before the
 * playhead?"), so the export has to stay a number. core/era.js returns the
 * whole {y, m, d, prec, jd} record, which is what you want when rendering and
 * emphatically not what you want in `a.date - b.date`.
 */
export const parseDate = (input) => parseFull(input)?.jd ?? NaN;

/** The full record, for anything that needs the parts rather than the order. */
export { parseDate as parseDateParts } from '../core/era.js';

const listeners = new Set();

export const state = {
  lang: 'no',            // 'no' | 'en'
  theme: 'auto',         // 'auto' | 'light' | 'dark'
  view: 'story',         // 'story' | 'map' | 'timeline' | 'people'
  date: 0,               // scrubber position, as a Julian day
  filter: 'all',         // 'all' | 'battle' | 'politics' | 'turning-point'
  selected: null,        // { type: 'event' | 'person', id }
  playing: false,
};

/** Subscribe. Returns an unsubscribe function.
 *  fn(state, changed) where `changed` is a Set of key names. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Merge a patch into state and notify anyone who cares. */
export function set(patch, opts = {}) {
  const changed = new Set();
  for (const k of Object.keys(patch)) {
    if (!shallowEq(state[k], patch[k])) {
      state[k] = patch[k];
      changed.add(k);
    }
  }
  if (!changed.size) return;
  for (const fn of listeners) fn(state, changed);
  // Only view/selection live in the URL. Scrubbing must not spam history.
  if (!opts.silent && (changed.has('view') || changed.has('selected'))) writeHash();
}

function shallowEq(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/* ---------- Persistence ------------------------------------ */

const LS = 'fortell:prefs';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.lang === 'no' || p.lang === 'en') state.lang = p.lang;
    if (['auto', 'light', 'dark'].includes(p.theme)) state.theme = p.theme;
  } catch { /* private mode, corrupt value — defaults are fine */ }
}

export function savePrefs() {
  try {
    localStorage.setItem(LS, JSON.stringify({ lang: state.lang, theme: state.theme }));
  } catch { /* not worth bothering the user about */ }
}

/* ---------- Hash routing -----------------------------------
   #/kart  #/tidslinje  #/personer  #/hendelse/<id>  #/person/<id>
   Keeps the Android back button and shared links working.
   ----------------------------------------------------------- */

const VIEW_SLUG = { story: 'fortell', map: 'kart', timeline: 'tidslinje', people: 'personer' };
const SLUG_VIEW = { fortell: 'story', kart: 'map', tidslinje: 'timeline', personer: 'people' };

let writing = false;

export function hashFor(s = state) {
  if (s.selected) {
    const kind = s.selected.type === 'person' ? 'person' : 'hendelse';
    return `#/${kind}/${s.selected.id}`;
  }
  return `#/${VIEW_SLUG[s.view] || 'fortell'}`;
}

function writeHash() {
  const h = hashFor();
  if (location.hash === h) return;
  writing = true;
  // Opening a detail pushes history (so Back closes it); switching view replaces.
  if (state.selected) history.pushState(null, '', h);
  else history.replaceState(null, '', h);
  writing = false;
}

/** Apply the current URL to state. Called on boot and on popstate. */
export function readHash() {
  const m = /^#\/([^/]+)(?:\/(.+))?$/.exec(location.hash || '');
  if (!m) { set({ selected: null }, { silent: true }); return; }
  const [, head, id] = m;
  if (head === 'hendelse' && id) {
    set({ selected: { type: 'event', id: decodeURIComponent(id) } }, { silent: true });
  } else if (head === 'person' && id) {
    set({ selected: { type: 'person', id: decodeURIComponent(id) }, view: 'people' }, { silent: true });
  } else if (SLUG_VIEW[head]) {
    set({ view: SLUG_VIEW[head], selected: null }, { silent: true });
  }
}

export function initRouting() {
  window.addEventListener('popstate', () => { if (!writing) readHash(); });
  window.addEventListener('hashchange', () => { if (!writing) readHash(); });
}

/* ---------- Filtering ---------------------------------------
   Turning points are marked with importance 3 rather than a `kind`, so the
   filter cannot be a plain kind comparison. Both the map and the timeline
   go through here so they always show the same set.
   ------------------------------------------------------------ */

export const FILTERS = [
  { id: 'all',           label: 'filterAll',      test: () => true },
  { id: 'battle',        label: 'filterBattle',   test: (e) => e.kind === 'battle' },
  { id: 'politics',      label: 'filterPolitics', test: (e) => e.kind === 'politics' },
  { id: 'people',        label: 'filterPeople',   test: (e) => e.kind === 'people' },
  { id: 'turning-point', label: 'filterTurning',  test: (e) => e.importance === 3 },
];

export function matchesFilter(ev, filter = state.filter) {
  const f = FILTERS.find((x) => x.id === filter);
  return f ? f.test(ev) : true;
}

/* ---------- Timing ------------------------------------------
   requestAnimationFrame stops firing whenever the page is not being
   painted (backgrounded tab, occluded window). Anything that only makes
   things *look* nice can rely on rAF; anything that has to actually happen
   must not. This runs the callback on the next frame, or shortly after
   regardless, whichever comes first.
   ------------------------------------------------------------ */

export function onNextFrame(fn) {
  let done = false;
  const run = () => { if (done) return; done = true; fn(); };
  requestAnimationFrame(run);
  setTimeout(run, 48);
}

/* ---------- Date helpers -----------------------------------
   All of these moved to core/era.js and are re-exported above, so the two
   modes share one calendar and neither of them owns it. The old names are
   kept where they read well; `fracToDate`/`dateToFrac` are the same
   functions under their era.js names. */

/** Scrubber fraction (0–1) → a Julian day. */
export { fracToJD as fracToDate, jdToFrac as dateToFrac } from '../core/era.js';
