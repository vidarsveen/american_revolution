# Den amerikanske revolusjonen

A narrated learning app, built as a companion to Ken Burns' *Den amerikanske revolusjonen*
on NRK. Norwegian and English, mobile first.

Two ways in:

- **Fortell** — a narrated chapter. A voice tells the story and the map moves with it: a
  portrait when someone is named, a march drawing itself across the country when a march is
  described, a zoom to the field at the moment the field matters. First chapter:
  **19 April 1775**, hour by hour, about eleven minutes.
- **Utforsk** — the whole war to browse: a parchment map of 39 events, a timeline grouped by
  the six NRK episodes, and 32 people.

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
    map.js      Leaflet surface: flyTo, routes, pins, place names, time of day
    overlays.js portrait / image / quote / stat cards
  captions.js   word-highlighted captions and the transcript
  chrome.js     transport, scene rail, scrubbing
  basemap.js    the parchment tiles, shared with Explore
  story.js      mode entry point

content/american-revolution/    one folder per subject
  chapter-1775-04-19.json  scenes -> beats -> cues, plus places, routes, quotes
  timing.no.json           generated: beat offsets and per-word times
  audio/no/s1.mp3 …        generated: one gapless file per scene
  media.json  media/       generated: images with artist, licence, source
  people.json  events.json  chapters.json  geo/

js/                        the Explore mode
tools/                     narrate.py · fetch-media.py · check-script.py · check-data.py
```

**Cue vocabulary** (a subject without geography simply never uses the map verbs):
`map.flyTo` · `map.fitRoute` · `map.time` · `map.mood` · `map.flash` · `route.draw` ·
`route.clear` · `marker.show/hide/clear` · `portrait.show/hide` · `image.show/hide` ·
`quote.show/hide` · `stat.show/clear` · `caption.note` · `militia.converge` · `hold` · `pause`.

Adding a verb means adding it to the table in `engine/stage.js` **and** to `VERBS` in
`tools/check-script.py`, or a typo in a chapter will silently do nothing.

---

## Working on it

No build step, no npm. Serve over HTTP — ES modules and the service worker will not run from
`file://`.

```bash
python -m http.server 8000
```

Python tooling lives in `.venv` (`edge-tts`, `pillow`, `mutagen`) and needs `ffmpeg` on PATH.

```bash
# regenerate narration after editing the script (only changed beats re-synthesise)
python tools/narrate.py --chapter american-revolution/chapter-1775-04-19 --lang no
python tools/narrate.py ... --only s3          # just one scene
python tools/narrate.py ... --rate -14%        # slower read
python tools/narrate.py ... --engine openai    # needs OPENAI_API_KEY

# images from Wikimedia Commons, with licence and attribution captured
python tools/fetch-media.py american-revolution

# always run both before committing
python tools/check-script.py american-revolution/chapter-1775-04-19
python tools/check-data.py
```

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
- Map tiles © OpenStreetMap contributors, © CARTO.
- Voices: Microsoft Edge neural TTS via [edge-tts](https://github.com/rany2/edge-tts).
- [Fraunces](https://github.com/googlefonts/fraunces) (SIL OFL 1.1),
  [Leaflet](https://leafletjs.com/) (BSD-2-Clause).
- Structure and chapter titles follow *Den amerikanske revolusjonen* (Ken Burns,
  Sarah Botstein and David Schmidt), shown on NRK.
