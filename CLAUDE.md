# Working on this repo

A narrated learning app about the American Revolution, built as a companion to Ken Burns'
*Den amerikanske revolusjonen* on NRK — and increasingly a **framework** for narrating any
historical subject on a map. Norwegian and English, mobile first.

Read `README.md` first for what the app *is*. This file is about how to work on it.

Read `docs/design-direction.md` before changing anything a viewer can see. It is the
standard — one motion scale, one type scale, one sound grammar, all in numbers — and it
exists because the alternative was four different answers to "how long does a thing take
to arrive", each chosen alone. A duration, a font size or a level that is not derived
from that document is a defect, whatever it looks like.

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
epoch counter before the await and drop the result if it has moved. `engine/surfaces/map.js`
does this for regions, and it cost an afternoon to find: seeking to the end of the intro left
Massachusetts washed blue over the whole map.

**2. Nothing that must happen depends on `requestAnimationFrame`.** Browsers stop delivering
frames to a backgrounded tab. Animation frames make things smooth; timers are the contract.
Every draw path must be callable synchronously.

**A level derived from other numbers is not a level anybody has heard.** The music bed sat at
−24 dB because that is what the old per-cue gains added up to, and a long comment in
`sound/soundscape.js` reasoned it out. Metered — an analyser in front of the destination,
against the narration mp3 decoded offline — it came out **35 dB under the voice**, which is
inaudible, and it was reported as "the music does not work". It is −8 now, metered at 19 dB
under. Same lesson as the caption ink and the map share, in a third costume: **a number that
describes what a listener or a viewer experiences has to be measured on what they get.**

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
engine/       narration: script -> player -> stage -> surfaces
  pack.js       content/packs.json + each pack.json; the only registry
  style.js      a pack's own numbers, merged over engine/defaults/style.json
  surfaces/     THE ARTIFACT LAYER. Each module declares its own verbs and its
    registry.js   own lifecycle; the registry merges them into one cue table.
    map.js        A pack declares which it wants in pack.json -> surfaces, and
    plate.js      one that does not name `map` never imports map/ at all —
    overlays.js   measured at 0 modules and 0 geometry files, 3.85 MB it does
    chart.js      not pay. Adding an artifact is a module and a manifest entry.
    sound.js
js/           the Explore mode
content/
  packs.json       the list of subjects. Data, not code.
  <pack>/
    script.*.md    one chapter each, as prose — script.<chapter-id>.md, keyed
                   the way timing.<chapter>.<lang>.json is. `author.py --new
                   <pack>/<chapter>` starts one from the outline.
    outline.md     the course above the chapter: what it teaches, in what
                   order, what each chapter is FOR, and what it leaves out.
                   pack.json's chapter list is compiled from it.
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
| `dev/map-lab.html` | Is every label that is drawn entirely inside the frame? |
| `dev/sound-lab.html` | Does the music duck under speech, and stay silent under `instant`? |
| `dev/sound-lab.html` | Does every loop join itself at the seam, measured on the samples? |
| `tools/check-turn.py` | At the instant the stage is rebuilt, is the veil actually opaque? |
| `dev/turn-lab.html` | Between two chapters, is there a frame with nothing on it? |
| `tools/check-plate.py` | When one picture replaces another, were both on screen at once? |
| `tools/check-legible.py` | When the narration names a place, is that name on screen and not under anything? |
| `tools/check-dead-css.py` | Does any module actually paint this class? |
| `tools/check-overlap.py` | Do two things the reader is meant to read land on each other? |
| `dev/engine-lab.html` | Does a chart drawn by seeking match one drawn by playing, axis for axis? |
| `dev/surface-lab.html` | Does a pack that does not declare the `map` surface load `map/` at all? |
| `dev/style-lab.html` | Does every number the app draws with come from `style.json`? |

`dev/engine-lab.html` is the bench for rule 1, which until now was enforced by discipline
alone. It compares a **stage signature** — every layer, every artifact, every declared
property — between playing forward and seeking, at every cue time ±40 ms plus a one-second
grid. `tools/check-engine.py` drives it headless and fails a build. Three things are
deliberately outside the signature, and getting this wrong is how the bench reports correct
behaviour as a defect (it did, on its first run):

- **`t0`, `instant`, `over`** — the animation phase. `engine/surfaces/map.js` sets
  `over: instant ? 0 : 0.7`, so `over` is a statement about drawing time, not identity.
- **`is-instant`** — `show()` in `engine/surfaces/overlays.js` removes it on the next animation
  frame, so its presence records whether a frame fired, not what is on screen.
- **the one-shot surfaces** (`.ov-note`, `.atlas__flash`) and **the camera** — the first are
  *supposed* to differ between the two passes, and the second is measured in `map-lab`.

Add a verb and you touch two things: `engine/verbs.json` (with its `surface`), and a handler in
that surface's own `verbs` map. The registry merges them; there is no central table to forget.
If it takes a reference type, the pool `tools/check-script.py` resolves that type against is the
third — and it is the one that has actually been forgotten before. A `sound` reference validated only against the pack's `sound.json`
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
python tools/outline.py italy-wine          # does the course still say what it teaches?
python tools/author.py content/italy-wine/script.chapter-1-piemonte.md --check   # prose vs the JSON that ships
python tools/check-data.py
python tools/build-sw.py --check   # is sw.js's precache still what the graph says?
python tools/check-engine.py       # rule 1, measured — needs a server
python tools/check-turn.py         # is the scene change behind the veil? — needs a server
python tools/check-turn-chapter.py # and the chapter change — needs a server
python tools/check-plate.py        # does a picture ever cut instead of dissolve?
python tools/check-dead-css.py     # is every class in css/ one that something paints?
python tools/check-legible.py      # can you see the place the sentence names? — a report, not a gate
python tools/check-contrast.py --pack <pack>   # samples real pixels; fails on an unreadable map
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

**When the narration names an area, that area goes ON THE MAP.** Not the county it is
in — the area itself. "Chianti Classico" is a shape between Florence and Siena and the
viewer should see it; a wash over the whole of Tuscany while the sentence says Chianti is
the map answering a different question. A course therefore ships the zones its chapters
name (`content/italy-wine/geo/zones.geojson`) alongside the administrative regions, and
each zone carries a `source` line saying the outline is approximate and why. A teaching
map that says "about here" is honest; one that looks traced from a legal boundary it did
not come from is not.

**A course goes where its chapters go, and so does its close-in geometry.** `map.detail`
is a LIST of boxes — the wine course has the Langhe and the hills between Florence and the
sea — each with its own `minZoom`, `bbox` and file, and only the box the camera is standing
in is ever fetched. With one box, chapter two zoomed into blank parchment: Natural Earth at
1:10M has nothing to draw at zoom nine and the pack's own geometry was six hundred
kilometres away. `python tools/fetch-detail.py <pack> --box 1` fetches the second.
`minWood` and `minWater` are per box too, because how big a copse has to be to be worth
drawing is a fact about that country: at the shared default Tuscany came to 4.4 MB against
the Langhe's 1.1.

**A picture must show what the sentence is talking about, or it is worse than no
picture.** This produced the single worst regression of the project, and every part of it
was avoidable. Pictures were added beat by beat to raise the count, and the result was:
Franklin's *Join, or Die* over the line "here they are, thirteen colonies" — covering the
map that was drawing all thirteen, with a cartoon that has eight segments and was cut in
1754 for a different war. An 1766 allegorical mock funeral under "no taxation without
representation", an event the script never mentions. The Boston Massacre under a line
about a silversmith and two lanterns. Two near-identical prints of the same scene in
consecutive beats.

Three of the four are now mechanically checkable and `check-script.py` fails on them: a
plate over a cue that *animates* (a march drawing itself, a front advancing, a flash) —
it plays out behind the picture and is never seen; a plate shown and hidden inside one
beat, or two different plates starting in adjacent beats; and a plate under six seconds
or over thirty-four.

The fourth is not checkable and is the one that matters: **does this picture show the
thing being said?** A tool cannot read the sentence. What it can do is *list* every plate
that sits over a `region.show` or a `marker.show`, and it does — those are fine when the
plate is pre-staging the map behind itself, and wrong when the line is pointing at it.
Read that list.

`tools/review-pictures.py <pack>` assembles the rest of that judgement: every picture beside
every sentence it is on screen for, in both languages, with the prompt that made it and its
`claims`/`omits`. It also counts how many of the words a picture ASSERTS are actually spoken
while it is up — as information, not a verdict, and the file says why at length: as a flag
that number fired on all twelve wine pictures including the good ones, and as a sort order it
put three correct pictures at the top while the one that was wrong sat in the middle. The
report comes out in the order a viewer meets them. `--set` writes a corrected prompt back.

**Half of that question is mechanical, and `tools/check-legible.py` now asks it.** Not
"does this picture show the thing being said" — no tool reads a sentence — but the spatial
half: *when the narration names a place, is that place's name on screen at all?* It seeks
to every cue that names a place, measures the drawn label, and sorts the answer into
CLIPPED (crosses the edge of the map host), COVERED (a DOM overlay paints over it),
MISSING (no label was drawn, or declutter dropped it) and PLATED (a full-frame picture is
over the map, which is usually right and only a human can say). It prints the beat's own
sentence beside every finding, for the same reason `check-script.py` does.

Its first run says 396 of 908 named places are legible. Read that before adding anything.
Two things it taught, both worth knowing before writing a probe of your own: **clipping is
against the MAP HOST, not the window** — the host is 390x734 inside a 390x844 phone and
`onScreen()` lets a pin sit 120 px outside it, so a name can be well inside the window and
cut in half by the map. And **a label's position is not a safe key for finding it**,
because a label that flips to the other side of its anchor is no longer at its anchor;
match on the text the map says it drew.

It reports and never fails — `--strict` exits 1 when the content is ready to be gated.
It is NOT in `check-all.py`: twelve minutes for sixteen chapter/language pairs would
roughly double a run, and CLAUDE.md's own argument against the old five-command list was
that it is a list people run four fifths of. It is a report you run, like the rhythm below.

The rhythm is a property of the whole chapter, not of a beat. Print it — one line per
scene, which pictures and for how long — before deciding anything is missing.

**For ten minutes after a push, a browser can run half of one version against half of
another.** GitHub Pages serves JavaScript with `Cache-Control: max-age=600`, and a returning
visitor's HTTP cache does not expire every file at the same instant. So a fresh
`engine/surfaces/map.js` gets imported against a ten-minute-old `map/basemap.js`, and the module
graph does not degrade — it throws *does not provide an export named `registerLevels`* and
nothing loads at all. `check-published.py` reports the site perfect throughout, because the
server really is correct; it is the visitor who is holding two versions.

It self-heals within ten minutes, and a hard reload fixes it now. What matters is recognising
it: an export error naming a module you did not touch, right after a deploy, is this and not
your code. Do not go looking for the bug. And it is why the answer to "is it live?" is
`check-published.py` *plus* a reload in a browser that has been there before — the two
questions have different answers for ten minutes.

**A compiled file edited by hand is a fork, and the compiler wins the next time
somebody runs it.** `script.<chapter>.md` is the source and `chapter-*.json` is what it
compiles to —
but six edits had been made straight to the wine chapter (five region labels turned off, one
place name) and never to the prose, so the next `--write` would have put the labels back on
the map, silently. Nothing reported it: `author.py --lab` round-trips the JSON through
itself, which passes happily while the hand-written source says something else entirely.
`--check` now EXITS 1 on any difference and `check-all.py` runs it per pack. The same shape
applies one level up, which is why `pack.json`'s chapter list is compiled from `outline.md`
and checked the same way.

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

**A generated candidate outlives the prompt that made it, and `--accept` counted the
folder.** Candidates are named `01-seed100.png` and every render starts at `01`, so a second
render of the same picture left ten files in one directory and sorted order interleaved them:
`--accept hender-host=4` handed back a picture from the PREVIOUS prompt and wrote the new
`claims` and `omits` beside it — a record saying "grey bloom, fog in the rows" over a
photograph of a pair of pliers, which is precisely what those two fields exist to prevent.
A render now writes `_run.json` with its own file list and the exact prompt it used;
`--accept` numbers that list, says how many older candidates it is ignoring, and REFUSES
when the prompt on disk has changed since. Both paths were confirmed by reproducing them.

**A probe that reads a class name is not a visibility check.** `.ov-fact` had no hidden
state in the stylesheet at all, so removing `is-on` changed nothing a viewer could see — and
the fact box was reported fixed four times running, because every probe asked the DOM what
class it had rather than asking the browser what it looked like. The same shape appeared one
layer up: `engine/transition.js` dimmed the stage for a scene change while `rebuildTo()` cut
the picture at t=0, so the device existed, its class was on, and the cut it was built to hide
happened in front of it at 0.008 opacity. Both are now measured on **effective opacity** —
`display`, `visibility` and every ancestor folded in — by `dev/engine-lab.js` and
`tools/check-turn.py`, and both benches were confirmed by reintroducing the bug and watching
them fail.

**A stylesheet outlives the renderer it was written for, and the rule gets applied to
the dead copy.** `css/story.css` styled `.story-mk`, `.story-place`, `.story-ring` and
`.stage-map__mood/__flash/__time` for as long as the map module has been drawing
`.atlas-pin`, `.atlas-place`, `.atlas-ring` and `.atlas__mood/__flash/__time`. Nothing
rendered the first set. So when the design direction said "no infinite animation", the
fix landed on `.story-ring` — three iterations, correct, invisible — and the live
`.atlas-ring` went on pulsing at the viewer for the rest of every scene. The rule was
written, the fix was made, and the defect was still on screen.

The two copies had also *drifted*: night at .30 against .34, the muzzle flash at 700 ms
against 620 ms, the clock at `--fs-xs` against a literal 14px. A number maintained in
two places and visible in one is worse than a number nobody wrote down.

Same shape as `.ov-fact` having no hidden state, one layer out: **a probe or a rule
aimed at a selector nothing paints reports success for ever.** `tools/check-dead-css.py`
fails the build on a class in `css/` that no module writes, as a ratchet — a documented
baseline of what is still dead, and nothing new allowed. It excludes `tools/`
deliberately, because `tools/check-turn.py` queried three of those dead selectors and
would otherwise have vouched for the very names it was failing to find.

**The middle of the map element is not the middle of the picture, and a probe that
re-centres the camera has to know that.** The caption, the transport and a fact card sit ON
the map, so a `flyTo` that centres its target in the host puts it low and spends the top of
the frame on whatever is north — measured on the wine chapter, half a phone of Switzerland
while Italy was pressed against the subtitles. Every camera verb composes into the visible
band now, using the same `framePadding()` the fits have always used. It is exported through
`engine/scenes/map.js` — the HANDLE, never the surface, or a pack with no map pulls in
map/index.js and the surface refactor's one measurable payoff is gone. `check-legible.py`
re-centred with `setView(coords)` and would otherwise have gone on judging every label
against a frame the app no longer draws.

**Two overlays anchored to the same edge will fight, and the later one wins.** The stats deck
and the caption box were both `bottom: calc(var(--transport-h) + ...)`, and the caption sits on
a higher layer — so every number the chapter shows was drawn behind it. Invisible, not missing,
which is why it survived so long. `engine/captions.js` publishes `--caption-h` the way the
transport publishes its own height; anything sharing that edge must clear it.

**And a SUM of those numbers is not the same as the thing.** The map's licence credit cleared
`--floor + --caption-h + --s1` and still sat 8 px inside the caption in every frame of every
chapter — because the caption SLOT is a little above the floor and the sum did not know.
`--caption-reach` is measured off the elements instead, which is the same argument
`framePadding()` makes: a sum of parts is wrong the moment a part moves. Found by
`tools/check-overlap.py` on its first run, 50 of 50 frames of the wine chapter, and it matters
more than it looks — ODbL asks for the credit to be legible, not merely emitted.

**A seek replays the cues, so everything on the stage animates in again — measure after it
has stopped.** `check-overlap.py`'s first numbers did not reproduce: two runs of the same
command disagreed on two pairs, because a card fades in over `--t-enter` from the moment of
the seek and a probe reading 140 ms later catches it mid-fade, with its opacity on one side of
the threshold or the other. It waits for the boxes to stop changing now, and two consecutive
runs agree exactly. Same family as the `--caption-h` flake and `check-turn`'s: a number read
too close to the thing that produced it.

`tools/check-overlap.py` is that harness, and it is committed because the one that found the
first round of these was not: "the remaining 30 are portrait cards reaching down out of the top
deck" sat in `BACKLOG.md` for weeks with nothing able to re-measure it. A measurement nobody
can re-run is a story, not a number. It is a RATCHET — the known overlaps are listed with the
count each was measured at, anything new fails, and anything that improves asks you to lower
the number.

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

**A foreign name is read with the reading voice's letter values, and the only control is the
spelling.** A Norwegian voice says "Vino Nobile di Montepulciano" the way those letters work in
Norwegian, which is not the name. `content/<pack>/say.json` maps a written word to how it
should be SPELLED for the voice, per language; the screen, the captions and the transcript keep
the real spelling, and `narrate.py` maps every reported word back before it writes the timing
file, so cue anchors still resolve. One word for one word — a substitution that changes the
word count would slide every anchor in the sentence, and the tool refuses it.

A respelling cannot be checked by reading it, because the letters are wrong on purpose:

```bash
python tools/narrate.py --pack italy-wine --say "Vino Nobile di Montepulciano"
```

writes the phrase twice into `shots/say/`, as written and as respelled, to listen to.

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

**A card is not stage state, and must be mounted where `resetStage()` cannot reach it.**
The scene card (`engine/transition.js`) and the end card (`engine/ending.js`) are both
siblings of `.story__stage` for this reason, and neither is a cue: a cue replays on every
seek, so scrubbing past the end would stack end cards the way it would fire forty muskets.
What a card SAYS can still be authored — `chapter.ending` is metadata — but anything the
engine reads has to be named in the whitelist in `compile()` (`engine/script.js`), or the
field silently does nothing.

**A scene change wipes the stage, so nothing standing survives it.** Rule 1 says the picture
is a function of time; seeking re-applies only the cues of the scene you land in. So a front,
a marker or a road drawn in scene four is *gone* in scene five, and the script gives you no
hint — the beat still talks about the redoubt, and the redoubt is not there. The Bunker Hill
chapter opened its dawn scene on a fleet shelling nothing and sent its first assault at empty
grass before this was spotted by looking at the pixels. Every scene re-establishes what it
inherits, at `start`. `check-script.py` cannot catch this: both halves are individually valid.

**Module-level state in `engine/surfaces/*` lives longer than a chapter.** It was written when
Fortell loaded one chapter per page load, and the cover can now switch. `regionsReady`
memoised a fetch whose `.then` called `useRegions()` on the map instance that was current when
it started, so after a switch the second map never got the geometry and `region.show` drew
nothing — with a 200 in the network panel. `mountMap` clears it. Anything else cached against
`map` must go the same way.

**A strong keyline can hide a weak fill, and the bench will vouch for it.**
`check-contrast.py` scored a map pin as max(fill, ring), which is a sound argument — a pin
presents two boundaries and the stronger one is what you see. The ring is `--atlas-ink`, the
opposite of the ground by definition, so it scored 13.64 while the fill underneath it scored
2.21. And a march, an arrow and a front are strokes in that same fill with no ring at all. The
fill is measured on its own now, read off the `--f-*` the palette publishes rather than
sampled from a screenshot: a one-pixel antialiased stroke samples as a blend of the colour and
the ground, so a screenshot cannot answer the question it is being asked.

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

**Plain English, in bullets. No jargon.** This is the rule that gets broken
most, and it was asked for twice in one day:

> "make a non jargon summary as bullet points of what you have done, stop with
>  detail jargon that makes it really hard to understand what has been done"

So: **say what a person would notice**, not what changed in the code.

    NO   `.is-now` carried font-weight: 600, so advance widths changed and
         the line reflowed on every word boundary
    YES  Captions stop jumping. Words were shifting lines as they highlighted,
         because bold letters are wider.

    NO   `.ov-deck--mid` was `top: 32%` and never anchored to --caption-h
    YES  Cards were landing on top of the subtitles. 121 frames, now 30.

Never a selector, a file path, a token name or a function name in a summary,
unless the reader has to type it. Numbers are welcome — they are not jargon,
they are evidence — but a number needs a unit a person recognises: "95 ms
frozen" and "82 of 84 pictures", not "worst 1.25:1 at dim 0".

**Ten lines, hard limit.** What was done, what to do next, one question if
there is one. No tables of what was verified, no recap of reasoning, no
restating the problem. Detail belongs in the code comment, `BACKLOG.md` or the
commit message, where it is read once and found again — not re-read in every
reply. Ten minutes to extract a status is a broken status.

State the full path whenever files are produced, and keep produced files inside
the project rather than a temp directory.

## How to work here

Five things learned expensively. They are about judgement, not about code.

**Fix what was asked, not what the tools point at.** A whole day went into
Roman cannon, Narvik markers and Revolution plates because the checks flagged
them — content the person had never mentioned and did not care about. The
checks cover four courses; the work is usually about one. **Ask which course
matters, then freeze the others.**

**"It is ugly" means remove it, until told otherwise.** A region label was
called ugly, and it was answered four separate times by changing its size —
14px, 11px, 15px, 17px — with two of those attempts written into
`docs/design-direction.md` as reasoning. It was never a size. When someone
reports the same thing three times, the reading is wrong, not the value:
**stop tuning and offer to delete.**

The fifth answer was `display: none !important` in `css/atlas.css`, and it took
a twelfth complaint to find out that was not a deletion either: `map/index.js`
went on building the node, measuring it, placing it and ranking it above every
city name, and one line of CSS hid it. **Hidden is not removed.** A phone
holding an older stylesheet had the name back, behaving exactly as reported.
It is gone at the source now, and `region.show` no longer takes a `label`, so
nothing can ask for one. Two lessons, and the second is the expensive one:
when a fix is a rule that hides something, say so out loud — and when a report
keeps coming back after a fix, **check the thing on screen before trusting the
note that says it was fixed.**

**And it was still not the thing being complained about.** The label on screen
was `caption.note` — a pill under the caption saying "Piemonte, nordvest i
Italia" — anchored `@end` in the LAST beat of its scene, so the scene wipe took
it away as it arrived: 1.7 s of life, twice, in two different places. Every
probe in this repo seeks with `rebuildTo()`, and a seek does not sit in the
trailing gap where that cue lives, so none of them ever saw it. **Watch it play
forward before believing a probe** — `tools/check-script.py` measures the
lifetime of every `caption.note` now, and sixteen of the nineteen that ship had
exactly 0.0 s.

**A bench that has never failed has not been shown to measure anything.** Four
checks in this repo were passing while measuring nothing at all — one had never
looked at the main screen, one scored a map pin against its own label, one flew
to the wrong continent, one ran a weaker copy of the dev server than the app
uses. That is why several defects survived being reported repeatedly and
"fixed". **Reintroduce the bug and watch the bench fail, every time**, and say
in the report how you did it.

**Measure before diagnosing, and measure the right thing.** Three separate
times a probe here read a value too soon after the thing that produced it and
reported a working fix as broken: a stale `.coach` element, a scene card
mid-fade, a `--caption-h` that wanders a whole line between reads. A **paired**
measurement — same page, same beats, one thing toggled — is evidence. A single
absolute reading of a published custom property is not.

**Say when a number you gave was wrong.** "The caption box is 127 px median"
was quoted in a summary, a commit and this repo's backlog, and it does not
reproduce. Correcting it costs one sentence; leaving it costs the next person's
trust in every other number.

## Scope, when starting fresh

Ask before doing any of this:

- **Which course are we working on?** Freeze the rest. They stay in the repo as
  proof the framework is not about one subject; they are not the work.
- **Framework or content?** Content fixes in a course nobody is watching are
  the most expensive kind of nothing.
- **Is this the thing that was asked for, or the thing next to it?**

And know what the framework already does before proposing to build it: a
chapter is prose (`tools/author.py`, 177 lines against 1652 of JSON), artifacts
are pluggable surfaces, a course's numbers live in its own `style.json`, and a
course that wants no map loads none of it. `README.md` is the map of all of it.

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

- **The course being worked on is `italy-wine`, and only that one.** Rome, the
  Revolution and Narvik are frozen: they stay as proof the framework is not
  about one subject, and their content is not the work. Do not fix them because
  a check reported them.
- **The next real test is somebody writing chapter two of the wine course in
  the `script.<chapter>.md` format**, without help — `python tools/author.py
  --new italy-wine/chapter-2-toscana` starts the file. If that takes more
  than an hour, the framework is not ready to produce with, and where it sticks
  is the next job. Everything else is behind that.
- Open work is the top section of `BACKLOG.md`, in order, split into the course
  and the framework. The colour pass is done for marks: every faction fill on
  every course clears 3:1 against the ground in both themes, derived lightness
  is fitted to that floor rather than fixed, and `check-contrast.py` gates it.
  The caption's unsaid ink is done too, and the number this repo had been
  quoting for it was wrong: measured on rendered pixels it is 4.19 over a
  picture, not 3.91, and `--ink-soft` moved to clear AA on the worst plate in
  all four courses.
- Explore has moved off Leaflet, so both modes draw the same ground from the
  same module and `vendor/` is gone; the sound module is driven from a 100 ms
  interval, as the note here always said it would have to be.
- **Generated sound effects are Apache 2.0** (MOSS-SoundEffect v2.0), so the build is
  commercially usable. Check a LICENSE file rather than a blog before trusting any model's
  terms: Meta's AudioGen is widely described as Apache 2.0 and its weights are CC-BY-NC 4.0.
  The synthesised catalogue in `sound/library.js` stays as the zero-dependency fallback and
  must not be deleted — a pack entry only overrides it.
- **Music has a survey and no tool yet.** ACE-Step v1-3.5B is Apache 2.0 on the weights
  themselves (LICENSE read, standard text, no added clauses) and Magenta RealTime is
  Apache code with CC-BY-4.0 weights; Stable Audio Open and MusicGen both fail the bar.
  `BACKLOG.md` has the table and what building on it costs — a 7-8 GB download and the
  loop-seam problem, which is the part the licence has nothing to do with.
