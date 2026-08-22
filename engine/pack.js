/* ============================================================
   pack.js — which subjects exist, and what each one declares.

   `content/packs.json` is the only registry, and it is data. Before this the
   list of chapters was an array in story.js and the list of pack files was
   six fetches in js/main.js, which is why `grep -r "american-revolution"
   --include=*.js` used to find thirty-one things.

   A pack.json is loaded once and cached. Everything that used to be a
   constant in the engine — how far you can zoom out, which bbox has close-in
   geometry, what a side looks like, which chapters there are and what they
   are called — is a field in it.
   ============================================================ */

import { packUrl } from '../core/paths.js';

const cache = new Map();
let packList = null;

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Every pack id, in the order the registry lists them. */
export async function listPacks() {
  if (!packList) {
    packList = getJSON(registry).catch((err) => {
      console.warn(`[pack] no ${registry} —`, err.message);
      return [];
    });
  }
  return packList;
}

/* Which registry to read.

   content/packs.json is what SHIPS — one pack, usually. The benches under
   dev/ need what EXISTS, because a pack taken out of the build still has to
   stay correct and would otherwise stop being swept for rule-1 violations
   the moment it left. packs.dev.json is written by tools/build-shell.py. */
let registry = './content/packs.json';

export function useRegistry(url) {
  registry = url || './content/packs.json';
  packList = null;
  cache.clear();
}

/**
 * One pack's manifest.
 *
 * Cached by id and never re-fetched: it is read at boot, on every chapter
 * open, and by both modes, and it does not change while the page is up.
 */
export function loadPack(id) {
  if (!cache.has(id)) {
    cache.set(id, getJSON(packUrl(id, 'pack.json')).catch((err) => {
      console.warn(`[pack] could not load ${id}/pack.json —`, err.message);
      return null;
    }));
  }
  return cache.get(id);
}

/** The first pack, which is the one a single-subject build is about. */
export async function defaultPack() {
  const ids = await listPacks();
  return ids[0] || null;
}

/**
 * Every narrated chapter across every pack, in order.
 *
 * Carries the title from the manifest, which is what killed the old
 * `learnTitles()`: the cover used to fetch two whole chapter files — about
 * 200 KB of prose — after it was already on screen, purely to find out what
 * they were called. Fine at two chapters and wrong at ten.
 */
export async function allChapters() {
  const ids = await listPacks();
  const packs = await Promise.all(ids.map(loadPack));
  const out = [];
  ids.forEach((pack, i) => {
    const manifest = packs[i];
    for (const ch of manifest?.chapters || []) {
      out.push({ pack, manifest, ...ch });
    }
  });
  return out;
}

/** A pack's chapters alone. */
export async function chaptersOf(id) {
  const manifest = await loadPack(id);
  return (manifest?.chapters || []).map((ch) => ({ pack: id, manifest, ...ch }));
}

/** A pool file's URL, or null when the pack does not declare that pool. */
export function poolUrl(manifest, pack, name) {
  const rel = manifest?.pools?.[name];
  return rel ? packUrl(pack, rel) : null;
}
