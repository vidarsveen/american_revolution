# Making a lesson worth watching

`planning.md` decides whether there is a course. `authoring.md` says how to type a
chapter. **Neither says how to make one anybody would want to watch**, and that is the
level this file is missing from the repo.

It exists because a chapter was written that passed every check in the build and was
read as *"so unengaging and boring ... it's really not there"*. Nothing was broken. The
prose was accurate, the cues were valid, the rule-1 bench was green. It was simply not
worth five minutes of anybody's attention, and no tool and no document in this repo was
in a position to say so.

---

## What this framework is for

A person can now be handed a short, genuinely engaging lesson — one chapter or eight —
about a subject that used to be hard to get into. Not a summary, not a slide deck: a
thing you sit through willingly and come out of able to read something you could not
read before.

**Being engaging is therefore not polish applied at the end. It is the work.** A
correct chapter that nobody finishes has failed at the only thing it was for.

---

## The evidence this file is built on

Two measured chapters in this repo, and the outside literature where the repo has
nothing to measure.

The internal comparison is `beer/chapter-1-fire-ting` (the best thing here) against
`football/chapter-1-baklengs` (the failure that prompted this file). Same engine, same
tooling, same author. Real seconds, from the timing files:

| | beer ch1 | football ch1 |
|---|---|---|
| new full-frame picture every | **24.1 s** | **67.0 s** |
| longest stretch with no frame change | 32.2 s | **87.0 s** |
| distinct pictures | 22 plates + 2 charts | **0** |
| numbers spoken / numbers shown | 6 / 6 | **5 / 0** |
| `sound.music` cues | 6, with one scene silent by choice | **0** |
| distinct frame states | 24 | **1** |
| surfaces carrying the frame | 3 | **1** (84% of all cues) |
| frame-weight cues | 56% | **10%** |
| opening | picture + number + bed on word one | an empty green rectangle |

The football chapter has the **higher** cue rate — 8.78 a minute against 6.78. It is
busy and static at the same time, which is the worst combination available.

**And beer is 80%, not 100%.** It is beautifully shot exposition with nothing at stake
and no through-line: seven scenes that could be watched in any order. Copying it gets
you to 80. Rules 2 and 3 below are what it does not have.

---

## Twelve rules, in the order they fail

### 1. The first fifteen seconds

Open on a thing, a person, a number, or a decision somebody has to make. Never on the
artefact, and never on an empty stage.

    NO   "Dette er et kurs om moderne fotballtaktikk."
         (the only beat in three chapters that is about the course rather than
          the subject, over a pitch with nobody on it)

    YES  "Øl er fire ting." {a picture of the four} {a chip saying 4}
         "Tre av dem kan du veie opp på en kjøkkenvekt. Den fjerde er i live."
         (the thesis lands at 11.1 s, inside beat two)

`docs/design-direction.md` already says the visual half of this — *"the first beat opens
on a picture, not on a map: a map with nothing on it yet is a screen waiting to be told
what it is for."* An empty pitch, an empty chart and an unlabelled diagram are all that
screen.

Then **state the promise**: what the viewer will be able to do afterwards that they
cannot do now. One sentence. It is the only reason to keep watching a subject you do
not yet care about.

### 2. A curiosity chain, not a syllabus

One broad question, broken into sequential ones, where each answer opens the next.
That is what makes eight chapters a course instead of eight files
([documentary structure][doc1], [Journalism University][doc2]).

The test is at the seam: **the last beat of every chapter should make the next chapter's
question unavoidable**, and the first beat should answer something the last one raised.
A chapter list where the order is arbitrary is a syllabus, and a syllabus is a
table of contents with narration over it.

### 3. Stakes, and something to come back to

Something must be at issue. An abstract thesis — *"there is no dominant strategy"* — is
true, defensible and inert, because nothing turns on it.

A concrete recurring situation beats it every time: a decision a named person had to
make, with a cost either way, that the course returns to and finally answers. It gives
the viewer a reason to hold the material rather than merely receive it.

This is the rule beer does not follow and it is why beer is 80. Its seven scenes are
seven correct explanations. Nothing is ever at risk.

### 4. Change the frame every 20 to 30 seconds

Not the *cues* — the thing that fills the screen. The engine's own bounds already say
this: a plate is legal for 6 to 34 seconds (`PLATE_FLOOR`, `PLATE_CEILING`), and the
beer median is 24. Football's pitch held for 47 to 87 seconds, two to three times the
ceiling the engine sets for any one image.

`tools/check-rhythm.py` gates the median at 30 s and the worst stretch at 45 s.

A drawing surface — a map, a pitch, a chart — is not exempt. It is one image. Cropping
it, moving the camera, or changing what is on it all count; leaving it standing while
the voice runs does not.

### 5. The pictures have to be different pictures

This rule was first written as *"one surface cannot carry a chapter"*, with a gate at
75%, and **the good course immediately disproved it**: beer puts 82 to 94% of its frame
on `plate` and is the best thing in the repo. Surface share is not the defect.

The defect is **sameness**. Beer's 22 plates are 22 different photographs. The football
chapter's frame changed five times and every one of them was the same empty pitch being
called up again at the top of a scene: one picture, 342 seconds.

So the gate counts **distinct frame states**, and asks for one every 45 seconds. That is
the honest version of what rule 5 was reaching for, and the recalibration is worth
keeping in mind whenever a threshold here is set: **calibrate against the thing that
works, and let it veto you.**

The craft advice underneath survives, and it is still worth following. Every surface has
a register it is good at — pictures carry atmosphere and objects, the map and the pitch
carry relationships, a chart carries a comparison, a chip carries a number, a fact box
carries a definition without stopping anything. A chapter that uses one of them is
speaking in one tone of voice for ten minutes, which is how the football chapter ended
up with four surfaces mounted and idle in its own pack.

### 6. Say where to look

The [signalling principle][may1]: attention has to be directed, or the viewer spends
their working memory finding the thing instead of understanding it
([CBE—Life Sciences Education][may2]).

Concretely, and these are cheap:

- **Every number spoken gets a chip.** Football spoke *2.2 goals a game*, *1992*, *four
  against three* and showed none of them. Beer raised six chips and cleared all six.
- **Everything named on a drawing surface gets raised, and the rest gets dimmed.** When
  the narration said *"somebody behind is now free"*, the screen showed twenty-two
  identical dots and pointed at none of them.
- **A term that carries a beat gets a fact box**, not only a marked word.
  `design-direction.md` says why: *"term.mark made the word tappable and almost nobody
  taps while a voice is running."*

### 7. One scene is one idea

60 to 120 seconds. The [segmenting principle][may1]: people take new material in
digestible units with a break between them, and the scene turn is that break.

A scene that needs three ideas is three scenes. A scene under 45 seconds is usually a
paragraph that got promoted.

### 8. Rhythm is made of short beats after long ones

Beer ch1's median beat is 6.5 s, minimum 2.8, maximum 10.7. The short ones are doing
work:

    {plate.hide} {plate estere-frukt} {fact term:ester} Banan. Pære. Eple. Litt nellik.

Three words, 2.4 seconds, on a new picture, after two beats of 8.7 and 6.4. That is
punctuation, and it is why the paragraph before it lands.

Football's shortest beats were short *sentences*; its longest was forty words. Long
beats should be held moments, not long sentences — a sentence that needs forty words is
two sentences.

The paragraph break is the metre and you never type it: a blank line compiles to 1.35 s
of air instead of 0.9, and the last beat of a scene gets 2.0. Beer spends 14 to 16% of
its running time in silence.

### 9. Silence is an instrument, and you have to own one to play it

Beer ch1 runs a bed under six of seven scenes and drops it for the scene where the
fourth ingredient turns out to be alive — with the reason written into the script as a
comment. That drop is the loudest thing in the chapter.

Football had no bed at all, so it had no lever, and 5 minutes 35 of unaccompanied voice.
A chapter with no music does not sound austere. It sounds unfinished.

`sound/library.js` ships beds that need no pack file at all. There is no excuse.

### 10. Vary the scene-opening gesture

Beer ch2's seven scenes open with: plate / plate / flyTo+marker / flyTo+marker /
flyTo+marker+bed / plate / plate. Football's five scenes open with the identical
three-cue gesture, five times out of five. By the third the viewer has stopped
registering the scene change as an event.

### 11. Nothing arrives in the last beat

Already in `design-direction.md` §4, restated here because it is dramaturgy and not
layout: *"nothing arrives in the last beat. No `plate.show`, no `marker.show`, no
`stat.show` — only hides and clears."* A chapter whose final sentence competes with
something appearing has no ending to give.

Beer closes 7 of 7 scenes on a beat with no cues at all, holding the picture through
2.0 s of silence.

### 12. A chapter is an argument, not an inventory

The rule from `CLAUDE.md`, and the mechanical test: **if two paragraphs could swap
places without loss, it is a list and it is wrong.** An argument does not survive
shuffling.

A glossary read aloud is still a glossary at any length, and the tappable glossary
already exists for the viewer who wants to look something up.

---

## How this is enforced

    python tools/check-rhythm.py        # rules 4, 5 and part of 1, measured
    python tools/check-cover.py         # is the screen ever empty
    python tools/check-script.py <ch>   # the picture-over-animation rules

`check-rhythm.py` gates four things and reports the rest, because a tool that fails on
judgement gets turned off. What it cannot see is rules 2, 3 and 12 — the curiosity
chain, the stakes, and whether the thing is an argument. Those are read by a person,
and the reason this file is prose rather than a schema.

**And look at it.** Both of the worst defects in the pitch surface were invisible to
every assertion and obvious in one screenshot at phone size.

[doc1]: https://blog.celtx.com/how-to-write-a-documentary-script/
[doc2]: https://journalism.university/electronic-media/engaging-documentary-script-writing/
[may1]: https://www.digitallearninginstitute.com/blog/mayers-principles-multimedia-learning
[may2]: https://www.lifescied.org/doi/10.1187/cbe.16-03-0125
