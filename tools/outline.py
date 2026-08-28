#!/usr/bin/env python3
"""
outline.py — the course, written as prose, above the level of a chapter.

    python tools/outline.py italy-wine            # compile, diff, and ask
    python tools/outline.py italy-wine --write    # update pack.json's chapters
    python tools/outline.py --new italy-wine      # a first outline from pack.json

A chapter had a source you could read; a COURSE did not. `pack.json` lists
chapters as ids and titles, which is a table of contents written after the
fact — it says what exists, never what any of it is FOR. So the wine chapter
could spend four beats on Moscato d'Asti, a white grape, and close on "and we
have not mentioned the whites yet", and nothing above the chapter existed to
notice. That defect is what this file is for.

The outline is `content/<pack>/outline.md`, in the same notation as a chapter:

    ---
    pack: italy-wine
    ---

    # question
    Hvorfor står det et sted og ikke en drue på en italiensk flaske?
    > Why does an Italian bottle name a place and not a grape?

    # about
    Kurset handler om rødvin.
    > The course is about red wine.

    # not here
    hvitvin, hvite | white wine, whites

    ## chapter-1-piemonte
    title: Tåka og tørsten | The fog and the thirst
    for: Å vise at et navn på en flaske er et sted. | To show that a name
         on a bottle is a place.
    teaches: terroir, nebbiolo, barolo, barbaresco, barbera, moscato
    assumes:
    shows: map, pictures

`# question` is the one question the whole course answers, and every chapter is
part of the answer. It is its own section because it is the difference between
a course and a list of chapters — and in the one outline that existed before
this, an excellent one sat in the middle of `# about` where nothing above the
chapter could point at it.

`assumes:` is the other half of `teaches:` — what a chapter expects the viewer
already has. It must have been taught by an EARLIER chapter, and that is a gate:
a chapter reaching for a word nothing has explained is the commonest way a
course stops working, and it is invisible while you are writing that chapter.

`shows:` is what carries the frame — `map`, `pictures`, `charts`, `cards`,
`process` — most important first. It is asked at outline time because that is
the only moment the answer is still cheap: it decides which surfaces the pack
declares, and it is where a subject that the framework cannot draw yet shows up
as a missing artifact rather than as a disappointing chapter.

`pack.json`'s `chapters` array is COMPILED from it, the way the chapter JSON is
compiled from `script.<chapter>.md` — one place a person writes, one the engine
reads, and `--check` is the only thing keeping them in step. `for`, `teaches`
and the two sections stay here: the engine has no use for them, and the tools
have nothing else to ask their questions of.

Seven questions, and the gates are the ones with a right answer, because the
rest are judgement and a tool that fails on judgement gets skipped:

    GATE  the course says what question it answers
    GATE  every chapter on disk is in the outline, and every outline chapter exists
    GATE  pack.json says what the outline says
    GATE  a chapter assumes something no earlier chapter teaches
    GATE  a chapter is carried by something the pack has no surface for
    note  two chapters teaching the same subject      (chapter two repeats one)
    note  a subject the course says is NOT here, spoken   (the whites)
    note  what a shipped chapter promised, beside the cues it arrived with

The `not here` note matches the words you wrote there and nothing cleverer.
"hvitvin" does not match "hvite" by itself; list both, in the language they are
spoken in, and the tool will find them in the narration and print the sentence.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# The Windows console is cp1252 and raises on an em-dash, which is a silly way
# for a report to die. Same three lines as check-all.py.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
DEFAULT_LANGS = ["no", "en"]

I18N_KEYS = {"title", "subtitle", "blurb", "for"}
LIST_KEYS = {"langs", "teaches", "assumes", "shows"}
CHAPTER_KEYS = I18N_KEYS | LIST_KEYS | {"planned"}

SECTIONS = ("question", "about", "not here")

# What can carry a frame, and the surface that draws it. The outline is asked
# this BEFORE a chapter exists, because that is the only moment the answer is
# still cheap: it decides pack.json's `surfaces`, and a course that does not
# name `map` loads no map module and no geometry at all.
#
# `process` is in the table on purpose with nothing behind it. A course about
# brewing is a process before it is a place -- malt, mash, boil, hops, yeast --
# and no surface in engine/surfaces/ draws a sequence of steps. An outline is
# allowed to say that, and the tool then names the artifact the framework is
# missing instead of rejecting the plan. That is the point of asking at this
# level: the answer arrives while it is still a build decision.
SHOWS = {
    "map": "map",
    "pictures": "plate",
    "charts": "chart",
    "cards": "overlays",
    "process": None,
}

# What of an outline chapter the engine is allowed to see. `for` and `teaches`
# are deliberately NOT here: writing them into pack.json would make the engine
# look like it reads them, and the next person would wire something to it.
PACK_FIELDS = ["id", "title", "subtitle", "blurb", "langs"]


class SourceError(Exception):
    def __init__(self, line: int, msg: str):
        super().__init__(f"{line}: {msg}")


def fail(line: int, msg: str) -> SourceError:
    return SourceError(line, msg)


def i18n(text: str, langs: list[str], line: int) -> dict:
    """`norsk | English` -> {no, en}. One part means both say the same."""
    parts = [p.strip() for p in text.split("|")]
    if len(parts) == 1:
        return {lang: parts[0] for lang in langs}
    if len(parts) != len(langs):
        raise fail(line, f"expected {len(langs)} languages separated by '|', "
                         f"got {len(parts)}: {text!r}")
    return dict(zip(langs, parts))


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def parse_outline(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()

    front: dict[str, str] = {}
    i, n = 0, len(lines)
    while i < n and (not lines[i].strip() or lines[i].lstrip().startswith("//")):
        i += 1
    if i < n and lines[i].strip() == "---":
        i += 1
        while i < n and lines[i].strip() != "---":
            text = lines[i]
            if text.strip() and not text.lstrip().startswith("//"):
                if ":" not in text:
                    raise fail(i + 1, f"front matter is `key: value`, got {text!r}")
                k, _, v = text.partition(":")
                front[k.strip()] = v.strip()
            i += 1
        if i >= n:
            raise fail(1, "the front matter opens with `---` and never closes")
        i += 1

    langs = [l.strip() for l in front.get("langs", ",".join(DEFAULT_LANGS)).split(",")
             if l.strip()]
    out = {
        "pack": front.get("pack", ""),
        "langs": langs,
        "question": {lang: [] for lang in langs},
        "about": {lang: [] for lang in langs},
        "notHere": [],
        "chapters": [],
    }
    if not out["pack"]:
        raise fail(1, "the front matter must say which pack this is: `pack: <id>`")

    section = None
    chapter = None
    key = None                       # the chapter key a continuation line joins
    while i < n:
        text, lineno, i = lines[i], i + 1, i + 1
        stripped = text.strip()

        if stripped.startswith("## "):
            chapter = {"id": stripped[3:].strip(), "line": lineno}
            out["chapters"].append(chapter)
            section, key = None, None
            continue
        if stripped.startswith("# "):
            name = stripped[2:].strip().lower()
            if name not in SECTIONS:
                raise fail(lineno, f"no section called '{name}'. There are "
                                   f"three: " + ", ".join(
                                       f"`# {sec}`" for sec in SECTIONS))
            section, chapter, key = name, None, None
            continue
        if not stripped or stripped.startswith("//"):
            key = None
            continue

        if section in ("about", "question"):
            bucket = out[section]
            if stripped.startswith(">"):
                if not bucket[langs[0]]:
                    raise fail(lineno, "a `>` line translates the sentence above "
                                       "it, and there is no sentence above it")
                bucket[langs[-1]].append(stripped[1:].strip())
            else:
                bucket[langs[0]].append(stripped)
            continue

        if section == "not here":
            subject = i18n(stripped, langs, lineno)
            out["notHere"].append({
                "line": lineno,
                "name": {l: subject[l].split(",")[0].strip() for l in langs},
                "words": {l: [w.strip() for w in subject[l].split(",") if w.strip()]
                          for l in langs},
            })
            continue

        if chapter is None:
            raise fail(lineno, f"text outside any chapter: {stripped[:50]!r}. A "
                               f"chapter starts with `## <chapter-id>`")

        # A key line is never indented and a continuation always is. Matching
        # on `word:` alone was wrong the first time a sentence wrapped onto a
        # line beginning "kontrollen: langsomt, rent" — which is prose, and was
        # rejected as an unknown field. Indentation is the only rule that can
        # tell the two apart without guessing, and every outline already
        # follows it.
        if re.match(r"^[a-z][a-z0-9_]*:", stripped) and not (
                key and text[:1].isspace()):
            key, _, value = stripped.partition(":")
            key = key.strip()
            if key not in CHAPTER_KEYS:
                raise fail(lineno, f"a chapter takes {', '.join(sorted(CHAPTER_KEYS))}"
                                   f", not '{key}'")
            chapter[key] = value.strip()
        elif key:
            # A wrapped line joins the key above it, so a `for:` can be a
            # sentence and not a column of one.
            chapter[key] = f"{chapter[key]} {stripped}".strip()
        else:
            raise fail(lineno, f"a chapter is `key: value` lines, got {stripped[:50]!r}")

    for ch in out["chapters"]:
        line = ch.pop("line")
        for k in list(ch):
            if k in I18N_KEYS:
                ch[k] = i18n(ch[k], langs, line)
            elif k in LIST_KEYS:
                ch[k] = [v.strip() for v in ch[k].split(",") if v.strip()]
            elif k == "planned":
                ch[k] = ch[k].strip().lower() in ("true", "yes", "ja")
        if "title" not in ch:
            raise fail(line, f"{ch['id']} has no `title:`")
        for value in ch.get("shows", []):
            if value not in SHOWS:
                raise fail(line, f"{ch['id']} is shown by '{value}'. The list is "
                                 f"{', '.join(sorted(SHOWS))}, most important first")
    for lang in langs:
        out["about"][lang] = "\n\n".join(out["about"][lang])
        out["question"][lang] = " ".join(out["question"][lang]).strip()
    return out


# ---------------------------------------------------------------------------
# Compile
# ---------------------------------------------------------------------------

def chapters_for_pack(outline: dict) -> list[dict]:
    """The `chapters` array pack.json should carry, in the outline's order."""
    rows = []
    for ch in outline["chapters"]:
        if ch.get("planned"):
            continue                 # written down, not written yet
        row = {"id": ch["id"]}
        for field in PACK_FIELDS[1:]:
            if field in ch:
                row[field] = ch[field]
        row.setdefault("langs", list(outline["langs"]))
        rows.append(row)
    return rows


def find_array(raw: str, key: str) -> tuple[int, int, int]:
    """Where `"key": [ ... ]` starts and ends in the raw text, and its indent.

    pack.json is hand-formatted — compact arrays, aligned columns — so it is
    NOT re-dumped. Re-serialising the whole file to change one array would
    reformat ninety lines a person aligned on purpose, and the diff would hide
    the one line that actually changed.
    """
    m = re.search(r'\n(\s*)"%s"\s*:\s*\[' % re.escape(key), raw)
    if not m:
        raise ValueError(f'pack.json has no "{key}" array')
    indent = len(m.group(1))
    start = m.end() - 1
    depth, j, in_str, esc = 0, start, False, False
    while j < len(raw):
        c = raw[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return start, j + 1, indent
        j += 1
    raise ValueError(f'"{key}" array is never closed')


def render(rows: list[dict], indent: int) -> str:
    body = json.dumps(rows, ensure_ascii=False, indent=2)
    pad = " " * indent
    return "\n".join(pad + line if k else line
                     for k, line in enumerate(body.splitlines()))


# ---------------------------------------------------------------------------
# The questions
# ---------------------------------------------------------------------------

def chapters_on_disk(pack: str) -> list[str]:
    d = os.path.join(CONTENT, pack)
    return sorted(f[:-5] for f in os.listdir(d)
                  if f.startswith("chapter-") and f.endswith(".json"))


def sentences(pack: str, cid: str, langs: list[str]):
    """Every spoken sentence of a chapter, with the beat it belongs to."""
    path = os.path.join(CONTENT, pack, cid + ".json")
    with open(path, encoding="utf-8") as fh:
        chapter = json.load(fh)
    for scene in chapter.get("scenes", []):
        for beat in scene.get("beats", []):
            say = beat.get("say") or {}
            for lang in langs:
                if say.get(lang):
                    yield beat.get("id", "?"), lang, say[lang]


def cue_mix(pack: str, cid: str) -> dict[str, int]:
    """How many cues each surface answers in a chapter that ships.

    This is the second half of `shows:`. The first half is a promise made
    before anything exists; this is what the chapter turned out to be. Verbs
    name their own surface in engine/verbs.json, so nothing here knows what a
    verb does.

    IT IS PRINTED AND NOT JUDGED, and the first real run is why. The beer
    course's chapter one is thirteen full-frame pictures over ten minutes and
    almost nothing else, which is exactly what its `shows: pictures` promised.
    Counted as cues it came out `overlays 30, plate 26` and the tool called it
    a mismatch -- because every card is a show and a hide, every picture is a
    show and a hide, and a fact box the size of a stamp counts the same as a
    picture covering the whole phone. The count cannot answer the question it
    was being asked.

    Screen SECONDS would answer it, and that is a real measurement worth
    building. It is not this: the map is under everything for the whole
    chapter, so "which surface is on screen longest" is the map in every
    chapter ever written, and the number that actually matters -- how much of
    the map an overlay is sitting on -- is already measured, per frame, by
    tools/check-overlap.py.

    So this prints the arrivals and lets a person read them, the same
    conclusion tools/review-pictures.py reached about its own word count: as a
    flag it fired on the good chapters too, and a tool that cries wolf gets
    skipped.
    """
    with open(os.path.join(ROOT, "engine", "verbs.json"), encoding="utf-8") as fh:
        verbs = json.load(fh)["verbs"]
    with open(os.path.join(CONTENT, pack, cid + ".json"), encoding="utf-8") as fh:
        chapter = json.load(fh)
    mix: dict[str, int] = {}
    for scene in chapter.get("scenes", []):
        for beat in scene.get("beats", []):
            for cue in beat.get("cues", []):
                surface = (verbs.get(cue.get("do"), {}) or {}).get("surface")
                if surface:
                    mix[surface] = mix.get(surface, 0) + 1
    return mix


def ask(outline: dict, pack: str) -> tuple[list[str], list[str]]:
    """(failures, notes) — the gates first, the judgement after."""
    fails, notes = [], []
    langs = outline["langs"]
    listed = [c["id"] for c in outline["chapters"]]
    planned = {c["id"] for c in outline["chapters"] if c.get("planned")}
    on_disk = chapters_on_disk(pack)

    for cid in on_disk:
        if cid not in listed:
            fails.append(f"{cid} ships and the outline does not mention it — "
                         f"add it, or the course does not know what it teaches")
    for cid in listed:
        if cid not in on_disk and cid not in planned:
            fails.append(f"{cid} is in the outline and there is no "
                         f"{cid}.json — mark it `planned: true` until there is")
    if len(set(listed)) != len(listed):
        fails.append("the same chapter is listed twice")

    # The course has to say what question it answers. A course without one is
    # a list of chapters, and the wine outline had a very good one buried in
    # prose where nothing above the chapter could point at it.
    for lang in langs:
        if not outline["question"].get(lang):
            fails.append(f"`# question` says nothing in {lang} — one sentence, "
                         f"the question the whole course answers")
    first = outline["question"].get(langs[0], "")
    if first and not first.rstrip().endswith("?"):
        notes.append("`# question` is not a question. That is allowed, and it "
                     "is usually a sign the spine is a topic and not a spine")

    # What a chapter assumes must have been TAUGHT, and taught earlier. This is
    # the commonest way a course quietly stops working, and it is invisible
    # from inside the chapter doing the assuming.
    taught_by_now: set[str] = set()
    for ch in outline["chapters"]:
        for subject in ch.get("assumes", []):
            key = subject.lower()
            if key in {t.lower() for t in ch.get("teaches", [])}:
                notes.append(f"{ch['id']} both assumes and teaches '{subject}'")
            elif key not in taught_by_now:
                fails.append(f"{ch['id']} assumes '{subject}' and no earlier "
                             f"chapter teaches it")
        taught_by_now |= {t.lower() for t in ch.get("teaches", [])}

    # What carries the frame, against what the pack can actually draw. Asked
    # here because a course that does not declare `map` loads no map module and
    # no geometry, and that is a decision worth making before the writing.
    with open(os.path.join(CONTENT, pack, "pack.json"), encoding="utf-8") as fh:
        surfaces = set(json.load(fh).get(
            "surfaces", ["map", "plate", "overlays", "sound"]))
    for ch in outline["chapters"]:
        for value in ch.get("shows", []):
            surface = SHOWS[value]
            if surface is None:
                notes.append(
                    f"{ch['id']} is carried by '{value}' and no surface in "
                    f"engine/surfaces/ draws it — that is a framework item, "
                    f"not a content one")
            elif surface not in surfaces:
                soon = ch.get("planned")
                where = ("cannot be written until the pack declares it"
                         if soon else "will draw nothing")
                line = (f"{ch['id']} is carried by '{value}' and pack.json does "
                        f"not declare the `{surface}` surface — it {where}")
                (notes if soon else fails).append(line)
        if not ch.get("shows"):
            notes.append(f"{ch['id']} does not say what carries its frame "
                         f"(`shows:`)")

    # And what it turned out to be, printed beside what it promised. Read the
    # two together; the docstring on cue_mix says why this is not a verdict.
    for ch in outline["chapters"]:
        wants = ch.get("shows", [])
        if not wants or ch["id"] not in on_disk:
            continue
        mix = cue_mix(pack, ch["id"])
        if not mix:
            continue
        spread = ", ".join(f"{k} {v}" for k, v in
                           sorted(mix.items(), key=lambda kv: -kv[1]))
        notes.append(f"{ch['id']} promised '{', '.join(wants)}' and arrives as "
                     f"{spread} — cues, not seconds, and a fact card counts "
                     f"the same as a full-frame picture")

    # Chapter two repeating chapter one. A subject may legitimately come back
    # as context, so this is a note: the question is whether it comes back as
    # the POINT, and no tool can see that.
    claims: dict[str, list[str]] = {}
    for ch in outline["chapters"]:
        for subject in ch.get("teaches", []):
            claims.setdefault(subject.lower(), []).append(ch["id"])
    for subject, where in sorted(claims.items()):
        if len(where) > 1:
            notes.append(f"'{subject}' is taught by {' and '.join(where)}")

    # The whites, mechanically. Only the words the outline actually lists.
    for subject in outline["notHere"]:
        for ch in outline["chapters"]:
            if ch["id"] in planned or ch["id"] not in on_disk:
                continue
            for subj in [s.lower() for s in subject["words"].get(langs[0], [])] \
                    + [s.lower() for s in subject["words"].get(langs[-1], [])]:
                pattern = re.compile(rf"\b{re.escape(subj)}\b", re.I)
                for bid, lang, text in sentences(pack, ch["id"], langs):
                    if pattern.search(text):
                        notes.append(
                            f"{ch['id']} {bid} {lang}: says '{subj}', which the "
                            f"course puts under `not here`\n      {text}")
    return fails, notes


# ---------------------------------------------------------------------------
# A first outline, from what a pack already declares
# ---------------------------------------------------------------------------

def scaffold(pack: str) -> str:
    with open(os.path.join(CONTENT, pack, "pack.json"), encoding="utf-8") as fh:
        data = json.load(fh)
    langs = DEFAULT_LANGS
    out = [f"// Kursplan for {pack}. What the course teaches, in what order, and",
           "// what each chapter is FOR. pack.json's `chapters` list is compiled",
           "// from this file.",
           "//",
           f"//     python tools/outline.py {pack} --check",
           f"//     python tools/outline.py {pack} --write",
           "",
           "---",
           f"pack: {pack}",
           "---",
           "",
           "# about",
           "TODO: hva kurset handler om, i én setning.",
           "> TODO: what the course is about, in one sentence.",
           "",
           "# not here",
           "// One subject per line, and the words it is spoken with:",
           "//     hvitvin, hvite | white wine, whites",
           ""]
    for ch in data.get("chapters", []):
        out.append(f"## {ch['id']}")
        for field in ("title", "subtitle", "blurb"):
            if field in ch:
                pair = " | ".join(ch[field].get(l, "") for l in langs)
                out.append(f"{field}: {pair}")
        if ch.get("langs"):
            out.append("langs: " + ", ".join(ch["langs"]))
        out.append("for: TODO | TODO")
        out.append("teaches: ")
        out.append("")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# A course from nothing
# ---------------------------------------------------------------------------

SKELETON = """// Kursplan for {pack}. Dette er nivaaet over et kapittel: hva kurset
// laerer bort, i hvilken rekkefolge, og hva hvert kapittel er TIL FOR.
// pack.json sin `chapters`-liste er kompilert herfra.
//
//     python tools/outline.py {pack}
//     python tools/outline.py {pack} --write
//
// Den vanlige linja er norsk, skrevet forst; `>`-linja under er engelsk.
// Les docs/planning.md for hva hvert felt er til for.

---
pack: {pack}
---

# question
// Ett sporsmaal. Hele kurset er svaret, og hvert kapittel er en del av det.
TODO: sporsmaalet kurset svarer paa.
> TODO: the question the course answers.

# about
TODO: hva kurset handler om, og hva det med vilje ikke handler om.
> TODO: what the course is about, and what it deliberately is not about.

# not here
// Ett emne per linje, og ordene det sies med, slik at verktoyet finner dem
// i manuset og viser setningen:
//     hvitvin, hvite | white wine, whites

## chapter-1-TODO
title: TODO | TODO
subtitle: TODO | TODO
blurb: TODO | TODO
langs: no, en
planned: true
for: TODO — hva kapitlet er TIL FOR, ikke hva det inneholder.
     | TODO — what the chapter is FOR, not what is in it.
teaches: 
assumes: 
shows: pictures
"""


def new_pack(pack: str) -> int:
    """Start a course: an outline first, and a pack.json compiled from it.

    The order matters and it used to be the wrong way round — `--new` builds an
    outline FROM a pack.json, which assumes somebody already decided what the
    chapters are. That is exactly the decision the outline exists to make, so
    there was no way to begin at the beginning. This is that way.
    """
    folder = os.path.join(CONTENT, pack)
    if os.path.exists(folder):
        print(f"content/{pack}/ already exists", file=sys.stderr)
        return 1
    os.makedirs(folder)

    with open(os.path.join(folder, "outline.md"), "w",
              encoding="utf-8", newline="\n") as fh:
        fh.write(SKELETON.format(pack=pack))

    manifest = {
        "id": pack,
        "version": 1,
        "//": [
            "A new course. Everything marked TODO has to be decided before a",
            "chapter is written, and README.md's step 2 says what each field",
            "is. The two that cost the most to change later:",
            "",
            "`surfaces` — what the scene is made of. A course that does not",
            "name `map` loads no map module and not a byte of geometry, which",
            "is 3.85 MB it does not pay for. outline.md's `shows:` is where",
            "that decision is argued; this array is where it is declared.",
            "",
            "`factions` — not sides in a war. Named colours the map and the",
            "DOM can both reach, and for a subject with no combatants the",
            "honest use is whatever the subject actually divides into.",
        ],
        "work": {"no": "TODO", "en": "TODO"},
        "years": {"no": "TODO", "en": "TODO"},
        "description": {"no": "TODO", "en": "TODO"},
        "factions": {
            "neutral": {"label": {"no": "Ovrige", "en": "Elsewhere"},
                        "hue": 96, "sat": 0.28}
        },
        "map": {
            "home": [0, 0],
            "zoom": {"min": 3.0, "max": 13, "default": 5.0, "maxFit": 12.0},
            "basemap": {"levels": [{"name": "world-110m", "maxZoom": 4.0},
                                   {"name": "world-50m", "maxZoom": None}]},
            "borders": {"country": True, "state": False},
            "credit": "Natural Earth",
        },
        "era": {"start": "1900-01-01", "end": "2026-12-31", "tickStep": "year"},
        "voices": {"no": "nb-NO-FinnNeural", "en": "en-GB-RyanNeural",
                   "rate": "-8%"},
        "narration": {"wps": [1.9, 3.4], "minContentWordMs": 100},
        "pools": {"terms": "terms.json", "topics": "topics.json",
                  "media": "media.json"},
        "chapters": [],
        "surfaces": ["plate", "overlays", "sound"],
        "entries": {
            "term": {"label": {"no": "Ordbok", "en": "Glossary"},
                     "browse": True},
            "topic": {"label": {"no": "Tema", "en": "Topics"}, "browse": True},
        },
    }
    with open(os.path.join(folder, "pack.json"), "w",
              encoding="utf-8", newline="\n") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    for sub in ("media", "portraits", "geo", "sound"):
        os.makedirs(os.path.join(folder, sub), exist_ok=True)
    # An OBJECT and not an array. Every pool in this framework is keyed by id
    # -- terms, topics, media, grapes -- and an empty `[]` gets as far as
    # check-data.py's `media.items()` before saying so.
    for name in ("terms.json", "topics.json", "media.json"):
        with open(os.path.join(folder, name), "w",
                  encoding="utf-8", newline="\n") as fh:
            fh.write("{}\n")

    print(f"content/{pack}/ — outline.md, pack.json and empty pools.\n"
          f"  1. write outline.md: the question, the course, the chapters\n"
          f"  2. python tools/outline.py {pack} --write\n"
          f"  3. python tools/author.py --new {pack}/<chapter-id>")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pack", nargs="?", help="e.g. italy-wine")
    ap.add_argument("--write", action="store_true",
                    help="update pack.json's chapters array from the outline")
    ap.add_argument("--check", action="store_true",
                    help="the default: compile, diff, and ask the questions")
    ap.add_argument("--new", metavar="PACK",
                    help="print a first outline built from that pack's pack.json")
    ap.add_argument("--new-pack", metavar="PACK", dest="new_pack",
                    help="start a course from nothing: the outline first, and "
                         "a pack.json compiled from it")
    args = ap.parse_args(argv)

    if args.new_pack:
        return new_pack(args.new_pack)
    if args.new:
        sys.stdout.write(scaffold(args.new))
        return 0
    if not args.pack:
        ap.print_help()
        return 2

    path = os.path.join(CONTENT, args.pack, "outline.md")
    if not os.path.exists(path):
        print(f"{args.pack}: no outline.md. Start one with:\n"
              f"  python tools/outline.py --new {args.pack} "
              f"> content/{args.pack}/outline.md", file=sys.stderr)
        return 2

    try:
        outline = parse_outline(path)
    except SourceError as err:
        print(f"outline.md:{err}", file=sys.stderr)
        return 1
    if outline["pack"] != args.pack:
        print(f"outline.md says `pack: {outline['pack']}` and lives in "
              f"content/{args.pack}/", file=sys.stderr)
        return 1

    rows = chapters_for_pack(outline)
    pack_path = os.path.join(CONTENT, args.pack, "pack.json")
    raw = open(pack_path, encoding="utf-8").read()
    current = json.loads(raw).get("chapters", [])

    planned = [c["id"] for c in outline["chapters"] if c.get("planned")]
    print(f"{args.pack}: {len(outline['chapters'])} chapters"
          f"{f' ({len(planned)} planned)' if planned else ''}, "
          f"{len(outline['notHere'])} subjects the course leaves out")

    drift = json.dumps(current, sort_keys=True, ensure_ascii=False) != \
        json.dumps(rows, sort_keys=True, ensure_ascii=False)
    if drift:
        if args.write:
            start, end, indent = find_array(raw, "chapters")
            with open(pack_path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(raw[:start] + render(rows, indent) + raw[end:])
            print(f"  wrote the chapters array into "
                  f"{os.path.relpath(pack_path, ROOT)}")
        else:
            print(f"  pack.json's chapters differ from the outline:")
            print(f"    outline:  {[r['id'] for r in rows]}")
            print(f"    pack.json:{[r.get('id') for r in current]}")
            for r in rows:
                cur = next((c for c in current if c.get("id") == r["id"]), None)
                if cur is None:
                    print(f"    {r['id']}: not in pack.json")
                    continue
                for k in PACK_FIELDS[1:]:
                    if r.get(k) != cur.get(k):
                        print(f"    {r['id']}.{k}: {cur.get(k)} -> {r.get(k)}")
    else:
        print("  pack.json says what the outline says")

    fails, notes = ask(outline, args.pack)
    if notes:
        print(f"\nnotes ({len(notes)}):")
        for note in notes:
            print(f"  - {note}")
    if fails:
        print(f"\nPROBLEMS ({len(fails)}):")
        for f in fails:
            print(f"  FAIL: {f}")
        return 1
    if drift and not args.write:
        print("\nnothing written — pass --write to update pack.json.")
        return 1
    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
