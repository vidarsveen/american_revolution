# Working on this repo

A narrated learning app about the American Revolution, built as a companion to Ken Burns'
*Den amerikanske revolusjonen* on NRK — and increasingly a **framework** for narrating any
historical subject on a map. Norwegian and English, mobile first.

Read `README.md` first for what the app *is*. This file is about how to work on it.

---

## Hard constraints

**No build step. No npm. No bundler.** Native ES modules, relative paths, `.js` extensions
included. If a change needs a compiler, it is the wrong change.

**Every path is relative.** GitHub Pages serves this from a subdirectory
(`/american_revolution/`). An absolute path works locally and 404s in production.

**Serve over HTTP.** ES modules and the service worker will not run from `file://`.

```bash
python tools/serve.py     # NOT python -m http.server — see below
```

`http.server` sends `Last-Modified` and no `Cache-Control`, so browsers apply *heuristic*
freshness and quietly serve you the version you edited two minutes ago. No error, nothing in
the console, and you debug code that is not running. `serve.py` is `no-store` throughout and
prints the LAN address for testing on a phone.

Python tooling lives in `.venv` (`.venv/Scripts/python.exe` on Windows) and needs
`playwright` and `pillow`. `narrate.py` additionally needs `edge-tts`, `mutagen` and `ffmpeg`.

---

## Three rules the engine keeps

These are not style preferences. Breaking one produces bugs that are very hard to see.

**1. The picture is a function of time, not a history of events.** Seeking wipes the stage and
re-applies every cue up to that point with `instant: true`. Every artifact must therefore be a
pure function of `(data, camera, progress)` and accumulate nothing. Scrub backwards into a
half-drawn march and you must get a correct picture, not a half-drawn one.

*Corollary:* one-shot effects — a muzzle flash, a musket — must return early when `instant` is
true. Scrubbing back through Lexington must not fire forty muskets.

*Corollary:* **an async cue handler breaks this rule unless it is guarded.** Replaying cues
after a seek runs them in order, but an awaited fetch lands out of order — a `clear` in a later
beat runs instantly while an earlier `show` resolves after it and undoes the clear. Capture an
epoch counter before the await and drop the result if it has moved. `engine/scenes/map.js`
does this for regions, and it cost an afternoon to find: seeking to the end of the intro left
Massachusetts washed blue over the whole map.

**2. Nothing that must happen depends on `requestAnimationFrame`.** Browsers stop delivering
frames to a backgrounded tab. Animation frames make things smooth; timers are the contract.
Every draw path must be callable synchronously.

**3. Audio failing is not the app failing.** If playback is blocked before a user gesture, or a
file is missing, the chapter still runs on a timer and the captions carry the words. **Never
route the narration `<audio>` element through a Web Audio graph** — that would put the voice
behind something that can fail silently and permanently on iOS. Ducking is computed from the
script's word timings, which is deterministic and seek-safe.

---

## Layout

```
map/          the map module — no tiles, no Leaflet, we draw the ground (BOTH modes)
  geo.js        Web Mercator (Leaflet-compatible), Catmull-Rom, normals
  basemap.js    Natural Earth baked into Path2D + a pack's detail overlay
  artifacts.js  army arrows, marches, fronts, areas, crossings, battles
  regions.js    named administrative areas
  index.js      createMap(host, opts) -> an instance
sound/        mixer, procedurally synthesised effect library, ducking
core/         shared primitives (theme)
engine/       narration: script -> player -> stage -> scenes/overlays
js/           the Explore mode (still on Leaflet — see "In flight")
content/<pack>/  one folder per subject
assets/geo/   built basemap data, committed
dev/          per-module benches — open these, not the app
tools/        python: build, fetch, narrate, check
```

## The lab pattern

Every module gets a standalone bench under `dev/`, and **each lab exists to answer one
falsifiable question**, not to look at things. A lab that is only a gallery will rot.

| Lab | The question it answers |
|---|---|
| `dev/map-lab.html` | Does `instant` reproduce the animated picture exactly? Is any frame blank? |
| `dev/map-lab.html` | Can two regions that share a border be told apart, measured on the pixels? |
| `dev/sound-lab.html` | Does the music duck under speech, and stay silent under `instant`? |

Add a verb and you must touch three things, not two: `engine/verbs.json`, the `VERBS` table in
`engine/stage.js`, and — if it takes a reference type — the pool `tools/check-script.py`
resolves that type against. A `sound` reference validated only against the pack's `sound.json`
rejects every effect the shipped library synthesises, which is all of them.

Build the module against its lab **before** wiring it into the app. Both defects that mattered
most this year were invisible to reading and obvious to measurement.

## Checks to run before committing

```bash
python tools/check-script.py american-revolution/chapter-1775-04-19
python tools/check-data.py
python tools/check-contrast.py     # samples real pixels; fails on an unreadable map
python tools/check-sound.py        # 24 assertions on ducking and the silent fallback
```

After pushing, confirm the deploy actually landed. "I pushed" and "the site is
updated" are different claims — Pages builds asynchronously, and a file that
was never committed 404s in production while working perfectly on localhost:

```bash
python tools/check-published.py    # hashes every file index.html reaches
```

---

## Hazards that have bitten before

**`sw.js` carries a hand-maintained `PRECACHE` list and a `VERSION`.** Add a file and forget
the list, and it works online and 404s offline — silently, because the install uses
`Promise.allSettled`. Every change that adds, moves or deletes a shipped file must update
both.

**The cue vocabulary lives in `engine/verbs.json` and nowhere else.** It used to be copied by
hand into `engine/stage.js` and `tools/check-script.py`, so adding a verb to one and not the
other meant a chapter validated clean and then silently did nothing in the browser. Adding a
verb now means: the manifest entry, and a handler in the `VERBS` table in `stage.js`.
`checkVerbManifest()` reports drift at boot on localhost, and `check-script.py` refuses a
chapter that uses a verb the manifest does not declare. Declare an argument with a reference
type (`place`, `route`, `person`, `media`, `quote`, `sound`) and its integrity check comes
free.

**CSS `<link>` order in `index.html` is load-bearing.** `tokens.css` must precede everything
that reads its variables, and later files rely on later-wins cascade. When splitting a
stylesheet, put the new file immediately after the one it came from.

**Simplifying areas one at a time tears the borders between them.** Shapely's
`preserve_topology` preserves the topology of the geometry you hand it, not the topology
*between* geometries — so Virginia's southern edge and North Carolina's northern edge, which
are one line in the source, thin down to two different lines. Measured on the file this
replaced: twelve overlapping pairs, the worst 151 km². On screen that is a border drawn twice
a few pixels apart with two washes stacked between them. `tools/build-colonies.py` now
simplifies the border *network* — union the boundaries, simplify the arcs, polygonize back —
and `report_seams()` fails the build if two areas ever claim the same ground again. A
side-effect worth knowing: neighbours now share the very coordinates along their border, which
is what `check-contrast.py` and the lab use to work out which regions touch.

**One `stroke()` call, not one per region.** Two coincident subpaths inside a single
`ctx.stroke()` composite once; two separate `stroke()` calls composite twice, so every internal
border comes out darker and fatter than the coastline. `drawRegions()` takes the whole set for
this reason. Correct geometry is a precondition, not a substitute.

**An animation that outlives its scene is erased, not paused.** A scene change wipes the stage
and replays — that is what makes seeking correct — so a route still drawing when the scene ends
simply stops partway and vanishes. Nothing in the script shows it; you have to multiply `over`
against the time left. `check-script.py` does that now, and it is how "the British march out of
Boston" was found stopping 70% of the way to Concord.

**A cached ground buffer must remember whether it had any ground.** `paintGround` bakes the
basemap into an offscreen buffer and re-renders it only when the camera leaves it. But
`drawBasemap` fills the buffer with water and returns early when the level is still loading —
and that buffer was then cached as if it were complete, so the land never arrived. The story
map never showed it, because its camera moves constantly and invalidates the buffer anyway;
Explore fits once at boot and holds still, and kept the empty one. `bufState.ready` now
records whether the geometry was actually there.

**"Network idle" is not "the ground is drawn".** The basemap level is fetched from inside the
first draw, so a screenshot on a timer can catch a canvas that is still all water — which made
`check-contrast.py` report land and sea as the same colour, at random. Wait on `map.ready()`.

**A media element that cannot answer a Range request cannot seek.** It streams the whole file,
reports `seekable` as an empty range, and silently refuses — so dragging the scrubber does
nothing and the playhead sits wherever the audio actually is. Two things caused this: the
service worker answered a Range request from cache with a complete 200 (the Cache API cannot
store a 206), and `tools/serve.py` ignored Range entirely so it could not be reproduced in
dev. Media now bypasses the service worker, and `serve.py` answers 206.

**A media element reports where it IS, not where it was told to go.** Between setting
`currentTime` and the `seeked` event it still returns the old position, so a scrubber that
believes it snaps back on every frame of the drag. `player.now()` runs on the timer while a
seek is in flight — and only trusts the element when it has a timeline at all, because a file
that failed to load reports 0 for ever.

**Modern boundaries are wrong for history.** The framework ships modern admin boundaries
because that is the honest general default. Massachusetts in 1775 included Maine, Vermont was
disputed, and West Virginia did not exist. A historical pack overrides with its own
`geo/borders.geojson`.

---

## Browser gotchas learned the hard way

Each of these cost real time. They are documented at the call site too.

- **`ctx.setTransform()` replaces the DPR transform**, it does not compose with it. Below a
  DPR-scaled context use `scale()`/`translate()`. Getting this wrong drew the ground at half
  size while the HTML overlay stayed correct — New York rendered out in the Atlantic.
- **`ctx.filter = 'blur(...)'` is astronomically expensive** — measured 39 ms *per frame* for
  one blurred shape, because canvas filters blur the whole surface. A wide translucent stroke
  reads nearly the same and is free.
- **Object spread evaluates getters.** `{...layer}` calls `get size()` once and freezes the
  value forever. Delegate explicitly when the source object has accessors.
- **A `var()` inside a custom property resolves where the property is *declared*.** A
  `--filter` composed at `:root` freezes its inputs there, and no descendant can override
  them. Compose at the point of use.
- **Leaflet defaults `updateWhenIdle` to `Browser.mobile`**, i.e. true on phones — so no tile
  loads until the drag *ends*. That was the "blank while panning" bug.
- **`sepia()` collapses hue onto one axis.** Land and water on most basemaps differ mostly in
  hue, so a sepia wash destroys exactly the distinction it was applied over.
- **WCAG contrast is luminance-only** and cannot see a hue difference. Measured land
  `(238,234,227)` against water `(234,242,236)` is a ratio of 1.01 and plainly different to
  the eye. Score ground-vs-ground with CIE76 ΔE instead; keep WCAG for text.

---

## Writing style

The part that decides whether any of this is worth using. Upper-secondary level, never
university: hook first, short sentences (long ones read badly aloud), every term explained the
first time, concrete over abstract, one good fact instead of three paragraphs of context.
Numbers are written the way they should be **spoken** — `syttisju`, not `77` — with the digits
kept separately for the screen.

**Norwegian is written natively; English follows it.** Not translated from English.

Code comments follow the same instinct: say *why*, and name the bug avoided. Match the density
of the surrounding file.

---

## In flight

- Nothing. Explore has moved off Leaflet, so both modes draw the same ground from the same
  module and `vendor/` is gone; the sound module is wired into `engine/story.js` and driven
  from a 100 ms interval, as the note here always said it would have to be.
- **The sound module is built and benched but not wired into `engine/story.js`.** Integration
  notes are in the plan; the key point is to drive `soundscape.tick()` from a 100 ms interval,
  **not** from the player's `onTick`, which only fires when the beat or word changes.
