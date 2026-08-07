# Den amerikanske revolusjonen 1763–1783

An interactive map and timeline of the American Revolution, built as a companion to
Ken Burns' *Den amerikanske revolusjonen* on NRK. Norwegian and English, mobile first.

Open it, drag the year rail, and watch the war spread across the map. Tap anything to
read what happened — written to be read on a sofa, not in a seminar.

---

## What's in it

- **Kart** — a parchment-styled map with the events placed where they happened. A year
  rail along the bottom drives everything: markers appear as you reach their date, the
  current year pulses, campaign routes draw themselves across the map, and a soft glow
  follows the war's centre of gravity from New England to the Middle Colonies to the South.
- **▶ Ta meg gjennom krigen** — a guided tour. The camera flies between the eleven moments
  that turned the war while the clock runs forward. Touch anything to take back control.
- **Tidslinje** — every event in order, grouped under the six NRK episodes, so you can jump
  straight to the one you just watched. Filter by battles, politics, people or turning points.
- **Personer** — 27 portraits, both sides. Each one links to the events they were part of.
- **Les mer** — Wikipedia summaries are fetched *into* the app, in your language, with an
  automatic fall back to English. Nothing throws you out to a browser tab unless you ask.
- Light and dark, Norwegian and English, installable to your home screen, works offline.

39 events · 27 people · 8 animated campaign routes · 1763–1783.

---

## Running it locally

No build step, no npm, no dependencies to install. It just needs to be served over HTTP
(ES modules and the service worker will not run from `file://`).

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Any static server works.

---

## Publishing to GitHub Pages

```bash
git init
git add .
git commit -m "Den amerikanske revolusjonen"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.

Two things that matter and are already handled:

- `.nojekyll` at the root, so GitHub Pages serves the files as-is.
- Every path in the project is **relative** (`./css/base.css`, never `/css/base.css`).
  A project site lives at `https://<you>.github.io/<repo>/`, and absolute paths are the
  usual way these break.

---

## Editing the content

All the writing lives in `data/` — you never need to touch JavaScript to change history.

```jsonc
// data/events.json
{
  "id": "saratoga",
  "date": "1777-10-17",
  "dateDisplay": { "no": "17. oktober 1777", "en": "17 October 1777" },
  "kind": "battle",        // battle | politics | people
  "side": "patriot",       // patriot | british | french | neutral — marker colour
  "importance": 3,         // 1 small · 2 normal · 3 turning point (gold, in the tour)
  "coords": [43.0089, -73.6398],
  "title":   { "no": "…", "en": "…" },
  "hook":    { "no": "One line that makes you want to read on.", "en": "…" },
  "body":    { "no": "Three or four short paragraphs.", "en": "…" },
  "why":     { "no": "Why it matters — one sentence.", "en": "…" },
  "fact":    { "no": "Did you know…", "en": "…" },
  "numbers": { "britishForces": 6200, "americanForces": 15000, "outcome": "patriot" },
  "people":  ["burgoyne", "arnold", "gates"],   // ids from people.json
  "route":   "burgoyne-south",                  // id from geo/routes.json
  "wiki":    { "no": "Slaget ved Saratoga", "en": "Battles of Saratoga" }
}
```

`*text*` becomes italics. Blank lines separate paragraphs.

| file | what it holds |
|---|---|
| `data/events.json` | the 39 events |
| `data/people.json` | the 27 people, with `portrait` naming a file in `assets/portraits/` |
| `data/chapters.json` | the six NRK episodes and their date ranges |
| `data/geo/routes.json` | campaign paths and theatre glows |
| `data/geo/places.json` | period place names drawn on the map |
| `data/geo/colonies.geojson` | the thirteen colonies outline |

**House style for the writing** — this is the part that makes or breaks it:
hook first; around 120 words of body; explain every term the first time; concrete over
abstract; round numbers; one good fact beats three paragraphs of context. Norwegian is
written natively and English follows it, not the other way round.

After editing, run the validator:

```bash
python tools/check-data.py
```

---

## How it is put together

Vanilla HTML, CSS and ES modules. No framework — it is fifty entries and one map, and this
way it still works in five years with nothing to reinstall.

```
index.html          shell; every path relative
sw.js               offline: network races a short timer for app files,
                    cache-first for map tiles
css/                tokens · base · shell · map · timeline · sheet
js/
  store.js          state, pub/sub, hash routing, filter predicates
  main.js           loads data, builds the chrome, wires the views
  map.js            Leaflet, markers, place labels, camera
  routes.js         campaign lines that draw themselves, theatre glow
  scrubber.js       the year rail
  timeline.js       the chapter-grouped list
  people.js         the portrait grid
  sheet.js          the drag-up detail panel
  wiki.js           Wikipedia summaries, cached, failing quietly
  tour.js           the guided tour
  i18n.js           all UI strings
data/               all content
vendor/             Leaflet 1.9.4, vendored so no CDN can break it
assets/             portraits, fonts, icons
```

A few decisions worth knowing about:

- **The map tiles are CARTO's label-free basemap**, aged into parchment with a CSS filter
  and a warm multiply wash. Real geography and real pinch-zoom, period look, no API key.
  If CARTO is unreachable it falls back to Esri, then to plain OpenStreetMap. Place names
  are drawn by us, so no modern motorways show through.
- **Nothing that has to happen depends on `requestAnimationFrame`.** Browsers stop
  delivering frames to a backgrounded tab, and a tour that freezes when you switch apps and
  never recovers is worse than one that is slightly less smooth. rAF is used for smoothness;
  timers are the contract.
- **A Wikipedia failure is never visible.** Offline, blocked or missing article — the block
  simply does not appear.
- **Offline starts fast, not just eventually.** A plain network-first service worker makes
  every request on the page wait out its own connection timeout, which turned an offline
  launch into about ten seconds of splash screen. The network now races a 900 ms timer, and
  the first failure trips a short circuit breaker so the rest of the page goes straight to
  cache. Cold offline start is around 1.7 seconds.
- `prefers-reduced-motion` disables the route drawing and the tour's camera flights.

---

## Credits

- Text written for this project. Wikipedia extracts are fetched live and credited in place
  (CC BY-SA).
- Portraits: public-domain paintings from Wikimedia Commons.
- Map tiles © OpenStreetMap contributors, © CARTO.
- [Fraunces](https://github.com/googlefonts/fraunces) (SIL Open Font License 1.1),
  [Leaflet](https://leafletjs.com/) (BSD-2-Clause).
- Structure and chapter titles follow *Den amerikanske revolusjonen* (Ken Burns,
  Sarah Botstein and David Schmidt), shown on NRK.
