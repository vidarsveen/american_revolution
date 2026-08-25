# Writing a chapter

A chapter used to mean hand-editing sixteen hundred lines of JSON and guessing whether a
`word:` anchor still matched the sentence it was pinned to. This is the other way in: one
file per chapter, prose first, cues attached to the words they belong to.

```bash
python tools/author.py content/italy-wine/script.md --check   # compile and complain
python tools/author.py content/italy-wine/script.md --write   # write the chapter JSON
python tools/author.py --verbs                                # every cue and what it takes
```

The compiler writes the same `content/<pack>/<chapter>.json` the engine has always loaded.
Nothing at runtime changes, the JSON stays committed and readable, and
`tools/check-script.py` still has the last word. What has gone is the bookkeeping.

This file walks through writing a new chapter from nothing. It is not a reference — the
reference is `python tools/author.py --verbs`, which prints the vocabulary out of
`engine/verbs.json` and therefore cannot be out of date.

---

## The worked example: chapter two, Tuscany

The wine course ends chapter one with *"next time we go south, to Tuscany, and to the grape
that makes Chianti."* So that is the chapter we are writing. Everything below is real: it
compiles, and the output shown is the output it gives.

### 1. Say what it is

Open `content/italy-wine/script-2.md` and write the front matter. The source file's own name
is yours to choose; `id` is what the compiled chapter is called and what the engine loads,
and `pack` is the subject it belongs to. Anything with two languages is written
`norsk | English`, in that order, because the Norwegian is written first and the English
follows it.

```
---
id: chapter-2-toscana
pack: italy-wine
title: Sangiovese | Sangiovese
subtitle: Toscana, og én drue til | Tuscany, and one more grape
regions: geo/regions.geojson
---
```

That is the whole of it. `voice`, `rate`, `home`, `poster`, `work` and `blurb` are the other
fields a chapter may carry, and none of them is required — the voice comes from the pack.

### 2. Give it ground

The map needs somewhere to fly to. A place is an id, a latitude and a longitude, and then
whatever else it wants:

```
# places
firenze     43.7696, 11.2558  zoom=9     kind=city  Firenze | Florence
siena       43.3188, 11.3308  zoom=10.4  kind=town  Siena | Siena
montalcino  43.0568, 11.4894  zoom=11.6  kind=town  Montalcino | Montalcino
```

`zoom` is how close the camera goes when a cue names this place and says nothing else about
it. The free text at the end is the name drawn on the map.

Routes and quotes have their own sections in the same spirit — see the end of this file. A
chapter with no marches needs no `# routes`.

### 3. Write the scenes

A `##` heading starts a scene, and its title is what the scene card says. Under it, **one
sentence per line** — that sentence is a beat, the unit the whole app is built on — with the
English underneath it after a `>`:

```
## Én drue, mange navn | One grape, many names

Toscana er åser hele veien, og på åsene står det én drue.
> Tuscany is hills the whole way, and on the hills stands one grape.
Den heter Sangiovese, og den dekker sytti prosent av vinmarkene i regionen.
> It is called Sangiovese, and it covers seventy per cent of the vineyards in the region.

Navnet betyr Jupiters blod. Ingen vet om det er sant, og alle sier det likevel.
> The name means the blood of Jupiter. Nobody knows whether that is true, and everybody says it anyway.
```

**The blank line is not decoration.** A blank line between two sentences is a paragraph
break, and a paragraph break is a longer pause: 1.35 s of air instead of 0.9. The last beat
of a scene gets 2.0 s, which is what `docs/design-direction.md` §4 prescribes for the silence
before a chapter turns over. You never type a `gapAfter`.

You now have a chapter that runs. Compile it, run `tools/narrate.py`, and you can watch it
before a single picture exists. Do that first — the writing is the part that decides whether
any of this is worth using, and everything below is decoration on top of it.

### 4. Attach the pictures to the words

A cue goes in `{braces}`, **immediately after the word it belongs to**:

```
Toscana {region Toscana side=red over=1.4} er åser hele veien, og på åsene står det én drue.
```

That compiles to `"on": "word:Toscana"`. A cue written *before* the first word of the
sentence belongs to the whole beat and compiles to `"on": "start"` — which is where the
establishing shots go:

```
{music bedWarm} {mood day} {flyTo firenze zoom=7.2} Toscana {region Toscana side=red over=1.4} er åser…
```

You never type the anchor word. It is where the cue sits.

**The English needs its own word.** "prosent" is "cent", and a cue anchored to a word the
English sentence does not contain would fire at the start of the beat instead — early, and
easy to miss by ear. So mark the English word with `{^}`:

```
Den heter Sangiovese, {fact grape:sangiovese} og den dekker sytti prosent {stat 71% label=av vinmarkene | of the vineyards side=red} av vinmarkene i regionen.
> It is called Sangiovese, {^1} and it covers seventy per cent {^2} of the vineyards in the region.
```

The marks pair with the word-anchored cues in order. `{^}` on its own is "the next one";
`{^1}`, `{^2}` are needed only when the two languages put the words in a different order,
which they sometimes do. A proper noun that is the same word in both — Barolo, Etna, Nebbiolo
— needs no mark at all: write `@same` on the cue and it compiles to one bare string for every
language, exactly as the README describes.

That beat compiles to this, which is what you would otherwise have typed:

```jsonc
{
 "id": "s0.b2",
 "say": {
  "no": "Den heter Sangiovese, og den dekker sytti prosent av vinmarkene i regionen.",
  "en": "It is called Sangiovese, and it covers seventy per cent of the vineyards in the region."
 },
 "cues": [
  { "on": { "no": "word:Sangiovese", "en": "word:Sangiovese" },
    "do": "fact.show", "kind": "grape", "id": "sangiovese" },
  { "on": { "no": "word:prosent", "en": "word:cent" },
    "do": "stat.show", "value": "71%",
    "label": { "no": "av vinmarkene", "en": "of the vineyards" }, "side": "red" }
 ],
 "gapAfter": 1.35
}
```

**How a cue is written.** The verb, then one bare value, then `key=value` for the rest:

| you write | it means |
|---|---|
| `{flyTo firenze zoom=7.2}` | `map.flyTo`, the first required argument is `to` |
| `{region Toscana side=red}` | `region.show` — a family's one non-hide verb is its short name |
| `{marker siena kind=point tone=gold}` | `marker.show` |
| `{fact grape:sangiovese}` | `fact.show` — a pool and an entry in it |
| `{plate.hide 1.1}` | the full name always works; `1.1` is its `over` |
| `{stat.clear}` | no arguments |

An attribute's value runs to the next `key=`, which is how a two-language label fits on one
line. Quote a value that contains an `=`. Every verb, argument, type, enum and default comes
out of `engine/verbs.json` — nothing is written down twice — so `--verbs` is the list, and a
verb added to the manifest is writable the moment it is there.

### 5. Compile it

```
$ python tools/author.py content/italy-wine/script-2.md --check
content/italy-wine/script-2.md: 34 lines -> 2 scenes, 5 beats, 11 cues (5 pinned to words), 221 lines of JSON

nothing written — pass --write to update the chapter JSON.
```

`--check` never writes. `--write` writes the JSON and tells you what to run next. If the
chapter already exists, both print a difference list against the file on disk, so you can see
exactly what your edit changed before it lands.

### 6. When it is wrong

The compiler refuses before, rather than reporting after. Three real mistakes, and what it
says about them:

```
PROBLEMS (4):
  FAIL: bad.md:17: no cue verb 'glow'. engine/verbs.json does not declare it
      (tools/author.py --verbs lists every one)
  FAIL: s0.b1: plate.show names an image 'langhe-taake' that is not in
        content/italy-wine/media.json — nearest: langhe-take
  FAIL: s0.b1: the en sentence does not say 'fjellet' — 'Piemonte means at the foot
        of the mountain.'. The visual would fire at the start of the beat instead.
        Put the cue after the right word, or mark the en word with {^}.
  FAIL: s0.b2: fact.show points at term 'nebbia', which is not in that pool —
        nothing would open, and nothing would say so. Nearest: nebbiolo
```

It reports every problem it can find in one pass, not the first one. A place that is not
declared, a region name that is not in the GeoJSON, a sound the library cannot synthesise, an
argument the manifest does not declare, an enum value that is not one of the allowed ones and
a verb whose surface the pack has not mounted all read the same way.

### 7. Record it, then check it

```bash
python tools/author.py content/italy-wine/script-2.md --write
python tools/narrate.py --chapter italy-wine/chapter-2-toscana --lang no
python tools/narrate.py --chapter italy-wine/chapter-2-toscana --lang en
python tools/check-script.py italy-wine/chapter-2-toscana
```

Then add the chapter to `content/italy-wine/pack.json` -> `chapters`, and to `sw.js` via
`python tools/build-sw.py`.

**The compiler cannot do check-script.py's job and does not try.** Everything that depends on
how long a sentence actually took — a plate on screen for two seconds or for ninety, a camera
flight the scene ends in the middle of, a fact box that outlives its own beat, two sound
effects nineteen seconds apart — only exists once the narration has been recorded. Those are
`check-script.py`, and it is the check that fails a build.

### 8. Watch it

```bash
python tools/serve.py
```

Rewrite a sentence and the anchors follow it, because they are the words. Re-run `narrate.py`
— only the beats whose text changed are re-synthesised — and nothing is hand-timed, so
nothing drifts.

---

## What the compiler writes for you

- **Scene ids** — `s0`, `s1`, … in the order the `##` headings appear. They restart at `s0`
  in every chapter, which is why timings and audio are keyed by chapter as well as language.
- **Beat ids** — `s2.b4`, from the scene the beat is in and its position in it.
- **`gapAfter`** — 0.9 between sentences, 1.35 across a paragraph break, 2.0 at the end of a
  scene. `{gap 1.55}` on a beat overrides it and `{gap none}` writes none at all; both exist
  for chapters that were hand-tuned before this tool did, and neither should be needed in
  something new.
- **`#2`** on an anchor, when the word has already been said once in the same sentence.
- **Nothing else.** The compiler never fills in a default. A default belongs to the engine,
  which already has it, and writing it into the chapter would make the file lie about what
  you decided.

## What you cannot write

Honest list, because the format has edges and finding them was the point of building it.

- **A beat id of your own.** They are generated, so a chapter that was hand-edited to squeeze
  in an `s2.b6b` comes back renumbered — and the timing file keys its beats by id, so that
  chapter has to go back through `narrate.py` (cheap: the cache is keyed by text, so nothing
  is re-synthesised, only re-assembled).
- **A cue in an order the prose does not have.** Cues are stored in the order they are
  written, and they are written where their words are. When a sentence names the bottle
  before the number but the cue for the number has to come first, write the anchor out:
  `{play corkDraw gainDb=-8 @word:flaska}`. `--from-json` does this for you where it is
  needed, and it is needed twice in eight chapters.
- **A comment inside `# places`, `# routes` or `# quotes`.** A `//` line is a comment
  everywhere else. A data section with a `//` key in it — `norway-1940` has one — is written
  as `# json routes` instead, which takes raw JSON and is the escape hatch for anything the
  readable grammar has no spelling for.
- **Geometry.** A route is still a list of coordinates. Nothing here helps you invent one;
  `tools/build-*.py` and a map do.
- **Whether the picture shows what the sentence is talking about.** No tool can read the
  sentence. That is CLAUDE.md's worst regression and it is still yours to catch.

## The sections, in one place

```
---  front matter  ---     id, pack, title, subtitle, blurb, work, regions,
                           poster, home, voice.no, voice.en, rate, langs

# places      id  lat, lon  [k=v …]  [Navn | Name]
# routes      id  [k=v …]  [Etikett | Label]
                  lat,lon  lat,lon  …          (indented, as many lines as you like)
# quotes      id  [k=v …]
                  text: … | …                  (indented)
                  by:   … | …
# ending      say: … | …                       the end card
              figure.value: 500
              figure.label: … | …
# json <field>                                 raw JSON for any top-level field

## Scene title | Scene title
clock: Oktober | October                       optional, drawn on the map
<sentence>                                     a beat
> <sentence>                                   the same beat, second language
```

`//` anywhere outside a `# json` block is a comment.

## The bench

```bash
python tools/author.py --lab
```

One falsifiable question: **does every chapter that ships survive being written in this
format?** It decompiles all eight chapter JSONs, compiles the result back, and compares
key by key. Today: eight of eight, with one chapter differing only in the beat ids it
generates.

```
chapter                                   source    json  diffs   ids
american-revolution/chapter-1775-04-19       301    3605      0    26
american-revolution/chapter-1775-06-17       308    3184      0     0
italy-wine/chapter-1-piemonte                159    1652      0     0
norway-1940/chapter-1940-04-09               926    3823      0     0
norway-1940/chapter-1940-05-28               680    3199      0     0
roman-empire/chapter-14ad-tiberius           227    1870      0     0
roman-empire/chapter-27bc-augustus           229    2413      0     0
roman-empire/chapter-44bc-octavian           237    3176      0     0
                                            3067   22922   13% of the JSON
```

The one comparison it lets through is case in a word anchor: the engine matches with
`norm()`, so `word:Nebbia` and `word:nebbia` are the same anchor and the chapter files are
simply inconsistent about which they wrote.

`--from-json <pack>/<chapter>` is the same machinery pointed the other way, and it is how you
move an existing chapter onto this format — decompile it, read it, and only then write it
back.
