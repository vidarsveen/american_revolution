# Backlog

Things worth doing, with enough context that picking one up does not mean
re-deriving why. Newest concerns first within each section.

---

## The framework pass — phase 0, the safety net

The app is being generalised into a framework for narrating any historical
subject, with **Rome, episode one: how Octavian came to power** as the scoping
target. Before any of that moves, there had to be something that could tell us
whether it still worked. Phase 0 built it and changed nothing else.

**`dev/engine-lab.html` — rule 1 is now measured, not trusted.** It compares a
*stage signature* between playing forward to `t` and `rebuildTo(t)`, at every
cue time ±40 ms plus a one-second grid: 1303 samples on 19 April, 1233 on
17 June, both clean. `tools/check-engine.py` drives it headless. That baseline
is the thing the pack boundary, the era model and the depth layer must not
move. It also reports two things nobody could see before — anchors that fell
back to the start of their beat (none, in either chapter), and beats whose
picture is identical to the one before.

**Eighteen beats of the Bunker Hill chapter change nothing on the stage**, against
six in 19 April. Not a defect — a beat is allowed to sit still — but eighteen
is the map sitting out a fifth of the chapter, and it is worth a look at which
ones. The lab lists them by id.

**The bench reported five failures before the engine produced one, and every
one of them was the bench.** Worth writing down, because the next lab will be
tempted the same way:

- `over` is derived from `instant` at `engine/scenes/map.js:507`, so comparing
  it reports correct behaviour as a defect.
- `is-instant` is removed on the next animation frame, so whether it is present
  records whether a frame fired, not what is on screen. It landed on the played
  side in one scene and the sought side in the next.
- A one-shot's DOM node always exists. Testing for the node rather than for
  `is-on` reports a correctly hidden note as standing.
- Replaying every cue from zero at each sample time is not "playing forward" —
  it is a rebuild with `instant: false`. It could not have caught an
  accumulation bug, because it wiped the accumulation each time. Two passes:
  one play-through that keeps its state, then the seeks.
- "Settled" has to be measured. A 400 ms wait, and then a quiesce that accepted
  a single unchanged sample, both called a picture finished while a 372 KB
  region file was still parsing — and then blamed the epoch guard. It now waits
  on the geometry actually being there. (Also: `const f = window.fetch; f(…)`
  throws *Illegal invocation*, `ensureRegions()` catches it and **memoises the
  null**, and the regions then never load at all. Use `f.call(window, …)`.)

The first three are named in `CLAUDE.md` next to the lab table, because they
are properties of this engine that any future bench has to know.

**`check-published.py` had never checked three of the files it loads.** Its
import regex was single-line, so `import { … } from './basemap.js'` with the
named list wrapped over two lines was invisible to the walk. `map/basemap.js`,
`map/artifacts.js` and `core/theme.js` were reachable from the app and absent
from the graph, and so were never once compared against the live site. The
walk moved to `tools/graph.py` and handles a wrapped clause.

**`sound.json` was never precached.** Found by generating the list instead of
maintaining it: `engine/scenes/sound.js:68` fetches it at runtime, it was not
in `PRECACHE`, so offline every one of the nine recorded effects fell back to
its synthesised version. Silently, and only offline, which is why nobody heard
it. `tools/build-sw.py` now writes the list and derives `VERSION` from the
contents.

**`core/theme.js` is dead code.** Nothing imports it; `js/main.js:218` and
`map/index.js:1045` each define their own `isDark()` and `reducedMotion()`. It
was precached for nothing and is now not. Phase 1 wants it back — `derivePalette`
needs to know the theme — so the fix is to wire it up and delete the two local
copies, not to delete the file.

## The framework pass — phase 1, the pack boundary

`grep -rn "american-revolution" --include=*.js` went from **31 hits across four
files to zero**, which is better than the acceptance test this backlog set
itself. `content/packs.json` is the registry and it is data; everything the
engine used to know about this subject is now `content/<pack>/pack.json`.

Moved out of code: the chapter list (was an array in `story.js`), the four
faction names and their token map (was duplicated in `engine/scenes/map.js`
**and** `js/map.js`, so adding a subject meant editing the same list twice and
noticing neither), the Boston detail bbox and zoom bounds, `atlantic-10m` —
which was inside `map/basemap.js`, where the grep would never have found it —
Explore's six hardcoded fetches, its 1763–1783 home bounds, and 21
faction-named CSS selectors. Portraits moved from a global `assets/portraits/`
into the pack, because the Roman pack has its own Caesar.

Worth knowing for the next phase:

- **The colours are byte-identical.** A faction declares `token: "--red"` and
  the value is read live, so the theme still flips it and `check-contrast`
  measures the same 11.88 dE between Connecticut and New York that it did
  before. Deriving from a `hue` is there for a pack nobody has tuned yet.
- **`tone` was redefined rather than migrated.** It now means a palette role,
  registered as synthetic factions `tone:red … tone:sage`, so both existing
  chapters kept drawing without a single edit to either script.
- **`--f-<side>` is published on `:root`, and must be referenced as a `var()`.**
  Resolving it to a hex at render time would freeze the colour and stop it
  flipping with the theme.
- **`map.extent` and `map.explore.bounds` are different things.** Padding the
  explore bounds and calling it the extent rejected Paris, Versailles and
  Flamborough Head as bad coordinates. Where the camera opens is not where the
  subject happens.
- **`sw.js` still contains the pack name**, ~22 times, because the precache is
  a list of paths. It is generated from `packs.json` by `tools/build-sw.py`, so
  it is data rather than knowledge — a new pack appears there by running the
  tool, not by editing it.
- **`js/sheet.js` still reads `britishForces` / `americanForces` off an event.**
  That is the Explore *content schema*, not the palette, and generalising it is
  a separate job from this one.

---

## The framework pass — a second subject, brought forward

Rome was planned last, on a finished framework. It was pulled forward instead,
on the argument that phases 4–6 were all being designed for a subject that did
not exist — and if the boundary was wrong somewhere, finding out after three
more phases of building on it would cost far more.

That argument was right. **A second pack found six defects in one afternoon,
five of them in the framework and none of them findable from the Revolution.**

- **`play()` hung for ever on a chapter with no audio.** `audio.play()` on an
  element with no `src` returns a promise that never settles, so awaiting it
  parked the player on the first frame with `playing` false and nothing said
  why. That is rule 3 — audio failing is not the app failing — broken for the
  one case nobody had: a pack still being authored. Now an unrecorded scene
  goes straight to the timer, which is also what makes the documented
  authoring order (cues first, narration last) actually possible.
- **An unnarrated chapter compiled to a duration of zero.** Every beat started
  at 0 and lasted 0. Beats without a recording are now laid end to end with a
  duration estimated from their word count at the pack's speaking rate. It is
  an estimate and the captions cannot highlight word by word, but the chapter
  RUNS — the difference between a draft you can watch and one you cannot.
- **`map.fitPlaces` with ONE place fitted a point**, so the camera went to the
  frame ceiling and sat on top of a single town at zoom nine. Found by aiming
  a whole-Mediterranean establishing shot at one pseudo-place. Fitting one
  place now means flying to it at its declared zoom.
- **`check-contrast.py` hardcoded scene 0**, which was true for exactly as long
  as every pack's sample beat happened to be in the first scene. It also never
  OPENED the pack's chapter — it sampled whichever one the cover loaded, so it
  would have measured the American Revolution while reporting on Rome.
- **The neighbour-contrast rule was wrong, not just its plumbing.** It demanded
  every bordering pair be distinguishable. Thirteen colonies are all one side
  and must be told apart; Antony's five eastern provinces are also one side and
  must NOT be — `vary: false` says the shot is about the side, not the areas.
  The check now reads what the chapter actually drew and only compares pairs
  that are supposed to differ. Measuring a deliberate design decision as a
  defect is worse than not measuring it.
- **The engine probed for timing files that were never recorded**, logging four
  404s per load. `pack.json` now declares `langs` per chapter, and an empty
  list means "not narrated yet — run it on the timer".

What held up without a change: the pack registry, `derivePalette`'s hue path
(seven factions, none of them tuned by hand), `registerLevels`, the depth
pools, `term.mark`, the era model with Julian BC dates, and `build-sw.py`.
`grep -rn "american-revolution" --include=*.js` is still zero.

**What Rome is right now:** a scaffold. Two scenes, no narration, fifteen
schematic provinces (modern outlines grouped and renamed — see the header of
`tools/build-provinces.py`), eight people, four terms, three topics, no
portraits. It runs, it is checked by every tool, and it proves the boundary.
It is not a chapter anybody should watch to learn history yet.

Still to do: sources and certainty, `spoken`/`lexicon.json` for Latin names
(untested and needed — `nb-NO-FinnNeural` on "Brundisium" is unheard), the six
new verbs, and then Rome's remaining six scenes and its narration.
The plan is in `.claude/plans/`.

---

## Licence: the build is commercially usable

**Every generated sound effect is Apache 2.0.** They come from
MOSS-SoundEffect v2.0 (OpenMOSS) — the LICENSE file in the OpenMOSS/MOSS-TTS
repository is the real Apache text, and `moss_soundeffect_v2/pyproject.toml`
declares it independently. No revenue threshold, no attribution obligation.
We credit it in `sound.json` anyway, because a build should always be able to
say where its assets came from.

This replaced Meta's AudioGen, whose *weights* are CC-BY-NC 4.0. That licence
restricts using the model at all for commercial ends, so it would have made
the whole build non-commercial. Several blogs claim AudioCraft is Apache 2.0;
its repository says otherwise. **Check the LICENSE file, not a summary of it.**

MOSS nearly got written off as needing a 24 GB card. It does not — see the
comment in `open_moss()` in `tools/gen-sound.py`. The weights load at 10.6 GB
because `from_pretrained` silently ignores `torch_dtype` for the DiT and the
VAE; Windows then spills the excess into system RAM and the card crawls at
80 s per denoising step while reporting 100% utilisation at idle power. One
`.to(bfloat16)` on the DiT parameters takes it to 7.8 GB and 1.4 s/step.

**The synthesised catalogue stays.** It is the zero-dependency fallback, it
needs no model and no download, and a pack entry only overrides it. Delete an
entry from `content/<pack>/sound.json` and the synthesised effect returns.
Four names — `oars`, `wading`, `fire`, `doorKnock` — have no synthesised
version and would fall silent instead, which is safe but is a real difference.

**One image is tagged "No restrictions", not "Public domain".**
`content/american-revolution/media/old-north.jpg` is an 1878 book plate, so it
is out of copyright by age, but Commons tags it with the Flickr Commons
"no known copyright restrictions" label rather than an explicit PD tag.
`tools/fetch-media.py` prints a warning for exactly this case. Left in
deliberately; worth a second look before any commercial use.

**The portraits have no provenance record — the original 32, anyway.**
Those files arrived with no source list, unlike `content/<pack>/media/`, which
is rebuilt from `media-sources.json` and carries artist, licence and source URL
per image. `tools/fetch-media.py --portraits` now does the same job for faces,
reading `portrait-sources.json` and writing `portraits.json`, and the four
added for Bunker Hill went through it. The original 32 are still unrecorded and
cannot be reconstructed by looking at a JPEG; they want an afternoon with
Commons and a reverse image search.

One of the four is **CC0 rather than public-domain-by-age**:
`william-prescott.jpg` is a 2015 photograph of the 1881 statue, because no
portrait of Prescott was ever painted. CC0 is a public-domain dedication and
carries no obligation, so this is a note rather than a problem — but it is not
the same tag as everything around it, and `portrait-sources.json` says so.

---

## Open, from the 9 August review pass

None of these are bugs. They are judgement calls I did not want to make alone.

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

**Explore's eight strategic routes are lines, not arrows.** They would read
far better as army arrows, which needs a troop number per route — Arnold to
Quebec, Burgoyne south, the march to Yorktown. I did not want to invent those
figures.

**The chapter has no ending.** It stops on the last beat and returns to the
cover. A held final card — the arc around Boston, the date, the toll — would
land it.

---

## From the second chapter, 10 August

Adding **17 June 1775** exercised the engine as a *framework* for the first
time, which is where it was weakest. Four things it found:

**A scene change wipes the stage, so nothing standing survives it.** That is
the rule that makes seeking correct and it is written down, but writing a
second chapter is what makes you feel it: scene three opened on a fleet
shelling a redoubt that was not drawn, and the first British assault was a red
arrow pointing at empty grass — the North Bridge defect again, one chapter
later. Every scene now re-establishes the line it inherits at `start`. It is
the single easiest thing to get wrong when authoring, and `check-script.py`
cannot see it: a beat that mentions the redoubt and a stage with no redoubt on
it are both perfectly valid.

**Module-level caches assumed one chapter per page load.** `regionsReady` in
`engine/scenes/map.js` memoises a fetch whose `.then` calls `useRegions()` on
whichever map existed when it started. Switch chapters and the second map is
handed nothing — the closing shot named three colonies and coloured none of
them, with the file fetched and a 200 in the network panel. Cleared in
`mountMap` now. Worth a sweep for others the day a third chapter lands.

**Timings and audio were keyed by pack, not by chapter.** Scene ids restart at
`s0` in every chapter, so `timing.no.json` and `audio/no/s3.mp3` would have had
chapter two overwriting chapter one, silently, because a timing file for the
wrong chapter still parses and still has an `s0`. Now
`timing.<chapter>.<lang>.json` and `audio/<lang>/<chapter>/<scene>.mp3`.

**`tools/shoot.py` had a stale scene index beside every beat id.** They drifted
apart the day scene 0 was added, so `s3-77` shot scene 2 and the contact sheet
labelled Dawes riding out as "seventy-seven against seven hundred". Nobody
noticed for months, because a sheet with a plausible picture under every
caption looks right. The index is derived from the beat id now, and the table
covers both chapters.

Still open from it:

**The cover's chapter list fetches whole chapters to learn their names.** Two
files, ~200 KB, after the cover is already up and not awaited — fine at two
chapters and wrong at ten. The real answer is a `pack.json` listing narrated
chapters with their titles, which is the "pack boundary" item below.

**Nobody has listened to the new chapter.** The levels were set by eye from the
first chapter's numbers: `bedSolemn` at -7, `bedUrgent` at -6/-7, `cannon` at
-5 for the opening broadside and -9 for the sustained bombardment, the beach
volley at -6 over six muskets at -11. Three cannon and a volley inside twenty
seconds is more ordnance than the first chapter fires in eleven minutes.

## Sound — the 9 August pass

Listened to on 8 August, rebuilt on 9 August. What was wrong and what was
done, because "improved the bells" is not a thing anyone can check later.

| Effect | Was | Now |
|---|---|---|
| `alarmBell` | Nine strikes in three seconds, 214 Hz, eight pure sines with independent decays. A hand bell on a table, and closer to a synth pad than a bell. | Six strikes about a second apart, 294 Hz, and every partial is a **pair** a fraction of a hertz apart. That beating is where a bell's shimmer comes from and it was the missing ingredient. Plus a real strike transient — a bell is hit with several kilos of iron and for thirty milliseconds that is all you hear. |
| `churchBell` | Same body, tolling. Unused. | Same rebuild, 233 Hz, two strikes 3.7 s apart, 13 s to ring out. |
| `wind` | One sine LFO on level, another on cutoff, at different rates. Breathed on a perfect cycle, and nothing in nature modulates brightness and loudness independently. | Three layers — rumble, body, edge — all driven from **one** `wobble()` curve, so a gust arrives as a single event: louder, brighter and thinner at once. `wobble()` sums sinusoids at whole-number cycles per loop, so it wanders and still joins itself exactly at the seam. |
| `hooves` | 0.60 s stride: a racing gallop, frantic under a calm sentence. | 0.82 s, a hand canter, with the footfall pattern stretched proportionally and the stride length breathing a few percent so it is not a metronome. |
| `crowd` | One 480 Hz noise band with evenly-scattered blips. Read as static. | Two bands (chest and mouth), and the blips come in **clumps** — people talk in bursts and then everyone stops at once. |
| `rigging` | Barely audible. | A level problem, as suspected: the bed was mostly very quiet wind, so RMS normalisation tried to lift it and the peak of one hard block-knock capped the gain for the whole buffer. Louder wind, softer knocks, RMS back in charge. Measured 0.1100 against wind's 0.1041. |

Still unlistened-to by ear in context: `drums`, `fife`, `boots`, `rain`, `sea`.

**Escape hatch unchanged.** A pack can ship a real recording:
`content/<pack>/sound.json` takes file-based entries with mandatory `licence`
and `credit`, and `tools/check-script.py` validates them. Synthesis is the
default, not a constraint.

---

## Done

- **Two cue arguments were being read by nobody.** `marker.show kind` and
  `place.highlight tone` had been in the chapter for months. Neither was
  declared in `verbs.json` nor read by `scenes/map.js`, so every pin drew
  British-red, every "red" ring drew gold, and no battle glyph ever appeared —
  which is most of why Lexington and the North Bridge had nothing to follow.
  `check-script.py` now rejects a cue carrying an argument the manifest does
  not declare, and checks enum values, so this exact failure cannot recur.
- **Every stat chip was drawn behind the caption.** `.ov-deck--lower` and
  `.story__caption-slot` were both anchored to the transport and the caption
  sits on a higher layer. Seventy-seven against seven hundred, the eight dead
  on the green, the casualty counts — all present, none visible.
  `engine/captions.js` now publishes `--caption-h` the way the transport
  publishes its own height, and the stats deck clears it.
- **The chapter's sound did not stop when the chapter did.** Stopping the
  sound clock only stops the ducker; music and ambience are looping sources
  that carry on by themselves. The bed played on under the cover card, and
  under Explore after switching tabs. Finish is a real stop now, pause
  suspends the context, and resume brings it back.
- **`front.show` exists.** The map module had drawn fronts since it was
  written and no cue could ask for one. An arrow says these people moved; a
  front says they stood there and faced something, which is the only honest
  shape for seventy-seven men on a village green.
- **The episode list.** Eight scenes with number, title, clock and duration,
  one tap from the minimised transport. The rail inside the expanded controls
  was the only way to change scene, it carried no labels, and it folded itself
  away after 3.6 seconds — so in practice the chapter had no navigation.
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

- Nothing outstanding. Explore came off Leaflet and `vendor/` is gone; the
  soundscape is driven from a 100 ms interval in `engine/story.js`, not from
  the player's `onTick`, for the reason this entry used to give — `onTick`
  only fires when the beat or word changes, so the ducker would stall for up
  to a second between beats.

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
