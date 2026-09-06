# Planning a course

One level above `docs/authoring.md`. That file writes a chapter; this one decides whether
there is a course for it to be a chapter of.

```bash
python tools/outline.py --new-pack beer     # start a course from nothing
python tools/outline.py beer                # the eight questions, asked
python tools/outline.py beer --write        # compile pack.json's chapter list
```

This level exists because of a defect that could not be seen from inside a chapter. The
wine chapter closed on "and we have not mentioned the whites yet", four beats after
spending a scene on Moscato, which is a white grape. Every check passed. Nothing above the
chapter had ever been written down, so nothing was in a position to notice.

The rule that follows: **a course is a claim, and a chapter is part of the evidence.** If
the claim is not written, the evidence cannot be wrong.

---

## The eight questions

Run these as an interview, out loud, with somebody who is not an expert in the subject.
The first two are the course. The rest are how it is built.

### 1. What is the one question the course answers?

Not a topic — a question, with a question mark, that a seventeen-year-old would want the
answer to.

    NO   "Italian wine, region by region"
    YES  "Why does an Italian bottle name a place and not a grape?"

    NO   "The history and styles of beer"
    YES  "Why does beer taste of a thousand things when it is made of four?"

A topic can be arranged. A question has to be answered, and that is the difference between
a course and a table of contents. It goes in `# question`, and `outline.py` fails without
one. It also says so, mildly, when the sentence does not end in a question mark — allowed,
and usually a sign the spine is still a topic.

### 2. What is the answer, in one sentence?

If the answer needs a list, the question is too big. Split it or narrow it.

Wine: *the place is the explanation — the grape, the ground and the weather.* Beer: *three
ingredients you can weigh and a fourth that is alive, and the whole history is people
trying to control something they could not see.*

The answer is what decides the ORDER of the chapters, which is question 5.

### 3. What does the viewer need before the answer means anything?

That is chapter one, and it is nearly always the chapter people get wrong, because it is
the one with no story in it. The beer course spends its first chapter on four ingredients
and four steps with **not one place name in it** — deliberately, because "why does beer
from here taste like that" is not a question you can hear until you know what beer is.

Write down what chapter one hands to the rest. That list is `teaches:`, and every later
chapter names what it takes back in `assumes:`.

### 4. What is the proof, in each chapter?

One concrete thing that makes the point undeniable, and it should be in the chapter's
`for:` line. Not "Piedmont is important" — *the same grape, eighteen kilometres apart, two
completely different wines.* Not "English beer is different" — *the gypsum in the water
under Burton, which is chemistry you can point at.*

A chapter whose `for:` is a summary of its contents has no proof in it, and it will read
as a list. `for:` says what the chapter is FOR, never what is in it.

### 5. What is the order argument?

There are three, and a course should pick one and stay with it:

| | |
|---|---|
| **geography** | the wine course: north to south, one region at a time |
| **chronology** | the obvious one, and usually the weakest — history is a shape, not an order |
| **mechanism** | the beer course: what it is, then the two yeasts, then the year one of them was caught |

The beer course mixes two on purpose and says so in `# about`: mechanism first (chapters
one to three), then chronology (four to six). Mixing is fine. Not knowing which one you
are using is what produces "chapter two repeats chapter one".

### 6. What is it NOT?

The half that gets forgotten, and the one that caused the defect at the top of this file.
Write the subjects the course deliberately leaves out **in the words they are spoken with,
in both languages**, under `# not here`:

    hjemmebrygging, oppskrift, brygg selv | homebrewing, recipe, brew your own

`outline.py` looks for exactly those words in the narration and prints the sentence it
found them in. It matches words and nothing cleverer: `hvitvin` does not find `hvite`, so
list both. And do not list a word the course legitimately uses — a beer course says
*brygge* on every page, so the entry is `hjemmebrygging`, not `brygg`.

An empty `# not here` is not a course with no limits. It is a course that has not decided.

### 7. What does the screen show?

Ask this now, not when you are writing beat eleven. It decides which surfaces the pack
declares, and a course that does not name `map` loads no map module and not a byte of
geometry — 3.85 MB it never pays for.

`shows:` per chapter, most important first, from a list of five:

| | |
|---|---|
| `map` | the ground carries it |
| `pictures` | full-frame stills carry it |
| `charts` | a profile or a comparison carries it |
| `cards` | facts, portraits, quotes, numbers |
| `process` | a sequence of steps — **and no surface draws one yet** |

The last row is the point of asking at this level. A beer course is a process before it is
a place, and nothing in `engine/surfaces/` draws malt → mash → boil → ferment. Written in
the outline, that surfaces as a framework item on the first run of the tool, while it is
still a build decision. Written in a chapter, it surfaces as a disappointing chapter.

Once the chapter ships, the tool measures what it actually turned out to be — every cue
counted against the surface that answers it — and says so when the promise and the mix
disagree.

### 7b. Who is it for, and what may you assume?

The question that was missing, and its absence cost a whole course two
rewrites. `CLAUDE.md` said "upper-secondary level, never university" as a house
rule, which is true of the beer and wine courses and comprehensively wrong for
a course written for a sixty-year-old academic who wants a field opened up
fast. Written faithfully to the house rule, a football course came out
explaining that a pitch is large and that eleven men cannot cover it. The
reader's answer was:

> "too banal and too childish ... it's almost like you need to explain that
>  there's a lot of square metres around the player ... I have watched a
>  football match before. I know there are eleven players."

**The default, and it is the right answer for most courses:** somebody with a
university degree, in something else. They read widely, follow the world, and
have no training in this subject. Get to the point immediately; take an
academic, analytic approach — claim, mechanism, consequence; explain the
subject's vocabulary and never the reader's; and never explain the obvious
surface of the subject.

**`# for whom` REFINES that default for one course, and then wins.** Register
is a property of the subject and its audience, not of the house. Write it as
permissions and prohibitions, not as an adjective — "for adults" is useless,
and this is not:

    Nothing about the game itself is explained. There are eleven a side.
    Never write a sentence that assumes the reader does not know that.

    No definition lines. A term is explained in a subordinate clause inside
    the sentence that needs it, never as an entry.

    Abstraction is expected: trade-off, equilibrium and dominant strategy
    need no explanation. Playing out from the back does.

**The list test.** The failure mode a register line has to prevent is the
chapter that is an inventory with narration over it. It is checkable by hand
and worth doing on every chapter: *if two paragraphs could swap places without
loss, it is a list and it is wrong.* An argument does not survive shuffling.

**And do the reading first.** A course plan written from memory produces the
obvious syllabus, which is the one the reader could have guessed. Search before
planning: what does the field argue about right now, what is contested, what
changed in the last two years. The football plan only found positional play
against relationism — the live dispute in the subject, and the chapter that
makes it a course for an adult rather than a primer — because that search was
run. `docs/planning.md` did not say to, and that is why this paragraph exists.

### 8. What will it cost, and who said yes?

Ask this **before** the writing, not when the pictures are ordered. It is the one question
here that is about somebody's money rather than somebody's attention, and it is the easiest
to answer badly by not asking it.

The rule is in `CLAUDE.md`: the Claude Code subscription is the only standing cost, and
every service that bills is a decision taken here, in writing. Not implied by a plan that
mentions a model. Not assumed because the last course used one.

Answer three things and write them in the outline's `# about` block:

| | |
|---|---|
| **what it needs** | pictures, a voice, beds, hosting — and for each, free or paid |
| **what it costs** | a measured number, per course, not a catalogue price |
| **who agreed** | the person paying, in this conversation, before the work starts |

**Measure it on one picture and one sentence, not on a price list.** The beer course was
priced this way in twenty minutes for $2.09: the same real prompt through nine picture
models, the same real Norwegian paragraph through eleven voices. It came out at **24 to 241
kroner for a six-chapter course depending only on which picture model** — a tenfold spread
that no amount of reading would have found, because two of the advertised prices were wrong
by a factor of ten and video carries no published price at all.

That measurement is also the answer to *is it worth it*: a course at 24 kroner against the
300-kroner book on the same subject is an easy yes, and one at 241 is a conversation.

`tools/try-openrouter.py` is the tool for this. `outline.py` does **not** check this
question — like the refusal test below, it is a conversation with a person, and no tool can
have it for you.

---

## Three tests before a word is written

**The prerequisite test.** Read the chapters in order and check that every word in
`assumes:` was taught by an earlier chapter. `outline.py` fails on this, and it is the
commonest way a course quietly stops working: chapter four leans on a word nothing ever
explained, and from inside chapter four it looks fine, because you know what it means.

**The cover test.** Read only the `blurb:` lines, in order, and nothing else. If two of
them could swap places without anybody noticing, one of those chapters has no job.

**The refusal test.** Cover `# not here` and ask somebody what they expect the course to
include. Everything they name that is not in it belongs in that section, in their words.

---

## The file

`content/<pack>/outline.md`, in the same notation as a chapter script: the ordinary line is
Norwegian, written first, and the `>` line under it is English. `//` is a comment.

```markdown
---
pack: beer
---

# for whom
Hvem kurset er skrevet for, og hva det derfor kan ta for gitt.
> Who the course is written for, and what it may therefore assume.

# question
Hvorfor smaker øl av tusen ting, når det bare er laget av fire?
> Why does beer taste of a thousand things when it is made of four?

# about
Hva kurset handler om, og hva det med vilje ikke handler om.
> What the course is about, and what it deliberately is not about.

# not here
hjemmebrygging, oppskrift | homebrewing, recipe

## chapter-1-fire-ting
title: Fire ting i et glass | Four things in a glass
subtitle: Vann, korn, humle og gjær | Water, grain, hops and yeast
blurb: Nesten all øl i verden er laget av fire ting. | Almost every beer in the world is made of four things.
langs: no, en
planned: true
for: Å gi ordene resten av kurset hviler på. | To give the words the rest of
     the course leans on.
teaches: malt, mesking, vørter, kok, humle, bitterhet, gjær, gjæring
assumes:
shows: process, pictures, charts
```

A wrapped line is indented and joins the field above it. A field is never indented — that
is the only rule separating a key from prose that happens to begin `kontrollen:`.

`planned: true` means written down and not written yet. It is how a course gets planned in
full before chapter one exists: planned chapters stay out of `pack.json` entirely, so the
front door shows only what a viewer can actually watch.

**`pack.json`'s `chapters` array is compiled from this file.** Editing it by hand is a
fork, and `--write` wins the next time somebody runs it. `check-all.py` fails on the drift.

---

## What the tool checks

Gates — a wrong answer, and the build stops:

- the course says what question it answers
- every chapter on disk is in the outline, and every outline chapter exists or is `planned`
- `pack.json` says what the outline says
- a chapter assumes something no earlier chapter teaches
- a chapter is carried by a surface the pack does not declare

Notes — judgement, printed and never failed, because a tool that fails on judgement gets
skipped:

- the question is not a question
- two chapters teaching the same subject
- a subject the course put under `# not here`, spoken, with the sentence
- a shipped chapter whose cues do not match what `shows:` promised
- a chapter carried by something the framework has no surface for

## The level below this one

`docs/dramaturgy.md`. This file decides whether there is a course and what each chapter
is for; that one decides whether anybody would watch it. It is not optional and it is
not polish: a chapter can answer its question, teach its words, pass every gate in
`check-all.py` and still be worthless, which is exactly what happened. Read it before
writing, and run `tools/check-rhythm.py` after.

## What it cannot check

Whether the course is worth taking. Whether chapter four earns its place. Whether the
proof in chapter two is a proof or an anecdote. Whether the question at the top is one
anybody wants answered.

That is the whole reason the eight questions are written as an interview and not as a
schema.
