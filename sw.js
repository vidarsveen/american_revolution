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
const VERSION = 'vb0d60b86a3';
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
  './assets/geo/atlantic-10m.json',
  './assets/geo/mediterranean-10m.json',
  './assets/geo/northwest-europe-10m.json',
  // the coarse world level. Every pack's level ladder starts here, and it is the
  // fallback when a pack declares none at all (DEFAULT_LEVELS in map/basemap.js).
  './assets/geo/world-110m.json',
  './assets/geo/world-50m.json',
  './content/american-revolution/chapter-1775-04-19.json',
  './content/american-revolution/chapter-1775-06-17.json',
  './content/american-revolution/chapters.json',
  './content/american-revolution/events.json',
  './content/american-revolution/geo/colonies.geojson',
  './content/american-revolution/geo/places.json',
  './content/american-revolution/geo/regions.geojson',
  './content/american-revolution/geo/routes.json',
  './content/american-revolution/media.json',
  './content/american-revolution/media/baater-over-vannet.jpg',
  './content/american-revolution/media/boston-1768.jpg',
  './content/american-revolution/media/bunker-hill-assault.jpg',
  './content/american-revolution/media/bunker-hill-attack.jpg',
  './content/american-revolution/media/bunker-hill-plan.jpg',
  './content/american-revolution/media/doolittle-1.jpg',
  './content/american-revolution/media/doolittle-2.jpg',
  './content/american-revolution/media/doolittle-3.jpg',
  './content/american-revolution/media/doolittle-4.jpg',
  './content/american-revolution/media/gresskledd-bakke.jpg',
  './content/american-revolution/media/havn-og-master.jpg',
  './content/american-revolution/media/kolonne-paa-avstand.jpg',
  './content/american-revolution/media/leir-om-natten.jpg',
  './content/american-revolution/media/old-north.jpg',
  './content/american-revolution/media/siege-map.jpg',
  './content/american-revolution/media/stein-gjerde-roykskyer.jpg',
  './content/american-revolution/media/trumbull-warren.jpg',
  './content/american-revolution/media/vei-ved-daggry.jpg',
  './content/american-revolution/media/vinterveien-hjem.jpg',
  './content/american-revolution/media/washington-cambridge.jpg',
  './content/american-revolution/people.json',
  './content/american-revolution/sound.json',
  './content/american-revolution/style.json',
  './content/american-revolution/timing.chapter-1775-04-19.en.json',
  './content/american-revolution/timing.chapter-1775-04-19.no.json',
  './content/american-revolution/timing.chapter-1775-06-17.en.json',
  './content/american-revolution/timing.chapter-1775-06-17.no.json',
  './content/beer/chapter-1-fire-ting.json',
  './content/beer/chapter-2-overgjaer.json',
  './content/beer/chapter-3-undergjaer.json',
  './content/beer/chapter-4-renkultur.json',
  './content/beer/chapter-5-belgia.json',
  './content/beer/chapter-6-kveik.json',
  './content/beer/media.json',
  './content/beer/media/ale-glass-lys.jpg',
  './content/beer/media/bitter-glass.jpg',
  './content/beer/media/blandekunst.jpg',
  './content/beer/media/brent-korn.jpg',
  './content/beer/media/brett-fat.jpg',
  './content/beer/media/bryggeri-rom.jpg',
  './content/beer/media/burton-bronn.jpg',
  './content/beer/media/bybronn.jpg',
  './content/beer/media/bygg-aker.jpg',
  './content/beer/media/einer-lag.jpg',
  './content/beer/media/estere-frukt.jpg',
  './content/beer/media/fat-rekke.jpg',
  './content/beer/media/fathall.jpg',
  './content/beer/media/fire-raavarer.jpg',
  './content/beer/media/fortynning-rekke.jpg',
  './content/beer/media/gard-belgia.jpg',
  './content/beer/media/gardskjokken.jpg',
  './content/beer/media/gips-krystall.jpg',
  './content/beer/media/gjaer-bunnfall.jpg',
  './content/beer/media/gjaer-flaske.jpg',
  './content/beer/media/gjaer-torr.jpg',
  './content/beer/media/gjaerbank-hyller.jpg',
  './content/beer/media/gjaering-skum.jpg',
  './content/beer/media/gjaerkake-krukke.jpg',
  './content/beer/media/gjaerkrans.jpg',
  './content/beer/media/gjaerkrone-kar.jpg',
  './content/beer/media/glass-mot-vindu.jpg',
  './content/beer/media/handverksbryggeri.jpg',
  './content/beer/media/hansen-mikroskop.jpg',
  './content/beer/media/humle-i-kok.jpg',
  './content/beer/media/humle-torking.jpg',
  './content/beer/media/humlehage.jpg',
  './content/beer/media/humlekongle-snitt.jpg',
  './content/beer/media/ipa-glass.jpg',
  './content/beer/media/is-hogging.jpg',
  './content/beer/media/kalk-vann.jpg',
  './content/beer/media/kjeller-kald.jpg',
  './content/beer/media/kjoleskip.jpg',
  './content/beer/media/kloster-gang.jpg',
  './content/beer/media/kok-fosskok.jpg',
  './content/beer/media/kriek-kirsebaer.jpg',
  './content/beer/media/lab-benk.jpg',
  './content/beer/media/laer-stall.jpg',
  './content/beer/media/lagerkjeller-tanker.jpg',
  './content/beer/media/lambik-glass.jpg',
  './content/beer/media/loftsvindu.jpg',
  './content/beer/media/london-elv.jpg',
  './content/beer/media/lys-malt.jpg',
  './content/beer/media/malt-fargeskala.jpg',
  './content/beer/media/mesk-damp.jpg',
  './content/beer/media/mesk-termometer.jpg',
  './content/beer/media/mikroskop-bord.jpg',
  './content/beer/media/pils-rekke.jpg',
  './content/beer/media/pilsner-glass.jpg',
  './content/beer/media/plzen-bryggeri.jpg',
  './content/beer/media/porter-kar.jpg',
  './content/beer/media/pub-lyst-og-morkt.jpg',
  './content/beer/media/salt-vekt.jpg',
  './content/beer/media/senne-dal.jpg',
  './content/beer/media/skip-kai.jpg',
  './content/beer/media/skumming-spade.jpg',
  './content/beer/media/spirende-korn.jpg',
  './content/beer/media/stabbur-inne.jpg',
  './content/beer/media/stabbur.jpg',
  './content/beer/media/stout-glass.jpg',
  './content/beer/media/surt-kar.jpg',
  './content/beer/media/takluker.jpg',
  './content/beer/media/torrhumling.jpg',
  './content/beer/media/tre-ingredienser.jpg',
  './content/beer/media/varm-gjaering.jpg',
  './content/beer/media/vedtekter-penn.jpg',
  './content/beer/media/vorter-glass.jpg',
  './content/beer/sound.json',
  './content/beer/style.json',
  './content/beer/timing.chapter-1-fire-ting.en.json',
  './content/beer/timing.chapter-1-fire-ting.no.json',
  './content/beer/timing.chapter-2-overgjaer.en.json',
  './content/beer/timing.chapter-2-overgjaer.no.json',
  './content/beer/timing.chapter-3-undergjaer.en.json',
  './content/beer/timing.chapter-3-undergjaer.no.json',
  './content/beer/timing.chapter-4-renkultur.en.json',
  './content/beer/timing.chapter-4-renkultur.no.json',
  './content/beer/timing.chapter-5-belgia.en.json',
  './content/beer/timing.chapter-5-belgia.no.json',
  './content/beer/timing.chapter-6-kveik.en.json',
  './content/beer/timing.chapter-6-kveik.no.json',
  './content/italy-wine/chapter-1-piemonte.json',
  './content/italy-wine/chapter-2-toscana.json',
  './content/italy-wine/geo/detail-toscana.json',
  './content/italy-wine/geo/regions.geojson',
  './content/italy-wine/geo/zones.geojson',
  './content/italy-wine/media.json',
  './content/italy-wine/media/alpene-over.jpg',
  './content/italy-wine/media/bord-middag.jpg',
  './content/italy-wine/media/dal-avstengt.jpg',
  './content/italy-wine/media/druer-kasse.jpg',
  './content/italy-wine/media/flasker-liggende.jpg',
  './content/italy-wine/media/galestro-jord.jpg',
  './content/italy-wine/media/gammel-stokk.jpg',
  './content/italy-wine/media/glass-blek-rod.jpg',
  './content/italy-wine/media/glass-perler.jpg',
  './content/italy-wine/media/hender-host.jpg',
  './content/italy-wine/media/kjeller-fat.jpg',
  './content/italy-wine/media/langhe-take.jpg',
  './content/italy-wine/media/maremma-kyst.jpg',
  './content/italy-wine/media/montalcino-hoyde.jpg',
  './content/italy-wine/media/sangiovese-klase.jpg',
  './content/italy-wine/media/toscana-bakker.jpg',
  './content/italy-wine/media/tre-flasker.jpg',
  './content/italy-wine/media/vinmark-helling.jpg',
  './content/italy-wine/style.json',
  './content/italy-wine/timing.chapter-1-piemonte.en.json',
  './content/italy-wine/timing.chapter-1-piemonte.no.json',
  './content/italy-wine/timing.chapter-2-toscana.en.json',
  './content/italy-wine/timing.chapter-2-toscana.no.json',
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
  './content/norway-1940/media/torpedobat-kjell.jpg',
  './content/norway-1940/media/tyske-jagere.jpg',
  './content/norway-1940/media/vrak-narvik.jpg',
  './content/norway-1940/media/warspite.jpg',
  './content/norway-1940/people.json',
  './content/norway-1940/style.json',
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
  './content/roman-empire/style.json',
  './content/roman-empire/timing.chapter-14ad-tiberius.en.json',
  './content/roman-empire/timing.chapter-14ad-tiberius.no.json',
  './content/roman-empire/timing.chapter-27bc-augustus.en.json',
  './content/roman-empire/timing.chapter-27bc-augustus.no.json',
  './content/roman-empire/timing.chapter-44bc-octavian.en.json',
  './content/roman-empire/timing.chapter-44bc-octavian.no.json',
  './core/dossier.js',
  './core/entries.js',
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
  './engine/ending.js',
  './engine/pack.js',
  './engine/player.js',
  './engine/scenes/map.js',
  './engine/scenes/overlays.js',
  './engine/scenes/sound.js',
  './engine/script.js',
  './engine/stage.js',
  './engine/story.js',
  './engine/style.js',
  './engine/surfaces/chart.js',
  './engine/surfaces/map.js',
  './engine/surfaces/overlays.js',
  './engine/surfaces/plate.js',
  './engine/surfaces/registry.js',
  './engine/surfaces/sound.js',
  './engine/transition.js',
  // fetched by checkVerbManifest() through a default argument
  './engine/verbs.json',
  './index.html',
  './js/chooser.js',
  './js/i18n.js',
  './js/library.js',
  './js/main.js',
  './js/map.js',
  './js/routes.js',
  './js/scrubber.js',
  './js/sheet.js',
  './js/store.js',
  './js/timeline.js',
  './js/tour.js',
  './js/wayout.js',
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
      /* `cache: 'reload'` — and this is not a detail.

         The cache name carries VERSION and `activate` deletes every older
         one, so a new build cannot serve an old cache. What it CAN do is
         fill the new cache from a stale one: c.add(u) goes through the
         browser's HTTP cache, and GitHub Pages serves JS with
         `Cache-Control: max-age=600`. So a worker installing within ten
         minutes of the reader's previous visit baked ten-minute-old
         JavaScript into a brand-new version-scoped cache — and then served
         it for as long as that version lived, because networkFirst prefers
         the cache whenever the network is slower than NET_TIMEOUT_MS.

         CLAUDE.md documents the ten-minute window as something that
         self-heals. It does not self-heal if the service worker writes it
         down. That is how a fix could be live and correct on the server,
         verified byte for byte by check-published.py, and still not be what
         the reader was running.

         `reload` bypasses the HTTP cache for the precache, so a new VERSION
         always means genuinely new files. */
      .then((c) => Promise.allSettled(
        PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })))))
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

/* WHICH BUILD IS THIS PHONE ACTUALLY RUNNING?

   "I pushed" and "the site is updated" are different claims, and so are "the
   site is updated" and "the phone in my hand has it". tools/check-published.py
   answers the middle one by hashing what the server sends; nothing answered
   the last one, so testing a fix on a phone meant reloading and hoping.

   VERSION is a hash of the precached files' contents, so it is not a label
   somebody remembered to bump — it moves exactly when what a reader gets
   moves. Asking the WORKER for it, rather than fetching a version file, is
   the point: the worker replying is the one actually serving this page, so
   the answer is what is running and not what is on the server. */
self.addEventListener('message', (e) => {
  if (e.data === 'version') {
    e.source?.postMessage({ type: 'version', version: VERSION });
  }
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
