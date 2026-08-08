# Backlog

Things worth doing, with enough context that picking one up does not mean
re-deriving why. Newest concerns first within each section.

---

## Sound — needs another pass

Listened to on 8 August. Verdict: most of the library is usable, three are not.

| Effect | Verdict | Likely cause |
|---|---|---|
| `churchBell` | **bad** | Eight inharmonic partials with independent decays. Probably too many partials and too clean a strike — a real bell has a hard transient and a much longer, beating tail. |
| `crowd` | **bad** | A 480 Hz noise band with formant blips reads as static, not people. Needs uneven density and occasional near-voice peaks without ever being a word. |
| `rigging` | **barely audible** | Almost certainly a level problem, not a design one: the RMS ceiling added to stop `fife` dominating will have pushed a quiet ambient bed further down. Check its RMS against `wind` (0.1004) before touching the synthesis. |

Everything else (`musket`, `volley`, `cannon`, `alarmBell`, `fife`, `drums`,
`hooves`, `boots`, `wind`, `rain`, `sea`, the two beds) passed.

**Escape hatch already exists.** If a synthesised effect cannot be made good
enough, a pack can ship a real recording: `content/<pack>/sound.json` takes
file-based entries with mandatory `licence` and `credit`, and
`tools/check-script.py` already validates them. Synthesis is the default, not
a constraint.

---

## Blocking the next piece of work

**The cue vocabulary is duplicated by hand** between `engine/stage.js` and
`tools/check-script.py`. Adding a verb to one without the other means a typo
in a chapter silently does nothing. This has already blocked work twice, and
wiring sound cues will hit it a third time. One JSON manifest read by both,
and the lab control panels can be generated from it for free.

---

## Content

**`geo/colonies.geojson` is anachronistic.** It has 15 features including a
separate *Maine* and a *West Virginia*. In 1775 Massachusetts ran up through
Maine, Vermont was claimed by both New York and New Hampshire, and West
Virginia was 88 years away. This matters immediately: any scene that says
"the thirteen colonies" and draws this file is teaching something false. The
override mechanism is in place (`map.useRegions(geojson)`); the data is not.

**An introduction chapter.** The existing chapter opens in Boston with no
orientation. See "Next up" below.

---

## Modules not yet built

- **Script authoring** — the bottleneck for every future subject. A Waterloo
  chapter currently means hand-editing 2000 lines of JSON and guessing whether
  a `word:` anchor matches the sentence.
- **Timeline** — known defect: dots too small to read or hit. Needs a density
  histogram, labelled dots only for turning points, ≥8 px targets.
- **Section indicator** — no sense of "which part am I in" during a chapter.
- **Comparison artifact** — "seventy-seven against seven hundred" lands harder
  shown as one ratio than as two unrelated stat chips.
- **Pack boundary** — `pack.json` carrying factions, flags, chapters, bboxes.
  Acceptance test: `grep -r "american-revolution" --include=*.js` returns one hit.

## Wiring not yet done

- **Explore is still on Leaflet** (`js/map.js`, `js/routes.js`). The story
  stage has moved to `map/`. Until Explore follows, `vendor/leaflet.*` stays.
- **Sound is not wired into `engine/story.js`.** Drive `soundscape.tick()`
  from a 100 ms interval, **not** the player's `onTick` — that only fires when
  the beat or word changes, so the ducker would stall for up to a second
  between beats.

---

## Next up: an establishing chapter

The idea: open wide and close in, the way a documentary does. Britain, France
and the colonies as three players on one map; then America; then the thirteen
colonies; then Boston; then the existing 19 April chapter continues from
there.

Two reasons it is the right next thing. It is pedagogically the missing piece
— the chapter currently drops a Norwegian sixteen-year-old into Boston with no
idea who is fighting whom or why. And it exercises exactly the capabilities
just built, in the order they were built: world basemap, country borders,
named historical regions, then the close-in OSM detail.

Keep it small. One scene, roughly six to ten beats, ninety seconds. The
artifacts that earn their place:

- country borders at level 0, and Britain / France / the colonies as named,
  faction-coloured regions
- a naval route across the Atlantic — the thing that made this war expensive
- the thirteen colonies from the pack's own (corrected) boundaries
- a fly-in to Boston, handing off to the existing opening
- sound: a bed, and sea or rigging under the Atlantic crossing. **Not**
  muskets — those belong at Lexington and spending them early costs the
  moment they exist for.

Author and test the cues with captions first; the engine's silent fallback
means the scene works before a word of it is recorded. `tools/narrate.py`
comes last, once the script has stopped moving.
