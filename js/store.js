/* ============================================================
   store.js — one small state object, a pub/sub, and hash routing.
   No framework; every view subscribes and re-renders what changed.
   ============================================================ */

export const START = Date.UTC(1763, 0, 1);
export const END   = Date.UTC(1783, 11, 31);
export const SPAN  = END - START;

const listeners = new Set();

export const state = {
  lang: 'no',            // 'no' | 'en'
  theme: 'auto',         // 'auto' | 'light' | 'dark'
  view: 'story',         // 'story' | 'map' | 'timeline' | 'people'
  date: START,           // scrubber position, ms
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

const LS = 'revolusjonen:prefs';

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

/* ---------- Date helpers ----------------------------------- */

/** Scrubber fraction (0–1) → ms */
export const fracToDate = (f) => START + Math.max(0, Math.min(1, f)) * SPAN;
/** ms → scrubber fraction (0–1) */
export const dateToFrac = (d) => Math.max(0, Math.min(1, (d - START) / SPAN));

export const yearOf = (ms) => new Date(ms).getUTCFullYear();

/** Parse 'YYYY-MM-DD' as UTC so timezones never shift a date across midnight. */
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}
