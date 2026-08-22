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

`tools/gen-sound.py` is the exception and runs from **`.venv-audio`**, a second environment on
Python 3.12. Two reasons it is separate, both learned the hard way: `audiocraft` wants
`numpy<2` and would break the tooling above, and it hard-pins `torch==2.1.0`, `torchvision`,
`torchtext` and `xformers<0.0.23`, none of which have 3.12 wheels — so it is installed with
`--no-deps` on torch 2.6+cu124 with its import chain satisfied by hand. `pip` will complain
about the unmet pins for ever; the imports work. Neither venv is committed.

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
core/         shared primitives, no DOM ownership
  theme.js      isDark(el), watchTheme, reducedMotion
  palette.js    a pack's factions -> what the map and the DOM draw
  paths.js      where a pack's files are — the only place that knows
engine/       narration: script -> player -> stage -> scenes/overlays
  pack.js       content/packs.json + each pack.json; the only registry
js/           the Explore mode
content/
  packs.json       the list of subjects. Data, not code.
  <pack>/
    pack.json      factions, map framing, era, voices, chapters, pools
    chapter-*.json + timing.<chapter>.<lang>.json
    portraits/ media/ sound/ geo/   the pack's own assets
assets/geo/   built basemap data, committed
dev/          per-module benches — open these, not the app
tools/        python: build, fetch, narrate, check
```

## The lab pattern

Every module gets a standalone bench under `dev/`, and **each lab exists to answer one
falsifiable question**, not to look at things. A lab that is only a gallery will rot.

| Lab | The question it answers |
|---|---|
| `dev/engine-lab.html` | Does `rebuildTo(t)` produce the same picture as playing forward to `t`? |
| `dev/map-lab.html` | Does `instant` reproduce the animated picture exactly? Is any frame blank? |
| `dev/map-lab.html` | Can two regions that share a border be told apart, measured on the pixels? |
| `dev/sound-lab.html` | Does the music duck under speech, and stay silent under `instant`? |

`dev/engine-lab.html` is the bench for rule 1, which until now was enforced by discipline
alone. It compares a **stage signature** — every layer, every artifact, every declared
property — between playing forward and seeking, at every cue time ±40 ms plus a one-second
grid. `tools/check-engine.py` drives it headless and fails a build. Three things are
deliberately outside the signature, and getting this wrong is how the bench reports correct
behaviour as a defect (it did, on its first run):

- **`t0`, `instant`, `over`** — the animation phase. `engine/scenes/map.js:507` sets
  `over: instant ? 0 : 0.7`, so `over` is a statement about drawing time, not identity.
- **`is-instant`** — `show()` in `engine/scenes/overlays.js` removes it on the next animation
  frame, so its presence records whether a frame fired, not what is on screen.
- **the one-shot surfaces** (`.ov-note`, `.atlas__flash`) and **the camera** — the first are
  *supposed* to differ between the two passes, and the second is measured in `map-lab`.

Add a verb and you must touch three things, not two: `engine/verbs.json`, the `VERBS` table in
`engine/stage.js`, and — if it takes a reference type — the pool `tools/check-script.py`
resolves that type against. A `sound` reference validated only against the pack's `sound.json`
rejects every effect the shipped library synthesises, which is all of them.

Build the module against its lab **before** wiring it into the app. Both defects that mattered
most this year were invisible to reading and obvious to measurement.

## Checks to run before committing

```bash
python tools/check-all.py          # all of the below, on every pack
```

It finds the chapters itself and starts its own server for the benches that need one, because
the previous list was five commands, two of which needed a server in another shell and one of
which had to be repeated per chapter — which is a list people run four fifths of. The
individual tools still work on their own, and a failure reads the same either way:

```bash
python tools/check-script.py american-revolution/chapter-1775-04-19
python tools/check-data.py
python tools/build-sw.py --check   # is sw.js's precache still what the graph says?
python tools/check-engine.py       # rule 1, measured — needs a server
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

**For ten minutes after a push, a browser can run half of one version against half of
another.** GitHub Pages serves JavaScript with `Cache-Control: max-age=600`, and a returning
visitor's HTTP cache does not expire every file at the same instant. So a fresh
`engine/scenes/map.js` gets imported against a ten-minute-old `map/basemap.js`, and the module
graph does not degrade — it throws *does not provide an export named `registerLevels`* and
nothing loads at all. `check-published.py` reports the site perfect throughout, because the
server really is correct; it is the visitor who is holding two versions.

It self-heals within ten minutes, and a hard reload fixes it now. What matters is recognising
it: an export error naming a module you did not touch, right after a deploy, is this and not
your code. Do not go looking for the bug. And it is why the answer to "is it live?" is
`check-published.py` *plus* a reload in a browser that has been there before — the two
questions have different answers for ten minutes.

**`sw.js`'s `PRECACHE` list and `VERSION` are generated — run `tools/build-sw.py`.** They used
to be maintained by hand, so adding a file and forgetting the list meant it worked online and
404s offline, silently, because the install uses `Promise.allSettled`; and forgetting to bump
`VERSION` served the old cache to everyone who already had one. Both halves were bookkeeping.
The tool walks what `index.html` actually reaches (`tools/graph.py`) plus each pack's runtime
data, and derives `VERSION` from the contents, so it moves exactly when the cache would serve
something different. `--check` is in `check-all.py`.

This is **not a build step**: `sw.js` stays committed and readable, nothing compiles at load,
and only the block between the generated markers is touched — the fetch strategy below it is
hand-written and must stay that way. Generating the list immediately found that
`content/american-revolution/sound.json` had never been in it, so every recorded effect fell
back to a synthesised one offline; and that `core/theme.js` was in it while nothing imports it.

**The cue vocabulary lives in `engine/verbs.json` and nowhere else.** It used to be copied by
hand into `engine/stage.js` and `tools/check-script.py`, so adding a verb to one and not the
other meant a chapter validated clean and then silently did nothing in the browser. Adding a
verb now means: the manifest entry, and a handler in the `VERBS` table in `stage.js`.
`checkVerbManifest()` reports drift at boot on localhost, and `check-script.py` refuses a
chapter that uses a verb the manifest does not declare. Declare an argument with a reference
type (`place`, `route`, `person`, `media`, `quote`, `sound`) and its integrity check comes
free.

**A cue argument the manifest does not declare is read by nobody, silently.** `kind` on
`marker.show` and `tone` on `place.highlight` sat in the chapter for months. The verb existed,
the argument did not, so every pin drew British-red, every "red" ring drew gold, and no battle
glyph ever appeared — and `check-script.py` passed it clean, because it only ever checked verb
*names*. It now rejects undeclared arguments and validates enum values. The lesson generalises:
the manifest is the contract, and anything not in it is decoration.

**Two overlays anchored to the same edge will fight, and the later one wins.** The stats deck
and the caption box were both `bottom: calc(var(--transport-h) + ...)`, and the caption sits on
a higher layer — so every number the chapter shows was drawn behind it. Invisible, not missing,
which is why it survived so long. `engine/captions.js` publishes `--caption-h` the way the
transport publishes its own height; anything sharing that edge must clear it.

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

**SSML does not work with `edge-tts`, and fails out loud.** Tags are escaped into the text,
so `<emphasis level="strong">four</emphasis>` is spoken as *"emphasis level equals strong four
emphasis"* — and the tag words land in the word list, so the captions show them too. The only
prosody controls are the voice, the `rate`, and the wording itself.

**The number rule does not cover English homophones.** Writing numbers as words fixes how they
are *read*, not how they are *heard*: "a war fought across four continents" came out with
`four` held for 75 ms, which is function-word length, and in British English an unstressed
`four` and `for` are the same sound. Rewording to "on four continents at once" gives the number
somewhere to lean and 125 ms. `edge-tts` reports a duration per word, so this is measurable —
a cardinal under about 100 ms is being swallowed.

**Timings and audio are keyed by chapter, not just by pack.** `timing.<chapter>.<lang>.json`
and `audio/<lang>/<chapter>/<scene>.mp3`. Scene ids restart at `s0` in every chapter, so the
original one-file-per-pack layout had a second chapter overwriting the first scene for scene
— and the overwrite is silent, because a timing file for the wrong chapter still parses and
still has an `s0`. Adding a chapter therefore also means four new lines in `sw.js`.

**A scene change wipes the stage, so nothing standing survives it.** Rule 1 says the picture
is a function of time; seeking re-applies only the cues of the scene you land in. So a front,
a marker or a road drawn in scene four is *gone* in scene five, and the script gives you no
hint — the beat still talks about the redoubt, and the redoubt is not there. The Bunker Hill
chapter opened its dawn scene on a fleet shelling nothing and sent its first assault at empty
grass before this was spotted by looking at the pixels. Every scene re-establishes what it
inherits, at `start`. `check-script.py` cannot catch this: both halves are individually valid.

**Module-level state in `engine/scenes/*` lives longer than a chapter.** It was written when
Fortell loaded one chapter per page load, and the cover can now switch. `regionsReady`
memoised a fetch whose `.then` called `useRegions()` on the map instance that was current when
it started, so after a switch the second map never got the geometry and `region.show` drew
nothing — with a 200 in the network panel. `mountMap` clears it. Anything else cached against
`map` must go the same way.

**Modern boundaries are wrong for history.** The framework ships modern admin boundaries
because that is the honest general default. Massachusetts in 1775 included Maine, Vermont was
disputed, and West Virginia did not exist. A historical pack overrides with its own
`geo/borders.geojson`.

**A pack declares what the engine used to know.** `content/<pack>/pack.json` carries the
factions (arbitrary in number — Octavian's rise has seven and two of them change sides), the
map framing, the era, the voices, the chapter list with titles, and where each pool lives.
Three rules that are easy to get wrong:

- **A faction names a colour three ways**: `token` (a CSS custom property, which flips with
  the theme for free), `hue` (the framework derives fill and wash), or explicit `fill`. See
  `core/palette.js`.
- **`tone: red|blue|gold|sage` is a palette ROLE, not a party.** It used to alias a faction —
  `TONE = { red: 'british' }` — which is the same leak in a smaller shape. Gold is the map's
  look-here colour whatever the subject is.
- **CSS must not select on a faction name.** `.mk--british { … }` bakes "there are four sides
  and they are these" into a stylesheet, and how many there are is a property of the subject.
  A node carries `--side: var(--f-british)` instead; `--f-*` is published on `:root` and
  re-published on every theme change, which is why it must be a `var()` reference and not a
  resolved hex.

**`map.extent` is not `map.explore.bounds`.** The first is where the subject's coordinates are
allowed to be, the second is where the camera opens. This war is fought on the seaboard and
decided partly in Paris — `check-data.py` uses the extent to catch a swapped lat/lon, and the
explore bounds would reject Paris as an error.

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

## Answering back

**Summaries: ten lines, hard limit.** What was done, what to do next, one
question if there is one. Nothing else. No tables of what was verified, no
recap of reasoning, no restating the problem. Detail belongs in the code
comment, `BACKLOG.md` or the commit message, where it can be read once and
found again — not re-read in every reply. Ten minutes to extract a status is
a broken status.

State the full path whenever files are produced, and keep produced files
inside the project rather than a temp directory.

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
- **Generated sound effects are Apache 2.0** (MOSS-SoundEffect v2.0), so the build is
  commercially usable. Check a LICENSE file rather than a blog before trusting any model's
  terms: Meta's AudioGen is widely described as Apache 2.0 and its weights are CC-BY-NC 4.0.
  The synthesised catalogue in `sound/library.js` stays as the zero-dependency fallback and
  must not be deleted — a pack entry only overrides it.
