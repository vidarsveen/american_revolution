# Backlog

Things worth doing, with enough context that picking one up does not mean
re-deriving why. Newest concerns first within each section.

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

**The portraits have no provenance record.** All 32 files in
`assets/portraits/` arrived with no source list, unlike
`content/<pack>/media/`, which is rebuilt from `media-sources.json` and
carries artist, licence and source URL per image. A `portrait-sources.json` in
the same shape would close it.

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

**An army arrow at street zoom is still too big.** `widthForStrength` models
an arrow as ground it stands on, which is right at theatre zoom and absurd at
14: four hundred militia crossing a hundred metres of bridge asked for a
350 m-wide ribbon. `arrowPath` caps the width at 13% of the march's own
length, which stops it being a lozenge but not being enormous. The bridge
scene was pulled back from zoom 14.2 to 13.5 to dodge it. A real fix probably
bounds the arrow against the viewport, which artifacts.js cannot currently
see.

**Explore's eight strategic routes are lines, not arrows.** They would read
far better as army arrows, which needs a troop number per route — Arnold to
Quebec, Burgoyne south, the march to Yorktown. I did not want to invent those
figures.

**The chapter has no ending.** It stops on the last beat and returns to the
cover. A held final card — the arc around Boston, the date, the toll — would
land it.

---

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
