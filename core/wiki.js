/* ============================================================
   wiki.js — pull a Wikipedia summary INTO the app.

   Rules of the house:
     - never block the UI,
     - never throw upward,
     - if Norwegian has no article, quietly use English,
     - if both fail, the block simply is not shown.
   ============================================================ */

/* The reader's language is passed in rather than imported.

   This module used to reach into js/store.js for state.lang, which made a
   core/ primitive depend on the Explore mode — so the narrated mode could not
   use it without dragging Explore's whole state object along. Which language
   to prefer is a question the caller can always answer. */

const TIMEOUT_MS = 6500;
const memory = new Map();

function cacheKey(lang, title) { return `wiki:${lang}:${title}`; }

function readCache(lang, title) {
  const k = cacheKey(lang, title);
  if (memory.has(k)) return memory.get(k);
  try {
    const raw = sessionStorage.getItem(k);
    if (raw) {
      const v = JSON.parse(raw);
      memory.set(k, v);
      return v;
    }
  } catch { /* storage unavailable — memory cache still works */ }
  return undefined;
}

function writeCache(lang, title, value) {
  const k = cacheKey(lang, title);
  memory.set(k, value);
  try { sessionStorage.setItem(k, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

async function fetchOne(lang, title) {
  const cached = readCache(lang, title);
  if (cached !== undefined) return cached;

  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/`
            + `${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) { writeCache(lang, title, null); return null; }

    const json = await res.json();
    // Disambiguation pages and stubs without an extract are not worth showing.
    if (!json.extract || json.type === 'disambiguation') {
      writeCache(lang, title, null);
      return null;
    }

    const out = {
      lang,
      title: json.titles?.normalized || json.title || title,
      extract: json.extract,
      thumb: json.thumbnail?.source || null,
      url: json.content_urls?.desktop?.page
        || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
    writeCache(lang, title, out);
    return out;
  } catch {
    // Offline, blocked, CORS hiccup, timeout — all the same to us.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{no?:string, en?:string}} titles
 * @returns {Promise<null | {lang, title, extract, thumb, url, fallback:boolean}>}
 */
export async function getSummary(titles, lang = 'no') {
  if (!titles) return null;

  const prefer = lang === 'en' ? 'en' : 'no';
  const other = prefer === 'no' ? 'en' : 'no';

  if (titles[prefer]) {
    const hit = await fetchOne(prefer, titles[prefer]);
    if (hit) return { ...hit, fallback: false };
  }
  if (titles[other]) {
    const hit = await fetchOne(other, titles[other]);
    if (hit) return { ...hit, fallback: true };
  }
  return null;
}

/** Warm the cache without caring about the result. */
export function prefetch(titles) {
  getSummary(titles).catch(() => {});
}
