# Den amerikanske revolusjonen

A narrated learning app, built as a companion to Ken Burns' *Den amerikanske revolusjonen*
on NRK. Norwegian and English, mobile first.

Two ways in:

- **Fortell** — narrated chapters. A voice tells the story and the map moves with it: a
  portrait when someone is named, a march drawing itself across the country when a march is
  described, a zoom to the field at the moment the field matters. Two so far, both hour by
  hour: **19 April 1775** — the day the war began, and **17 June 1775** — Bunker Hill, the
  day both sides found out what it was going to cost. Pick one on the cover.
- **Utforsk** — the whole war to browse: a parchment map of 39 events, a timeline grouped by
  the six NRK episodes, and 37 people.

Live: **https://vidarsveen.github.io/american_revolution/**

---

## The idea the engine is built on

Cues are pinned to **words in the script**, never to timestamps:

```jsonc
{
  "id": "s3.b4",
  "say": {
    "no": "De er syttisju mann. Nedover veien kommer det sju hundre.",
    "en": "There are seventy-seven of them. Coming down the road are seven hundred."
  },
  "cues": [
    { "on": { "no": "word:syttisju", "en": "word:seventy-seven" },
      "do": "stat.show", "value": "77",  "side": "patriot" },
    { "on": { "no": "word:hundre",   "en": "word:hundred" },
      "do": "stat.show", "value": "700", "side": "british" }
  ]
}
```

`edge-tts` reports the millisecond every word was actually spoken, so `tools/narrate.py`
resolves those anchors for you. You write prose and say which word each visual belongs to.
Rewrite the sentence, or change the voice, and the timings regenerate — nothing is hand-timed.
The same word times drive the karaoke-style captions, so the whole chapter works with the sound
off.

An anchor written as a bare string (`"word:Concord"`) applies to every language, which is right
for proper nouns. A `{no, en}` pair is required whenever the languages say it differently —
`tools/check-script.py` fails the build if an anchored word is not in the text, because the
player would otherwise fall back to the start of the beat and the visual would just fire early,
which is easy to miss by ear.

---

## Three rules the engine keeps

**The picture is a function of time, not a history of events.** Seeking wipes the stage and
re-applies every cue up to that point with animation suppressed. Scrub backwards into the middle
of a drawing route and you get a correct picture, not a half-drawn one.

**Nothing that must happen depends on `requestAnimationFrame`.** Browsers stop delivering frames
to a backgrounded tab. Animation frames make things smooth; timers are the contract.

**Audio failing is not the app failing.** If playback is blocked before a user gesture, or a file
is missing, the chapter still runs on a timer and the captions carry the words. And if a chapter
has not been recorded in your language, it plays in one that has been, and the cover says so.

---

## Layout

```
engine/                    generic — knows nothing about this subject
  script.js     load a chapter, resolve word anchors against the timings
  player.js     the clock: playback, cue scheduling, seeking, silent fallback
  stage.js      the cue vocabulary — one table of verb -> effect
  scenes/
    map.js      cue -> map calls: flyTo, routes, pins, place names, time of day
    overlays.js portrait / image / quote / stat cards
  captions.js   word-highlighted captions and the transcript
  chrome.js     transport, scene rail, scrubbing
  story.js      mode entry point

core/                      shared primitives, no DOM ownership
  theme.js      isDark(el), watchTheme, reducedMotion — one copy, was three

map/                       the map module — we draw the ground ourselves
  geo.js        Web Mercator (Leaflet-compatible), Catmull-Rom, normals
  basemap.js    Natural Earth baked into Path2D + a pack's detail overlay
  artifacts.js  army arrows, marches, fronts, areas, crossings, battles
  regions.js    named administrative areas, any level
  tint.js       one side's colour spread into a family, one per region
  index.js      createMap(host, opts) -> an instance, used by BOTH modes

sound/                     mixer, synthesised effects, script-driven ducking

dev/                       benches — open these, not the app
  engine-lab.html does seeking produce the same picture as playing forward?
  map-lab.html    every map capability on one screen, both themes
  sound-lab.html  every effect, with the duck curve plotted

assets/geo/                built by tools/build-basemap.py, committed
content/<pack>/geo/        built by tools/fetch-detail.py — close-in water

content/packs.json         the list of subjects — the only registry, and it is data
content/american-revolution/    one folder per subject
  pack.json                factions, map framing, era, voices, chapters, pools
  chapter-<date>.json      scenes -> beats -> cues, plus places, routes, quotes
  timing.<chapter>.no.json generated: beat offsets and per-word times
  audio/no/<chapter>/s1.mp3  generated: one gapless file per scene
  media.json  media/       generated: images with artist, licence, source
  portraits.json  portraits/  generated: the same record for the faces
  people.json  events.json  chapters.json  geo/

Timings and audio are keyed by chapter as well as language. Scene ids restart at `s0` in
every chapter, so one timing file per pack meant chapter two silently overwrote chapter one.

js/                        the Explore mode
tools/                     narrate.py · fetch-media.py · check-script.py · check-data.py
```

**`pack.json` is what makes this a framework rather than an app about one war.** It carries
the factions — arbitrary in number, not the four this subject happens to have — the map
framing, the era, the voices, and the chapter list. Nothing under `engine/`, `map/`, `core/`
or `js/` names a subject: `grep -r "american-revolution" --include=*.js` returns nothing but
comments explaining why it does not.

**Cue vocabulary** — all subject-neutral. A topic without geography simply never uses the
map verbs; one with different geography just ships different places.

| verb | what it does |
|---|---|
| `map.flyTo` `map.fitRoute` `map.fitPlaces` | move the camera |
| `map.time` `map.mood` `map.flash` | clock, time of day, a shot going off |
| `route.draw` `route.clear` | a march drawing itself. Frames itself first unless `fit: false`, so it cannot run off the edge |
| `converge` | `from: [places] → to: place`. Lines coming in from outside and joining — militia on a road, armies on a capital, supply lines on a port |
| `place.highlight` `place.clear` | a pulsing ring: point at the map while you talk |
| `marker.show/hide/clear` | a named pin |
| `portrait.show/hide` | the person being spoken about, upright |
| `image.show/hide` `quote.show/hide` `stat.show/clear` `caption.note` | the overlay cards |
| `front.show/hide/clear` | a line held, with a facing |
| `road.draw` | standing scenery, drawn whole — the road a march travels along |
| `region.show/clear` `border.set` | named areas, and which borders to draw |
| `sound.play` `sound.ambience` `sound.music` | one-shots, a bed, a loop |
| `pause` | waits for a tap |

The full list with every argument, type and default is `engine/verbs.json` — 33 verbs, and the
only place the vocabulary is written down. Adding one means the manifest entry and a handler
in the `VERBS` table in `engine/stage.js`; `tools/check-script.py` reads the manifest, so it
needs no change unless the verb takes a new *kind* of reference. `checkVerbManifest()` reports
drift between the two at boot on localhost.

---

## Working on it

No build step, no npm. Serve over HTTP — ES modules and the service worker will not run from
`file://`.

```bash
python tools/serve.py
```

Not `python -m http.server`: that sends `Last-Modified` and no `Cache-Control`, so the
browser invents a freshness lifetime and hands you back the module you edited two minutes ago
— silently, with nothing in the console. `serve.py` serves everything `no-store`, and prints
the LAN address so you can open it on a phone.

Python tooling lives in `.venv` (`edge-tts`, `pillow`, `mutagen`) and needs `ffmpeg` on PATH.

```bash
# regenerate narration after editing the script (only changed beats re-synthesise)
python tools/narrate.py --chapter american-revolution/chapter-1775-04-19 --lang no
python tools/narrate.py ... --only s3          # just one scene
python tools/narrate.py ... --rate -14%        # slower read
python tools/narrate.py ... --engine openai    # needs OPENAI_API_KEY

# images from Wikimedia Commons, with licence and attribution captured
python tools/fetch-media.py american-revolution
python tools/fetch-media.py american-revolution --portraits   # the faces, same record

# always run this before committing — every check, every pack, own server
python tools/check-all.py

# or on their own
python tools/check-script.py american-revolution/chapter-1775-04-19
python tools/check-data.py
python tools/build-sw.py --check        # is sw.js's precache still what the graph says?
python tools/check-engine.py            # rule 1: does seeking match playing forward?
python tools/check-contrast.py          # both themes; fails on unreadable map
python tools/check-sound.py             # ducking, instant suppression, silent fallback

# after pushing — does the live site actually serve what you committed?
python tools/check-published.py
```

Per-module benches live in `dev/` and are the place to work. Build a module against its bench
before wiring it into the app — every defect that mattered this year was invisible to reading
and obvious to measurement.

```bash
# rebuild the basemap after changing tolerances or levels
python tools/build-basemap.py
# close-in water and coastline for one pack's theatre (OpenStreetMap, ODbL)
python tools/fetch-detail.py american-revolution
```

`check-contrast.py` drives a real browser and samples real pixels, because the map was
unreadable for months and nobody could point at a number. It scores label and marker contrast
as WCAG ratios, and land-versus-water as a CIE76 colour difference — deliberately not a WCAG
ratio, because WCAG is a function of luminance alone and land and water here differ mostly in
hue. Measured land (238,234,227) against water (234,242,236) is a luminance ratio of 1.01 and
plainly different to the eye. Scoring that by luminance is the same mistake `sepia()` made.

`--engine openai` sounds better but returns no word timings, so anchors are estimated from word
length and flagged `approx`. The tool says so rather than quietly mis-syncing.

### Writing style

The part that decides whether any of this is worth using. Upper-secondary level, never
university: hook first, short sentences (long ones read badly aloud), every term explained the
first time, concrete over abstract, one good fact instead of three paragraphs of context.
Numbers are written the way they should be **spoken** — `syttisju`, not `77` — with the digits
kept separately for the screen. Norwegian is written natively; English follows it.

---

## Publishing

Push to `main`; GitHub Pages serves from the repository root. `.nojekyll` is in place and every
path is relative, so the site works under `/american_revolution/`.

---

## Credits

- Text written for this project. Wikipedia extracts are fetched live and credited in place
  (CC BY-SA).
- Amos Doolittle's four engravings of 19 April 1775, made the same year — public domain,
  with artist, source and licence recorded in `media.json`.
- Portraits: public-domain paintings from Wikimedia Commons. Where an image is a statue or a
  stand-in rather than a likeness, the app says so.
- Basemap drawn from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
  Close-in water and coastline from OpenStreetMap contributors, ODbL.
- Voices: Microsoft Edge neural TTS via [edge-tts](https://github.com/rany2/edge-tts).
- [Fraunces](https://github.com/googlefonts/fraunces) (SIL OFL 1.1).
- Structure and chapter titles follow *Den amerikanske revolusjonen* (Ken Burns,
  Sarah Botstein and David Schmidt), shown on NRK.
