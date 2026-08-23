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

/* BEGIN GENERATED — tools/build-sw.py */
// Written by tools/build-sw.py from the files index.html actually reaches,
// plus each pack's runtime data. Do not edit by hand — run the tool.
const VERSION = 'vd1d3fb4111';
const APP_CACHE = `fortell-app-${VERSION}`;
const TILE_CACHE = `fortell-tiles-${VERSION}`;
const TILE_LIMIT = 400;

// Deliberately no audio here. The narration is ~7.6 MB across two languages,
// and pulling that down on a first visit over mobile data to cache a chapter
// you may not play is the wrong trade. Scene files are cached by the fetch
// handler the first time they are played, so anything you have listened to
// works offline afterwards.
const PRECACHE = [
  // the navigation fallback — a cold offline launch asks for the root
  './',
  // referenced from css/fonts.css by url(), which is not walked
  './assets/fonts/fraunces-latin.woff2',
  // the coarse world level only — first paint needs it. The 50m, 10m and pack-detail
  // levels are megabytes and are fetched when the camera asks for them; networkFirst
  // caches each one the first time it is used.
  './assets/geo/world-110m.json',
  './content/american-revolution/chapter-1775-04-19.json',
  './content/american-revolution/chapter-1775-06-17.json',
  './content/american-revolution/chapters.json',
  './content/american-revolution/events.json',
  './content/american-revolution/geo/colonies.geojson',
  './content/american-revolution/geo/places.json',
  './content/american-revolution/geo/regions.geojson',
  './content/american-revolution/geo/routes.json',
  './content/american-revolution/media.json',
  './content/american-revolution/media/boston-1768.jpg',
  './content/american-revolution/media/bunker-hill-assault.jpg',
  './content/american-revolution/media/bunker-hill-attack.jpg',
  './content/american-revolution/media/bunker-hill-plan.jpg',
  './content/american-revolution/media/doolittle-1.jpg',
  './content/american-revolution/media/doolittle-2.jpg',
  './content/american-revolution/media/doolittle-3.jpg',
  './content/american-revolution/media/doolittle-4.jpg',
  './content/american-revolution/media/old-north.jpg',
  './content/american-revolution/media/siege-map.jpg',
  './content/american-revolution/media/trumbull-warren.jpg',
  './content/american-revolution/media/washington-cambridge.jpg',
  './content/american-revolution/people.json',
  './content/american-revolution/sound.json',
  './content/american-revolution/timing.chapter-1775-04-19.en.json',
  './content/american-revolution/timing.chapter-1775-04-19.no.json',
  './content/american-revolution/timing.chapter-1775-06-17.en.json',
  './content/american-revolution/timing.chapter-1775-06-17.no.json',
  './content/norway-1940/chapter-1940-04-09.json',
  './content/norway-1940/chapter-1940-05-28.json',
  './content/norway-1940/media.json',
  './content/norway-1940/media/allierte-soldater.jpg',
  './content/norway-1940/media/bergjegere.jpg',
  './content/norway-1940/media/bjerkvik-landgang.jpg',
  './content/norway-1940/media/eidsvold.jpg',
  './content/norway-1940/media/georg-thiele.jpg',
  './content/norway-1940/media/glorious.jpg',
  './content/norway-1940/media/koalisjonen.jpg',
  './content/norway-1940/media/malmtog.jpg',
  './content/norway-1940/media/narvik-etter.jpg',
  './content/norway-1940/media/polakkene.jpg',
  './content/norway-1940/media/tyske-jagere.jpg',
  './content/norway-1940/media/vrak-narvik.jpg',
  './content/norway-1940/media/warspite.jpg',
  './content/norway-1940/people.json',
  './content/norway-1940/timing.chapter-1940-04-09.en.json',
  './content/norway-1940/timing.chapter-1940-04-09.no.json',
  './content/norway-1940/timing.chapter-1940-05-28.en.json',
  './content/norway-1940/timing.chapter-1940-05-28.no.json',
  './content/roman-empire/chapter-14ad-tiberius.json',
  './content/roman-empire/chapter-27bc-augustus.json',
  './content/roman-empire/chapter-44bc-octavian.json',
  './content/roman-empire/geo/provinces.geojson',
  './content/roman-empire/media.json',
  './content/roman-empire/media/actium.jpg',
  './content/roman-empire/media/agrippina-ashes.jpg',
  './content/roman-empire/media/appia.jpg',
  './content/roman-empire/media/augustus-statue.jpg',
  './content/roman-empire/media/caesar-death.jpg',
  './content/roman-empire/media/caesar-funeral.jpg',
  './content/roman-empire/media/cleopatra-death.jpg',
  './content/roman-empire/media/colosseum.jpg',
  './content/roman-empire/media/denarius.jpg',
  './content/roman-empire/media/forum.jpg',
  './content/roman-empire/media/legion.jpg',
  './content/roman-empire/media/mausoleum.jpg',
  './content/roman-empire/media/nile.jpg',
  './content/roman-empire/media/pantheon.jpg',
  './content/roman-empire/media/philippi.jpg',
  './content/roman-empire/media/proscriptions.jpg',
  './content/roman-empire/media/res-gestae.jpg',
  './content/roman-empire/media/sejanus-fall.jpg',
  './content/roman-empire/media/senate.jpg',
  './content/roman-empire/media/siege.jpg',
  './content/roman-empire/media/tacitus-ms.jpg',
  './content/roman-empire/media/teutoburg.jpg',
  './content/roman-empire/media/triumph.jpg',
  './content/roman-empire/people.json',
  './content/roman-empire/timing.chapter-14ad-tiberius.en.json',
  './content/roman-empire/timing.chapter-14ad-tiberius.no.json',
  './content/roman-empire/timing.chapter-27bc-augustus.en.json',
  './content/roman-empire/timing.chapter-27bc-augustus.no.json',
  './content/roman-empire/timing.chapter-44bc-octavian.en.json',
  './content/roman-empire/timing.chapter-44bc-octavian.no.json',
  './core/dossier.js',
  './core/era.js',
  './core/icons.js',
  './core/palette.js',
  './core/paths.js',
  './core/theme.js',
  './core/wiki.js',
  './css/atlas.css',
  './css/base.css',
  './css/chooser.css',
  './css/dossier.css',
  './css/fonts.css',
  './css/map.css',
  './css/sheet.css',
  './css/shell.css',
  './css/story.css',
  './css/timeline.css',
  './css/tokens.css',
  './engine/captions.js',
  './engine/chrome.js',
  './engine/depth.js',
  './engine/pack.js',
  './engine/player.js',
  './engine/scenes/map.js',
  './engine/scenes/overlays.js',
  './engine/scenes/plate.js',
  './engine/scenes/sound.js',
  './engine/script.js',
  './engine/stage.js',
  './engine/story.js',
  './engine/transition.js',
  // fetched by checkVerbManifest() through a default argument
  './engine/verbs.json',
  './index.html',
  './js/chooser.js',
  './js/i18n.js',
  './js/main.js',
  './js/map.js',
  './js/people.js',
  './js/routes.js',
  './js/scrubber.js',
  './js/sheet.js',
  './js/store.js',
  './js/timeline.js',
  './js/tour.js',
  // linked from index.html by rel=manifest, not by a script or style tag
  './manifest.webmanifest',
  './map/artifacts.js',
  './map/basemap.js',
  './map/geo.js',
  './map/index.js',
  './map/regions.js',
  './map/tint.js',
  './sound/library.js',
  './sound/mixer.js',
  './sound/soundscape.js',
];
/* END GENERATED */
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

  /* Media goes straight to the network, always.

     A media element seeks by asking for a byte range. The Cache API cannot
     store a 206, so a cached entry is always the complete file — and handing
     a complete 200 back to an element that asked for bytes makes it mark
     itself unseekable. It plays, and the scrubber does nothing: drag it and
     the playhead returns to wherever the audio actually is, which is the
     start. Nothing in the console, because nothing failed.

     The narration was deliberately never precached (7.6 MB across two
     languages), so this costs no offline capability that was designed for.

     Matched on the REQUEST, not on the file extension. The rule used to be
     "any .wav/.mp3 URL", which also caught the sound effects — and those are
     not streamed by an element at all: sound/library.js fetches them from
     script and hands the bytes to decodeAudioData, so no Range is involved
     and there is nothing to make unseekable. Under the old rule they went to
     the network on every single visit and never worked offline. A media
     element sets request.destination to 'audio' or 'video'; a fetch() from
     script leaves it 'empty', which is exactly the distinction wanted. */
  if (request.headers.has('range')) return;
  if (request.destination === 'audio' || request.destination === 'video') return;
  // Older browsers may not populate `destination`; fall back to the old test
  // only when it is missing entirely, so they keep the seek fix.
  if (!('destination' in request) && isMedia(url)) return;

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

/** Anything a <video> or <audio> element streams, and therefore seeks. */
function isMedia(url) {
  return /\.(mp3|m4a|aac|ogg|opus|wav|mp4|webm)$/i.test(url.pathname);
}

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
