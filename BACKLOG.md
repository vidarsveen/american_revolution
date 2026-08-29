# Backlog

Things worth doing, with enough context that picking one up does not mean
re-deriving why.

---

# Open, in the order I would do it

Everything below is open. Everything under the horizontal rule further down is
history — what was done and why, newest first. This section exists because the
open items were scattered through six "still open" lists and nobody could see
them at once.

Two tracks: **the beer pack**, which is the course being built, and **the
framework**, which is what makes the next subject cheaper than this one. The
wine pack below is the reference course and is not the work.

---

## The beer pack

**0. DONE — chapter one ships: `Fire ting i et glass`.** Ten minutes in both
languages, seventy-eight beats, thirteen full-frame pictures and two bar charts.
It is the picture-led chapter the course was started to prove: four ingredients,
four steps, and not one place name until the second-to-last beat, where the map
appears empty under the line that says the place is about to start mattering.
One camera move in the whole chapter and nothing pinned on it.

What it needed that the wine course did not:

- **Four more faction colours.** A pack's factions are named colours, and this
  subject divides two ways at two levels: `ale/lager/wild/farmhouse` is the
  fermentation, which is chapters two to six, and `vann/korn/humle/gjaer` is the
  ingredients, which is chapter one. A number about hops is green every time it
  appears. `korn` and `lager` are both yellow and that is not an oversight —
  malt and pale beer are that colour, and the two families never share a frame.
- **Two prompt corrections found by looking.** The model drew hop cones as
  catkins — long spiky things that are not hops — in every candidate of two
  different pictures, because the prompt said "cones" and assumed the model knew
  the shape. Describing the cone (overlapping papery scales, like a small soft
  pine cone) fixed both. It also drew lupulin as yellow beads instead of powder,
  and gave three glasses for "four glasses" on three candidates running, so the
  count had to be spelled out and each glass given its own colour. All four are
  in `image-prompts.json` as `//prompt` notes beside the prompt they corrected.
- **A picture reviewed and swapped after acceptance.** The first glass of beer
  had faint etched marks on it that read as quasi-text. Not a brand and not
  legible, but the pack's own rule is that a generated marking on a glass is the
  one thing a picture may not invent, so it was replaced with a plain one.

**Two notes the tools still print, both correct.** Chapter one asks for a
`process` artifact the framework does not have — that is the framework item
below, not a content defect. And `check-contrast.py` will say the beer pack is
gated on no measurement at all, which is true and unavoidable: nothing is drawn
on the map in chapter one, so there is no pin and no pair of adjacent areas to
sample. Chapter two, with Burton pinned, is where that beat gets declared.

**0b. Three notes from watching chapter one, two fixed and one for the
framework list.**

**FIXED — a term is a coloured word now, not a card that arrives.** The ask was
"I would really like a lot of definitions in this course, but not showing up on
screen". `term.mark` already made a word tappable, but the mark was a dotted
rule in `currentColor` — docs/design-direction.md had described it as "a dotted
gold underline" for as long as the stylesheet had not been doing that, so the
document and the screen had drifted and the screen was the quiet one. A mark
nobody notices is a definition nobody opens, and the thing the script reached
for instead was `fact.show`, which takes the frame.

So the word is coloured, in the caption AND in the transcript — which had no
marks at all, meaning every marked word in the chapter lived for one spoken
sentence and was then unreachable. The colour is its own token, `--term`, and
not `--gold`: this is TEXT on the caption's paper and WCAG holds text to 4.5,
where a mark on the map ground answers to 3.0. Measured on the caption veil,
`--gold` is 3.44 and fails; `--term` is 5.76 and passes. The dark theme needed
no second colour — gold on dark paper is already 7.8. Confirmed by reading the
computed colour off the rendered word in both themes and looking at the frame,
not by asking the DOM what class it had.

Every `fact.show` is out of chapter one as a result. Eleven marked words remain
and each opens its entry from the transcript, where a reader can go looking
rather than being offered.

**FIXED — `ground: none` did not remove the map, and the verification was the
problem.** Reported as "I see the map of Africa in between images". The option
took the map SURFACE out of the cue table, and `mountAll()` — the function that
actually decides what to build — was still calling `surfacesFor(chapter.packInfo)`
without the chapter. So the map mounted anyway and drew a world map behind every
gap between pictures.

It was verified against `stageSurfaces()`, which is the REPORTING path and does
take the chapter. It answered exactly what was wanted while the mounting path did
something else. **A probe that asks a different function than the app uses will
agree with you every time** — the same shape as verifying a dissolve with a seek,
twice in one day. The re-check queried the DOM instead.

Three checks broke on the fix, all for one reason: they used `#story-map` as
their "the app is ready" signal, and a chapter with no ground never creates one,
so they waited twenty seconds and reported a failure of something else. They wait
on `.story__stage` now.

**Still open: 19 % of the chapter is blank paper** — one minute fifty-three — where
it used to be blank map. Calmer than a wrong map and still not good. Six more
pictures would close it.

**FIXED — a phone was showing 30 % of every wide picture.** Reported as "when
you show the four ingredients, I only see two of them on mobile", and the number
is worse than it sounds. A plate fills the stage under `cover`, and the stage on
a phone is 390x734. Measured: a `wide` picture shows 30 % of its width, a square
53 %, a portrait 68 %. Eight of the beer course's pictures were authored `wide`,
including every composition that was a ROW of things — four ingredients, four
malts, four glasses — which is the worst possible shape for a tall crop.

`tools/gen-image.py`'s own header already said square by default, NOT 16:9,
because the stage is mobile-first and portrait. A note in a docstring did not
survive contact with somebody choosing an aspect on a laptop.
`tools/check-plate-crop.py` is the number that fails a build instead. It gates
GENERATED pictures, which can be re-rendered for nine seconds of GPU, and only
reports ARCHIVE ones, which are the shape they are.

**And the archive number has a cause worth fixing separately.**
`tools/fetch-media.py` already letterboxes anything far from the stage ratio —
against `STAGE_AR = 16/9`, a LANDSCAPE frame. The phone stage is 0.53. So the
fit every archive picture in three courses was given was decided against a shape
the app has never drawn on a phone, and 38 of them sit under the floor. Not
touched here: relabelling frozen courses is a separate decision, and `contain`
is right for a plan of Boston and wrong for a battle scene. It is one line in
fetch-media plus a judgement per picture.

**FIXED — the model cannot count, and the fix was to stop asking it to.** Four
ingredients came back as three bowls twice (grain and hops merged; then the
water dropped, because clear water in a white bowl from above looks like an
empty bowl) and needed the water promoted to a glass. Four glasses came back as
two, three times running — so that picture is now two glasses, pale and black,
which is the pair chapter two actually teaches, and it is a better closing image
than the one originally ordered. Five fruits laid "in a vertical column" were
STACKED into a tower, banana balanced on cloves on an apple; shot from directly
above, the model cannot stack. All four notes are in `image-prompts.json` beside
the prompt they corrected.

**FIXED — the pub, not the kitchen table.** "Show it where people have fun."
The glass of beer is on a bar by a window with warm lamps and blurred drinkers
behind it, and the chapter ends on two glasses on a pub table in a full room.
Nobody's face is in focus and no signage is in frame, which keeps them inside
the pack's own rule about invented markings.

**FIXED — the progress bar on a phone was not thin, it was absent.** The scrub
bar shared one row with the play button, the clock and five icons: about 300 px
of controls in a 330 px bar, and the seek area grows from a minimum of zero, so
it collapsed. It has its own full-width row now — 88 % of the bar at 390 px, 6 px
tall — with the controls beneath it, and a minimum width it cannot go under.

**FIXED — the map was printing a place id as a name.** `nordvest-europa`, in
serif, across the North Sea, in the chapter whose whole point is that it names
no places. `pick(place.name) || id` wrote the key when a place had no name. A
place with no name is a camera anchor and nothing else, which is a legitimate
thing to declare; there is nothing to draw.

**FIXED — the music is back, and it does not pump.** The cause was one number.
`MIN_OPEN_MS` was 500, and the compiler writes 0.9 s between two sentences,
1.35 s across a paragraph and 2.0 s at the end of a scene — so the bed rode up
in ALL THREE, about seventy times in a ten-minute chapter. That is exactly what
"it goes up and down in volume" is. At 1200 (and the ducker's 250 ms look-ahead)
it holds one level through a whole scene and breathes at the scene join, which
is the shape this list argued for from the other direction: a bed belongs at an
opening and an ending, not under a paragraph. A per-pack number now
(`sound.minOpenMs`), and the beer course ducks 9 dB rather than 12, because a
bed that lies still can sit closer to the voice than one that dives. Beds on the
first scene and the last, and nowhere else.

Real music is still item 4 below, and still a 7-8 GB download.

**FIXED — a sound effect was playing over an empty map, and no check had ever
looked at the two together.** Reported as "why do you show the map when you are
telling about pouring a glass and having a sound effect of pouring a glass".
The pour turned out to be fine — the picture is up, confirmed by playing the
scene forward and looking at the frame at the millisecond the word is spoken,
not by seeking, because a seek re-applies cues with `instant` and that is
exactly the state in which a dissolve does not happen. The FIZZ was the real
one: the fermentation foam came down one beat before the sentence that says it
bubbles, so the one sound in the chapter that has a picture of itself was heard
over bare ground.

Both halves were individually valid, which is why nothing caught it: the plate
was under its 34-second ceiling and the sound was on the right word. The scene
gets a picture it was missing at the top — a gram of dried yeast under the line
about twenty billion cells — and the foam now starts later and lives through
the sound it belongs to.

`tools/check-script.py` prints what is on screen at every `sound.play` now. A
note and not a gate, and the other four courses show why: the Revolution hears
a musket, a volley and a cannon over bare map, and Narvik hears torpedoes over
an empty fjord, and all of those are right — a shot you do not see is more
frightening than one you do. It is the beer course that is different, because
its sounds are of things you can photograph.

**FIXED — the library stacks two ways.** "In order" (the order the pool file
lists them, which is the order the course teaches them) and "A–Z", remembered
per viewer. It only appears where it changes something: a face grid is browsed
by looking, and two chips over it would be furniture.

**OPEN, and it is a framework item — the map is what you get when there is no
picture, and that is the wrong default.** Reported as: the map as the fallback
is not working, the map is a little bit boring, and if a course is going to
show a map it needs to be a better one.

The immediate half is content and is done: chapter one had six stretches of
twenty to fifty seconds with nothing but empty ground under them, and five more
pictures now cover the longest. Frames with a picture up went from 24 of 39 to
27 of 38, and the cue mix went from `overlays 30, plate 26` to `plate 34,
overlays 17`.

The other half is not content, and item 3 below argues the wrong thing about
it. That item measured how much of the map is LEFT — two thirds to three
quarters, in every chapter — and concluded the case for `ground: none` was
weaker than assumed. The number was right and the question was wrong. Nobody
was ever asking how much map is visible; they are asking whether what is
visible is worth looking at, and at zoom 4.6 over northwest Europe the honest
answer is a coastline and some dashed borders. Two separable pieces of work:

  - **a scene can declare its ground.** `ground: none` — paper, or the pack's
    own colour — for a scene that is not about places. Cheapest, and it is the
    one the beer course actually needs: chapters one, four and five are not
    standing anywhere.
  - **a better map when there IS one.** More to draw at low zoom than
    Natural Earth 1:10M gives: relief, rivers that survive simplification, a
    ground that reads as a drawn map rather than as a fill. This is the
    expensive one and it should be argued from a picture, not from here.

Do not build these off item 3's numbers. Re-argue from what a viewer sees.

**1. The plan is written and five chapters of it are still a plan.**
`content/beer/outline.md`, started with `python tools/outline.py --new-pack
beer`. One question — *why does beer taste of a thousand things when it is made
of four?* — and the answer is that the fourth ingredient is alive, which is what
lets history, method and place be one course instead of three.

Six chapters, all `planned: true`, ordered by mechanism and then by chronology:

    1  fire-ting     what beer IS. Four ingredients, four steps, and not one
                     place name in it, because "why does beer from here taste
                     like that" is not a question you can hear yet.
    2  overgjaer     ale, England, and the gypsum in the water under Burton —
                     the first proof that a place makes a style, and it is
                     chemistry rather than tradition.
    3  undergjaer    lager, Bavarian ice cellars, and Plzeň going golden in 1842.
    4  renkultur     Copenhagen 1883, the single yeast cell, and the bill:
                     beer that tastes the same everywhere.
    5  belgia        the counter-argument, and it is strongest right after four.
    6  kveik         a Norwegian farm loft had one the whole time.

What the read has to settle, because a tool cannot: whether six is the right
number, whether chapter one earns a whole chapter before any story starts, and
whether chapter four or chapter six is the ending. The first of those three is
now answerable by watching rather than by imagining it.

**2. Nothing else is decided, and three things are TODO in the manifest.** The
basemap has no 10m level north of 50 degrees — `mediterranean-10m` stops south
of Brussels, Burton and all of Norway, so chapters two to six zoom into blank
paper as it stands. That is the wine course's detail-box lesson one level up,
and it is written at the field in `content/beer/pack.json`. The other two are
the two pools the course will need (`styles.json` with taster axes, and
`ingredients.json`) and a `say.json` for Plzeň, Reinheitsgebot, lambik and
Brettanomyces.

**3. Registered in `content/packs.json`,** because a chapter does ship now.

---

## The wine pack

Ordered by how badly it hurts the chapter.

**Five of the eight items this list opened with are done**, and four of them were
already done when the list was written — it was assembled from a review pass and
never pruned against the same commit's own fixes. Every wine has a taster
profile drawn by `chart.show`, Barbaresco has the explanation Barolo had,
`pour` is a bottle glugging rather than a waterfall, and "Barolo" is no longer
written three times on one screen. The eighth is the closing line, below.

**Done: the chapter no longer contradicts itself about the whites.** It closed on
"og vi har ikke nevnt de hvite ennå" four beats after a scene on Moscato, which
is a white grape. The clause is cut — the course is about red wine on purpose —
and the line is now "Tre helt forskjellige viner, og nitten regioner igjen",
re-recorded in both languages. The level that would have caught it before it was
written now exists: `content/italy-wine/outline.md`, and `tools/outline.py`
prints the sentence when a chapter speaks a subject the course put under
`# not here`.

**Done: the scissors are gone, and they were the smaller half of that
defect.** The tool the model drew was a pair of long-nose pliers with three
handles, floating unattached to anything. But the sentence the picture sits
under is about why Nebbiolo is called Nebbiolo — that it hangs into October
when the valley fills with fog, and that the skin carries a grey bloom. It
never mentions picking at all. So the correction was not a better pair of
shears: it was to take the tool out and photograph the thing being said. The
picture is a bunch hanging late with the bloom clearly on the skins and the fog
going down the row, and the words it asserts that are actually spoken went from
1 of 9 to 7 of 13.

**1. Piemonte arrives small — mostly answered, and by the camera rather than by
the cue.** The frame was measured at s2.b7 before and after the composition fix
(the camera now aims at the middle of the picture rather than the middle of the
map element). Before: the top half of the phone was Switzerland, the boot ran
into the subtitles, and Piemonte was a smudge in the corner of a frame that was
mostly not Italy. After: the whole country is in the clear band, Firenze sits
105 px higher, and Piemonte is the largest of the four washes on screen with
Torino pinned beside it.

What is left is a judgement, not a defect. The sentence is "og Piemonte, helt
nordvest" — "far north-west" needs the whole country in frame to mean anything,
so bringing the camera in early would cost the line its sense, and the two beats
after it (`En ting til, før vi drar` and the one about names being places) are
country-level talk that a zoomed-in map would not serve either. If it still
reads small to the author, the move is to give it its own beat, not to move the
camera.

**2. Three final pictures are still moving when their chapter ends.**
Not wine — 19 April, 27 BC and 44 BC, all three frozen. The push is set longer
than the chapter has left, so the picture is still creeping under the end card,
which the direction says should be still.

    19 April    zooms 16s, 13s remain   -> moving by  3s
    27 BC       zooms 14s, 13s remain   -> moving by  1s
    44 BC       zooms 26s, 11s remain   -> moving by 15s

Three numbers. `check-script.py` reports it and does not fail, because
shortening the push and moving the picture a sentence earlier look different on
screen and it is somebody's writing.

---

## The framework

**1e. DONE — the outline grew the three things it was missing, and each one
is a gate.** The outline level existed but only asked what a chapter taught. It
now also asks:

- **`# question`** — the one question the whole course answers. The wine course
  had an excellent one and it was buried in the middle of `# about`, where
  nothing above the chapter could point at it. It is a section now, and a
  course without one fails.
- **`assumes:`** — the other half of `teaches:`. Every word a chapter leans on
  must have been taught by an EARLIER chapter, and that is the commonest way a
  course quietly stops working: from inside chapter four it looks fine, because
  the person writing it knows what the word means.
- **`shows:`** — what carries the frame, from `map`, `pictures`, `charts`,
  `cards`, `process`. Asked at outline time because that is the last cheap
  moment: it decides `pack.json`'s `surfaces`, and a course that does not name
  `map` loads no map module and no geometry. `process` is in the vocabulary
  with nothing behind it on purpose — the beer course's first chapter asks for
  it, and the tool names the missing artifact on every run.

Once a chapter ships, `shows:` gets printed beside what the chapter actually
arrived with — every cue counted against the surface that answers it. It PRINTS
and does not judge, and the first real run is why. Beer chapter one is thirteen
full-frame pictures over ten minutes and almost nothing else, exactly what it
promised; counted as cues it came out `overlays 30, plate 26` and the tool
called it a mismatch, because every card is a show and a hide and a fact box the
size of a stamp counts the same as a picture covering the whole phone.

Screen seconds would answer it and would be worth building — but not naively:
the map is under everything for the whole chapter, so "on screen longest" is the
map in every chapter ever written, and the number that actually matters, how
much of the map an overlay is sitting on, is already measured per frame by
`tools/check-overlap.py`. Same conclusion `review-pictures.py` reached about its
own word count: as a flag it fired on the good chapters too.

Also `python tools/outline.py --new-pack <id>`, which starts a course from
nothing — outline first, `pack.json` compiled from it. `--new` built an outline
FROM a pack.json, which assumed somebody had already decided what the chapters
were, and that is the decision the outline exists to make. There was no way to
begin at the beginning.

All six were confirmed by reintroducing the defect and watching the tool fire:
a chapter assuming a word only a later chapter teaches, a `shows:` value the
framework has never heard of, no `# question` at all, a question that is not a
question, a shipped chapter promising charts and shipping 35 map cues, and a
chapter carried by a surface its pack does not declare.

`docs/planning.md` is the half a tool cannot check — seven questions asked as an
interview, three tests before a word is written, both courses worked through.

**And starting a course from nothing immediately found three things the
framework had never been asked to survive.** A pack with no chapters is a
legitimate state — it is what a course being planned IS — and none of the three
had been reached before:
`--new-pack` wrote its empty pools as `[]` when every pool in this framework is
keyed by id, which got as far as check-data's `media.items()`; and
`check-contrast.py` opened the course with `?emne=`, loaded nothing because
there was nothing to load, and read `toScreen` off a null map. That is the same
crash the note at the top of that file already records for the chooser,
arriving by a different road. It says "no chapters yet — nothing on screen to
sample" and stops now.

The third: `check-turn-chapter.py` asked the lab to select a pack whose chapter
list was empty and sat for thirty seconds waiting for an option that could not
appear, then reported a Playwright timeout where a reader goes looking for a
missing veil. It already passed a ONE-chapter pack with "no door to turn
through"; none is one door fewer, and it says so now.

All three are the same shape and worth knowing before the next course is
started: **every browser-driven check assumes a pack has a picture.** A course
that has been planned and not written does not, and the honest answer is a
skip that says why, not a crash.

**1. DONE — `style.json` and its lab.** Per-pack motion durations, the Ken Burns
push and drift, camera speed, map weight, a type multiplier, `detail.minZoom`,
merged over `engine/defaults/style.json` and published as CSS custom properties
the way `--f-*` is, with `dev/style-lab.html` putting sliders on a running
chapter. This list still described it as "decided and not built" a fortnight
after it shipped, which is what a backlog assembled from a review pass and never
pruned looks like.

**1b. DONE — the course outline.** `content/<pack>/outline.md`, prose in the same
notation as a chapter, compiled to `pack.json`'s chapter list by
`tools/outline.py` (and by `author.py`, which routes an `outline.md` source to
it). It carries what the course teaches, in what order, what each chapter is
FOR, and — the half that gets forgotten — what the course deliberately leaves
out, in the words those subjects are spoken with.

Four questions, two of them gates: every chapter on disk is in the outline and
every outline chapter exists; `pack.json` says what the outline says; two
chapters teaching the same subject; and a chapter speaking a subject the course
put under `# not here`, with the sentence printed. The last two are notes rather
than failures, because both are judgement and a tool that fails on judgement
gets skipped. All four were confirmed by reintroducing the defect and watching
them fire — the whites line back in the chapter, a title edited into pack.json
behind the outline's back, a chapter file the outline never mentions, and
chapter two claiming to teach Barolo.

`chapter-2-toscana` is in there as `planned: true` with its purpose written, so
the next chapter is written into a course rather than into empty space.

**1d. A pack could only hold one prose file, which is a poor answer to "write
chapter two".** `content/<pack>/script.md` compiled to whichever chapter its
front matter named, and a second one had nowhere to live — and `check-all` only
globbed the one name, so a second source would have gone unchecked and quietly
stopped being the source. It is `script.<chapter-id>.md` now, keyed the way
`timing.<chapter>.<lang>.json` is, and the check globs `script*.md`.

`python tools/author.py --new italy-wine/chapter-2-toscana` writes the first
draft: the front matter filled in from `outline.md`, the sections in place, the
two-language grammar shown once — and at the top, where the writer sees it every
time they open the file, **what the outline says the chapter is FOR**. That line
is the whole reason the outline exists and it was worth nothing in a file nobody
had open. CLAUDE.md says the next real test of this framework is somebody
writing that chapter without help; the blank file was the first place it stuck.

**1c. The prose was not the source, and nothing said so.** Six edits had been
made straight to `chapter-1-piemonte.json` and never to `script.md` — five
region labels turned off and one place name — so the next compile would have put
the labels back on the map, silently. `author.py --lab` could not see it: it
round-trips the JSON through itself and passes while the hand-written source
says something else. `--check` now exits 1 on any difference, `check-all.py`
runs it for every pack with a `script.md`, and the same guard is what
`outline.py` does for `pack.json`. Confirmed by putting one label back and
watching it fail.

**2. DONE — surfaces, and a chart that is a first-class artifact.** Each surface
under `engine/surfaces/` declares its own verbs and lifecycle and the registry
merges them; a pack names what it wants in `pack.json` -> `surfaces`, and one
that does not name `map` imports no map module and no geometry — measured at 0
modules and 3.85 MB it does not pay. `chart.show` is the proof and the wine
course uses it: a `profile` chart against a fixed ceiling, a `bar` chart against
the largest value on screen, and no `line`, because no pack has a series over
time and declaring an enum value with no handler behind it is the `kind`-on-
marker.show defect again. Also still listed here as open a fortnight after it
shipped.

**3. The map earns its place — the camera now composes; the rest is open.**

**DONE: a flyTo aims at the middle of the picture, not the middle of the
element.** `framePadding()` has known where the furniture is for as long as it
has existed, and only `fitCoords()` ever asked. A `flyTo` handed the map a point
and the map centred it in the HOST — whose bottom sixth is caption and
transport, and whose bottom third is caption, transport and a fact card in any
scene that raises one. So the place a sentence names arrived low and the frame
above it went to whatever lies north.

Measured at 390x844 on the wine chapter's "og Piemonte, helt nordvest": before,
the top half of the phone was Switzerland and Rome, Naples, Palermo and Sicily
were behind the subtitles; after, the whole boot is in the clear band and
Piemonte sits in the upper left of the PICTURE. Firenze moved 105 px up the
frame. `map/index.js`'s `flyTo` has taken an `offset` since Explore needed to
clear its sheet — nothing had ever passed one. `place.highlight` and the
one-place case of `fitPlaces` compose too, since both are a flyTo underneath.

**It broke a bench, and the bench was believed.** `check-legible.py` re-centres
the camera itself when a cue is a `place.highlight`, because a seek leaves the
camera where the rebuild put it — and it did that with `setView(coords)`, which
is exactly the framing the app had just stopped drawing. It would have gone on
judging every label against a frame no viewer is shown. The offset is exported
through `engine/scenes/map.js` (the handle, not the surface, so a mapless pack
still imports no geometry) and the probe uses the same one implementation.

**The map-share number exists now, and it does not say what this list assumed.**
`tools/check-overlap.py` rasterises the map host against every overlay on it and
prints, per chapter, how much of it no overlay is sitting on:

    american-revolution/chapter-1775-04-19   68 % median, worst 28 % at s1.b4
    american-revolution/chapter-1775-06-17   71 % median, worst 35 %
    italy-wine/chapter-1-piemonte            77 % median, worst 59 %
    norway-1940/chapter-1940-04-09           68 % median, worst 30 %
    roman-empire/chapter-27bc-augustus       73 % median, worst 37 %

**"Roughly 40 % of the frame is spoken for" is wrong**, and it is wrong in a way
worth knowing: it was three separate measurements of PARTS added together — a
126 px deck reserve, a 127 px caption, a 78 px transport, against 734 — and the
parts overlap each other. The deck sits above the caption only when both are up,
the caption is empty between beats, and a fact card and the stats share a band.
Measured as one thing on a grid, the map keeps between two thirds and three
quarters of its frame at rest. The worst frames — 28 to 35 % — are a card over a
map, which is the deck reserve doing its job, and whether the place being named
is still visible there is what `check-legible.py` asks.

So the case for `ground` per scene and `map.inset` / `map.take` is weaker than
this list assumed, and it should be re-argued from the numbers above rather than
built on the old one. What a scene declaring `ground: none` would still buy is
the paint and the geometry a subject that is not about places never needs — that
is a real argument, and it is a different one.

**4e. The bed shipped and nobody heard it, and the reason is the worst kind.**
Reported as "I have not heard any background music" while the file was on disk,
in the manifest, licensed, measured and live.

`engine/surfaces/sound.js` only fetches a pack's sound.json if the pack DECLARES
it — `pools.sound` — because otherwise every pack without audio logs a 404 on
every load. The beer pack never declared it. So the manifest was never fetched,
`bedBrew` was never a name the library knew, and the cue played nothing.

**And it failed to SILENCE, with no error.** The synthesised catalogue is the
designed fallback when a pack file is missing — but only for names the
catalogue HAS. `bedBrew` is a pack-only name; there was nothing behind it. A
missing file for `wind` degrades to a synthesised wind; a missing file for a new
name degrades to nothing at all, quietly. Worth knowing before adding another.

**The anti-pumping number was dead too**, and had been saying so out loud:
`[style] engine/defaults/style.json declares "sound.minOpenMs", which nothing
reads` on every page load. A style key has to be in the SPEC table and in the
BUILT_IN defaults, and the two are cross-checked precisely so a number cannot
live in one place and be ignored in the other. It was in neither.

**Every sound effect is out of the course.** "The sound effects are basically so
bad we need to remove them completely" — the two one-shots and the cellar room
tone, which is the same synthesiser. The generated MOSS effects were never
installed; `content/beer/sound.json` carries the music bed and nothing else.

**4d. DONE — there is real music, generated locally, and it loops.**
ACE-Step v1-3.5B, Apache 2.0 on the weights, so the build stays commercially
usable. `tools/gen-music.py` with prompts in `content/<pack>/music-prompts.json`,
the same shape as the image and sound tools.

**It cost far less than this list feared and rather more than it should have.**
Measured on the RTX 4060 Laptop (8 GB): 60 s of audio in 18 s, 6.82 GB peak,
cpu_offload on, torch_compile off. No dtype surgery — the MOSS trap did not
repeat. What did cost time was the install: eight missing packages one at a
time, and one genuinely misleading failure where torchvision resolved to a
version that does not match this torch and surfaced as "Could not import module
'CLIPTextModelWithProjection'". The pipeline also keeps its OWN checkpoint cache
and ignores the huggingface one, so it downloaded a second 7.8 GB copy of the
same bytes before dying on a 639-byte config.json that Windows would not let it
symlink. All four are in the tool's header.

**The free-library route was tried first and failed on its own terms**, which
is worth recording so nobody repeats it: the CC0 game-loop packs (Abstraction /
Tallbeard, 200+ seamless loops, licence verified from the file) are written with
soft synths and were rejected as "very synthetic"; FreePD shut down in 2025;
Chosic blocks automated access; and public-domain classical on archive.org is a
licence minefield where most recordings state no licence at all and the rest are
non-commercial. The measurement harness built along the way stayed useful —
`tools/describe-sound.py` now reports the loop join, and it immediately found
that the generated `ferment` effect is declared a loop and is 19 dB away from
joining itself.

**The loop is the half the licence has nothing to do with, and it is solved by
construction.** Generate 90 s, search for the cut length at which the material
after the cut most resembles the opening, then fold the overhang back over the
head with an equal-power crossfade — the same trick sound/library.js already
uses for synthesised loops, applied to a file. The crossfade is SIX seconds and
not two: at two the sample-level click was gone (-33..-40 dB) and the phrase
change was still an event. At six it measures -43 dB and reads as two quiet
passages overlapping, which is what a fade is for.

**What is shipped:** `bedBrew`, 28.5 s, mono, 2.7 MB — an extremely slow sparse
nylon-string guitar, a few notes and then silence. Chosen by ear from three,
heard as three passes round so the join could actually be judged.
`bedBrewStrings` is written into music-prompts.json unused: it was picked out as
"more dramatic", and chapter four — the yeast caught in a laboratory — is where
that belongs.

**What is still open:** whether "too fast" is fully answered. Four takes were
rejected as too busy before this one, and the lesson is in the prompts file —
tempo is not the lever, how OFTEN something happens is. There is room below
45 bpm if it still reads as busy under narration.

**4c. The beds are OUT of the beer course, and the reason generalises.**
Reported this week as "the background music is terrible, and it goes up and
down in volume — we basically need to make a completely different background
music". Both halves are true and they are different problems.

The pumping is not a bug. The bed sits at −8 dB and ducks 12 dB whenever anyone
speaks, exactly as docs/design-direction.md §3 prescribes. What the wine course
did not expose is what happens when a chapter is TEN MINUTES of nearly
continuous narration: every sentence ducks, every gap releases, and the result
is a hand on the volume knob for the length of the chapter. The wine chapter is
eight minutes with more air in it and it was reported the same way, more
quietly.

So there are two fixes and only one of them is "better music":

  - **a bed does not belong under continuous speech.** It belongs at a scene
    opening, under a picture with no voice on it, and at an ending. Under a
    paragraph it is something to duck, and ducking is the thing being
    complained about. This is a change to the design direction, not to a
    synthesiser, and it costs nothing to try: put a bed on the first and last
    scene of a chapter and nowhere else.
  - **and then the music itself.** ACE-Step, item 4 below. Karplus-Strong
    drones are what a synthesiser gives you for free and they are not a score.

Chapter one of the beer course ships with no bed at all — a room tone under the
mash, the effects, and otherwise the voice. That is not the final answer; it is
the honest one until there is music worth ducking.

**4a. The music can be turned off, and that is the honest state of it.** The
bed ducks 12 dB whenever anyone speaks, which is the grammar working exactly as
docs/design-direction.md prescribes and reads as a hand on the volume knob for
the length of a chapter. Reported that way, along with "the actual music is not
very interesting". So there is a switch in the transport now — a note that
becomes a note with the wire cut — remembered across sessions, and it silences
the BED only: an effect is a thing the narration just named and a room is a
room. A pack that declares no `sound` surface does not get the button.

Two things it does not fix and that come next, in this order:

- **The effects.** Three in the wine chapter, at 4:32, 6:42 and 7:30, and they
  were reported as not working at all. That is the next thing to measure — the
  bed's level was wrong by 35 dB and nobody had metered it, so assume nothing
  about the effect levels either.
- **The beds themselves.** Karplus-Strong drones are what a synthesiser gives
  you for free and they are not a score. The survey below says which models the
  licence allows; whether the pumping is still objectionable at a good level
  with real music is a question that cannot be answered until there is real
  music.

**4. Music — the licence survey is done, and it did not fail.**

This list expected it to: MusicGen's weights are CC-BY-NC, which is the AudioGen
trap recorded further down, and several "open" music models restrict deployment
rather than output. Three clear the bar. Read on 27 August 2026, from the model
card and the LICENSE file rather than from a summary of either:

| model | code | weights | verdict |
|---|---|---|---|
| **ACE-Step v1-3.5B** | Apache 2.0 | Apache 2.0 | **clears.** The LICENSE file is the standard Apache text with a copyright line and no added clauses. Instrumental or sung, ~4 min, runs on a consumer GPU. |
| **Magenta RealTime** (Google) | Apache 2.0 | CC-BY-4.0 | **clears, with attribution.** Google claims no rights in the output. Built for a continuous stream, which is the shape a bed actually is. |
| **YuE** (m-a-p) | Apache 2.0 | Apache 2.0 | clears, and the card explicitly encourages monetising the output — but it is a 7B song model with vocals, which is the wrong shape for a bed. |
| Stable Audio Open 1.0 | — | Stability AI Community Licence | **fails.** Commercial use needs a separate agreement. |
| MusicGen / AudioCraft | MIT | CC-BY-NC | fails, and it is the trap this file already records. |

So the recommendation is **ACE-Step for beds**, on the same argument that chose
MOSS-SoundEffect and FLUX.2-klein-4B: Apache 2.0 on the weights themselves, with
Magenta RealTime as the alternative if a seamless continuous stream turns out to
matter more than prompt control. CC-BY costs a credit line, and
`content/<pack>/sound.json` already requires one.

WHAT STEP TWO COSTS, because it is not small and it is somebody's machine: a
7-8 GB weights download, an install into `.venv-audio` (which is Python 3.12 on
torch 2.6+cu124 with a hand-satisfied import chain — read this file's note on
what that cost the first time), and GPU minutes per bed. Then the real work,
which the licence has nothing to do with: **a bed has to loop at the seam**, and
`dev/sound-lab.html` already measures that on the samples. A four-minute song is
not a bed; what is wanted is 20-40 s that joins itself, generated long and cut
at a zero crossing the autocorrelation agrees with.

**5. DONE — the picture reviewer.** `tools/review-pictures.py <pack>` puts every
picture beside every sentence it is actually on screen for, in both languages,
with the prompt that made it, its `claims` and `omits`, and how long it holds.
`--set` writes a corrected prompt back and prints the render command; nothing
regenerates by itself, because a person has to look at the result anyway.

**What it taught, and both halves are in the file.** The one thing it can count
mechanically — how many of the words a picture ASSERTS are spoken while it is up
— is neither a flag nor an order. As a flag it fired on all twelve wine pictures
including the good ones, because `claims` describes a picture and narration is
prose about a subject and they are supposed to share few words. As a sort order
it put three correct pictures at the top on 0 of 9 words ("Italy is full of
mountains" over a narrow valley with one road matches nothing and is exactly
right) while the picture that WAS wrong sat in the middle. So it prints the
number and orders the report the way a viewer meets the pictures.

**And it found a defect in `gen-image.py` on its first real use.** Candidates
are named `01..0N` per render and accumulate in one folder, so `--accept id=4`
indexed sorted filenames across renders and installed a picture made from the
PREVIOUS prompt — with the new `claims` and `omits` written beside it. A render
writes `_run.json` now; `--accept` numbers that run, says how many older
candidates it is ignoring, and refuses outright when the prompt has changed
since. Both confirmed by reproducing them.

**6. DONE — the colour pass.**

**DONE: a mark on the map clears 3:1 against the ground.** `core/palette.js` used
to take a fill lightness of 42 in light and 56 in dark whatever hue it was
applied to, which is a statement about no colour in particular: measured against
`--atlas-land`, a dark-theme red came out at 2.21, an Antonian purple at 1.96
and a light-theme Pompeian teal at 2.46, against WCAG's 3.0 floor for a mark
that is not text. The lightness is a RESULT now — start at the band, walk away
from the ground until it clears — with hue and saturation untouched, so a family
still reads as one family. Worst move: eleven points of lightness on a
dark-theme red. Worst score after: 3.01, on every faction of every pack in both
themes.

**And the hand-tuned pack was not exempt after all.** This list said "the one
pack that passes is the one whose factions are hand-tuned `token:` references".
It did not pass: `--red` in the dark theme is the same colour a march is stroked
in and measured 2.68 against the map ground. Four points of lightness (#e0645c
-> #e3746d) clears it at 3.05, and red ink on dark paper improves from 5.31 to
6.04 at the same time.

**The bench that could not see any of this.** `marker/ground` scores
max(fill, ring) and the ring is `--atlas-ink`, which is the opposite of the
ground by definition — so a pin read 13.64 while its fill read 2.21, and the
fills went on failing behind a passing number. `check-contrast.py` measures
`fill/ground` directly now, read off the `--f-*` the palette publishes rather
than off a screenshot, because a one-pixel antialiased stroke samples as a blend
of the colour and the ground and cannot answer the question. Gated on all four
packs. Confirmed by putting the fixed lightness back and watching it fail at
2.21, which is the number this file recorded.

The four palette ROLES (`tone:red` and the rest) are measured and printed but
not gated: they are hand-tuned tokens shared with the DOM, and moving them moves
every red in the app.

**DONE, and the number that was quoted was wrong in both directions.** This file
said 3.91 against AA 4.5 for `--ink-soft` on `--paper-veil`, and the tokens
alone give 5.58 over the brightest possible plate; neither had been measured on
the rendered thing. `check-contrast.py` samples it now — the unsaid words, which
are most of every line at any instant, against the pixels beside them — and it
samples TWICE: at the pack's contrast beat, and again at a beat with a picture
up, because the caption is `--paper-veil` with a backdrop blur and what its ink
is read against is whatever is behind it.

Measured, light theme: 5.30 over the map and **4.19 over a picture**, which is
where a caption is doing the most work. Dark theme passed throughout. Six points
of lightness on `--ink-soft` (#6b6152 -> #595144), same hue and saturation, and
the worst of the four packs is 4.81. The number is taken from the worst plate in
all four and not the first one measured: three points cleared the wine chapter
and left the Revolution at 4.25 and Rome at 4.23. Gated on every pack in both
themes.

That closes the colour pass.

**7. The menu, and the decision about Explore. The evidence is gathered; the
decision is one sentence and it is not a tool's to make.**

WHAT IT COSTS. `js/` is 2 382 lines and 87 KB of JavaScript, plus about 39 KB of
CSS in `timeline.css`, `map.css` and `sheet.css`. `js/main.js` is `index.html`'s
only entry point and it imports all of it statically, then initialises the whole
of Explore — map, routes, scrubber, tour, timeline, sheet — BEFORE it starts
Fortell. So a reader who opens a chapter and never touches another tab still
pays for every byte of it. For scale: `engine/` is 281 KB, `map/` 162 KB,
`core/` 58 KB.

It also carries most of what is left on the design-direction list: 11 of the 12
remaining literal font sizes in `css/` are in those three files, and "Explore
draws Virginia twice" is below.

WHAT IT UNIQUELY GIVES — and this is the part that has changed. The one
capability this list said would justify keeping it, *tap a place and read about
it*, IS ALREADY IN FORTELL: `engine/depth.js` opens a place note on `atlas:tap`,
and `engine/surfaces/map.js` makes a pin tappable only when the pack has prose
for it, so the affordance appears as a course is written. The library and the
dossier are `core/entries.js`, shared by both modes already. What is genuinely
Explore-only is the free-roam map with events on it, the timeline scrubber and
the guided tour — and **only american-revolution has the content schema those
need** (`events.json`, `geo/routes.json`, `geo/places.json`). The other three
have at most a `people.json`, which Fortell reads too. That one pack is frozen.

SO THE READING IS: one course of four has the content, its distinguishing
capability is already in the narrated mode, and it is 126 KB that every visitor
loads. Retiring it is the answer the evidence points at. It is not a change a
tool should make on its own, and it is worth saying what each answer costs next:

  RETIRED   delete `js/` bar the chooser and the way-out, delete three
            stylesheets, and `check-contrast.py` loses its `land/water` probe,
            which is Explore-only and the one measurement only that pack can
            answer. It would have to move onto the story stage or go.
  KEPT      then it should at least be LAZY: split `js/main.js` into a shell
            and load the Explore modules when a reader first leaves the story
            tab. Worth doing only under this answer, which is why it is not
            done.
  FOLDED    the free-roam map becomes a depth-layer view inside Fortell,
            reading the same pools rather than a Revolution-shaped schema.

---

## Two more numbers that were not measured on the thing

`--caption-h` (below) was the first. Two more turned up the same way, and both
are now measured rather than derived:

- **"Roughly 40 % of the frame is spoken for before the map draws anything."**
  Three separate measurements of PARTS added together — a 126 px deck reserve, a
  127 px caption, a 78 px transport, against 734 — and the parts overlap each
  other. Rasterised as one thing, the map keeps 68-77 % of its host at rest and
  drops to 28-35 % only when a card is up. `tools/check-overlap.py` prints it
  per chapter.
- **"The caption's unsaid ink is 3.91 against AA 4.5."** Computed from the
  tokens it is 5.58; measured on rendered pixels over a picture it was 4.19.
  Fixed, and now sampled at a beat with a plate up rather than at whichever beat
  was convenient.

The shape is the same every time: a number that describes what is on screen has
to be measured on what is on screen. A sum of parts is not it, and neither are
the tokens the parts are written in.

---

## A measurement I have been quoting is not stable

`--caption-h` is published by a ResizeObserver, and read straight after a render
it wanders by a **whole line** between runs. The same fifty italy-wine beats
measured 127 / 155 / 238 px median on three consecutive passes of the same
harness. Measuring `.captions` directly instead gives 169 / 294.

So "the caption box is 127 px median, 211 worst" — which is in this file, in a
commit message, and was said to the user more than once — is one sample of a
noisy quantity presented as a fact. The DIRECTION of the change (the box got
shorter when the fact card was capped) is not in doubt; the numbers are.

What to trust instead: a PAIRED measurement in one page — same beats, same
render, one thing toggled — which is how the style.json wiring was proved to
change nothing (0 of 50 beats differ). An absolute reading of a
ResizeObserver-published custom property is not evidence.

This is the same family as `check-turn.py`'s occasional flake and the
`check-engine` epoch-guard flake: three separate places where a number is read
too close to the thing that produces it. Worth one pass over every probe that
reads a published custom property.

---

## Smaller, and each with a measurement behind it

- **The map stall does not reproduce, and the geometry was over-fine for one
  pack only.** Measured on this machine with a rAF probe around a scene-start
  flight, cold and warm, both packs: the worst frame is **20-40 ms**, not the
  52-85 ms this list has carried. Either the ground-buffer work recorded below
  fixed it or it needs a different flight to provoke; either way the number
  should not be repeated until somebody can reproduce it.

  What WAS wrong is the tolerance. `fetch-detail.py` simplified every subject's
  geometry at a flat 0.0001 degrees, described as "finer than a pixel at zoom
  14" — and measured against what the packs actually do that is 0.38 px for the
  wine course (deepest zoom 12.6) and 2.03 px for the Revolution (14.8, a beach
  a chapter stands on). One number that knew about neither. It is derived from
  the pack's own deepest zoom now, and `--resimplify` thins an existing file
  without re-querying Overpass.

  Wine: 92 155 -> 70 129 points, 1.5 MB -> 1.15 MB, and 0.64 % of pixels differ
  by more than 8/255 at its deepest beat. Its worst frame went 31 -> 29 ms,
  which is honest and small. The Revolution cannot be thinned at all without
  visible loss, so the lever there is `detail.minZoom` or tiling, as before.
  **Narvik was thinned by 11 % and put straight back**: `check-sealanes.py`
  found `hardy-ut` leg 4->5 crossing land, because thinning a coastline moves
  the shore under a route that ran close to it.
- **The overlap harness is committed, and it found the licence credit.**
  `tools/check-overlap.py` is the 646-frame pairwise harness that found the
  first round of these and was then thrown away — which is why "the remaining
  30 are portrait cards" sat here for weeks with nothing able to re-measure it.
  On its first run it found the map's ODbL credit overlapping the CAPTION in
  all 50 frames of the wine chapter: the credit cleared
  `--floor + --caption-h + --s1`, and the caption SLOT sits a little above the
  floor, so the sum landed 8 px inside the box. `engine/captions.js` publishes
  `--caption-reach`, measured off the elements, and it is clear in all 571.
  Now a ratchet in `check-all.py` (2m42 on the sampled walk, which found the
  same five pairs as the exhaustive one).
- **What is left: a portrait card hangs into a centred quote** — 2 frames of
  571, worst 47 882 px², plus a compare card in 1. A fix was tried and MEASURED
  WORSE: publishing the top deck's reach and starting the mid band below it
  shrinks a band that is bounded at both ends and centres its content, so a tall
  quote then overflowed it in both directions (5 pairs became 7, the quote
  landing on the caption in 6 frames and the transport in 3). What is left is
  capping how far a face may hang, which is a decision about how big a face is
  allowed to be.
- **DONE: the faceless note is no longer italic.** Section 2 keeps italic for a
  quotation, and "ingen kjent avbildning" is the app describing the record, not
  somebody's words.
- **DONE: `atlas-flash` and `atlas-ping` are on the scale.** The muzzle flash
  takes `--t-exit` (620 -> 600 ms). The ping keeps 2.8 s and stops being a loose
  number: it is `--t-ping` in `css/tokens.css` with its derivation beside it,
  and section 6 of the design direction names it the seventh token next to the
  2400 ms mood. A pack can move it like anything else.
- **Explore draws "Virginia" twice, overlapping.** Its two label systems never
  declutter against each other: `js/map.js drawPlaces()` adds period names with
  no `rank`, and the collision pass skips those. Frozen with Explore.
- **`tools/check-legible.py` is not in `check-all.py`** — twelve minutes for
  sixteen chapter/language pairs would roughly double a run. It is a report you
  run, and it should stay one until the content it reports on is cleaned up.
- **`tools/shoot.py` has no moments for any pack but the Revolution.** It runs
  again now, but `MOMENTS` only describes two chapters.
- **DONE: a flight that lands behind the closing veil is reported.** The visible
  deadline is `motion.turn` before the scene ends, read from the pack's own
  style.json rather than hardcoded at 1200 ms. A note and not a failure, because
  whether the arrival was the point is the author's call. Nothing in the eight
  chapters that ship trips it — the tightest flight has 3.1 s to spare — so it
  was confirmed by stretching one wine flight to 5.5 s over a 6.1 s scene and
  watching it fire in both languages.

---


## Phase 2 — type, furniture and the phone

"The text is too small" had been said four times and answered four times by
looking at the number. The number was never the question.

### A caption is a subtitle, not body text

Measured: the caption was a flat 17px on an 844px phone — **2.01 % of screen
height**, against broadcast subtitle practice of 2.5–3 %. A caption is read at
arm's length with the eye mostly on the picture, and a subtitle is sized as a
share of the screen. Body text is read close and can be fixed in px. Sizing one
as the other is why it kept coming back.

`--fs-md` is `clamp(1.1875rem, 5.4vw, 1.5rem)` now — about 21px at 390 wide,
2.5 % of the screen — and every other step moved up a notch so the
relationships hold. **Literal font sizes across `css/`: 34 → 11**, and all
eleven are in files frozen with Explore.

The cost, stated rather than discovered: bigger type means less map. It is the
third independent measurement this week pointing at the same thing.

**And the standard now names STEPS, not pixels.** Section 2 prescribed the map's
three label sizes as `13px / 11px / 15px`. Those WERE the steps — `--fs-sm`,
`--fs-2xs`, `--fs-base` — but written as numbers they read as three chosen pixel
values, and the moment the scale moved they became three wrong ones. Keeping
them would have put the city label off the one step named for it and town names
on the provenance step, which is the collapse the "distinction of kind" argument
exists to prevent. The map's steps are unchanged; the pixels are 15/12/17.

### The furniture stopped being UI

- **The pin chip** — "a text box with a border" — has lost its plate, border,
  radius and padding. It is a place name set louder, wearing the same halo the
  map's own labels use. The dot still lands at **0.00 px** deviation.
- **The clock** was a 999 px pill at 14px. It is the kicker the direction
  already called it.
- **`.atlas-pin[data-tap]::after`** was drawing a gold capsule around dot *and*
  name at `inset: -4px` on the flex row, contradicting its own comment. It was
  invisible as a fault only while the name had a box of its own to hide in.
- **The stat label was 9.5px** under a 1.45rem number. That was the whole of
  "the stats look mediocre".
- **`"REPRESENTANTER"` ran clean off the right edge of a 390 px phone.**
  `max-width: 12ch` does not hold a chip together: an unbreakable word wider
  than the cap simply overflows a content-sized box.

### The plate credit was illegible on 82 of 84 pictures

Not small — *transparent*. The credit is `rgba(255,255,255,α)`, so over a pale
sky it composites into the sky.

| all 84 plate credits, both themes | before | after |
|---|---|---|
| worst | **1.25 : 1** | **6.87** |
| median | 2.14 | 9.12 |
| at or above AA 4.5 | **2 / 84** | **84 / 84** |

`tools/fetch-media.py` captures artist, date, source and licence per image
precisely so the app can credit them in place. A credit that is emitted and
cannot be read satisfies the code and not the obligation — the same shape as a
rule applied to a selector nobody paints. The map's own OSM credit had it twice
over: 9px, and behind the caption.

It was also being **covered** — the stats chip sat on it in 36 frames. The decks
reserve `--s7` extra whenever a plate is on, derived from all 92 credit strings
rendered at 390 wide.

### 121 overlapping frames, now 30

Measured pairwise on effective opacity across 646 frames, four packs, both
languages. `.ov-deck--mid` was `top: 32%` and **nothing else** — never anchored
to `--caption-h` at all — so `.ov-quote__card` landed on the caption **31
times** and on the transport 6. It is a band bounded by the two decks it sits
between now: 1 and 0. The remaining 30 are portrait cards reaching down out of
the top deck, pre-existing.

Caption box, measured over all 1142 beats: median **152 → 127 px**, worst
**279 → 211**, beats running to six lines or more **109 → 67**, eight-line beats
**2 → 0**. The fact card is capped at two lines of name and three of hook:
worst **178 → 126 px**, and `DECK_RESERVE_PX` follows it from 163 to 126.

That 163 was stale before it was ever committed — at the new type scale the same
cards measured 178. A number derived from what ships has to be re-derived when
what ships changes, which is the argument for it living in a per-pack
`style.json` rather than in a module.

### The coach was pointing through the thing it points at

`.coach` anchored to `word.getBoundingClientRect().top` and sits at
`translate(-50%, -140%)`. A term on any line but the first therefore put the
pill on the line ABOVE — on top of the sentence it exists to point at. It got
worse when the caption grew a line, which is how it surfaced.

It anchors to the caption now, and **follows it**: the caption box is anchored
to its BOTTOM edge, so a beat that wraps grows upward into a pill that was
positioned once. A ResizeObserver rather than a frame loop — rule 2 says frames
are not a contract, and a backgrounded tab coming back must not find the pill
somewhere else.

Measured over every term the two narrated packs mark, both directions:
**9 → 0** and **6 → 0**.

Worth recording how nearly this was mis-measured: the first two probe runs
reported three and four remaining failures, and both were reading the app's own
earlier pill rather than the one under test — `document.querySelector('.coach')`
takes the first in the DOM and the app had already placed one. A probe that
picks the wrong element reports a fixed bug as broken just as readily as it
reports a broken one as fixed.

### The one mobile breakpoint in the app was not running

`css/chooser.css` carried `.wordmark--linked { font: inherit }` — a `<button>`
reset for an element `js/main.js` builds as an `<h1 role="button">`. chooser.css
loads after shell.css at equal specificity, so it beat the topbar's type **and
the media query inside it**, because a media query adds no specificity.
Measured: **17px system-ui, 55.1 px tall in a 52 px bar, second line cut off.**
That is the exact regression `shell.css:46-57` records as fixed, back through
the load-bearing `<link>` order — which nothing measures.

**The back arrow was `display: none` on every phone.** `.wordmark span` (0,1,1)
also matched `.wordmark__back` (0,1,0) and outranked it.

The chooser — the "menu is 80 % on usability" complaint — went from **1539 px of
content at 360 wide (1.82 screens, 1.9 of 4 cards visible)** to **758 px, all
four subjects on one screen**. Cards go horizontal below the breakpoint; the
type is untouched, because shrinking the front door's names would have been the
fourth wrong answer to "the text is too small".

The breakpoint is **`max-width: 30rem`**, in rem rather than px on purpose: a
reader who sets 20px text gets the compact chrome at 600 device px, which is
when their type needs it.

**Safe area.** `--floor: calc(var(--transport-h) + var(--safe-b))` is one
definition used by the caption slot, both decks and the plate credit;
`.story__chrome` clears the home indicator; the top deck and the plate badge
clear the notch. And `--safe-l` / `--safe-r` are new: `manifest.webmanifest`
declares `orientation: "any"` and **nothing in the app had an inline-axis inset
at all**, so a notched phone held sideways put the cutout over the wordmark.
Verified with a simulated 47 px left cutout.

**`.sr-only` is dropped, not wired up.** 29 controls are named with `aria-label`
and nothing has ever referenced it. Two mechanisms for one job means the next
author picks whichever they remember and half the app ends up labelled each way.
`css/base.css` records the condition for bringing it back: text that must be
read *in the flow* — a skip link, a landmark heading.

### Two tools that had quietly stopped working

**`tools/shoot.py` failed on every invocation.** It opens the server root with
no `?emne=`, and the moment a second subject landed in `content/packs.json` the
app answers that with the chooser — so `#story-map` never appears and the boot
wait dies on a twenty-second timeout. It was inferring the pack ("the only
one") and the chapter (from the ORDER of a table of nicknames, matched against
the order of rows on the cover). Both are declared now.

**`check-contrast.py`'s `label/ground` was reading a label as ground** — the
third instance of that bug in one file. `measure_labels()` samples a ring one
line-height outside a `.place` box and calls it ground; on the Explore map that
is exactly where the ATLAS draws its region names, and Explore paints both
label systems at once. It was sampling `Nord-Carolina`'s glyphs. Same frame with
`.atlas-place` hidden: **1.67 → 4.83**. `run_story()` had hidden them before its
own ground read since the day it was written.

### Still open, out of this phase

- **The caption's unsaid ink measures 3.91 against AA 4.5** over the worst
  plate, in the light theme. `--ink-soft` on `--paper-veil`, pre-existing, and
  a token decision rather than a shape one — the box got 25 px shorter without
  moving the number. Belongs with the colour pass, beside the faction fills.
- **`.ov-deck--lower` has `transition: bottom var(--t-tap)`**, so the fact box
  and the stats glide vertically on every caption reflow: stage motion at a
  chrome duration, which section 1 forbids.
- **`.ov-portrait__card` reaches out of the top deck** into the mid and lower
  decks in 30 frames.
- **`.ov-portrait__card figcaption u` is italic** ("no surviving likeness"),
  which section 2 permits only for a quotation.
- **Explore draws "Virginia" twice, overlapping.** Its two label systems never
  declutter against each other: `js/map.js drawPlaces()` adds period names as
  `map.pins` with no `rank`, and `map/index.js` skips those in the collision
  pass. Frozen with Explore.
- **`atlas-flash 620ms` and `atlas-ping 2.8s`** are still off the motion scale.
  620 wants `--t-exit`; 2.8 s has no token and its "3 × 2.8 s = one sentence"
  derivation is argued in the file. A scale decision, not a find-and-replace.
- **The type scale has no per-pack multiplier yet.** `style.type.scale` is in
  the plan and is not built.

---

## The place the sentence names, and whether you can see it

"On mobile Barolo is basically in the outskirts and part of the text is cut
off." One complaint, and measuring the frame it came from turned up two
different faults in it and a third underneath them both.

At 390x844, Norwegian, `italy-wine` s5.b2, where the narration says *"Barolo
ligger sørvest for Alba. Barbaresco ligger nordøst"*:

    Barbaresco   anchor x=363 of 390   label 374 -> 455   65 px of 80 off the right edge
    Barolo       label 39 -> 94, y 528 -> 555             on screen, and
    .ov-fact     12 -> 189, y 514 -> 597                  containing it whole
    .captions    16 -> 374, y 610 -> 712                  below both; innocent

The chip you could read one letter of was **Barbaresco**, clipped. **Barolo**
was drawn correctly and painted over by the fact box explaining Barolo.

### A label flips before it clips

`placeLabel()` already clamped a label inside its region and the frame, and was
called for REGIONS ONLY. Point labels and pins got `translate3d` plus
`onScreen()`, which is a *visibility* test with 60-140 px of slack on both
sides — so a name whose anchor is on screen and whose text is not counted as
shown, and `.atlas-place` / `.atlas-pin b` are `white-space: nowrap` running
rightward from the anchor.

A point label now takes the first of **right, left, above, below** that fits,
and is dropped if none does. Right first because that is where every name
already sits, so a flip reads as the exception; above and below break the
reading line and are last. Pure function of `(anchor, cached metrics, frame)` —
deliberately no memory of last frame's side, because "keep the previous side
unless it stops fitting" is the accumulation rule 1 forbids and `engine-lab`
would have caught it.

Measured, all eight chapters both languages, 908 named places:
**clipped 71 -> 0**, legible 382 -> 434. Collision drops fell 91 -> 32, and 73
new "no room on any side" appeared, which is the honest drop replacing a
clipped label.

**And it got cheaper.** Per-frame label work, same scene, 5 x 60 frames:
**0.675 ms median -> 0.215 ms**, worst 1.30 -> 0.40. Placement uses the cached
metrics, so `declutter()` stopped reading `offsetHeight`/`offsetWidth` per label
per frame, and `textContent` is only written when it changes — it used to be
written unconditionally, dirtying layout before every read.

Four things that were wrong going in:

- **The clamp was horizontal only.** There was no vertical constraint at all, so
  a region whose centre landed near the top drew its name half above the map.
- **The dot was never on its coordinate.** `align-items: center` put a
  *labelled* pin's dot 5.75 px below its coordinate while a *bare* one sat
  exactly on it, and `.atlas-place::before { top: 50% }` put the place dot
  ~1.3 px above. Both are exact now — and that is why the contrast numbers below
  moved at all.
- **`offsetLeft`/`offsetWidth` are not precise enough for an edge test.** They
  round to whole pixels: a label whose box top is 2.3 reports 2.0, so both top
  corners of a 390 px frame are dropped by 0.0 px. Measurement uses rects.
- **`transform-origin: 0 50%` on `.atlas-pin` is inert** — nothing scales or
  rotates a pin since `atlas-pop` became opacity-only.

The bench is `dev/map-lab.html` -> *Etikettest*, and it runs four times: both
themes x fix-on and bug-back, through `map.bench.setLabelSides(false)`. Every
run prints both columns — **0 crossings with placement, 20 with the bug back**.
If the bug-back column ever reads 0 the bench declares itself worthless rather
than green.

### The camera composed into a band that was about to be furniture

`framePadding()` measures the overlays and hands them to the fit, and it
measures **what is on screen at fit time**. The camera fits at the top of a
scene; a fact box arrives four sentences later. No amount of measuring at t0
sees that.

So a scene that raises a card now reserves the lower deck's corner whether or
not anything is in it yet — a corner rather than a band, reusing the "push down
or push in, whichever costs less picture" logic already there for portraits.
Barolo moved from `39-94 x 528-555` to `175-230 x 449-477`: clear.

`DECK_RESERVE_PX = 163` is measured, not chosen — all 78 fact cards the four
packs ship, both languages, rendered at 360 px wide; tallest is
`black-soldiers` at 163 px.

**That number is itself the finding.** On a 390x844 phone the caption is ~100 px,
the transport ~78, a fact box up to 163: roughly 40 % of the frame is furniture
before the map draws anything. Padding cannot fix that. It is the argument for
the map being an artifact over the story rather than the ground under it.

Also fixed while in there: `sceneAt` is module-level and was never reset on
mount, so switching chapters while the first was at scene five left
`drawStandingLabels()` applying scene five's rules to the new chapter's places —
a place declared `"label": "s3"` would appear in scene 0. Needs a mid-chapter
switch to show, which is why nobody had seen it. Same family as `regionsReady`.

### `tools/check-legible.py` — half of the unanswerable question

CLAUDE.md said "does the picture show the thing being said" cannot be
automated. That is true of the semantic half. The spatial half is mechanical:
**when the narration names a place, is that name on screen and not under
anything?** Verdicts are CLIPPED, COVERED, MISSING and PLATED, with the beat's
own sentence printed beside every finding.

First honest run, before the flip fix:

    named 908   legible 396   clipped 64   covered 71   missing 127   plated 114

- **Every one of the clipped was the RIGHT edge.** Zero left, top or bottom —
  which is the shape the flip fix addresses and good evidence it is the right
  fix. Eleven were worse than clipped: the anchor itself off the frame
  (`narvik` at x=480 of 390) and the map drew the name anyway.
- **The caption box is the biggest coverer at 62 region names.** The fact box
  covered 2. Region names losing to the caption is the dominant fault in the
  Roman chapters.
- **30 of the 44 "no label drawn" are `map.flyTo`** — the camera flies somewhere
  the map never names.

It derives its verb list from `engine/verbs.json` and its overlay list by
hit-testing rather than from a hardcoded list, which is why it found `.coach`
and the transport's seek track covering names — neither of which anybody would
have listed. Its self-test proves the derivation: a name under a `div` the tool
has never heard of is reported as covered, BY NAME.

It reports and never fails; `--strict` exits 1 when the content is ready to be
gated. It is deliberately NOT in `check-all.py` — twelve minutes for sixteen
chapter/language pairs would roughly double a run, and this repo's own argument
against the old five-command list was that it is a list people run four fifths
of.

Two things it taught that any future probe needs: **clipping is against the MAP
HOST, not the window** (390x734 inside a 390x844 phone, and `onScreen()` allows
120 px outside it), and **a label's position is not a safe key for finding it**,
because a label that flips is no longer at its anchor — match on the text the
map says it drew.

### A rule-1 divergence the one bench for rule 1 cannot see

`place.highlight` skipped its camera centring under `instant`
(`if (cue.centre !== false && !instant)`). So playing forward centred the map on
the place being pointed at, and seeking to the same second left the camera
wherever the rebuild's earlier cues had put it. One moment, two pictures.

Nothing caught it because CLAUDE.md puts the camera OUTSIDE
`dev/engine-lab.html`'s stage signature deliberately — it is measured in map-lab
instead — so the one bench that replays every cue both ways is blind to exactly
this. `over` differing between the passes is fine and is why the exclusion
exists; arriving somewhere different is not the same kind of difference.

Swept for siblings: the only other `!instant` branch in `engine/scenes/*` is the
one-shot sound suppression, which is correct and documented.

### And the pins do not clear 3:1 — a false PASS that took a flip to expose

`measure_markers` sampled the "ground" at one point, `dot.x + dot.w * 1.4` —
about 15 px right of an 11 px dot — which lands INSIDE the pin's own opaque chip
whenever the pin points right. A pin was being scored against its own plate. It
read 3.27 and passed. The moment labels learned to flip left, that sample
finally landed on ground.

The ground points come from the browser now — eight on a ring outside the dot,
anything inside the pin's own box discarded — and the score is the MEDIAN of
them. Worst-of-eight was tried first and is worth recording as the tempting
wrong answer: Barbaresco sits beside the Tanaro, one probe lands in the river,
gold on water scores 1.54, and a pack fails on two pixels of blue. Strictness
that measures an artefact is not strictness, it is noise, and noise is what gets
a check skipped.

The honest numbers, story-stage pins, floor 3.0:

| pack | light | dark |
|---|---|---|
| american-revolution | 5.37 | 6.87 |
| italy-wine | 3.47 | **2.68** |
| norway-1940 | 5.62 | **2.19** |
| roman-empire | **2.41** | 4.56 |

**The one pack that passes both themes is the one whose factions are hand-tuned
`token:` references. The three that fail are all hue-derived.** `core/palette.js`
derives a faction fill at a FIXED lightness — `LIGHT {s:57, l:42}`,
`DARK {s:50, l:56}` — against no contrast target at all.

`--gold` was fixed, because it was the single palette ROLE that failed and it is
the map's look-here colour, the one that can least afford to: measured against
the light ground, red 5.36, blue 7.33, sage 4.45, gold **2.94**. It is `#a07436`
now, the same hue and saturation two points darker, 3.36. Dark was never in
question at 8.73.

`--gold` was fixed, because it was the single palette ROLE that failed and it is
the map's look-here colour, the one that can least afford to: measured against
the light ground, red 5.36, blue 7.33, sage 4.45, gold **2.94**. It is `#a07436`
now, the same hue and saturation two points darker, 3.36.

**And then the pins were fixed properly, by a complaint rather than a number.**
The reaction to the frame was "ugly red marker", which is the same defect the
2.19 was: a dark-red dot on dark-olive ground reading as a smudge.
`measure_markers` scores `max(fill, ring)` on the argument that a pin presents
two boundaries and the stronger is what you see. The argument was sound; the
ring was not doing it. The border was `--atlas-halo`, which is near-white on
light ground and near-black on dark — always about the same value as the ground
it sat on. Measured against `--atlas-land`: **1.11 light, 2.15 dark.** It
separated nothing.

The ring is `--atlas-ink` now, which is the opposite of the ground by definition
in both themes: **14.54 and 8.13**. It is also what a printed map does — a
coloured disc with a dark keyline. Every pack now clears with room, so the story
pins are GATED rather than advisory, and the three packs that were left gated on
nothing have their gate back:

| pack | light | dark |
|---|---|---|
| american-revolution | 5.37 | 6.87 |
| italy-wine | 13.64 | 8.13 |
| norway-1940 | 13.64 | 8.13 |
| roman-empire | 6.01 | 15.53 |

**Still owed, and it is not the pin's.** The FILLS remain low-contrast on the
three hue-derived packs, because `core/palette.js` picks a fill lightness —
`LIGHT {s:57, l:42}`, `DARK {s:50, l:56}` — against no contrast target at all.
The ring carries a pin. Nothing carries a march, an arrow or a front, which are
strokes in those same colours and have no ring. That is the colour pass, and it
now has both a number and a reason.

`measure_markers`'s own comment claimed that "on a dark map it is the ring that
does that work, not the fill". Measured, dark, Malmkaia: dot (196,90,104) scores
2.19, ring 2.19, ground (76,72,56). The ring adds nothing in either theme —
`--atlas-halo` is a near-white ring on near-white ground in light and near-black
on `--atlas-land` #4c4838 in dark. That paragraph is corrected in place.

---

## Phase 1 of the refactor — transitions and continuity

"Every transition is poor" was one complaint covering four unrelated faults, in
four different files, none of them where they looked. All four are fixed and
measured; the numbers are here because "smoother" is not a thing anyone can
check later.

### The zoom stopped, softened and snapped — and it was one boolean

`paintGround` in `map/index.js` sets `camMovedAt` inside the same `draw()` call
it reads it in, so `moving` meant "did the camera change on THIS frame" rather
than "is the camera moving". Every discrete wheel notch therefore landed on
`moving === false` 160 ms later and paid for a full `drawBasemap`; a six-level
flight crossed `ZOOM_SLACK` a dozen times and paid twelve. Between crossings the
buffer is scaled, so the ground went soft and then snapped sharp at each bake.

Measured headless at 580x900, dpr 2, `american-revolution` (atlantic-10m plus
`detail.json`). "Frames over 32 ms" is how many times the picture stops:

| | longest frame | frames > 32 ms | bakes (in-frame) |
|---|---|---|---|
| flight 5.2 -> 11.6, before | 80.9 ms | 7 | 17 (17) |
| after | 80.1 ms | **1** | 13 (**1**) |
| twelve wheel notches, before | 95.2 ms | 6 | 6 (6) |
| after | **0.3 ms** | **0** | 9 (**0**) |
| pinch, before | 107.1 ms | 6 | 6 (6) |
| after | **0.2 ms** | **0** | 8 (**0**) |

Four changes: two sheets with the bake sliced across tasks off a timer and
swapped when it lands; the bake zoom floor-quantised while the zoom is moving
and exact when it settles; `moving` redefined as "within 400 ms or a flight is
in progress"; and per-feature bounding boxes so `drawBasemap` culls to the
buffer's world rect. Bakes now lead the flight by 600 ms and coverage loss is
predicted rather than hit. `dev/map-lab.js`'s existing `panTest`: **25 -> 60 fps**.

`ev.deltaY` was also used raw, so the same gesture zoomed **33.3x** further in
Chrome than in Firefox. Normalised, and routed through the flight animator over
0.16 s so a notch is a movement rather than a jump: **1.67x**.

**Four things believed going in that were wrong**, all of them the kind that
sends you optimising something that was never the cost:

- **`drawBasemap` never cost 118 ms.** Canvas commands are queued; it returns in
  0.1 ms and the bill arrives in the blit. So a wall-clock slice budget ran the
  entire bake in one task and looked like it was working. The flush has to be
  forced to be measured — through a 1x1 scratch canvas, because `getImageData`
  on the sheet itself deoptimises it to software, and Chromium says so.
- **Culling was not the big win** — 1.3-1.5x. The number that mattered: z9.4 is
  14.5 ms and z9.6 is **90.5 ms**. The pack's `detail.json` *is* the cost, and
  sub-pixel culling would buy nothing, because every wood and lake in it is over
  two device pixels.
- **The 140 ms `moving` window's real failure** was not only that it looked at a
  single frame: an 81 ms bake pushes the next frame past the window, so the map
  declares itself settled mid-flight and takes a *second* sharp bake.
- **Chunking a layer is not free.** Splitting a fill across two `fill()` calls
  makes adjacent OSM woodland polygons antialias their shared edge twice — 245
  solid pixels of seam. That is this repo's own "one `stroke()` call, not one per
  region" hazard arriving in a fill. Slices are per layer, never inside one.

### The join now happens where the sound stops

The turn used to begin the instant a scene's audio ran out, so the whole first
ramp — 1.2 s of it — played after the last word: moving picture over a dead
soundtrack, and only then the cut. `Player.tailFor()` starts it `IN_MS` early,
inside the trailing silence the mp3 already carries. Measured across 124 scenes,
eight chapters, two languages: shortest trailing silence **1.250 s**, median
1.625, so a 1200 ms tail fits with 50 ms to spare — and **0 of 2934 cues** land
in that window. All four packs: the turn begins 1.18-1.19 s before the audio
ends, the stage is rebuilt at `dur +0.01…+0.04 s`, veil **1.000**.

**A chapter had no turn at all.** `openChapter(current + 1)` tore the stage down
and landed on the cover. With the new device removed again to check, that is
**17 frames, about 647 ms, of empty screen**. Now zero, veil 1.000 throughout:
`closeVeil()` takes the end card's veil to opaque and *hands the node over* so
the teardown it is covering cannot remove it, `openChapter` re-appends it last so
the incoming chapter's own end card cannot get in front of it, and `liftVeil()`
lifts it on a timer.

**The narrator was 1.2 s late, and it was arithmetic.** `player.leadInMs` is
silence measured from the REBUILD, and the rebuild is already `IN_MS` into the
turn — `goToScene` awaits `coverMs` first. Handing it `LEAD_IN_MS` stacked the
two, so the voice arrived at t = 4000 while the veil had finished lifting at
2800. `SPEAK_AFTER_MS` is the number the player actually wants, and it comes out
as `HOLD_MS`, which is the check that the reading is right: the card holds, and
when it stops holding the voice is there. Silence at a scene join: **4.0 -> 2.8 s**.

**A latent runaway, found while doing it.** During the cover window `sceneIndex`
is already the new scene while `now()` still reports the old scene's clock — on
19 April, 171 s read against a 146 s scene — and `tick()` would call `next()`
repeatedly to the end of the chapter. It does not happen today only because
`warmNext()` gets the next file's metadata in before the following frame. A
`_turning` flag makes that a mechanism instead of luck.

**A flight still in the air at the wipe: let it land, do not cut it.**
`map.reset()` touches neither `flight` nor `cam`, so it already carries on —
measured, zoom 7.009 at the change continuing to 5.000 and arriving ~750 ms after
the rebuild. Cutting would freeze the framing exactly where it got to and then
reveal it, which is the "stopped 83 % of the way to Barolo" picture preserved
rather than avoided. **The tail is what makes it invisible**: that 750 ms lands
inside the opaque window, where without the tail the same landing happens 1.2 s
before the veil is opaque, in full view of a stage about to be replaced.

### One camera cue in eight chapters could not land, and it was the Barolo shot

`check_camera_lands()` reimplements `autoOver()` in Python — and **reads the
constants out of `map/index.js` with a regex**, so retuning them there moves the
check automatically, and rewriting the *shape* fails with a message saying so.
Both confirmed. It tracks the camera cue by cue through a scene, because a
flight's duration is a function of the distance travelled and nothing authored
says where the camera was.

352 flights. **One truncation**: `content/italy-wine/chapter-1-piemonte.json`
`s3.b6`, `map.fitPlaces` on alba/barolo/barbaresco over 4.2 s, anchored to the
word *Langhe* — which is spoken 3.5 s before the scene ends. Cut at 83 %, every
time, and it is the shot the "it zooms in and then stops" complaint is about.
Re-anchored a clause earlier, to the hills *rising* rather than to their name,
at the module's own natural duration:

    no: leaves 50.25 on 'bakkene', lands 53.25, "Langhe" at 52.71, scene ends 56.31
    en: leaves 50.96 on 'hills',   lands 53.96, "Langhe" at 53.69, scene ends 57.18

The camera settles about half a second after the name, with three seconds of
arrived picture standing. All eight chapters now: 0 flights with under a second
to spare.

The two deadlines differ, and only one of them fails a build. The HARD one is
`scene.dur`, where the next scene's establishing cue kills the flight and where
the veil is opaque. The VISIBLE one is `scene.dur - 1200 ms`: a flight still
running in the last 1.2 s lands behind a closing veil and is never seen. That
wants an advisory list, not a second failure. Not written yet.

### A rule applied to a selector nobody paints

`css/story.css` styled `.story-mk`, `.story-place`, `.story-ring`,
`.story-converge` and `.stage-map__mood/__flash/__time` for as long as the map
module has been drawing `.atlas-pin`, `.atlas-place`, `.atlas-ring` and
`.atlas__mood/__flash/__time`. So when the direction said "no infinite
animation", the fix landed on `.story-ring` — three iterations, correct,
invisible — and the live `.atlas-ring` went on pulsing at the viewer for the rest
of every scene. **The rule was written, the fix was made, and the defect was
still on screen.** That is the `.ov-fact` shape a third time.

The dead copies had also DRIFTED: night at .30 against .34, the muzzle flash at
700 ms against 620 ms, the clock at `--fs-xs` against a literal 14px. A number
maintained in two places and visible in one is worse than a number nobody wrote
down. And `docs/design-direction.md` cited the dead copy in three places, which
is how the fix went there in the first place — corrected, along with the rule
that a citation points at the selector that is painted.

The ring is now a standing ring that throws a `::after` ping three times
(3 x 2.8 s = 8.4 s, one sentence). Measured on effective opacity, scrubbing the
animation rather than waiting for it — a hidden tab does not advance a compositor
animation, which is rule 2 in the small:

| | ping opacity | ring | |
|---|---|---|---|
| played forward, 12 s | 0, finished | 0.8 | **agree** |
| sought (`--still`) | 0 | 0.8 | |
| with `infinite` put back, 12 s | .85, still running at 30 s | — | diverge |

So the old ring was also a rule-1 violation: one moment, two pictures, depending
on how you arrived at it.

`tools/check-dead-css.py` now fails the build on a class in `css/` that no module
writes — a ratchet with a documented baseline that can only shrink. It found 16;
12 remain and every one is in a file frozen with Explore. It excludes `tools/`
deliberately, because `tools/check-turn.py` queried three of those dead selectors
and would otherwise have vouched for the very names it was failing to find.

### Two benches were measuring nothing, and both had a real defect behind them

**`check-contrast.py` had never measured the story stage. On any pack.**
`check-all.py` called it with no `--pack`, so it always sampled `packs[0]` —
which became the Rome scaffold when `content/packs.json` was reordered — and
three of its four measurements printed `no samples` at exit 0. That much is the
ancestor defect recorded further down this file ("it sampled whichever chapter
the cover loaded"): `--pack` was added to fix it, and this list was never taught
to pass it. The deeper half is worse: `measure()` read Explore's `.place` and
`.mk__body`, and only `american-revolution` ships an `events.json`. The tool that
exists BECAUSE the map was unreadable for months had never once looked at the
thing the app actually is. It runs per pack now, measures `.atlas-place` and
`.atlas-pin i` at each pack's contrast beat, and `no samples` fails when a pack
declares the measurement.

`italy-wine` was gated on **nothing at all** — its contrast beat showed three
regions that do not touch, and no pins. Moved to `s5.b2`, the Langhe with Barolo
and Barbaresco pinned, which is the frame the mobile readability complaint is
about. It passes at **3.27 against a floor of 3.00**, which is barely, and that
is Phase 2's problem.

**`dev/map-lab.js`'s `paletteTest` was flying to the wrong continent.**
`packAreas()` takes `packs[0]`, and the test then fitted to
`[[30.2,-86.2],[47.6,-66.6]]` — the eastern seaboard, hardcoded — so it loaded
Roman provinces, pointed the camera at Georgia and reported "Ingen naboer maalt".
It frames the geometry it loaded now, and the first honest run fails:
**Macedonia / Achaea at ΔE 9.7 against a floor of 10.0**, with Illyricum /
Achaea at 10.3 behind it. The tint family runs out of separation at fifteen
same-side regions, where thirteen colonies clear 11.15. Real, and not a
transitions problem — see below.

### The precache held the one level no pack ever opens on

`sw.js`'s `PRECACHE` carried `world-110m.json` and no other geometry. Every
pack's default zoom (10.5 / 8.4 / 5.6 / 5.0) resolves to `atlantic-10m`,
`world-50m` or `mediterranean-10m` — and `drawBasemap` fills with water and
returns early while a level is still loading, so on a cold cache the first frame
of every chapter was an empty sea. Each pack's registered levels are precached
now: 3.19 MB for all four, because `mediterranean-10m` serves two.

`geo/detail.json` stays OUT: 6.46 MB, never shared, only reached above zoom
9.2-9.5 — and precaching it would not fix the stall anyway, because the parse and
the bake happen whether the bytes came off the network or out of the cache. The
fix for that is prefetching at chapter load, which knows which pack you opened,
and `map.warmDetail()` does it from `mountMap` now, beside `ensureRegions()`.
`draw()` keeps the late path as a fallback.

Worth knowing, and nobody had looked: **`PRECACHE` was already 29.2 MB, about 24
MB of it every pack's `media/` pictures.** Geometry at 3.2 MB is 11 % of that,
for the ground existing at all. `build-sw.py` prints megabytes now, so the next
24 MB is harder not to notice.

### Still open, out of this phase

- **The remaining stall is data, not code.** One in-frame bake per flight, 52-85
  ms. It is `detail.json`: 109k points in 3,060 features, `minZoom` 9.5, inside a
  0.95° x 0.7° box that fits entirely on screen at that zoom, so there is nothing
  to cull. Raising `detail.minZoom`, or simplifying and tiling it in
  `tools/fetch-detail.py`, is the only thing left that moves it. `detail.minZoom`
  is a candidate for the per-pack `style.json` in a later phase.
- **A fit frames the COORDINATES; the labels hang outside them, and nothing
  clamps a point label.** Shot at 390x844 in `shots/phase1/`: at wine s5.b2 the
  narration says "Barolo ligger sørvest for Alba. Barbaresco ligger nordøst" and
  the viewer can see neither — Barbaresco's pin chip runs off the right edge
  ("Barl…") and Barolo is under the fact box. `map.fitPlaces` framed all three
  points correctly; `.atlas-place` and `.atlas-pin b` are `white-space: nowrap`
  extending RIGHT of their anchor, and `placeLabel()`'s clamp
  (`map/index.js:715-746`) is called for regions only (`:540`). `onScreen()` is a
  visibility test with 60-140 px of slack on BOTH sides, so a name whose anchor
  is on screen and whose text is not counts as shown. This is the "on mobile
  Barolo is in the outskirts and part of the text is cut off" complaint, and it
  is three separate things: no clamp on point labels, a fit that does not know
  how wide a label is, and a fact box parked where the subject is.
- **Two sheets is ~42 MB on a phone at dpr 2.5**, and `MARGIN` cannot be widened
  without crossing iOS's 4096 px canvas limit on the long side.
- **The tint family cannot separate fifteen same-side regions** (ΔE 9.7). Roman
  provinces; the thirteen colonies clear 11.15. `map/tint.js`.
- **A flight that lands in the last 1.2 s is never seen**, and no tool says so.
- **`.sr-only` has never been used** — every reading surface relies on
  `aria-label` instead. An accessibility question, not dead CSS.
- **`check-turn.py` flaked once in three `check-all` runs** and passed four for
  four standalone. It bypasses `tick()` and `_turning` entirely, so it is not the
  tail; likely headless timing.
- **Cues in a new scene's first beat still fire during the lead-in silence.**
  Pre-existing, left alone, flagged rather than fixed.

---

## The design direction, and the app reconciled to it

Work had become reactive — the fade is too fast, the term box stays too long,
the region label looks odd, there are no sound effects — each fixed by hand
against no stated standard. Measured, the numbers plainly disagreed: **four
different answers to "how long does a thing take to arrive"** (220, 320, 420,
900 ms), and a 117x range between the fastest thing on screen and the slowest,
with nothing in between chosen on purpose.

So the first deliverable was not a fix. `docs/design-direction.md` is the
standard, `CLAUDE.md` links it, and everything below is a consequence of it.

**One motion scale, six tokens**, derived rather than picked: the unit of the
film is a spoken sentence (median beat 8.3–9.5 s across three chapters) and the
slow end is the 14 s drift on a still. `--t-tap 160` `--t-enter 900`
`--t-exit 600` `--t-dissolve 1200` `--t-turn 1200` `--t-drift 14s`. 900 ms is
the anchor because it is the plate fade — the one arrival nobody complained
about — and about a tenth of a beat. `--t-fast/-med/-slow` are gone from all
nine stylesheets; `--ease-spring` is deleted, and the same curve written out by
hand in `atlas.css` went with it.

**Nothing on the stage translates or scales on entry any more.** `mk-pop`'s
`scale(.4)`, `chip-in`'s translate+scale, the portrait's and quote's
`scale(.97)`, three `translateY`s, and `cap-in` — the caption cuts now, because
it carries the words and the words start immediately.

**The scene turn was a cut wearing a fade**: 320 in, 700 out, 900 ms of
silence. Now 1200 / 1600 / 1200 with `LEAD_IN_MS` 2800 — total 4.0 s against
3.62, so the silence triples and the length barely moves.

**And the device was running in front of the thing it existed to hide.**
`engine/story.js` called `mapScene()` and the player called `rebuildTo()` at
t = 0, while the veil was still transparent — measured at **0.008 opacity when
the picture changed**. The veil was also .82 rather than opaque, so even once
it arrived the cut showed through. `onScene` now returns whether a card is up,
`player.coverMs` defers the rebuild until the veil is closed, and every rebuild
bumps `_rebuildToken` so a scrub landing inside that 1200 ms window wins — the
async-cue hazard in a new shape. `tools/check-turn.py` measures it: the rebuild
now lands at ~1100 ms with the veil at 1.000, and the check was confirmed by
putting the old ordering back and watching it fail.

**Reduced motion no longer suppresses the scene card.** It returned early while
`LEAD_IN_MS` still ran, so a reduced-motion viewer got 2.8 s of silence over a
stage that had changed and was never told a scene had ended. The card cuts in
and out instead: the concern is vestibular — movement, not change.

**The region label was a watermark.** Italic, uppercase, .18em, 14px — larger
than every label it sat among while naming the least important thing on screen,
and at 14px that tracking is 2.5px between letters, which destroys word shape.
Now 11px / 600 / .08em, upright, mixed case. That is the "text looks very
weird" complaint.

**A probe that reads a class name is not a visibility check.** `dev/engine-lab.js`
now measures effective opacity — `display`, `visibility` and every ancestor's
opacity folded in — for six overlay surfaces, driving the real show/hide pair
animated and polling rather than waiting a fixed time. Reintroducing the
`.ov-fact` bug makes it fail with `fact.hide left .ov-fact on screen at opacity
1.00`. Clean on all eight chapters in both motion modes.

**The plate-to-plate transition never ran at all.** "Every transition is
poor", and this was the biggest one. Three beats of the wine chapter write
"replace this picture" as a `plate.hide` and a `plate.show` both at `start` of
the same beat (s0.b3, s3.b4, s5.b7; s6.b5-b6 does it a beat apart).
`showPlate()` decided whether to cross-dissolve by asking whether the container
still had `is-on` — and `hidePlate()` had just removed it. So every replacement
took the hard-cut branch. Measured at s0.b3: `druer-kasse` at scale 1.100 and
full opacity in one 80 ms sample, `dal-avstengt` at scale 1.000 and full opacity
in the next, ghost at 0 throughout. The picture snapped back to its opening
framing and swapped source inside one frame — "at the end of that one it is
basically rescaling, for a microsecond". The engine has had a ghost element for
carrying the outgoing picture since plates were built; it simply never ran.

The test is now whether the old picture is *visible* — computed opacity and
visibility — not whether it holds a class. Same lesson as `.ov-fact` and the
scene veil, three layers apart.

**And the outgoing picture used to freeze.** Now that dissolves happen, the
ghost carries on drifting at the rate it already had: a moving image dissolving
into a still one reads as a stall, and it is most of the difference between a
transition and a swap. The live transform is a matrix, so carrying the drift on
means scaling the matrix, not editing a `scale()` string — `carriedOn()`.

`tools/check-plate.py` asks "when the picture changed, was there a window in
which both were on screen?", which is what a dissolve is and nothing else
produces. **Its first version passed cleanly on the bug it was written for**,
because it looked for a jump in scale on one image and excluded samples where
the source changed — the only moment this can happen. Its second version
reported three false failures, because reusing one page means seeking backwards
between beats and a media element reports where it IS, not where it was told to
go, so the cues were applied by the rebuild instead of live. A fresh page per
beat. Confirmed by reintroducing the bug and watching it fail.

**The region label was made worse before it was made better.** The first pass
took it to 11px on this document's own argument that a region is "the least
important thing on screen". That made it the smallest type on the map and
brought the complaint back sharper — "tiny, and not professional". The premise
was wrong: a named region here is usually the subject of the sentence. The
honest distinction is of kind, not rank — a point name is small, dark, tight,
with a dot; an area name is larger, lighter, spread, quieter, with no dot.
15px/550/.05em, and `docs/design-direction.md` was corrected rather than quietly
deviated from.

**Composition: two faults, both fixed, neither in the script.** At `s2.b7` the
line is "Og Piemonte, helt nordvest, har Nebbiolo" and the frame showed neither.

- **The fact box was sitting in the middle of the map.** `.ov-deck--mid` is
  `top: 32%`, so the card explaining Nebbiolo landed squarely on Piemonte — the
  overlay explaining the subject was covering the subject. It is the left half
  of the lower deck now, opposite the stats and above the caption: it
  interrupts the picture's edge and nothing else, which is all the direction
  ever allowed it.
- **A named region could never win a label collision.** `declutter()` sorts by
  rank and a city was 3 while a region maxed at 2.9, so Torino — a standing
  label nobody asked for — beat Piemonte, which the narration was naming. A
  region is only in that layer because `region.show` put it there, so it now
  outranks a standing city at 4 + area. All four regions in the shot are named
  now, where one was. The shrink pass three lines above says in a comment that
  it exists to stop exactly this, and the sort order guaranteed it anyway.

Still open: at the last beat the camera sits on all of central Europe while
`Alba`, `Barolo`, `Barbaresco`, `Langhe` and `Asti` pile into a ten-pixel box.
A region too small on screen to carry its own name is a camera fault, and no
label size or rank fixes it — the places want a `minZoom`, or the beat wants a
camera.

**The chapter has an ending now.** It used to be `stopSound(); showCover('replay')`
— stop on the last beat, cut the sound dead, throw away the picture fourteen
minutes went into building, and put a menu there. `engine/ending.js`: two
seconds of silence with the last picture holding, then a veil at .52 that the
stage is still legible through, then a card with the date line, the chapter
title, one written sentence, one number with its label, and its doors. **Held
until tapped** — the narrator sets the pace for the whole chapter, and this is
the one moment the viewer holds.

Three things it gets right by construction:

- **The stage is not reset.** The card sits on the map the chapter ended on,
  which is the ground it belongs on. Mounted as a sibling of `.story__stage`
  so `resetStage()` cannot reach it, exactly as the scene card is.
- **`chapter.ending` is metadata, not a cue** — a cue would replay on every
  seek and stack end cards, which is the musket problem. Optional: a chapter
  without one still gets a card, just a barer one. It has to be named in the
  whitelist in `engine/script.js:compile()` or it silently does nothing, which
  is the mistake that comment warns about.
- **The bed comes up on its own**, because the ducking schedule stops with the
  clock. `fadeOutSound()` lets it go over four seconds when the card is
  dismissed, instead of the hard `stopSound()` that is still right for tearing
  a chapter down.

Two faults found by shooting it rather than reading it: the subtitle printed
twice, once as the kicker and once as the sentence, because the sentence fell
back to it; and the map's own labels read straight through the title —
"Tåka og tørsten" came out with Torino and Toscana inside it. A soft radial
scrim gives the type ground while the picture stays visible around it.

`content/italy-wine/chapter-1-piemonte.json` is the only chapter with an
`ending` written. The other seven fall back to title and date, and want one
sentence and one number each.

Still open from the direction, in its own order:

- **Sound.** The grammar is written and nothing is applied yet: one bed per
  scene in its first beat, at least one unscored scene per chapter, one effect
  per beat and none within 20 s, ambience never ducks, and levels stated
  against the bed rather than per cue. **One measurement is owed first** —
  every `sound.music` cue carries −6…−12 dB on top of the bus's own −14, so
  deleting the cue gains before moving the level into `bedDb` would make every
  chapter's music three times louder on the same day.
- **`content/roman-empire/chapter-44bc-octavian.json` fires `cannon` ×3,
  `musket`, `volley` ×2, `alarmBell` ×2 and a `churchBell` — in 44 BC.** Found
  by the direction pass, not by any tool. Every catalogue entry wants a year
  range and `check-script.py` should refuse one the pack's era does not
  contain.
- **The ending.** Still `stopSound(); showCover('replay')`. The direction
  prescribes 2 s of silence, a veil at .62 over the *unreset* stage, the bed
  rising from ducked to 0, and a held card the viewer dismisses.
- **Etna.** `s1.b6` says the vineyards sit nine hundred metres up a volcano and
  shows a map pin. It wants a picture and a cross-section. Note that the beat
  already carries a `plate.hide` at `start` and a `marker.show`, and
  `check-script.py` rejects a plate over an animating cue — so it is a re-cut
  of two beats, not a one-line addition.
- **34 literal font sizes across `css/`**, thirteen in `story.css`. The scale
  now has `--fs-3xs`, which `story.css:1393` had been reading against a token
  that existed nowhere.

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

---

## Sound — the score pass

`docs/design-direction.md` §3 is the standard this was measured against. What
was wrong, what was done, and the numbers, so a later reader can check rather
than take it on trust.

### The measurement that was owed

Every `sound.music` cue carried a `gainDb` of its own **on top of** the music
bus's `bedDb = -14`, so the bed that shipped was never the level the module
documented. Counted across all four packs before anything moved:

| | cues | carrying a gain | median | range |
|---|---|---|---|---|
| `sound.music` | 69 | 61 | **-10** | -6 … -12 |
| `sound.ambience` | 41 | 41 | -15 | -9 … -19 |
| `sound.play` | 49 | 48 | -9 | -2 … -19 |

So the bed a listener has actually been hearing is **-14 + -10 = -24 dB**.
That is taken as correct: `BED_DB` in `sound/soundscape.js` is now -24 and
every `sound.music gainDb` is gone. Doing it the other way round — deleting
the cue gains because the module said -14 — would have made every chapter's
music about three times louder on the same day.

Per pack the move is within a decibel: wine shipped at -23…-25, Rome -22…-26,
Narvik -23…-26. The outlier was **eight cues in 19 April that carried no gain
at all** and therefore shipped at -14, ten decibels over every other bed in
the app. They now match. Ambience and effects keep per-cue gains, clamped to
the direction's bands (-15 ±3 and -8 ±4); nineteen cues moved, the largest by
7 dB (`boots` at -19 in 27 BC).

**One thing left for you.** The direction's table states ambience and effects
as 0 dB and +6 dB *relative to the bed*. Against a bed at -24, ambience at -15
is +9 and an effect at -8 is +16. Those are what ships and I did not move them,
because the same paragraph says the cue numbers are the medians of what already
ships and that this "tidies the mix rather than moving it". The two halves of
that table disagree, and only listening settles which one you meant.

### Beds: a second family

Every bed in the catalogue was a drone on the same D–A–D–A–E–A stack, written
for a war. Five new ones, plucked rather than held, in A rather than D, built
on Karplus–Strong (`stringBuffer`) with a short filtered delay for air:

| bed | how it is built | its job |
|---|---|---|
| `bedWarm` | A major, six bars of 3.0 s, rocking A–D–A–E–A–D, warm bass plus three upper notes | sunlit, open, explaining something good |
| `bedPatient` | A minor an octave down, 4.4 s bars, damped at 1500 Hz, long decay | weight without grief — ground that has been there a long time |
| `bedMist` | one note every 2.6 s, no third at all, long room, a low pad at 55 Hz | almost still, and damp |
| `bedHollow` | eight low notes over 16 s, 0.37 s room at 0.40 feedback | indoors, and made of stone |
| `bedLilt` | rocking six-eight on double-stopped thirds, every note a mandolin **course** — two strings 8 cents and 6 ms apart | evening, human |

Verified by measurement rather than by claim. A Goertzel on each written pitch
against a quarter-tone control: `bedWarm` has A3 at -50.5 dB against -78.2 dB
off-pitch, a 28 dB margin, so the beds really are playing the notes they were
written from and not filtered noise.

Two findings worth keeping:

- **The plucked family survives a phone.** Through a 400 Hz high-pass — roughly
  what a phone loudspeaker can radiate — the drones lose 5.2 to 14.3 dB
  (`bedMarch` worst) and the plucked beds lose **0 to 3.6 dB**, because a
  Karplus–Strong string is rich well above its fundamental. `bedHollow` plays
  no note above 131 Hz and loses nothing at all.
- **`bedHollow` had no note attacks.** Measured in that same band: eight plucks
  over sixteen seconds and *zero* detectable attacks, because every note rang
  for 2.8 s on a 2.0 s step and the next one landed while it was still at half
  strength. A note now ends 0.2 s before the next begins and the room fills the
  gap — nine attacks. This is the whole reason to measure a bed instead of
  describing one: "dark and slow" and "one continuous wash" produce the same
  sentence and different music.

### Effects: five new, and what each answers

`content/italy-wine/chapter-1-piemonte.json` shipped **zero** effects. It now
has three, each on a word the narration says:

| effect | how it is built | the sentence it answers |
|---|---|---|
| `corkDraw` | seven rising friction squeaks, then the **neck's air resonance** at 232 Hz falling fast — the pop is the bottle, not the cork | s4.b4 "Den samme **flaska** etter tjue år er noe helt annet" |
| `pour` | a noise band climbing 760→1500 Hz as the glass fills, with bubbles gliding *up* as they collapse | s6.b2 "Til middag drikker de **Barbera**" |
| `fizz` | 520 clicks at exponentially decaying density over a thin high sheet | s6.b7 "søtt, lett **perlende**" |
| `vineyard` (loop) | still air, plus cicadas as a 4.6 kHz band **chopped at 41 Hz**, plus two or three distant birds | ambience under s2, the scene that now carries no bed |
| `cellar` (loop) | 120 Hz room tone, a drip every few seconds, a barrel hoop taking a load | ambience from s5.b5, where the narration goes indoors |

**No clink.** Glasses were asked for, and nothing in this chapter names two
glasses touching, so there is no cue for one. An effect that names nothing is
the rule this whole pass exists to keep.

**Scene 2 carries no bed.** The direction wants one unscored scene per chapter,
and the scene about farmers who never met each other because the mountains were
in the way is the one that earns silence. The vineyard keeps it a place rather
than a hole.

### 44 BC

`chapter-44bc-octavian.json` fired `cannon` ×3, `musket`, `volley` ×2,
`alarmBell` ×2 and a `churchBell`. Two new era-appropriate effects, and six
cues that are better gone:

| was | is | why |
|---|---|---|
| `volley` s1.b5; `cannon` s4.b6, s5.b8, s7.b3 | **`swords`** — nine impacts over 2 s, a third of them a shield boss, partials deliberately inharmonic | a blade is not tuned, and gunpowder is fourteen centuries away |
| `drums` s4.b3 | **`warHorn`** — a sawtooth through a filter that opens with the envelope, doubled in parallel fifths | a Roman army had no drums, it was moved by cornu, and fifths are what a valveless horn can actually play |
| `alarmBell` s6.b8, "Rome declares war" | `warHorn` | a declaration is a signal |
| `musket` s3.b6, Cicero killed | *nothing* | an execution does not want a gunshot, and nothing else in that sentence is a sound |
| `alarmBell` s5.b3; `churchBell` s8.b4 | *nothing* | cast bronze bells are medieval, and the senate naming a man wants no sound at all |

Also in 27 BC: `alarmBell` under "a fire brigade" removed, and `drums` under
the Teutoburg ambush — where it was cued to the word *rain* — became `swords`.

**And it is mechanical now.** Every catalogue entry carries `years`, and
`tools/check-script.py` refuses a cue whose span does not overlap the pack's
era: `musket [1400,1900]`, `cannon [1350,2100]`, `churchBell [500,2100]`,
`warHorn [-1500,1600]`, `swords [-2000,1900]`, `corkDraw [1650,2100]`. A
timeless sound — wind, a crowd, the sea — carries no range at all, because a
range nobody can defend is worse than none.

### The grammar, applied to every pack

`check-script.py` gained the direction's checks: one bed per scene in its first
beat with no gain, one ambience per scene, one effect per beat, three per
scene, none within 20 s, levels inside their bands, and the era. It also prints
every effect beside its own sentence, the way it already prints plates over a
`region.show`, because no tool can read a sentence.

What they found, beyond the levels:

- **Nine mid-scene bed changes**, removed (19 April ×4, Narvik 9 April ×2,
  44 BC ×3). 19 April alone changed bed twelve times across eight scenes.
- **Two ambience cues in one beat**, 19 April s1.b8: `oars` on "rowed" and
  `wading` on "wade". `setAmbience` crossfades, so the second replaced the
  first inside the same sentence and `oars` was **never heard**. Eight
  redundant or competing ambience cues removed across three chapters.
- **Effect density.** Bunker Hill's s5 fired six; it fires three (the first
  American volley, the second assault, the powder running out). 19 April s3
  fired four, with a volley 14.6 s after the first shot of the war; the single
  shot on the green and the fife twelve beats later now stand alone. Two Narvik
  clusters were fixed by tightening a spread rather than by deleting a cue —
  s4.b2's six reports over 2.6 s instead of 6.0 s buys the beach volley its
  twenty seconds.
- **A bed now leaves over four seconds**, not 900 ms (`resolveWanted` in
  `engine/scenes/sound.js`, and `stopMusic`'s own default), and arrives over
  1200 ms — `--t-dissolve` — instead of 900. This only became visible once
  scenes existed with no bed at all: a bed that is gone within a sentence of
  the scene turning reads as the sound breaking, not as silence arriving.
- **Unscored scenes** given to the three chapters where the choice is the
  scene's own argument: wine s2 (isolation), 19 April s3 (the shot on the
  green, over wind), 44 BC s3 (the proscription list). **The other five
  chapters still score every scene**, and `check-script.py` says so as a note
  rather than a failure. I left those to you: choosing which scene of a battle
  goes quiet is an editorial call, not a tidy-up.

### The bench

`tools/check-sound.py` is 27 assertions, up from 24. The bed level is read from
the module instead of being hard-coded twice, and **every loop is measured at
its own seam** — the sample-to-sample step across the wrap against the typical
step either side of it. All 21 loops come in between 0.00 and 2.04; a hard cut
of a tonal bed measures in the tens.

The first version of that check also asserted head level against tail level,
and failed `drums` at +64 dB, `hooves` at +140 and `bedMarch` at +11 — all
three correct, because a rhythmic loop starts on a downbeat and ends in the gap
before the next one. It is printed and not asserted. A threshold tuned until
those three passed would have measured nothing at all.
