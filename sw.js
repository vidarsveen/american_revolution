/* ============================================================
   sw.js — offline support.

   Strategy:
     app files  → network first, but only briefly. Waiting for a dead
                  connection to time out on every single request turns an
                  offline launch into ten seconds of staring at a splash
                  screen, so the network races a short timer and the cache
                  wins if the network is not clearly faster. When offline
                  is already known, the cache answers immediately.
     map tiles  → cache first, capped, so places you have looked at stay
     Wikipedia  → never cached here; wiki.js has its own session cache
   ============================================================ */

const VERSION = 'v14';
const APP_CACHE = `revolusjonen-app-${VERSION}`;
const TILE_CACHE = `revolusjonen-tiles-${VERSION}`;
const TILE_LIMIT = 400;

// Deliberately no audio here. The narration is ~7.6 MB across two languages,
// and pulling that down on a first visit over mobile data to cache a chapter
// you may not play is the wrong trade. Scene files are cached by the fetch
// handler the first time they are played, so anything you have listened to
// works offline afterwards.
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './css/fonts.css',
  './css/tokens.css',
  './css/base.css',
  './css/shell.css',
  './css/map.css',
  './css/timeline.css',
  './css/sheet.css',
  './js/main.js',
  './js/store.js',
  './js/i18n.js',
  './js/icons.js',
  './js/map.js',
  './js/scrubber.js',
  './js/timeline.js',
  './js/people.js',
  './js/sheet.js',
  './js/wiki.js',
  './js/tour.js',
  './js/routes.js',
  './content/american-revolution/events.json',
  './content/american-revolution/people.json',
  './content/american-revolution/chapters.json',
  './content/american-revolution/geo/places.json',
  './content/american-revolution/geo/colonies.geojson',
  './content/american-revolution/geo/routes.json',
  './engine/scenes/map.js',
  './engine/scenes/overlays.js',
  './core/theme.js',
  './css/atlas.css',
  './map/tiles.js',
  './map/texture.js',
  './map/geo.js',
  './map/basemap.js',
  './map/artifacts.js',
  './map/regions.js',
  './map/index.js',
  './engine/verbs.json',
  // The coarse world level only — first paint needs it. The 50m, 10m and
  // pack-detail levels are megabytes and are fetched when the camera asks
  // for them; networkFirst caches each one the first time it is used.
  './assets/geo/world-110m.json',
  './engine/captions.js',
  './engine/chrome.js',
  './engine/player.js',
  './engine/script.js',
  './engine/stage.js',
  './engine/story.js',
  './css/story.css',
  './content/american-revolution/chapter-1775-04-19.json',
  './content/american-revolution/timing.no.json',
  './content/american-revolution/media/doolittle-1.jpg',
  './content/american-revolution/media/doolittle-2.jpg',
  './content/american-revolution/media/doolittle-3.jpg',
  './content/american-revolution/media/doolittle-4.jpg',
  './content/american-revolution/media.json',
  './content/american-revolution/timing.en.json',
  './assets/fonts/fraunces-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE)
      // One bad URL must not sink the whole install.
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== APP_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Wikipedia: straight to the network, wiki.js handles failure gracefully.
  if (url.hostname.endsWith('wikipedia.org')) return;

  if (isTile(url)) { e.respondWith(tileFirst(request)); return; }
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(request)); }
});

function isTile(url) {
  return url.hostname.includes('basemaps.cartocdn.com')
      || url.hostname.includes('tile.openstreetmap.org')
      || url.hostname.includes('server.arcgisonline.com');
}

const NET_TIMEOUT_MS = 900;
const NET_COOLDOWN_MS = 10000;

/* Once one request has shown the network is unreachable, stop making every
   other request on the page rediscover that independently. Without this a
   cold offline launch pays the timeout once per wave of requests, which is
   the difference between a one-second start and a seven-second one. */
let networkDownUntil = 0;
const networkLooksDown = () => Date.now() < networkDownUntil;

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  // Update the cache whatever else happens, but never block on it.
  const network = fetch(request)
    .then((res) => {
      networkDownUntil = 0;
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch((err) => {
      networkDownUntil = Date.now() + NET_COOLDOWN_MS;
      throw err;
    });
  network.catch(() => {});   // an offline failure here is expected, not an error

  // Offline, or the network just failed us: answer from cache immediately.
  const knownOffline = self.navigator && self.navigator.onLine === false;
  if (cached && (knownOffline || networkLooksDown())) return cached;

  if (cached) {
    // Give the network a short head start, then stop waiting for it.
    const timeout = new Promise((resolve) => setTimeout(() => {
      networkDownUntil = Date.now() + NET_COOLDOWN_MS;
      resolve(null);
    }, NET_TIMEOUT_MS));
    const winner = await Promise.race([network.catch(() => null), timeout]);
    return winner && winner.ok ? winner : cached;
  }

  // Nothing cached — the network is the only hope.
  try {
    const fresh = await network;
    if (fresh) return fresh;
  } catch { /* fall through */ }

  // Navigations should still land somewhere useful when offline.
  if (request.mode === 'navigate') {
    const shell = await cache.match('./index.html');
    if (shell) return shell;
  }
  return new Response('Offline and not cached', { status: 504, statusText: 'offline' });
}

async function tileFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    // Tile CDNs answer opaquely without CORS; those are still worth keeping.
    if (fresh && (fresh.ok || fresh.type === 'opaque')) {
      cache.put(request, fresh.clone());
      trimTiles(cache);
    }
    return fresh;
  } catch {
    return new Response('', { status: 504, statusText: 'tile unavailable' });
  }
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_LIMIT) return;
  // Oldest first — Cache API keeps insertion order.
  await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((k) => cache.delete(k)));
}
