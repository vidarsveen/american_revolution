# Design direction

**A documentary you can walk into.** Ken Burns pacing. A narrator you trust. Motion that is
slow, rare and always meaningful. Type with one editorial voice. A score that carries a scene
rather than decorating it, and silence used on purpose. The narrator sets the pace; you may
pause. You are a viewer who can lean in — interaction is offered, never demanded.

That is the ambition. This file is the standard: the numbers that ambition turns into, so a
later change can be measured instead of argued about. Everything below is derived from two
things that are already true of the app and are not up for negotiation:

- **The unit of the film is a spoken sentence.** Measured across three chapters: a median beat
  is 8.3–9.5 s, with 0.9–1.25 s of air after it. Nothing on screen may be faster than a
  sentence can be understood or slower than a sentence lasts.
- **The slow end is the plate drift, 14 s** (`engine/scenes/plate.js:206`). It is the anchor at
  the top. A 320 ms scene card (`engine/transition.js:40`) is from a different film.

Today the app has four different answers to "how long does a thing take to arrive" — 220, 320,
420 and 900 ms — and none of them was derived from anything. That is what this replaces.

---

## 1. Motion: one scale, six numbers

Every duration in the app comes from this table. A duration written in a stylesheet or a module
that is not one of these tokens is a defect.

| token | value | its job |
|---|---|---|
| `--t-tap` | `160ms` | the app answering a finger. Chrome only: a button, a toggle, a sheet handle. Never appears on the stage. |
| `--t-enter` | `900ms` | a thing arriving on the stage: a card, a pin, a number, a fact box, a ring, a label. |
| `--t-exit` | `600ms` | the same thing leaving. |
| `--t-dissolve` | `1200ms` | one thing replacing another across the whole frame: a plate over the map, a plate over a plate, the map back. |
| `--t-turn` | `1200ms` | the scene turning over — the veil closing, and the veil lifting. |
| `--t-drift` | `14s` | the slow push on a still. |

Easings: **`--ease-out` for anything arriving or leaving**, because a thing that arrives should
decelerate into place; **`--ease-in-out` for anything crossing the whole frame** — a dissolve, a
turn, a camera flight — because it has a middle as well as two ends. There is no third easing.

**Why 900 ms.** The plate fade is 900 ms (`css/story.css:1251-1256`) and it is the one arrival
nobody has complained about, so it is the gesture the rest joins. It is also about a tenth of a
beat: a picture that arrives in 900 ms is complete before the clause that named it is finished,
and one that took 1.8 s would arrive after its own sentence. **600 ms out** is two thirds of
that — you stop looking at a thing before it is gone, but 420 ms reads as a cut.

**Why a dissolve and a turn are the same number.** They are the same event at two scales: the
whole frame becoming something else. `engine/scenes/plate.js:256` already cross-dissolves at
1.1 s and it reads correctly; 1200 makes it the scale's number instead of a loose one.

### Chrome

The table gives chrome one duration, and chrome has two kinds of change. Stated here so it
adds no numbers:

- **A control answering a finger** — a hover, a press, a colour, a chevron turning — is
  `--t-tap`. That is every use of the old `--t-fast`.
- **A chrome surface arriving or leaving** — the library sheet, the dossier, the chooser, the
  transport expanding — is still a thing arriving, so it is `--t-enter` / `--t-exit` like
  anything else. A sheet that pauses the film is a deliberate act and may look like one; it is
  the film's own gesture, not a faster one borrowed from an operating system.

There is no third case. If a chrome rule needs a duration that is neither, the rule is wrong.

Two derived numbers, stated in terms of the scale rather than added to it:

- **The ground's colour** (`map.mood`, `css/atlas.css:288-294`) changes over **2 × `--t-turn`** =
  2400 ms. The ground is not an object arriving; it is the light changing, and it must stay
  below noticing.
- **A camera flight** is a distance, not a duration. Keep `autoOver()` (`map/index.js:806-813`)
  and its cubic in-out, but clamp it to **1.4 s – 6 s** (currently 0.9 – 7). Below 1.4 s a fly
  is a cut and the eye loses the ground; above 6 s it is two thirds of a sentence spent
  travelling. `flyOver` stays 2.8 s.

Everything else that already has a duration — a march drawing itself at 2.6 s, a front at 1.6 s,
a converge at 3.2 s, a region wash at 1.2 s — is **information unfolding, not a transition**. It
keeps its own `over`, because the time it takes is part of what it says. It is bounded by
`check_animations_finish` in `tools/check-script.py`, and that is the right bound.

### The scene turn, in full

The join between two scenes is the most-used device in the app and it currently gets 320 ms.
Prescribed:

```
t = 0       scene changes. The veil begins to close.               --t-turn   (1200 ms)
t = 1200    the veil is opaque. NOW the stage is rebuilt.
            The card is at rest: clock line, then title.
t = 2800    the veil begins to lift, and the narrator speaks.      --t-turn   (1200 ms)
t = 4000    the veil is gone. The card went with it.
```

`LEAD_IN_MS` becomes **2800 ms** (from 900). Hold becomes **1600 ms** (from 2600). The card is
fully legible for 1.6 s and readable through both ramps — about 2.6 s, which is the same floor
`tools/check-script.py:109` puts on a portrait's name and role. Total device 4.0 s, against 3.62
today: the silence triples, the length barely moves.

Two things this fixes that are bugs, not taste. **The stage is rebuilt at 1200 ms, not at 0.**
`engine/story.js:193` calls `mapScene()` before `announce()`, so today the map cut happens with
no veil over it at all — the device exists and the thing it exists to hide is in front of it.
And **the card does not translate** (`css/story.css:1149-1152`): it fades with the veil, because
it is part of the veil, not a widget landing on it.

### What is allowed to move

Allowed, and nothing else:

1. **Opacity.** Everything on the stage arrives and leaves by fading. This is the default and
   needs no argument.
2. **The camera.** It carries the viewer somewhere.
3. **The drift** on a still.
4. **A line drawing itself** — a march, a front, a road, a converge, a fleet. The shape over
   time *is* the information.
5. **A bar growing** (`compare.show`), because the ratio is the information.

Forbidden, with the reason:

- **Nothing on the stage translates or scales on entry.** `translateY` on `.ov-note`,
  `.ov-image`, `.ov-portrait`, the caption line and the stat chip; `scale(.4)` on `mk-pop`,
  `scale(.9)` on `chip-in`, `scale(.97)` on the portrait and the quote. A card that slides in is
  a UI mannerism; a card that fades in is film.
- **Nothing overshoots.** `--ease-spring` is deleted from `css/tokens.css:128`. A pin that pops
  past its size and settles back is a notification, not a place on a map.
- **No infinite animation.** `atlas-ping` (`css/atlas.css:391-421`) runs forever, and a pulse that
  never stops stops meaning "look here" after the second cycle — after that it is just the map
  twitching for the rest of the scene. It runs **three times and stops**: 3 × 2.8 s = 8.4 s,
  which is one sentence, which is how long the highlight is about anything.
- **No transition on `filter`.** Blur was measured at 39 ms per frame; see CLAUDE.md.
- **Nothing moves that was not cued.** There is no ambient motion between sentences.

One exception, stated so it is not mistaken for drift: **the caption cuts.** It carries the
words and the words start immediately, so `cap-in` (`css/story.css:544`) goes — no fade, no
slide. The per-word colour change stays at **120 ms linear** (`css/story.css:546`): it is locked
to speech, not to the motion scale, and it is the only sub-200 ms number left in the app.

### Under `prefers-reduced-motion: reduce`

The concern is vestibular — movement, not change. So a fade stays a fade, and only motion
through space goes:

- `--t-drift: 0s`. The plate lands on its end framing, exactly as `instant` does.
- The camera does not fly: `map.flyTo` cuts.
- Every other token keeps its value; they are all cross-fades now, and cross-fades are safe.
- **The scene card still appears.** `engine/transition.js:102` and `css/story.css:1173-1175`
  currently suppress it entirely — but `LEAD_IN_MS` still runs, so a reduced-motion viewer gets
  2.8 s of nothing and never learns the scene changed. The card cuts in, holds 1600 ms, cuts
  out. The title and the clock are information; only the fade was decoration.

### Under `instant: true`

Every duration is zero and the picture is the end state. This is rule 1, measured by
`dev/engine-lab.html`, so it needs no new prose — but note that the turn never runs at all. A
seek into a scene is not that scene opening; the `at > 1.5` guard in `engine/transition.js:96`
already says so and stays.

---

## 2. Type

Two families, two jobs. **Display (Fraunces) names things. Body (system-ui) explains them.** A
name, a title, a number and a quotation are display. A sentence anyone has to read — the
caption, the transcript, a hook, a library entry — is body.

Every size comes from the scale, and each step has one job:

**Read the STEP, not the pixel.** The px column below is what the step resolves to at 390 wide
today; the whole scale moved up a notch once, and every number written down anywhere else went
stale in an afternoon. A rule in this document names `--fs-sm`; it does not name 15.

| step | px @390 | job |
|---|---|---|
| `--fs-3xs` | 11 | Provenance only: a credit, a licence, a made-mark. **Never a sentence.** |
| `--fs-2xs` | 12 | a kicker: the small word above a thing saying what kind of thing it is — a scene clock, "Ord", "Drue". Also a **town** name on the map. |
| `--fs-xs` | 13 | a secondary line inside a card: a role, a fact box's hook. |
| `--fs-sm` | 15 | a card's name line. A **city** name on the map, and a pinned place. |
| `--fs-base` | 17 | body text: library, transcript. And an **area** name on the map — which is not body text, but is the step above a city, which is what an area name has to be. |
| `--fs-md` | 19–24 | the caption, and only the caption. **Viewport-relative**, because it is a subtitle: broadcast practice sizes a subtitle as a share of screen height, and at a flat 17 it was 2.01 % of an 844 px phone against a 2.5–3 % norm. That is why "the text is too small" kept coming back. |
| `--fs-lg` | clamp | a quotation. A stat chip's number. |
| `--fs-xl` | clamp | a scene title, on the card and nowhere else. |
| `--fs-2xl` | clamp | the chapter title. Once, on the cover. |

`--fs-3xs` must be **defined** — `css/story.css:1393` already reads `var(--fs-3xs, var(--fs-2xs))`
against a token that exists nowhere.

**A literal font size in a stylesheet is a defect.** There were **34** across `css/`; there are
now **11**, and every one of those is in a file frozen with Explore
(`timeline.css`, `sheet.css`, `map.css`, `dossier.css`). The nine-and-a-half-pixel stat label
under a 1.45rem number was the worst of them and was the whole of "the stats look mediocre".

Note the count in this paragraph used to say "thirteen of them in `css/story.css`" and it was
twelve — the thirteenth, `10.5px`, is in `css/atlas.css`. A number in a document nobody
recomputes is the same defect the document is about.

### A label is not a watermark

This is the rule the region label fails, and it is the one type rule worth memorising.

> **A label is a name attached to a thing.** It has a referent you can point at, and it must
> read as text: mixed case, upright, tracking at or below 0.02em, at the size of the thing's
> importance, in full label ink with a halo.
>
> **A watermark is type used as texture** — wide-tracked, uppercase, italic, faded. It says
> "this is a decorative surface", not "this thing is called X".
>
> **The map has no watermarks.** Every piece of type on the map is a label.

`.atlas-place--region` (`css/atlas.css:176-186`) is a watermark: italic, uppercase, 0.18em
tracking, weight 500, quiet ink. At 14px, 0.18em puts 2.5px between letters, which destroys
word shape, so it reads slower than a town name a third of its size. It is shouting and
mumbling at once, which is what "looks very weird" means.

**Its size was not the fault, and the first fix got that wrong.** This document originally
called the region name "the least important thing on screen" and took it to 11px — which made
it the smallest type on the map and drew the complaint straight back, in the sharper form
"tiny, and not professional". The premise was wrong. A named region in this app is usually the
*subject of the sentence*: "Og Piemonte, helt nordvest, har Nebbiolo". It is not background.

Cartography already has the right answer, and it is not a size ranking — it is a **distinction
of kind**. A point label names something you could stand on: it is small, dark, tightly set,
and it has a dot. An area label names ground you would be *inside*: it is larger, lighter,
slightly spread, quieter in colour, and it has no dot. Larger and quieter at once is what makes
it read as the ground rather than as another pin, and it is why every atlas sets region names
bigger than the towns inside them without the region ever shouting.

An area name does legitimately differ from a point name, and there is exactly one honest
distinction: it has **no dot**, and it may be **slightly** tracked to suggest extent. The map's
three steps become:

```css
.atlas-place          { font: 650 var(--fs-sm)/1 var(--font-display); letter-spacing: .01em;
                        color: var(--atlas-ink); }        /* + dot, + halo */
.atlas-place--town    { font-weight: 550; font-size: var(--fs-2xs); letter-spacing: .01em;
                        color: var(--atlas-ink-quiet); }
.atlas-place--region  { font-weight: 550; font-size: var(--fs-base); letter-spacing: .05em;
                        font-style: normal; text-transform: none;
                        color: var(--atlas-ink-quiet); }  /* no dot, halo inherited */
```

Three steps, and each differs from the next in **more than one property**, which is what makes
them tell apart at a glance: `--fs-base`/550/spread/quiet/no dot for ground, `--fs-sm`/650/tight/
full ink/dot for a city, `--fs-2xs`/550/tight/quiet/dot for a town. The region is the largest and
the palest at the same time — bigger than the city it contains, and never competing with it.

This block used to be written as `13px` / `11px` / `15px`, and that is why it is worth a note.
Those WERE the steps — `--fs-sm`, `--fs-2xs`, `--fs-base` under the old scale — but written as
numbers they looked like three chosen pixel values, and when the scale moved they became three
wrong ones. The relationship is the rule; the pixels are what it happens to compute to.

0.05em at 17px is 0.85px between letters: spread enough to read as extent, not enough to break
word shape. "Massachusetts" and "Piemonte" render as they are written. Colour stays
`--atlas-ink-quiet`, the token already tuned to clear 4.5:1 over water (`css/tokens.css:95-97`),
so `check-contrast.py` keeps holding the floor.

One consequence to accept rather than work around: `placeLabel()` in `map/index.js` refuses to
let a name leave the region it names, so a larger label fits inside a small on-screen region
less often and gets dropped by the declutter pass. **That is correct.** A name that does not fit
its region should be absent, not shrunk into illegibility — and if a region the narration is
talking about is too small on screen to carry its own name, the camera is in the wrong place,
which is a composition fault the type cannot fix.

The general form, so this is checkable beyond one class:

- **Uppercase is allowed only for a kicker**, at `--fs-2xs` or `--fs-3xs`, with tracking between
  0.06em and 0.14em.
- **Tracking above 0.10em is allowed only at 12px or below, and only in uppercase.**
- **Italic is allowed only for a quotation.** Nothing else in the app is italic.
- **Uppercase and italic never appear together.**

---

## 3. Sound

**The score tells you where you are. An effect tells you what was just named. Ambience is the
room. Silence is a decision.**

**A wine course and a battle share one grammar and no vocabulary.** The grammar below applies to
every pack; what the catalogue contains is the pack's business. Density is not a property of the
subject either — it follows from how many things the narration names. Nobody fires a cannon in
Piemonte, but a cork, a pour and a glass are all named things, and
`content/italy-wine/chapter-1-piemonte.json` shipping zero effects fails the same rule that
condemns three cannon and a volley inside twenty seconds.

**The bed.**
- One bed per scene. `sound.music` appears **at most once per scene, in its first beat**. Today
  19 April changes bed twelve times across eight scenes, which is scoring the beat rather than
  the scene, and a bed that changes mid-scene is a bed you can hear working.
- **At least one scene per chapter carries no bed.** Music everywhere is music nowhere.
- A bed arrives over `--t-dissolve` and leaves over 4 s. It never cuts.

**An effect.**
- **An effect is a thing the narration just named.** Not atmosphere by association.
- **At most one `sound.play` per beat; no two within 20 s; at most three per scene.** Three
  reports of one gun is **one cue with `times: 3, spread: …`**, never three cues.
- **A `period` effect belongs to its era.** `content/american-revolution/sound.json` already
  carries `reuse: "generic" | "period"` per entry, and `pack.json` carries an era.
  `content/roman-empire/chapter-44bc-octavian.json` currently fires `cannon` ×3, `musket` ×1,
  `volley` ×2 and `churchBell` ×1 in 44 BC. Every catalogue entry gets a year range and
  `check-script.py` refuses one the pack's era does not contain.

**Ambience.**
- Ambience is a place, and a place lasts a scene: **one per scene, set in the first beat.** A
  second is allowed only when the narration says the place changed.
- Ambience **never ducks**. A room does not get quieter when someone speaks.

**Levels — one reference, not a number per cue.** Everything is stated against the bed at rest,
so re-balancing the whole app is one number:

| | relative to the bed | why |
|---|---|---|
| bed, open | **0 dB** | audible when you listen for it |
| bed, under the voice | **−12 dB** | the ducker's own number (`sound/soundscape.js:53`), unchanged |
| ambience | **0 dB**, never ducks | the room and the score are the same weight of background |
| an effect | **+6 dB** | an event has to arrive |
| no bed | **silence** | not "quiet music" |

In cue terms: **`sound.music` carries no `gainDb` at all**; `sound.ambience` carries
`gainDb: -15`; `sound.play` carries `gainDb: -8`. A cue may move an effect ±4 dB and ambience
±3 dB, and only to separate a near thing from a far one *inside one scene*. Anything beyond that
is the recording being wrong, and the fix is the `levelled` gain in `content/<pack>/sound.json`,
not the cue. Those two defaults are the medians of what already ships across the four packs, so
this tidies the mix rather than moving it.

**One measurement is owed before this is applied.** Every `sound.music` cue currently carries
−6 to −12 dB *on top of* the bus's own −14 (`sound/soundscape.js:52`), so the bed that ships is
9–12 dB below the level the module documents. Take what ships as correct: move it into `bedDb`
and then delete the cue gains. Deleting them first makes every chapter's music three times
louder on the same day.

---

## 4. The shape of a lesson

**It opens.** The cover carries the chapter title at `--fs-2xl` — the only place that size
appears. The tap that starts it is the audio unlock, and scene 0 gets no card, because the cover
was the card. The first sound is the bed, arriving over `--t-dissolve` **before** the first word.
The first beat opens on a picture, not on a map: a map with nothing on it yet is a screen
waiting to be told what it is for.

**It turns over** as in section 1. **It ends** — today it stops on its last beat, cuts the
sound, and puts the cover back
(`engine/story.js:226-228`). That is not an ending; it is the film running out. Prescribed:

```
last word           2.0 s of silence. Nothing moves. The last picture holds.
+2.0 s              a veil at .52 closes over --t-turn. The stage stays underneath
                    and is still legible — the arc of redoubts, the two villages.
                    The bed comes UP from its ducked level to 0 dB over --t-turn.
                    The card fades in with the veil:
                        the date line          --fs-2xs, uppercase, tracked
                        the chapter title      --fs-xl, display
                        one sentence           --fs-md, body
                        one number             --fs-lg, display, with its label
                        two doors              next chapter · library
held                until the viewer taps. The bed plays under it.
on leaving          the bed fades out over 4 s.
```

Three rules inside that:

- **The stage is not reset.** The picture the chapter spent fourteen minutes building is the
  ground the ending sits on. Throwing it away and showing a cover is the single worst thing the
  current ending does.
- **One sentence and one number, and both are written**, in `chapter.ending` — not derived, not
  assembled from cues. It is chapter metadata rather than a cue because a cue would replay on
  every seek and rule 1 forbids that.
- **The card is held, not timed.** The narrator set the pace for fourteen minutes. This is the
  one moment the viewer holds.

And: **nothing arrives in the last beat.** No `plate.show`, no `marker.show`, no `stat.show` —
only hides and clears. A chapter whose final sentence is competing with something appearing has
no ending to give.

---

## 5. Depth: three tiers, and what each may interrupt

| tier | what it is | what it may interrupt |
|---|---|---|
| **a marked word** | `term.mark` — a dotted gold underline in the caption | **nothing.** No layout shift, no sound, no time. It is an offer. |
| **a fact box** | `fact.show` — one line, bottom-left | **the picture's edge, and nothing else.** It never pauses, never ducks, never takes the frame, never covers the caption. |
| **the library** | `core/dossier.js` — the full entry | **everything.** It pauses the chapter. |

Two rules across the tiers. **Each tier is entered by the viewer's own action, except the fact
box, which the script raises** — which is why the fact box exists at all: `term.mark` made the
word tappable and almost nobody taps while a voice is running. And **the script may never take a
tier away from the viewer**: a scene change closes nothing the viewer opened. The library resumes
only if it was the thing that paused (`engine/depth.js:83-93`), so someone who stopped the
chapter deliberately is not talked at when they close a card.

Nothing in the script may open the library. A cue would replay on every seek and forty cards
would open at once.

### How long a fact box stays

This has been fixed three times and come back three times, because two mechanisms were both
entitled to hide it. So, in priority order, with one owner:

1. **It dies with the sentence that raised it.** The beat owns the lifetime.
   `factBeatIs()` at `engine/story.js:181` is the guarantee; the cue is only the timing. Never
   longer, whatever the cue list says.
2. Within that beat it stays **6.5 s** (`FACT_SECONDS`, `engine/script.js:117`) — three short
   lines read in 4–6 s while a voice is running.
3. A ceiling of **14 s** in `tools/check-script.py:135` catches a hand-written `until` that
   disagrees.

**`until` may only narrow the beat, never extend past it.** Any future argument that looks like
it could hold a box open across a beat boundary is the same bug in a new shape.

Density, so depth stays an offer and not a glossary: **at most two marked words per beat and one
new one per sentence; at most one fact box per beat, three per scene, and never two in adjacent
beats.**

---

## 5b. Where a rule points, and why it matters

Three of the file:line references in this document named `css/story.css` when the
live rule was in `css/atlas.css`, and one of them — `ring-pulse` — was *acted on*
there. The rule was written, the fix was made, the check would have passed, and the
ring on the map went on pulsing for the rest of every scene, because `.story-ring`
has not been painted since the map module landed.

That is the same shape as `.ov-fact` having no hidden state, and it is the third
time it has cost something. So:

> **A rule in this document points at the selector that is PAINTED.** Before citing
> a file and line, check that a module writes that class:
> `grep -rn "the-class" --include=*.js .`
> `tools/check-dead-css.py` now fails the build on a class in `css/` that nothing
> writes, which makes the citation checkable rather than trusted.

The dead copies had also drifted from the live ones — night at .30 against .34, the
muzzle flash at 700 ms against 620 ms, the clock at `--fs-xs` against a literal 14px.
A number maintained in two places and visible in one is worse than a number nobody
wrote down.

---

## 6. How each rule is checked

Mechanical, by grep over `css/`:

- no `font-size:` with a literal number — every size is a `--fs-*` token
- no `--ease-spring`, no `cubic-bezier` outside `css/tokens.css`
- no duration outside the six `--t-*` tokens, the 120 ms word colour, and 2400 ms for the mood
- no `transform: translate…` or `scale(…)` inside an entry keyframe or an `is-on` rule
- no `animation-iteration-count: infinite`
- no rule carrying both `text-transform: uppercase` and `font-style: italic`
- no `letter-spacing` above 0.10em at a size above 12px

Mechanical, in `tools/check-script.py` (new checks):

- one `sound.music` per scene, in the first beat, with no `gainDb`
- `sound.play`: one per beat, none within 20 s of another, three per scene, era inside the pack's
- one `sound.ambience` per scene, `gainDb` within −18…−12
- `fact.show`: one per beat, three per scene, never adjacent; `until` inside its own beat
- the last beat of a chapter contains only hides and clears
- `chapter.ending` exists and has one sentence and one number

Mechanical, already: `dev/engine-lab.html` for every `instant` form, `check-contrast.py` for
label ink in both themes, `check-sound.py` for the ducker.

**Not mechanical, and a human has to look.** Does the picture show the thing being said — no
tool reads a sentence, so read `check-script.py`'s list of plates over a `region.show` or
`marker.show`. Does each effect name a thing the narration just named — print every `sound.play`
next to its beat's sentence and read that list the same way. Is the map earning the frame — the
wine chapter's map covers ~54% of a subject that is mostly not geography. And does the ending
land: watch it once, with the sound on.

---

## 7. What this supersedes

| now | file:line | becomes |
|---|---|---|
| `--t-fast 140` `--t-med 260` `--t-slow 420` | `css/tokens.css:129-131` | `--t-tap 160` `--t-enter 900` `--t-exit 600` `--t-dissolve 1200` `--t-turn 1200` `--t-drift 14s` |
| `--ease-spring` | `css/tokens.css:128` | deleted |
| (no such token) | `css/tokens.css:106` | `--fs-3xs: 0.625rem` added |
| `IN 320 / HOLD 2600 / OUT 700` | `engine/transition.js:40-46` | `1200 / 1600 / 1200` |
| `LEAD_IN_MS 900` | `engine/transition.js:51` | `2800` |
| reduced motion returns early | `engine/transition.js:102`, `css/story.css:1173-1175` | card cuts in, holds, cuts out |
| veil `220ms` / `520ms` | `css/story.css:1134-1135` | `--t-turn` both ways |
| card `translateY(6px)` over 420 ms | `css/story.css:1149-1152` | no translate; fades with the veil |
| overlays `--t-slow` in and out | `css/story.css:247` | `--t-enter` / `--t-exit` |
| `translateY` on `.ov-note` `.ov-image` `.ov-portrait` | `css/story.css:262, 357, 486` | deleted |
| `scale(.97)` on `.ov-portrait` `.ov-quote` | `css/story.css:262, 397` | deleted |
| `mk-pop 460ms` spring, `scale(.4)` | `css/story.css:146-149` | `--t-enter`, opacity only |
| `chip-in 520ms` spring, translate+scale | `css/story.css:460-463` | `--t-enter`, opacity only |
| `atlas-ping … infinite` | `css/atlas.css:385` | three iterations, thrown by a `::after` so the ring itself stands |
| `cap-in 320ms` + `translateY(4px)` | `css/story.css:544-545` | deleted; the caption cuts |
| word colour `120ms linear` | `css/story.css:546` | kept, speech-locked |
| plate `.9s` in and out | `css/story.css:1251-1256` | `--t-dissolve` |
| `cue.into ?? 1.1` | `engine/scenes/plate.js:256` | `?? 1.2` |
| `plate.hide over` default `0.9` | `engine/verbs.json` | `1.2` |
| `map.mood 2.4s` | `css/atlas.css:293` | kept, as 2 × `--t-turn` |
| fly clamp `0.9 … 7` | `map/index.js:812` | `1.4 … 6` |
| `.atlas-place--region` italic/uppercase/.18em/14px | `css/atlas.css:176-186` | upright, mixed case, 15px, 550, .05em, quiet ink, no dot |
| `.atlas-place--town 11.5px` | `css/atlas.css:187` | `11px` |
| 34 literal font sizes, 13 of them in story.css | `css/story.css:85, 314, 322, 339, 378, 467, 476, 623, 788, 874, 1025, 1112, 1444` + `atlas.css`, `map.css`, `sheet.css`, `dossier.css`, `chooser.css` | scale steps |
| `stopSound(); showCover('replay')` | `engine/story.js:226-228` | the end card |
| `sound.music gainDb` −6…−12 per cue | every chapter | none; the level moves into `bedDb` |
| `sound.ambience gainDb` −9…−19 | every chapter | `-15` ±3 |
| `sound.play gainDb` −2…−19 | every chapter | `-8` ±4 |

Unchanged and deliberately so: `--ease-out` and `--ease-in-out`; `--t-drift 14s`; the ducker's
−14 / −12; `FACT_SECONDS 6.5` and `FACT_CEILING 14`; `PLATE_FLOOR 6` and `PLATE_CEILING 34`;
`STAT_STACK 3`; the `at > 1.5` guard on the scene card; the flight easing in
`map/index.js:844`; every `over` on a march, front, converge or region, because those are
information unfolding rather than transitions.
