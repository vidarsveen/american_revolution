# Fortell

A framework for narrated courses. A voice tells a story, and the screen shows what the voice
is talking about — a picture, a map, a chart, a face, a number — with every visual pinned to
the **word** it belongs to. Norwegian and English, mobile first, no build step.

Live: **https://vidarsveen.github.io/american_revolution/**

Four courses run on it today: **Vin fra Italia**, **Den amerikanske revolusjonen**,
**Kampen om Narvik** and **Romerriket**.

---

## The idea the whole thing is built on

Cues are pinned to words in the script, never to timestamps:

```
{music bedMist} {mood dawn} {flyTo torino zoom=7.6} Piemonte
{region Piemonte over=1.6} betyr ved foten av fjellet.
> Piemonte {^} means at the foot of the mountain.
```

The narration tool records the millisecond every word was actually spoken, so a cue placed
after a word happens **when that word is said**. Rewrite the sentence, change the voice, swap
the language — the timings regenerate and nothing is hand-timed.

The same word times drive the captions, so a course works with the sound off.

---

## Making a course

Seven steps, and the first three are the only ones that decide whether it is any good.

### 1. Plan the course — `content/<id>/outline.md`

What the course teaches, in what order, and what each chapter is **for** — written
before any of it, in prose. Also what the course deliberately leaves out, which is the
half that gets forgotten:

```markdown
# about
Kurset handler om rødvin.
> The course is about red wine.

# not here
hvitvin, hvite | white wine, whites

## chapter-1-piemonte
title: Tåka og tørsten | The fog and the thirst
for: Å vise at navnet på en flaske er et sted. | To show that the name on a bottle is a place.
teaches: terroir, nebbiolo, barolo, barbaresco
```

`pack.json`'s chapter list is compiled from it, and `tools/outline.py` asks the two
questions no other tool is at the right level to ask: does chapter two repeat chapter
one, and does a chapter promise something the course said it would not do? The wine
course closed on "and we have not mentioned the whites yet" four beats after covering
one, because nothing above the chapter had ever been written down.

### 2. Declare the subject — `content/<id>/pack.json`

What it is called, what colours it uses, where its map opens, which voices read it, and
**which artifacts it needs**:

```jsonc
{
  "surfaces": ["map", "plate", "overlays", "sound", "chart"]
}
```

A course that does not list `map` never loads the map module or a byte of geometry. That is
3.85 MB it does not pay for.

Add the id to `content/packs.json` and it appears on the front door.

### 3. Write the chapter — `content/<id>/script.md`

Prose, one sentence per line. A sentence is a **beat**, which is the unit the whole app is
built on. Norwegian plain, English underneath after a `>`. A blank line is a paragraph break
and becomes a longer pause. You never type a timing or an id.

```bash
python tools/author.py content/italy-wine/script.md --write
```

It refuses bad input before anything runs — a word that is not in the sentence, a verb that
does not exist, a picture or a place or a term that is not in the course. **Read
`docs/authoring.md`**: it writes a whole chapter as a worked example, and everything in it
compiles.

### 4. Record it

```bash
python tools/narrate.py --chapter italy-wine/chapter-2-toscana --lang no
```

Only changed beats re-synthesise. **Watch it now** — the engine runs a chapter with no audio
and no pictures at all, so the writing gets judged before anything decorates it.

### 5. Get the pictures

```bash
python tools/fetch-media.py italy-wine            # from Wikimedia, with licence captured
python tools/gen-image.py italy-wine --list       # or generate them
python tools/review-pictures.py italy-wine        # each one beside the sentence it sits under
```

Every picture carries its artist, licence and source, and a generated one carries what it
`claims` and what it `omits`.

The review is not optional and it is not about looking. Every defect in the first nine
generated pictures was semantic — a pit instead of a redoubt, two bottles instead of one, a
steamboat behind an 18th-century hillside — and of two candidates for one prompt, the prettier
painting was the one with the steamboat. So the reviewer puts the picture beside the sentences
it is actually on screen for, and `--set` writes the corrected prompt back.

### 6. Tune it — `content/<id>/style.json`

Pacing, camera speed, the slow push on a still, text size. Merged over
`engine/defaults/style.json`, so a course only writes what it wants to differ.

```jsonc
{ "plate": { "push": 0.28 }, "motion": { "drift": 18000 }, "type": { "scale": 1.0 } }
```

`dev/style-lab.html` puts sliders on a running chapter and audits that every number the app
draws with comes from this file.

### 7. Check it

```bash
python tools/check-all.py
```

---

## What a course is made of

```
content/<id>/
  outline.md       the course: what it teaches, in what order, what each chapter is for
  pack.json        the subject: colours, map framing, era, voices, chapters, artifacts
  style.json       its own pacing and sizing
  script.md        the chapter, as prose
  chapter-*.json   compiled from it — committed and readable
  timing.*.json    generated by narrate.py: every word, to the millisecond
  audio/           generated: one file per scene, per language
  media/           pictures, with media.json carrying licence and credit
  <pools>.json     what a reader can look up: terms, people, grapes, wines, anything
  geo/             the course's own map data, if it has any
```

`pack.json` is what makes this a framework rather than an app about one subject. Nothing
under `engine/`, `map/` or `core/` names a subject.

---

## Artifacts

An artifact is a **surface**: a module that declares its own vocabulary and its own
lifecycle. The registry merges them; a course picks the ones it needs.

| surface | verbs | what it draws |
|---|---:|---|
| `map` | 23 | the ground, and everything on it — marches, fronts, pins, regions, fleets |
| `overlays` | 13 | portraits, quotes, numbers, fact boxes, comparisons |
| `plate` | 2 | a picture taking the whole frame, with the slow documentary push |
| `chart` | 2 | values with a shape — a taste profile, a graph |
| `sound` | 3 | the score, the room, and one-shot effects |

**Adding an artifact is a module and a manifest entry.** Declare the verb in
`engine/verbs.json` with its `surface`, write the handler in that surface's `verbs` map.
`tools/author.py` can write it immediately, because it derives its shorthands from the
manifest rather than from a list of its own.

---

## Three rules the engine keeps

**The picture is a function of time, not a history of events.** Seeking wipes the stage and
re-applies every cue up to that point with animation suppressed. Scrub backwards into a
half-drawn march and you get a correct picture, not a half-drawn one.

**Nothing that must happen depends on `requestAnimationFrame`.** Browsers stop delivering
frames to a backgrounded tab. Frames make things smooth; timers are the contract.

**Audio failing is not the app failing.** If playback is blocked, or a file is missing, or a
chapter has not been recorded in your language, it still runs and the captions carry the
words.

---

## Layout

```
engine/       the narration: script -> player -> stage -> surfaces
  script.js     load a chapter, resolve word anchors against the recorded timings
  player.js     the clock: playback, cue scheduling, seeking, silent fallback
  style.js      a course's own numbers
  surfaces/     the artifact layer — registry, map, plate, overlays, chart, sound
map/          the map module — no tiles, no Leaflet; we draw the ground
core/         shared primitives: palette, paths, entries, era, dossier
sound/        mixer, a synthesised effect library, script-driven ducking
js/           Explore — a second, browsable mode
content/      the courses
tools/        author · narrate · fetch-media · gen-image · gen-sound · the checks
dev/          per-module benches — open these, not the app
docs/
  authoring.md        how to write a chapter, as a worked example
  design-direction.md the standard: one motion scale, one type scale, one sound grammar
```

---

## Working on it

No build step, no npm, no bundler. Native ES modules, relative paths. Serve over HTTP:

```bash
python tools/serve.py     # NOT python -m http.server — see CLAUDE.md
```

Python tooling lives in `.venv`. `narrate.py` needs `edge-tts`, `mutagen` and `ffmpeg`.
`gen-sound.py` runs from a second environment, `.venv-audio`.

Before committing:

```bash
python tools/check-all.py        # every check, every course, its own server
python tools/check-published.py  # after pushing: does the live site serve what you committed?
```

Reports you run rather than gates:

```bash
python tools/check-pictures.py   # the picture rhythm of a chapter
python tools/check-legible.py    # can you see the place the sentence names?
```

---

## Writing style

The part that decides whether any of this is worth using. Upper-secondary level, never
university: hook first, short sentences (long ones read badly aloud), every term explained
the first time, concrete over abstract, one good fact instead of three paragraphs of
context. Numbers are written the way they should be **spoken** — `syttisju`, not `77`.

**Norwegian is written natively; English follows it.** Not translated from English.

---

## Credits

- Text written for this project. Wikipedia extracts are fetched live and credited in place.
- Basemap from [Natural Earth](https://www.naturalearthdata.com/) (public domain); close-in
  coastline and water from OpenStreetMap contributors, ODbL.
- Voices: Microsoft Edge neural TTS via [edge-tts](https://github.com/rany2/edge-tts).
- Generated pictures: FLUX.2-klein-4B (Apache 2.0). Generated effects: MOSS-SoundEffect v2.0
  (Apache 2.0). Both chosen so the build stays commercially usable — check the LICENSE file,
  never a summary of it.
- [Fraunces](https://github.com/googlefonts/fraunces) (SIL OFL 1.1).
- Structure and chapter titles of the Revolution course follow *Den amerikanske
  revolusjonen* (Ken Burns, Sarah Botstein and David Schmidt), shown on NRK.
