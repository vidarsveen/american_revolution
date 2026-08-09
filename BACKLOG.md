# Backlog

Things worth doing, with enough context that picking one up does not mean
re-deriving why. Newest concerns first within each section.

---

## Open, from the 9 August review pass

None of these are bugs. They are judgement calls I did not want to make alone,
and one piece of research I would not invent.

**The quote card does two different jobs and looks the same doing both.** Six
of the seven quotes are somebody's words — Gage, Percy, Parker, Pitcairn,
Hosmer, Buttrick. The seventh, "no taxation without representation", is an
idea nobody in particular said. A reader has no way to tell those apart. A
variant style for a slogan would fix it; I left them identical rather than
guess which way you want it to go.

**Held beats are not usable yet.** The `pause` verb is implemented in the
player and unused, because its only affordance is a gold ring around the
transport — on a phone that reads as "frozen", not as "deliberate". It wants a
visible "tap to continue" before any chapter leans on it. The obvious place is
"nobody has ever been able to say who fired".

**Music placement is unheard.** Scene two gets `bedMarch` for urgency, but
Revere crossing the river past a warship with muffled oars may want
`bedSolemn`. Levels are untested by ear: bed at -14 dB, duck -12, and the
muskets at s2.b5 are -7. All single numbers.

**Scene three beat two is still the thinnest in the chapter.** "On the green
in the middle of Lexington stands a cluster of men" — sixteen seconds over
ground that has a road and some woods on it and nothing else. It wants a
period image of the green, or a device this chapter does not have yet.

**Explore's eight strategic routes are lines, not arrows.** They would read
far better as army arrows, which needs a troop number per route — Arnold to
Quebec, Burgoyne south, the march to Yorktown. I did not want to invent those
figures.

**The chapter has no ending.** It stops on the last beat and returns to the
cover. A held final card — the arc around Boston, the date, the toll — would
land it.

---

## Sound — needs another pass

Listened to on 8 August. Verdict: most of the library is usable, three are not.

| Effect | Verdict | Likely cause |
|---|---|---|
| `churchBell` | **bad**, and now unused | Eight inharmonic partials with independent decays. Probably too many partials and too clean a strike — a real bell has a hard transient and a much longer, beating tail. The chapter calls `alarmBell` instead, which passed and is the more accurate word anyway: those bells were rung as an alarm that night. |
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

## Done

- **The cue vocabulary is now one file** — `engine/verbs.json`, read by
  `engine/stage.js` (which cross-checks its handler table at boot on
  localhost) and by `tools/check-script.py` (which drives its reference
  integrity checks from the declared argument types). Removing a verb from
  the manifest now fails the validator instead of silently doing nothing in
  the browser. Adding a verb with a `place` argument gets its reference check
  for free. Still to do: generate the lab control panels from it.
- **`geo/colonies.geojson` is no longer anachronistic** — rebuilt by
  `tools/build-colonies.py` as thirteen units dissolved from modern states.

---

## Content

**Colonial boundaries are still an approximation.** `build-colonies.py` now
gives thirteen historically-grouped units, but they are modern state outlines
dissolved together, not 1775 survey lines. Charters ran to vague western
limits and several overlapped. Good enough to say "the thirteen colonies"
honestly; not good enough to argue a border dispute from.

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

## Done: the establishing chapter

Shipped as scene 0 of the 19 April chapter — "Before any of this", nine beats,
1763 to 1775. What follows is the brief it was built to.

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
