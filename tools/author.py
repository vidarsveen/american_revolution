#!/usr/bin/env python3
"""
author.py — write a chapter as prose, compile it to the chapter JSON.

    python tools/author.py content/italy-wine/script.md --check
    python tools/author.py content/italy-wine/script.md --write
    python tools/author.py --from-json italy-wine/chapter-1-piemonte
    python tools/author.py --lab
    python tools/author.py --verbs

A chapter is 1650 lines of JSON and about 120 lines of anything a person would
call writing. Everything else is bookkeeping — beat ids that derive from scene
ids, `gapAfter` values off a three-number scale, and a cue vocabulary whose
every argument is already declared in engine/verbs.json. Bookkeeping is what a
compiler is for.

So the source is prose with the cues attached to the words they belong to:

    Piemonte betyr ved foten av fjellet. {flyTo torino zoom=7.6 over=1.6}
    > Piemonte means at the foot of the mountain.

and the anchor is WHERE THE CUE SITS, not something typed twice. A cue after a
word compiles to `"on": "word:<that word>"`; a cue before the first word
compiles to `"on": "start"`.

THREE THINGS THIS FILE DELIBERATELY DOES NOT DO
-----------------------------------------------

**It does not know the cue vocabulary.** Not one verb, argument, type, enum or
default is written down here: they are read out of `engine/verbs.json`, which
engine/stage.js binds handlers to and tools/check-script.py validates against.
A hand-written table of shorthands would be the exact defect CLAUDE.md records
twice — `kind` on marker.show and `tone` on place.highlight sat in a chapter
for months being read by nobody, because the vocabulary lived in three places
and two of them drifted. The shorthands below are DERIVED from the manifest's
own shape (see `vocabulary()`), and a verb may also declare `"shorthand"` in
the manifest, which wins.

**It never fills in a default.** A default belongs to the engine, which already
has it. Writing it into the chapter would make the file lie about what the
author decided, and would make this compiler a second, silently diverging copy
of the manifest's defaults.

**It does not change the schema.** The output is the chapter JSON the engine,
check-script.py and narrate.py already read, byte-comparable against the eight
chapters that ship. `--lab` is the bench for that claim: it decompiles every
chapter in content/, compiles it back, and fails on any difference. A format
that cannot reproduce a shipping chapter is missing something the app needs,
and the point of the bench is to find out WHICH.

Reading a pack — where it lives, what pools a reference resolves against, how
the engine normalises a word — is tools/scriptlib.py, shared with the checkers.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

from scriptlib import (
    CONTENT, REF_TYPES, ROOT, VERB_SPEC,
    load_json, norm, pack_dir, pack_era, resolve_pools, sound_years, tokens,
)


# ---------------------------------------------------------------------------
# The pace of a chapter, in the three numbers docs/design-direction.md gives.
# ---------------------------------------------------------------------------
#
# `gapAfter` is the air after a spoken sentence, and an author should not be
# typing it: it is a property of where the beat sits, not a decision per beat.
# Three cases, and the source says which one with a blank line:
#
#   air     the next sentence follows on                     --t-enter
#   breath  a paragraph break — a new thought                 1.5 x air
#   turn    the last beat of a scene, prescribed by §4        "2.0 s of
#           silence. Nothing moves. The last picture holds."
#
# Measured against the wine chapter, which was hand-tuned: every one of its 45
# gaps is one of these three, and every 1.35 falls where a paragraph break
# falls. The scale was already there; nobody had written it down.
AIR = 0.9
BREATH = 1.35
TURN = 2.0

# Which languages a chapter is written in, primary first. Norwegian is written
# natively and English follows it (CLAUDE.md, "Writing style"), so the plain
# prose line is Norwegian and the quoted line under it is English.
DEFAULT_LANGS = ["no", "en"]

# A key whose last dotted segment is one of these carries both languages,
# written `norsk | English`.
I18N_KEYS = {"work", "title", "subtitle", "blurb", "clock", "say", "label",
             "note", "text", "by", "name"}

# Top-level chapter fields, in the order the shipping files use them.
FIELD_ORDER = ["id", "pack", "work", "title", "subtitle", "blurb", "voice",
               "rate", "ground", "home", "regions", "poster", "places",
               "routes", "quotes", "ending", "scenes"]

SECTIONS = ("places", "routes", "quotes", "ending")


class SourceError(Exception):
    """A problem in the script, with the line it is on."""

    def __init__(self, line: int, msg: str):
        super().__init__(f"{line}: {msg}")
        self.line = line
        self.msg = msg


def fail(line: int, msg: str) -> "SourceError":
    return SourceError(line, msg)


# ---------------------------------------------------------------------------
# The vocabulary, derived from engine/verbs.json
# ---------------------------------------------------------------------------

def vocabulary() -> tuple[dict, dict]:
    """(alias -> verb, verb -> positional slot).

    Three derivations, in order of precedence, and no table:

    1. **The manifest's own `shorthand`**, if a verb declares one. Nothing does
       today; the field is read so that `"shorthand": "fly"` on map.flyTo is a
       one-line change in the file that already owns the vocabulary, rather
       than a second list here.
    2. **The last segment, when it is unique.** `map.flyTo` -> `flyTo`,
       `place.highlight` -> `highlight`. `show` is not unique and so is not an
       alias, which is correct: `{show barolo}` cannot mean anything.
    3. **The family's primary, when the family has exactly one verb that is
       not a hide or a clear.** `region.show` -> `region`, `route.draw` ->
       `route`, `term.mark` -> `term`. `map.*` has six live members and so
       gets no `map` alias; `sound.*` has three and gets none either — which
       is why `{play corkDraw}` is spelled with the unique segment.

    The positional slot — the one argument you may write without naming it —
    is derived too: a verb declaring a required `kind` (enum) AND a required
    `id` takes its positional as `kind:id`, the same shape chart.show's own
    `ref` argument already uses. Everything else takes its first required
    argument, or its first argument if none is required.
    """
    alias: dict[str, str] = {}
    for verb, spec in VERB_SPEC.items():
        alias[verb] = verb
        short = spec.get("shorthand")
        if short:
            alias[str(short)] = verb

    seg_count = Counter(v.split(".")[-1] for v in VERB_SPEC)
    for verb in VERB_SPEC:
        seg = verb.split(".")[-1]
        if seg_count[seg] == 1:
            alias.setdefault(seg, verb)

    families: dict[str, list[str]] = {}
    for verb in VERB_SPEC:
        if "." in verb:
            families.setdefault(verb.split(".", 1)[0], []).append(verb)
    for family, members in families.items():
        live = [m for m in members if m.split(".")[-1] not in ("hide", "clear")]
        if len(live) == 1:
            alias.setdefault(family, live[0])

    slots: dict[str, tuple] = {}
    for verb, spec in VERB_SPEC.items():
        args = spec.get("args") or {}
        required = [k for k, a in args.items() if a.get("required")]
        if "kind" in required and "id" in required:
            slots[verb] = ("kind:id", None)
        elif required:
            slots[verb] = ("plain", required[0])
        elif args:
            slots[verb] = ("plain", next(iter(args)))
        else:
            slots[verb] = ("none", None)
    return alias, slots


ALIAS, SLOT = vocabulary()

# An argument of list type may also be written one item per key, in the
# singular: `part=... part=...` for `parts`. Derived by dropping a trailing
# "s", so `places`, `names` and `parts` all get it and nothing else has to be
# listed anywhere.
SINGULAR = {}
for _verb, _spec in VERB_SPEC.items():
    for _arg, _def in (_spec.get("args") or {}).items():
        if str(_def.get("type", "")).endswith("[]") and _arg.endswith("s"):
            SINGULAR.setdefault(_verb, {})[_arg[:-1]] = _arg


def verbs_report() -> str:
    """The vocabulary as an author sees it. Printed by --verbs."""
    out = ["The cue vocabulary, derived from engine/verbs.json.",
           "Anything in the left column is a way to write the verb on the right.",
           ""]
    by_verb: dict[str, list[str]] = {}
    for name, verb in ALIAS.items():
        if name != verb:
            by_verb.setdefault(verb, []).append(name)
    for verb, spec in VERB_SPEC.items():
        short = ", ".join(sorted(by_verb.get(verb, []))) or "-"
        kind, arg = SLOT.get(verb, ("none", None))
        pos = "kind:id" if kind == "kind:id" else (arg or "-")
        args = []
        for name, adef in (spec.get("args") or {}).items():
            t = adef.get("type", "")
            if t == "enum":
                t = "|".join(map(str, adef.get("values") or []))
            args.append(f"{name}:{t}" + ("*" if adef.get("required") else ""))
        out.append(f"  {verb:<16} {short:<22} positional={pos}")
        out.append(f"       {'  '.join(args) or '(no arguments)'}")
    out.append("")
    out.append("* = required.  Arguments are written key=value; the value runs")
    out.append("to the next key=. `norsk | English` for a two-language value.")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Values
# ---------------------------------------------------------------------------

def split_tokens(text: str) -> list[str]:
    """Whitespace split, but a quoted run and a bracketed run stay together."""
    out, buf, quote, depth = [], "", "", 0
    for ch in text:
        if quote:
            buf += ch
            if ch == quote:
                quote = ""
            continue
        # Only the double quote groups tokens. An apostrophe is a letter in
        # this app -- Meriam's Corner, Moscato d'Asti, Breed's Hill -- and
        # treating it as a delimiter left a cue looking for a `}` that the
        # rest of the line never had.
        if ch == '"':
            quote = ch
            buf += ch
            continue
        if ch in "[{":
            depth += 1
        elif ch in "]}":
            depth = max(0, depth - 1)
        if ch.isspace() and depth == 0:
            if buf:
                out.append(buf)
                buf = ""
            continue
        buf += ch
    if buf:
        out.append(buf)
    return out


def dequote(tok: str) -> str:
    if len(tok) >= 2 and tok[0] == tok[-1] == '"':
        return tok[1:-1]
    return tok


def as_number(text: str):
    """int or float, keeping the distinction the author wrote.

    `zoom=9` is 9 and `zoom=9.0` is 9.0. They are the same number and a
    different file, and a round-trip that cannot tell them apart cannot prove
    anything about the eight chapters that ship.
    """
    t = text.strip()
    if re.fullmatch(r"[+-]?\d+", t):
        return int(t)
    return float(t)


def i18n(text: str, langs: list[str]) -> dict:
    """`norsk | English` -> {no, en}. One part means both say the same."""
    parts = [p.strip() for p in text.split("|")]
    if len(parts) == 1:
        return {lang: parts[0] for lang in langs}
    if len(parts) != len(langs):
        raise ValueError(f"expected {len(langs)} languages separated by '|', "
                         f"got {len(parts)}: {text!r}")
    return dict(zip(langs, parts))


def loose(text: str, langs: list[str]):
    """A value with no declared type — a place attribute, a route flag.

    Numbers become numbers, true/false become booleans, and anything with a
    `|` in it becomes a two-language pair, because that is what those values
    are in every chapter on disk.
    """
    t = text.strip()
    if t.lower() in ("true", "false"):
        return t.lower() == "true"
    if re.fullmatch(r"[+-]?\d+(\.\d+)?", t):
        return as_number(t)
    if "|" in t:
        return i18n(t, langs)
    return t


def typed(value: str, atype: str, adef: dict, langs: list[str], verb: str, arg: str):
    """One argument value, coerced by the type the manifest declares for it."""
    text = value.strip()
    if text == "null":
        # map.time takes a null to clear the clock — "the epilogue steps
        # outside the day", as the manifest puts it.
        return None
    if text[:1] in "[{" and atype not in ("i18n", "string"):
        # The escape hatch: raw JSON for a type the readable grammar has no
        # spelling for yet. It costs nothing to leave open and it means a new
        # argument type in the manifest can never make a chapter unwritable.
        return json.loads(text)

    if atype.endswith("[]"):
        base = atype[:-2]
        if base == "part":
            raise ValueError(f"{verb} '{arg}' is a list of parts — write one "
                             f"`part=` per part, or paste raw JSON")
        items = [p.strip() for p in text.split(",") if p.strip()]
        return [typed(i, base, adef, langs, verb, arg) for i in items]
    if atype == "i18n":
        return i18n(text, langs)
    if atype in ("number", "seconds"):
        return as_number(text)
    if atype == "boolean":
        low = text.lower()
        if low not in ("true", "false", "yes", "no"):
            raise ValueError(f"{verb} '{arg}' takes true or false, got {text!r}")
        return low in ("true", "yes")
    if atype == "enum":
        allowed = adef.get("values") or []
        if allowed and text not in allowed:
            raise ValueError(f"{verb} '{arg}' is '{text}', not one of "
                             f"{', '.join(map(str, allowed))}")
        return text
    return dequote(text)


def part(text: str, langs: list[str], factions: set[str]) -> dict:
    """One bar of a compare.show: `38 "38 mnd" red Barolo`.

    n, then what is printed, then a colour, then the label. The colour is
    resolved against the PACK: a name the pack declares as a faction is a
    `side`, and one of the palette's four roles is a `tone`. `red` is both a
    faction of the wine pack and a palette role, and only the pack can say
    which one is meant — which is the whole reason CLAUDE.md forbids a
    hand-written mapping from a tone to a faction.
    """
    toks = split_tokens(text)
    if len(toks) < 2:
        raise ValueError("a part needs at least a number and a value: "
                         "`part=38 \"38 mnd\" red Barolo`")
    out = {"n": as_number(dequote(toks[0])), "value": dequote(toks[1])}
    rest = toks[2:]
    if rest:
        first = dequote(rest[0])
        if first in factions:
            out["side"] = first
            rest = rest[1:]
        elif first in ("red", "blue", "gold", "sage"):
            out["tone"] = first
            rest = rest[1:]
    if rest:
        out["label"] = i18n(" ".join(dequote(t) for t in rest), langs)
    return out


# ---------------------------------------------------------------------------
# Cues
# ---------------------------------------------------------------------------

ATTR = re.compile(r"^([A-Za-z][A-Za-z0-9_]*)=(.*)$", re.S)
MARK = re.compile(r"^\^(\d*)$")


class Cue:
    def __init__(self, raw: str, line: int):
        self.raw = raw
        self.line = line
        self.verb = None
        self.args: dict = {}
        self.anchor = None          # explicit @... , or None
        self.word = None            # derived from where it sits
        self.index = 1              # nth occurrence of that word
        self.same = False           # @same: one bare anchor for every language


def parse_cue(raw: str, line: int, langs: list[str], factions: set[str]) -> Cue:
    cue = Cue(raw, line)
    toks = split_tokens(raw)
    if not toks:
        raise fail(line, "an empty cue `{}`")
    head = toks[0]
    if head not in ALIAS:
        near = [a for a in sorted(ALIAS) if a.lower().startswith(head[:3].lower())]
        raise fail(line, f"no cue verb '{head}'. engine/verbs.json does not "
                         f"declare it" + (f" — did you mean {', '.join(near[:4])}?"
                                          if near else "") +
                         "\n      (tools/author.py --verbs lists every one)")
    cue.verb = ALIAS[head]
    spec = VERB_SPEC[cue.verb]
    declared = spec.get("args") or {}
    singular = SINGULAR.get(cue.verb, {})

    positional: list[str] = []
    key = None
    buckets: dict[str, list[str]] = {}
    order: list[str] = []
    for tok in toks[1:]:
        if tok.startswith("@") and len(tok) > 1:
            # `@same` is not an anchor, it is a statement ABOUT the anchor:
            # one bare string for every language, which is right for a proper
            # noun. It can therefore sit beside an explicit `@word:`.
            if tok[1:] == "same":
                cue.same = True
            else:
                cue.anchor = tok[1:]
            key = None
            continue
        m = ATTR.match(tok)
        if m and (m.group(1) in declared or m.group(1) in singular):
            key = m.group(1)
            order.append(key)
            buckets.setdefault(key, []).append(m.group(2))
            continue
        if m and m.group(1) not in declared and m.group(1) not in singular:
            raise fail(line, f"{cue.verb} has no argument '{m.group(1)}'. It "
                             f"takes: {', '.join(declared) or 'nothing'} "
                             f"(declare it in engine/verbs.json or the engine "
                             f"ignores it)")
        if key is None:
            positional.append(tok)
        else:
            buckets[key][-1] += " " + tok

    if positional:
        kind, arg = SLOT.get(cue.verb, ("none", None))
        text = " ".join(positional)
        if kind == "none":
            raise fail(line, f"{cue.verb} takes no arguments, got {text!r}")
        if kind == "kind:id":
            if ":" not in text:
                allowed = ", ".join((declared.get("kind") or {}).get("values") or [])
                raise fail(line, f"{cue.verb} is written `kind:id` — one of "
                                 f"{allowed} then the entry, e.g. term:nebbiolo")
            k, _, i = text.partition(":")
            buckets.setdefault("kind", []).append(k)
            buckets.setdefault("id", []).append(i)
            order += ["kind", "id"]
        else:
            buckets.setdefault(arg, []).insert(0, text)
            order.insert(0, arg)

    for name in dict.fromkeys(order):
        values = buckets[name]
        target = singular.get(name, name)
        adef = declared[target]
        atype = adef.get("type", "")
        try:
            if name in singular:
                base = atype[:-2] if atype.endswith("[]") else atype
                if base == "part":
                    cue.args[target] = [part(v, langs, factions) for v in values]
                else:
                    cue.args[target] = [typed(v, base, adef, langs, cue.verb, name)
                                        for v in values]
            else:
                cue.args[target] = typed(values[-1], atype, adef, langs,
                                         cue.verb, name)
        except ValueError as err:
            raise fail(line, str(err))

    for name, adef in declared.items():
        if adef.get("required") and name not in cue.args:
            raise fail(line, f"{cue.verb} needs '{name}' "
                             f"({adef.get('type')}) and there is none")
    return cue


# ---------------------------------------------------------------------------
# Prose: pulling the cues out of a sentence and remembering where they sat
# ---------------------------------------------------------------------------

def scan_braces(text: str, line: int):
    """(clean prose, [(raw cue text, word before it, nth occurrence)]).

    The word a cue sits after IS its anchor — that is the whole idea, and it
    is why nothing here asks the author to type a word twice. `\\{` is a
    literal brace.
    """
    out, found = "", []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch == "\\" and i + 1 < n and text[i + 1] in "{}":
            out += text[i + 1]
            i += 2
            continue
        if ch == "{":
            depth, j = 1, i + 1
            quote = ""
            while j < n and depth:
                c = text[j]
                if quote:
                    if c == quote:
                        quote = ""
                elif c == '"':
                    quote = c
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                j += 1
            if depth:
                raise fail(line, "a `{` with no `}` on the same line")
            raw = text[i + 1:j - 1].strip()
            before = out.rstrip()
            word = tokens(before)[-1] if tokens(before) else None
            nth = 0
            if word:
                target = norm(word)
                nth = sum(1 for w in tokens(before) if norm(w) == target)
            found.append((raw, word, nth))
            i = j
            continue
        out += ch
        i += 1
    return tidy(out), found


def tidy(text: str) -> str:
    """Close the hole a removed cue leaves, and nothing else."""
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"[ \t]+([,.;:!?»)\]])", r"\1", text)
    return text.strip()


def clean_word(word: str | None) -> str | None:
    """The token a cue sits after, without the punctuation it carries.

    Stripped only at the edges: `syttisju,` is the word `syttisju`, and
    `Moscato d'Asti` is two tokens either way.
    """
    if not word:
        return None
    return word.strip(".,:;!?—–\"'()[]»«")


# ---------------------------------------------------------------------------
# The document
# ---------------------------------------------------------------------------

class Beat:
    def __init__(self, line: int, text: str):
        self.line = line
        self.source = text          # the primary language, cues and all
        self.pending: list[tuple[int, str]] = []   # the `>` lines under it
        self.breath = False         # a blank line after it: a longer pause


class Scene:
    def __init__(self, line, title):
        self.line = line
        self.title = title
        self.clock = None
        self.bed = None
        self.beats: list[Beat] = []


def parse_document(path: str):
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()

    front: dict[str, tuple[int, str]] = {}
    sections: dict[str, list[tuple[int, str]]] = {}
    raw_json: dict[str, tuple[int, str]] = {}
    scenes: list[Scene] = []

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
                front[k.strip()] = (i + 1, v.strip())
            i += 1
        if i >= n:
            raise fail(1, "the front matter opens with `---` and never closes")
        i += 1

    current_section = None
    scene = None
    while i < n:
        text = lines[i]
        stripped = text.strip()
        lineno = i + 1
        i += 1

        if stripped.startswith("## "):
            scene = Scene(lineno, stripped[3:].strip())
            scenes.append(scene)
            current_section = None
            continue
        if stripped.startswith("# "):
            name = stripped[2:].strip().lower()
            scene = None
            if name.startswith("json "):
                field = name[5:].strip()
                body = []
                while i < n and not lines[i].lstrip().startswith("#"):
                    body.append(lines[i])
                    i += 1
                raw_json[field] = (lineno, "\n".join(body))
                current_section = None
                continue
            if name not in SECTIONS:
                raise fail(lineno, f"no section called '{name}'. The ones there "
                                   f"are: {', '.join(SECTIONS)}, or "
                                   f"`# json <field>` for anything else")
            current_section = name
            sections.setdefault(name, [])
            continue
        if not stripped or stripped.startswith("//"):
            # A blank line between two sentences is a paragraph break, and a
            # paragraph break is a longer pause. That is the whole notation
            # for `gapAfter`: see AIR / BREATH / TURN above.
            if scene and not stripped and scene.beats:
                scene.beats[-1].breath = True
            continue
        if current_section:
            sections[current_section].append((lineno, text))
            continue
        if scene is None:
            raise fail(lineno, f"text outside any scene: {stripped[:50]!r}. A "
                               f"scene starts with `## Tittel | Title`")

        if stripped.startswith(">"):
            if not scene.beats:
                raise fail(lineno, "a `>` line translates the sentence above it, "
                                   "and there is no sentence above it")
            scene.beats[-1].pending.append((lineno, stripped[1:].strip()))
            continue

        if re.match(r"^[a-z][a-z0-9_.]*:\s", stripped) and not scene.beats:
            k, _, v = stripped.partition(":")
            if k.strip() == "clock":
                scene.clock = (lineno, v.strip())
                continue
            if k.strip() == "bed":
                # A bed is state, not an event: engine/surfaces/sound.js drops
                # it at every scene change unless the new scene asks again.
                # Chapter one asked in its first scene and its last, so eight
                # of ten minutes played in silence and nothing noticed. So a
                # scene says which it is -- a sound id, or `none` out loud.
                scene.bed = (lineno, v.strip())
                continue
            raise fail(lineno,
                       f"a scene takes `clock:` or `bed:`, not '{k.strip()}'")

        scene.beats.append(Beat(lineno, stripped))
    return front, sections, raw_json, scenes


# ---------------------------------------------------------------------------
# Compile
# ---------------------------------------------------------------------------

def compile_script(path: str):
    """script.md -> (chapter dict, problems)."""
    front, sections, raw_json, scenes = parse_document(path)
    problems: list[str] = []

    langs = [l.strip() for l in front.pop("langs", (0, ",".join(DEFAULT_LANGS)))[1]
             .split(",") if l.strip()]
    chapter: dict = {}

    for key, (lineno, value) in front.items():
        node = chapter
        parts = key.split(".")
        for seg in parts[:-1]:
            node = node.setdefault(seg, {})
        leaf = parts[-1]
        try:
            node[leaf] = i18n(value, langs) if leaf in I18N_KEYS else value
        except ValueError as err:
            raise fail(lineno, str(err))

    pack = chapter.get("pack")
    if not pack:
        raise fail(1, "the front matter needs `pack:` — it says which subject "
                      "this chapter belongs to")
    if not chapter.get("id"):
        raise fail(1, "the front matter needs `id:` — it is the file name the "
                      "engine loads, e.g. chapter-1-piemonte")
    info = load_json(os.path.join(pack_dir(pack), "pack.json")) or {}
    if not info:
        problems.append(f"content/{pack}/pack.json does not exist — `pack: "
                        f"{pack}` names a subject that is not there")
    factions = set(info.get("factions") or {})
    surfaces = info.get("surfaces") or ["map", "plate", "overlays", "sound"]
    # `ground: none` takes the map surface out for THIS chapter, so a map verb
    # in it would be answered by nobody — which is the silent-do-nothing the
    # surface check exists to prevent. Refuse it here, at compile time, rather
    # than let it reach a stage that has no map on it.
    if chapter.get("ground") == "none" and "map" in surfaces:
        surfaces = [s for s in surfaces if s != "map"]

    if "places" in sections:
        chapter["places"] = parse_places(sections["places"], langs)
    if "routes" in sections:
        chapter["routes"] = parse_routes(sections["routes"], langs)
    if "quotes" in sections:
        chapter["quotes"] = parse_entries(sections["quotes"], langs)
    if "ending" in sections:
        chapter["ending"] = parse_keyed(sections["ending"], langs)
    for field, (lineno, body) in raw_json.items():
        try:
            chapter[field] = json.loads(body)
        except json.JSONDecodeError as err:
            raise fail(lineno, f"`# json {field}` is not valid JSON: {err}")

    out_scenes = []
    for si, scene in enumerate(scenes):
        sid = f"s{si}"
        node = {"id": sid}
        try:
            node["title"] = i18n(scene.title, langs)
        except ValueError as err:
            raise fail(scene.line, str(err))
        if scene.clock:
            node["clock"] = i18n(scene.clock[1], langs)
        if scene.bed:
            # `bed: none` is carried on the scene as a declaration of silence.
            # A named bed becomes the sound.music cue in the first beat below,
            # which makes "one bed per scene, in its first beat" a property of
            # the format rather than a rule to be checked.
            node["bed"] = scene.bed[1]
        beats = []
        if not scene.beats:
            problems.append(f"{path_line(path, scene.line)}: scene '{sid}' has "
                            f"no sentences in it")
        for bi, beat in enumerate(scene.beats):
            bid = f"{sid}.b{bi + 1}"
            last = bi == len(scene.beats) - 1
            try:
                beats.append(compile_beat(bid, beat, langs, factions, problems,
                                          path, last))
            except SourceError as err:
                # One broken sentence must not hide the next four. An author
                # fixing a script wants every complaint in one pass.
                problems.append(f"{path_line(path, err.line)}: {err.msg}")
        # A NAMED BED BECOMES THE CUE. Declaring it on the scene and emitting
        # it here is what makes "one bed per scene, in its first beat"
        # (docs/design-direction.md) a property of the format instead of a
        # rule that has to be checked — there is nowhere else to put it and no
        # way to write two. `bed: none` emits nothing and is the way a scene
        # says its silence is a decision.
        #
        # It goes FIRST in the beat: a bed arrives before the first word.
        if scene.bed and scene.bed[1] != "none" and beats:
            if any(c["do"] == "sound.music" for c in beats[0].get("cues", [])):
                problems.append(
                    f"{path_line(path, scene.bed[0])}: scene '{sid}' declares "
                    f"`bed: {scene.bed[1]}` and its first sentence also carries "
                    f"a {{music …}} cue. Use one or the other.")
            else:
                beats[0].setdefault("cues", []).insert(
                    0, {"on": "start", "do": "sound.music", "id": scene.bed[1]})
        node["beats"] = beats
        out_scenes.append(node)
    chapter["scenes"] = out_scenes

    ordered = {k: chapter[k] for k in FIELD_ORDER if k in chapter}
    ordered.update({k: v for k, v in chapter.items() if k not in ordered})

    problems += validate(ordered, pack, surfaces, langs, path)
    return ordered, problems


def path_line(path: str, line: int) -> str:
    return f"{os.path.basename(path)}:{line}"


def compile_beat(bid, beat, langs, factions, problems, path, last) -> dict:
    """One sentence, its translation, and the cues attached to its words."""
    primary = langs[0]
    lineno, source = beat.line, beat.source
    say_text, raw_cues = scan_braces(source, lineno)

    cues: list[Cue] = []
    gap = None
    for raw, word, nth in raw_cues:
        toks = split_tokens(raw)
        head = toks[0] if toks else ""
        if head == "gap":
            # The escape hatch for a hand-tuned pause — see AIR above. `none`
            # writes no `gapAfter` at all, which is what four beats in the
            # shipping chapters have and is not the same as writing 0.9.
            gap = "none" if len(toks) > 1 and toks[1] == "none" \
                else as_number(toks[1])
            continue
        try:
            cue = parse_cue(raw, lineno, langs, factions)
        except SourceError as err:
            problems.append(f"{path_line(path, err.line)}: {err.msg}")
            continue
        cue.word, cue.index = clean_word(word), max(1, nth)
        # What the anchor is in the language this sentence is written in.
        # Either the author said so with `@`, or it is the word the cue sits
        # after — and `#2` when that word has already been said once.
        if cue.anchor:
            cue.on = cue.anchor
        elif cue.word:
            cue.on = f"word:{cue.word}" + (f"#{cue.index}" if cue.index > 1 else "")
        else:
            cue.on = "start"
        cues.append(cue)

    say = {primary: say_text}
    marks: list[tuple[int | None, str, int]] = []
    for tline, ttext in beat.pending:
        lang = langs[len(say)] if len(say) < len(langs) else None
        if lang is None:
            raise fail(tline, f"{bid} has more `>` lines than the "
                              f"{len(langs)} languages this chapter declares")
        clean, found = scan_braces(ttext, tline)
        say[lang] = clean
        for raw, word, nth in found:
            m = MARK.match(raw)
            if not m:
                raise fail(tline, f"a `>` line carries only anchor marks — "
                                  f"`{{^}}` — not cues. Found {{{raw}}}")
            marks.append((int(m.group(1)) if m.group(1) else None,
                          clean_word(word), max(1, nth)))

    for lang in langs:
        if lang not in say:
            problems.append(f"{path_line(path, lineno)}: {bid} has no '{lang}' "
                            f"sentence — write it on a `>` line underneath")

    # Which cues need a word in the second language, and where it is.
    #
    # A bare anchor applies to every language, which is right for a proper
    # noun and wrong otherwise — "syttisju" is "seventy-seven" over there, and
    # a cue anchored to a word the English sentence does not contain fires at
    # the start of the beat instead, which is easy to miss by ear. So: mark
    # the English word with `{^}` and the anchor compiles to a pair; write
    # `@same` and it compiles to one bare string, checked against both texts.
    word_cues = [c for c in cues if c.on.startswith("word:") and not c.same]
    unnumbered = [m for m in marks if m[0] is None]
    numbered = {m[0]: m for m in marks if m[0] is not None}
    if marks and len(marks) != len(word_cues):
        problems.append(
            f"{path_line(path, lineno)}: {bid} pins {len(word_cues)} cue(s) to "
            f"words but the translation carries {len(marks)} mark(s). Mark the "
            f"matching word in every one with {{^}}, or write @same on the cues "
            f"whose word is the same in both languages.")
    cursor = 0
    for i, cue in enumerate(word_cues, 1):
        if i in numbered:
            cue.pair = numbered[i][1:]
        elif cursor < len(unnumbered):
            cue.pair = unnumbered[cursor][1:]
            cursor += 1

    out = {"id": bid, "say": say, "cues": [emit_cue(c, langs) for c in cues]}
    if gap != "none":
        out["gapAfter"] = (gap if gap is not None
                           else TURN if last else BREATH if beat.breath else AIR)
    return out


def emit_cue(cue: Cue, langs: list[str]) -> dict:
    on = cue.on
    pair = getattr(cue, "pair", None)
    if on.startswith("word:") and pair and pair[0]:
        other = f"word:{pair[0]}" + (f"#{pair[1]}" if pair[1] > 1 else "")
        on = {langs[0]: on, langs[1]: other}
    node = {"on": on, "do": cue.verb}
    for name in (VERB_SPEC[cue.verb].get("args") or {}):
        if name in cue.args:
            node[name] = cue.args[name]
    return node


# ---------------------------------------------------------------------------
# Data sections
# ---------------------------------------------------------------------------

def split_attrs(toks: list[str], langs: list[str]):
    """`k=v` runs, then whatever is left over as free text."""
    # One token per value here, unlike a cue: a place line ends in a free-text
    # name, and `kind=city Torino | Turin` has to mean a kind and a name
    # rather than a kind three words long. Quote a value that has a space in
    # it — `label="Sicilias sørspiss | The southern tip of Sicily"`.
    attrs: dict = {}
    rest: list[str] = []
    for tok in toks:
        m = ATTR.match(tok)
        if m:
            attrs[m.group(1)] = dequote(m.group(2))
        else:
            rest.append(dequote(tok))
    return {k: loose(v, langs) for k, v in attrs.items()}, " ".join(rest)


def parse_places(rows, langs) -> dict:
    out = {}
    for lineno, text in rows:
        toks = split_tokens(text.strip())
        if len(toks) < 3:
            raise fail(lineno, "a place is `id  lat, lon  [k=v]  [Navn | Name]`")
        pid = toks[0]
        try:
            lat = as_number(toks[1].rstrip(","))
            lon = as_number(toks[2].rstrip(","))
        except ValueError:
            raise fail(lineno, f"place '{pid}': the two numbers after the id "
                               f"are latitude and longitude, got "
                               f"{toks[1]!r} {toks[2]!r}")
        attrs, name = split_attrs(toks[3:], langs)
        node = {"coords": [lat, lon]}
        if "zoom" in attrs:
            node["zoom"] = attrs.pop("zoom")
        if name:
            node["name"] = i18n(name, langs)
        node.update(attrs)
        out[pid] = node
    return out


def parse_routes(rows, langs) -> dict:
    out, current = {}, None
    for lineno, text in rows:
        indented = text[:1] in (" ", "\t")
        toks = split_tokens(text.strip())
        if indented and current:
            for tok in toks:
                pair = [as_number(p) for p in tok.split(",")]
                if len(pair) != 2:
                    raise fail(lineno, f"a coordinate is `lat,lon`, got {tok!r}")
                out[current].setdefault("coords", []).append(pair)
            continue
        rid = toks[0]
        attrs, label = split_attrs(toks[1:], langs)
        node = {}
        if "side" in attrs:
            node["side"] = attrs.pop("side")
        if label:
            node["label"] = i18n(label, langs)
        node.update(attrs)
        out[rid] = node
        current = rid
    return out


def parse_entries(rows, langs) -> dict:
    """`id [k=v]` at the margin, `key: value` indented under it."""
    out, current = {}, None
    for lineno, text in rows:
        if text[:1] in (" ", "\t"):
            if current is None:
                raise fail(lineno, "an indented line belongs to the entry above "
                                   "it, and there is none")
            if ":" not in text:
                raise fail(lineno, f"expected `key: value`, got {text.strip()!r}")
            k, _, v = text.strip().partition(":")
            k = k.strip()
            out[current][k] = (i18n(v.strip(), langs) if k in I18N_KEYS
                               else loose(v.strip(), langs))
            continue
        toks = split_tokens(text.strip())
        current = toks[0]
        attrs, _ = split_attrs(toks[1:], langs)
        out[current] = attrs
    return out


def parse_keyed(rows, langs) -> dict:
    """`key: value` lines, dotted keys nesting."""
    out: dict = {}
    for lineno, text in rows:
        if ":" not in text:
            raise fail(lineno, f"expected `key: value`, got {text.strip()!r}")
        k, _, v = text.strip().partition(":")
        node, parts = out, k.strip().split(".")
        for seg in parts[:-1]:
            node = node.setdefault(seg, {})
        leaf = parts[-1]
        node[leaf] = (i18n(v.strip(), langs) if leaf in I18N_KEYS
                      else v.strip())
    return out


# ---------------------------------------------------------------------------
# Refusing before, rather than reporting after
# ---------------------------------------------------------------------------

def validate(chapter, pack, surfaces, langs, path) -> list[str]:
    """Everything check-script.py would find, found at compile time instead.

    The pools, the reference types and the word normalisation are
    tools/scriptlib.py's — the same ones the checkers use, so a name that
    passes here cannot fail there for a different reason.
    """
    found = []

    pools, pool_problems = resolve_pools(pack, chapter)
    found += pool_problems
    entries = entry_pools(pack)
    # Did the thing exist yet? Three cannon, a musket and a church bell went
    # off in 44 BC and every one of them validated clean, because nothing ever
    # asked when gunpowder was invented. The year spans are scriptlib's.
    era, years = pack_era(pack), sound_years(pack)

    for scene in chapter["scenes"]:
        for beat in scene["beats"]:
            bid = beat["id"]
            for cue in beat["cues"]:
                verb = cue["do"]
                spec = VERB_SPEC[verb]
                needs = spec.get("surface")
                if needs and needs not in surfaces:
                    found.append(
                        f"{bid}: {verb} is answered by the '{needs}' surface, "
                        f"which content/{pack}/pack.json does not declare "
                        f"(surfaces: {', '.join(surfaces)})")
                for arg, adef in (spec.get("args") or {}).items():
                    atype = adef.get("type", "")
                    base = atype[:-2] if atype.endswith("[]") else atype
                    if base not in REF_TYPES or arg not in cue:
                        continue
                    pool, what = pools[base]
                    wanted = cue[arg] if atype.endswith("[]") else [cue[arg]]
                    for ref in wanted:
                        if ref not in pool:
                            near = [p for p in sorted(pool)
                                    if norm(p)[:4] == norm(str(ref))[:4]][:3]
                            article = "an" if what[0] in "aeiou" else "a"
                            found.append(
                                f"{bid}: {verb} names {article} {what} '{ref}' "
                                f"that is not in {where_pool(base, pack, chapter)}"
                                + (f" — nearest: {', '.join(near)}" if near else ""))
                if verb.startswith("sound.") and era:
                    span = years.get(cue.get("id"))
                    if span and (era[1] < span[0] or era[0] > span[1]):
                        found.append(
                            f"{bid}: {verb} '{cue['id']}' belongs to "
                            f"{span[0]}…{span[1]} and this pack's era is "
                            f"{era[0]}…{era[1]} — it did not exist yet, or "
                            f"not any more")
                if verb in ("term.mark", "fact.show", "chart.show"):
                    found += check_entry_refs(bid, cue, pack, entries)
                found += check_anchor(bid, cue, beat, langs)
    return found


def entry_pools(pack: str) -> dict:
    """{kind: {id: entry}} for every entry kind the pack declares.

    `fact.show` and `chart.show` resolve `<kind>:<id>` against these — `wine`,
    `grape`, whatever a subject turns out to need — and the manifest's
    reference types cannot express a kind-plus-id, so neither can the generic
    check above.

    Imported from tools/check-script.py rather than written again: that is
    where the function already lives, and a second copy of "where does a
    pack's entry pool come from" is the engine/verbs.json mistake in another
    costume. It belongs in tools/scriptlib.py beside resolve_pools(), and the
    day it moves there this import turns into a plain one.
    """
    import importlib.util
    path = os.path.join(ROOT, "tools", "check-script.py")
    spec = importlib.util.spec_from_file_location("check_script", path)
    if not spec or not spec.loader:
        return {}
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.entry_pools(pack)


def check_entry_refs(bid, cue, pack, entries) -> list[str]:
    """`kind:id` — the reference the manifest's types cannot describe.

    Three verbs use it and all three fail the same way when it is wrong:
    nothing at all happens. A marked word opens no card, a fact box shows no
    definition, a chart draws no bars, and the cue reads correct in the file.
    """
    found = []
    refs = []
    if cue["do"] == "chart.show":
        refs = [(a, str(cue[a]).split(":", 1)) for a in ("ref", "against")
                if cue.get(a)]
        refs = [(a, p[0], p[1] if len(p) > 1 else "") for a, p in refs]
    else:
        refs = [("id", cue.get("kind"), cue.get("id"))]
    for arg, kind, eid in refs:
        if not kind or not eid:
            found.append(f"{bid}: {cue['do']} '{arg}' is written "
                         f"`kind:id` — a pool, then an entry in it")
            continue
        pool = entries.get(kind)
        if pool is None:
            found.append(
                f"{bid}: {cue['do']} names the pool '{kind}', which "
                f"content/{pack}/pack.json does not declare "
                f"(it has: {', '.join(sorted(entries)) or 'none'})")
        elif eid not in pool:
            near = [p for p in sorted(pool) if norm(p)[:4] == norm(eid)[:4]][:3]
            found.append(
                f"{bid}: {cue['do']} points at {kind} '{eid}', which is not in "
                f"that pool — nothing would open, and nothing would say so"
                + (f". Nearest: {', '.join(near)}" if near else ""))
    return found


def where_pool(base: str, pack: str, chapter: dict) -> str:
    """Where the author has to go to fix it."""
    if base == "region":
        # Not a section: region names come from the GeoJSON the chapter
        # declares, and a typo there draws nothing with a 200 in the network
        # panel.
        return f"content/{pack}/{chapter.get('regions')}"
    if base == "sound":
        return "sound/library.js or content/{}/sound.json".format(pack)
    target = REF_TYPES.get(base, base)
    if target.startswith("chapter."):
        return f"the `# {target.split('.')[1]}` section of this file"
    return f"content/{pack}/{target.split('.')[1]}.json"


def check_anchor(bid, cue, beat, langs) -> list[str]:
    """The one that breaks silently: a word that is not in the sentence.

    The player falls back to the start of the beat, so the visual fires early
    and nothing anywhere says so. README: a bare string anchors every
    language, which is right for a proper noun and wrong otherwise.
    """
    found = []
    on = cue.get("on", "start")
    for lang in langs:
        spec = on.get(lang) if isinstance(on, dict) else on
        if spec is None:
            found.append(f"{bid}: the cue has no '{lang}' anchor")
            continue
        if not spec.startswith("word:"):
            if spec not in ("start", "end") and not re.fullmatch(
                    r"(t|pct):[\d.]+", spec):
                found.append(f"{bid}: '{spec}' is not an anchor. Write @start, "
                             f"@end, @t:2.5, @pct:0.5, or put the cue after "
                             f"the word it belongs to")
            continue
        wanted, _, nth = spec[5:].partition("#")
        want = int(nth) if nth.isdigit() else 1
        text = (beat.get("say") or {}).get(lang, "")
        hits = [w for w in tokens(text) if norm(w) == norm(wanted)]
        if len(hits) < want:
            found.append(
                f"{bid}: the {lang} sentence does not say '{wanted}'"
                + (f" {want} times" if want > 1 else "")
                + f" — {text[:70]!r}. The visual would fire at the start of "
                  f"the beat instead. Put the cue after the right word, or "
                  f"mark the {lang} word with {{^}}.")
    return found


# ---------------------------------------------------------------------------
# The other direction: chapter JSON -> script.md
# ---------------------------------------------------------------------------

def decompile(chapter: dict, langs: list[str] | None = None) -> str:
    langs = langs or sorted({l for s in chapter["scenes"] for b in s["beats"]
                             for l in (b.get("say") or {})},
                            key=lambda l: 0 if l == "no" else 1)
    primary = langs[0]
    out = ["---"]
    for field in FIELD_ORDER:
        if field in ("places", "routes", "quotes", "ending", "scenes"):
            continue
        if field not in chapter:
            continue
        value = chapter[field]
        if isinstance(value, dict) and field in I18N_KEYS:
            out.append(f"{field}: " + pair_text(value, langs))
        elif isinstance(value, dict):
            for k, v in value.items():
                out.append(f"{field}.{k}: {v}")
        else:
            out.append(f"{field}: {value}")
    if langs != DEFAULT_LANGS:
        out.append("langs: " + ", ".join(langs))
    out.append("---")

    known_place = {"coords", "zoom", "name"}
    if chapter.get("places"):
        if any(set(p) - known_place - {"kind", "label"} for p in chapter["places"].values()):
            out += ["", f"# json places", json.dumps(chapter["places"],
                                                     ensure_ascii=False, indent=1)]
        else:
            out += ["", "# places"]
            for pid, place in chapter["places"].items():
                row = [pid, f"{place['coords'][0]}, {place['coords'][1]}"]
                if "zoom" in place:
                    row.append(f"zoom={place['zoom']}")
                for k, v in place.items():
                    if k in known_place:
                        continue
                    row.append(f"{k}={attr_text(v, langs)}")
                if "name" in place:
                    row.append(pair_text(place["name"], langs))
                out.append("  ".join(row))

    if chapter.get("routes"):
        if any(not isinstance(r, dict) for r in chapter["routes"].values()) or \
                any(k.startswith("//") for k in chapter["routes"]):
            out += ["", "# json routes", json.dumps(chapter["routes"],
                                                    ensure_ascii=False, indent=1)]
        else:
            out += ["", "# routes"]
            for rid, route in chapter["routes"].items():
                row = [rid]
                for k, v in route.items():
                    if k in ("coords", "label"):
                        continue
                    row.append(f"{k}={attr_text(v, langs)}")
                if "label" in route:
                    row.append(pair_text(route["label"], langs))
                out.append("  ".join(row))
                coords = route.get("coords") or []
                for i in range(0, len(coords), 4):
                    out.append("    " + "  ".join(
                        f"{c[0]},{c[1]}" for c in coords[i:i + 4]))

    if chapter.get("quotes"):
        out += ["", "# quotes"]
        for qid, quote in chapter["quotes"].items():
            row = [qid]
            for k, v in quote.items():
                if isinstance(v, dict):
                    continue
                row.append(f"{k}={v}")
            out.append("  ".join(row))
            for k, v in quote.items():
                if isinstance(v, dict):
                    out.append(f"    {k}: " + pair_text(v, langs))

    if chapter.get("ending"):
        out += ["", "# ending"]
        for k, v in flatten(chapter["ending"]).items():
            leaf = k.split(".")[-1]
            out.append(f"{k}: " + (pair_text(v, langs)
                                   if isinstance(v, dict) and leaf in I18N_KEYS
                                   else str(v)))

    for scene in chapter["scenes"]:
        out += ["", "## " + pair_text(scene.get("title") or {}, langs)]
        if scene.get("clock"):
            out.append("clock: " + pair_text(scene["clock"], langs))
        if scene.get("bed"):
            out.append("bed: " + str(scene["bed"]))
        out.append("")
        beats = scene["beats"]
        if scene.get("bed") and scene["bed"] != "none" and beats:
            # The cue in the first beat was GENERATED from `bed:` at compile
            # time, so writing it back out as `{music …}` too would say the
            # same thing twice and fail the round-trip on the next --check.
            first = dict(beats[0])
            first["cues"] = [c for c in first.get("cues", [])
                             if not (c["do"] == "sound.music"
                                     and c.get("id") == scene["bed"])]
            beats = [first] + list(beats[1:])
        n = len(beats)
        for i, beat in enumerate(beats):
            out += decompile_beat(beat, langs, last=i == n - 1)
            gap = beat.get("gapAfter")
            if gap == BREATH and i < n - 1:
                out.append("")
    return "\n".join(out) + "\n"


def flatten(node, prefix="") -> dict:
    out = {}
    for k, v in node.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict) and k not in I18N_KEYS:
            out.update(flatten(v, key + "."))
        else:
            out[key] = v
    return out


def decompile_beat(beat, langs, last) -> list[str]:
    """Put every cue back where the author would have written it.

    A cue goes immediately after its own word wherever that keeps the array in
    the order the file has it — that is the natural form and the one the
    format exists for. Where the words run in a different order from the cues
    (a sentence that names the bottle before the number, with the cue for the
    number first), the anchor is written out as `@word:` instead, because the
    order cues are WRITTEN in is the order they are stored in, and a
    round-trip that quietly re-orders them has not round-tripped.
    """
    primary, second = langs[0], langs[1] if len(langs) > 1 else None
    text = (beat.get("say") or {}).get(primary, "")
    words = tokens(text)

    plan = []            # (word index to sit after, text); -1 is before the
    marks = []           # first word, TAIL is after the last one
    TAIL = len(words)
    cursor = -1
    tail = False         # once a cue has been pushed to the end of the line,
    for cue in beat.get("cues", []):     # every later one must follow it there
        on = cue.get("on", "start")      # or the array order would change
        prim = on.get(primary) if isinstance(on, dict) else on
        body = write_cue(cue, langs)
        if isinstance(prim, str) and prim.startswith("word:"):
            wanted, _, nth = prim[5:].partition("#")
            want = int(nth) if nth.isdigit() else 1
            at, seen = None, 0
            for i, w in enumerate(words):
                if norm(w) == norm(wanted):
                    seen += 1
                    if seen == want:
                        at = i
                        break
            # `word:nebbia` against the token "Nebbia," is the same anchor —
            # the engine matches with norm() — but writing the cue inline
            # would compile the token's own spelling, so those go out long.
            exact = (at is not None and clean_word(words[at]) == wanted
                     and "#" not in prim[5:])
            bare = not isinstance(on, dict)
            same = " @same" if bare else ""
            if tail or at is None or at < cursor or not exact:
                tail = True
                plan.append((TAIL, f"{{{body} @word:{prim[5:]}{same}}}"))
            else:
                plan.append((at, f"{{{body}{same}}}"))
                cursor = at
            if not bare and second:
                other = on.get(second, "")
                marks.append(other[5:] if other.startswith("word:") else None)
            # A bare anchor needs no mark: it is one string for every
            # language, which is what @same says in the source.
        elif tail or cursor >= 0:
            tail = True
            plan.append((TAIL, f"{{{body} @{prim}}}"))
        else:
            plan.append((-1, f"{{{body}}}" if prim == "start"
                             else f"{{{body} @{prim}}}"))

    # `gapAfter` is generated from where the beat sits, so it is only written
    # out when the file disagrees with that — a hand-tuned number, or a beat
    # that carries none at all, which is not the same as carrying 0.9.
    if "gapAfter" not in beat:
        plan.append((len(words), "{gap none}"))
    else:
        gap = beat["gapAfter"]
        wanted = (TURN,) if last else (AIR, BREATH)
        if gap not in wanted:
            plan.append((len(words), f"{{gap {gap}}}"))

    lines = [assemble(words, plan)]
    if second:
        lines.append("> " + assemble_marks(
            tokens((beat.get("say") or {}).get(second, "")), marks))
    return lines


def assemble(words, plan) -> str:
    """Sentence with the cues dropped back in after their words."""
    after: dict[int, list[str]] = {}
    lead = []
    for at, text in plan:
        if at < 0:
            lead.append(text)
        else:
            after.setdefault(at, []).append(text)
    out = list(lead)
    for i, word in enumerate(words):
        out.append(word)
        out += after.get(i, [])
    out += after.get(len(words), [])
    return " ".join(out)


def assemble_marks(words, marks) -> str:
    """The translation, with `{^}` after each anchored word.

    Numbered when the two languages put the words in a different order —
    English says the bottle before the number where Norwegian says the number
    first, and an unnumbered mark would then pair with the wrong cue.
    """
    spots = []
    for i, wanted in enumerate(marks, 1):
        if wanted in (None, "@same"):
            spots.append((None, i, wanted))
            continue
        target, _, nth = wanted.partition("#")
        want = int(nth) if nth.isdigit() else 1
        at, seen = None, 0
        for j, w in enumerate(words):
            if norm(w) == norm(target):
                seen += 1
                if seen == want:
                    at = j
                    break
        spots.append((at, i, wanted))
    ordered = [s for s in spots if s[0] is not None]
    monotonic = all(a[0] < b[0] for a, b in zip(ordered, ordered[1:]))
    after: dict[int, list[str]] = {}
    for at, i, wanted in spots:
        if at is None:
            continue
        after.setdefault(at, []).append("{^}" if monotonic else f"{{^{i}}}")
    out = []
    for j, word in enumerate(words):
        out.append(word)
        out += after.get(j, [])
    return " ".join(out)


def write_cue(cue, langs) -> str:
    """One cue, back in the short form."""
    verb = cue["do"]
    short = min((a for a, v in ALIAS.items() if v == verb), key=len)
    spec = VERB_SPEC[verb]
    args = spec.get("args") or {}
    kind, slot = SLOT.get(verb, ("none", None))
    parts = [short]
    written = set()
    if kind == "kind:id" and "kind" in cue and "id" in cue:
        parts.append(f"{cue['kind']}:{cue['id']}")
        written |= {"kind", "id"}
    elif kind == "plain" and slot in cue and args[slot].get("type") != "part[]":
        parts.append(write_value(cue[slot], args[slot], langs, quoted=False))
        written.add(slot)
    for name, adef in args.items():
        if name in written or name not in cue:
            continue
        atype = adef.get("type", "")
        if atype == "part[]":
            for p in cue[name]:
                parts.append("part=" + write_part(p, langs))
            continue
        parts.append(f"{name}=" + write_value(cue[name], adef, langs))
    return " ".join(parts)


def write_value(value, adef, langs, quoted=True) -> str:
    atype = adef.get("type", "")
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict) and atype == "i18n":
        return pair_text(value, langs)
    if isinstance(value, list):
        if atype == "number[]":
            return json.dumps(value)
        return ",".join(str(v) for v in value)
    text = str(value)
    if quoted and (" " in text or "=" in text):
        return f'"{text}"'
    return text


def write_part(p, langs) -> str:
    bits = [str(p.get("n")), quote_if(str(p.get("value", "")))]
    if p.get("side"):
        bits.append(p["side"])
    elif p.get("tone"):
        bits.append(p["tone"])
    if isinstance(p.get("label"), dict):
        bits.append(pair_text(p["label"], langs))
    return " ".join(bits)


def quote_if(text: str) -> str:
    return f'"{text}"' if " " in text or "=" in text else text


def pair_text(value: dict, langs) -> str:
    """`norsk | English`, or one word when both languages say the same.

    A label that reads `Barolo | Barolo` is noise, and the compiler expands a
    single value across every language anyway — so the two forms are the same
    file and one of them is readable.
    """
    said = [str(value.get(l, "")) for l in langs]
    return said[0] if len(set(said)) == 1 else " | ".join(said)


def attr_text(value, langs) -> str:
    """One `k=v` in a data section. Quoted when it has a space in it."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict):
        return quote_if(pair_text(value, langs))
    return quote_if(str(value))


# ---------------------------------------------------------------------------
# The bench
# ---------------------------------------------------------------------------

def same(a, b, path="") -> list[str]:
    """Deep comparison that ignores key order and formatting, and nothing else.

    One normalisation, and it is a statement about the engine rather than a
    convenience: a word anchor is matched with scriptlib.norm(), so
    `word:Nebbia` and `word:nebbia` are the same anchor and the chapter file
    simply happens to be inconsistent about which it wrote.
    """
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a) | set(b)):
            if key not in a:
                out.append(f"{path}.{key}: only in the compiled chapter ({b[key]!r})")
            elif key not in b:
                out.append(f"{path}.{key}: lost — was {a[key]!r}")
            else:
                out += same(a[key], b[key], f"{path}.{key}")
        return out
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            out.append(f"{path}: {len(a)} items became {len(b)}")
            return out
        for i, (x, y) in enumerate(zip(a, b)):
            out += same(x, y, f"{path}[{i}]")
        return out
    if isinstance(a, str) and isinstance(b, str) and a.startswith("word:") \
            and b.startswith("word:"):
        if norm(a) == norm(b):
            return out
    if a != b:
        out.append(f"{path}: {a!r} -> {b!r}")
    return out


def lab(verbose=False) -> int:
    """Does every chapter that ships survive being written in this format?

    The falsifiable question, and the only one that matters: decompile the
    chapter JSON, compile the result back, and compare. A difference is the
    format missing something the app needs, and the difference names it.
    """
    import tempfile
    rows, bad, renumbered = [], 0, 0
    for path in sorted(glob.glob(os.path.join(CONTENT, "*", "chapter-*.json"))):
        rel = os.path.relpath(path, CONTENT).replace(os.sep, "/")[:-5]
        original = load_json(path)
        try:
            source = decompile(original)
            with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False,
                                             encoding="utf-8") as fh:
                fh.write(source)
                tmp = fh.name
            built, problems = compile_script(tmp)
            os.unlink(tmp)
            diffs = same(original, built, "chapter")
        except SourceError as err:
            diffs, problems, source = [f"did not compile: {err}"], [], ""

        # A beat id is GENERATED — s<scene>.b<n>, in order — so a chapter that
        # was hand-edited to squeeze in an `s2.b6b` comes back renumbered. That
        # is the tool doing its job, not the format losing something, and it is
        # reported separately so the bench stays a bench. It is not free: the
        # timing file keys its beats by id, so a renumbered chapter has to go
        # back through tools/narrate.py, which re-uses its cache and only
        # rebuilds the scene audio.
        ids = [d for d in diffs if re.search(r"\.id: 's\d+\.b[^']*' -> 's\d+\.b", d)]
        real = [d for d in diffs if d not in ids]
        lines = len(source.splitlines())
        rows.append((rel, lines, len(real), len(ids)))
        if real:
            bad += 1
            print(f"FAIL {rel}")
            for d in real[:12]:
                print(f"       {d}")
            if len(real) > 12:
                print(f"       ... and {len(real) - 12} more")
        elif ids:
            renumbered += 1
            print(f"ok   {rel}  ({len(ids)} beat ids renumbered — "
                  f"{', '.join(re.findall(chr(39) + r'(s\d+\.b\w+)' + chr(39), ' '.join(ids))[:6])}"
                  f" … re-run tools/narrate.py after writing this one)")
        elif verbose:
            print(f"ok   {rel}")

    print(f"\n{'chapter':<40} {'source':>7} {'json':>7} {'diffs':>6} {'ids':>5}")
    total_src = total_json = 0
    for rel, lines, diffs, ids in rows:
        json_lines = len(json.dumps(load_json(
            os.path.join(CONTENT, rel + ".json")), indent=1,
            ensure_ascii=False).splitlines())
        total_src += lines
        total_json += json_lines
        print(f"{rel:<40} {lines:>7} {json_lines:>7} {diffs:>6} {ids:>5}")
    print(f"{'':<40} {total_src:>7} {total_json:>7}   "
          f"{total_src / max(1, total_json):.0%} of the JSON")
    print(f"\n{len(rows)} chapters, {bad} that do not round-trip"
          + (f", {renumbered} that differ only in generated beat ids." if renumbered
             else "."))
    return 1 if bad else 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def dump(chapter: dict) -> str:
    return json.dumps(chapter, ensure_ascii=False, indent=1) + "\n"


def scaffold(ref: str) -> int:
    """A first script.<chapter>.md, from what the course has already decided.

    CLAUDE.md says the next real test of this framework is somebody writing
    chapter two of the wine course in this format WITHOUT HELP, and that where
    it sticks is the next job. The first place it sticks is the blank file: the
    front matter, the section names and the two-language grammar are all in
    docs/authoring.md, and copying them out of a document is not writing.

    So this fills in what is already known — the id, the pack, the title and
    subtitle from outline.md, the regions file the pack declares — and, at the
    top where the writer will see it every time they open the file, what the
    OUTLINE says this chapter is FOR. That line is the whole reason the outline
    exists, and it is worth nothing in a file nobody has open.
    """
    pack, _, cid = ref.partition("/")
    if not pack or not cid:
        print("usage: author.py --new <pack>/<chapter-id>", file=sys.stderr)
        return 2
    dest = os.path.join(CONTENT, pack, f"script.{cid}.md")
    if os.path.exists(dest):
        print(f"{os.path.relpath(dest, ROOT)} already exists", file=sys.stderr)
        return 2

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    entry, langs, purpose = {}, list(DEFAULT_LANGS), None
    try:
        import outline as outline_tool
        plan = outline_tool.parse_outline(os.path.join(CONTENT, pack, "outline.md"))
        langs = plan["langs"]
        for ch in plan["chapters"]:
            if ch["id"] == cid:
                entry = ch
        purpose = (entry.get("for") or {}).get(langs[0])
    except (FileNotFoundError, outline_tool.SourceError):
        pass

    manifest = load_json(os.path.join(CONTENT, pack, "pack.json")) or {}
    regions = ((manifest.get("map") or {}).get("regions")
               or (manifest.get("pools") or {}).get("areas") or "")
    pair = lambda field: " | ".join(
        (entry.get(field) or {}).get(l, "TODO") for l in langs)

    # Forward slashes in the commands whatever the platform: they are meant to
    # be typed, and a Windows path in a doc line is a paper cut.
    shown = os.path.relpath(dest, ROOT).replace(os.sep, "/")
    out = [f"// {cid}, written as prose. The chapter JSON is compiled from this",
           "// file and is what the engine loads; --check tells you whether the",
           "// two still say the same thing.",
           "//",
           f"//     python tools/author.py {shown} --check",
           f"//     python tools/author.py {shown} --write",
           f"//     python tools/narrate.py --chapter {pack}/{cid} --lang {langs[0]}",
           "//",
           "// docs/authoring.md writes one from nothing, start to finish, and",
           "// `python tools/author.py --verbs` lists every cue and what it takes."]
    if purpose:
        out += ["//",
                "// WHAT THIS CHAPTER IS FOR, from outline.md — if what you are",
                "// writing stops answering this, the outline is the thing to",
                "// change, not this comment:",
                "//"]
        out += [f"//   {line}" for line in wrap_for_comment(purpose)]
    out += ["", "---",
            f"id: {cid}",
            f"pack: {pack}",
            f"title: {pair('title')}",
            f"subtitle: {pair('subtitle')}"]
    if regions:
        out.append(f"regions: {regions}")
    out += ["---", "",
            "# places",
            "// id  lat, lon  [zoom=  kind=]  Navn | Name — the camera needs",
            "// these; a place a cue never names does not have to be here.",
            "",
            "# ending",
            "say: TODO | TODO",
            "figure.value: 0",
            "figure.label: TODO | TODO",
            "",
            "## Scenetittel | Scene title",
            "",
            "Første setning. En setning er ett beat.",
            "> First sentence. One sentence is one beat.",
            "Neste setning, og et blankt linjeskift under er en lengre pause.",
            "> Next sentence, and a blank line below is a longer pause.",
            ""]
    with open(dest, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(out))
    print(f"wrote {shown}")
    if not entry:
        print(f"  ({cid} is not in content/{pack}/outline.md — add it there "
              f"first and the title, subtitle and purpose come with it)")
    return 0


def wrap_for_comment(text: str, width: int = 68):
    words, line, out = text.split(), "", []
    for w in words:
        if len(line) + len(w) + 1 > width:
            out.append(line)
            line = w
        else:
            line = f"{line} {w}".strip()
    if line:
        out.append(line)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", nargs="?", help="a chapter written as prose, e.g. "
                                              "content/italy-wine/script.md")
    ap.add_argument("--write", action="store_true",
                    help="write the chapter JSON (otherwise nothing is touched)")
    ap.add_argument("-o", "--out", help="write it somewhere else")
    ap.add_argument("--check", action="store_true",
                    help="compile, validate, and diff against the chapter on disk")
    ap.add_argument("--from-json", metavar="PACK/CHAPTER",
                    help="the other direction: an existing chapter as prose")
    ap.add_argument("--lab", action="store_true",
                    help="round-trip every chapter in content/ and report")
    ap.add_argument("--new", metavar="PACK/CHAPTER",
                    help="a first script.<chapter>.md, filled in from outline.md")
    ap.add_argument("--verbs", action="store_true",
                    help="the cue vocabulary, as engine/verbs.json declares it")
    args = ap.parse_args()

    if args.new:
        return scaffold(args.new)
    if args.verbs:
        print(verbs_report())
        return 0
    if args.lab:
        return lab()
    if args.from_json:
        pack, _, cid = args.from_json.partition("/")
        path = os.path.join(CONTENT, pack, cid + ".json")
        chapter = load_json(path)
        if chapter is None:
            print(f"error: no chapter at {path}", file=sys.stderr)
            return 2
        source = decompile(chapter)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as fh:
                fh.write(source)
            print(f"wrote {args.out}  ({len(source.splitlines())} lines, "
                  f"from {len(dump(chapter).splitlines())} of JSON)")
        else:
            sys.stdout.write(source)
        return 0
    if not args.source:
        ap.print_help()
        return 2

    # An outline is prose too, and it compiles to pack.json the way a script
    # compiles to a chapter. It is a big enough job to live in its own file,
    # but the person who types this one should not have to know that.
    if os.path.basename(args.source) == "outline.md":
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import outline as outline_tool
        pack = os.path.basename(os.path.dirname(os.path.abspath(args.source)))
        return outline_tool.main([pack] + (["--write"] if args.write else []))

    if not os.path.exists(args.source):
        print(f"error: no script at {args.source}", file=sys.stderr)
        return 2
    try:
        chapter, problems = compile_script(args.source)
    except SourceError as err:
        print(f"{os.path.basename(args.source)}:{err}", file=sys.stderr)
        return 1

    scenes = len(chapter["scenes"])
    beats = sum(len(s["beats"]) for s in chapter["scenes"])
    cues = sum(len(b["cues"]) for s in chapter["scenes"] for b in s["beats"])
    pinned = sum(1 for s in chapter["scenes"] for b in s["beats"]
                 for c in b["cues"] if str(c.get("on")).startswith("word:")
                 or isinstance(c.get("on"), dict))
    with open(args.source, encoding="utf-8") as fh:
        n_source = len(fh.read().splitlines())
    print(f"{args.source}: {n_source} lines -> {scenes} scenes, {beats} beats, "
          f"{cues} cues ({pinned} pinned to words), "
          f"{len(dump(chapter).splitlines())} lines of JSON")

    target = args.out or os.path.join(CONTENT, chapter["pack"],
                                      chapter["id"] + ".json")
    existing = load_json(target)
    drifted = False
    if existing is not None:
        diffs = same(existing, chapter, "chapter")
        if diffs:
            drifted = True
            print(f"\n{len(diffs)} difference(s) against {os.path.relpath(target, ROOT)}:")
            for d in diffs[:40]:
                print(f"  {d}")
            if len(diffs) > 40:
                print(f"  ... and {len(diffs) - 40} more")
        else:
            print(f"identical to {os.path.relpath(target, ROOT)}")

    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1

    if args.write:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(dump(chapter))
        print(f"\nwrote {os.path.relpath(target, ROOT)}")
        print(f"now: python tools/check-script.py "
              f"{chapter['pack']}/{chapter['id']}")
    else:
        print("\nnothing written — pass --write to update the chapter JSON.")

    # --check FAILS on a difference, and that is the whole point of it. The
    # prose is the source; the chapter JSON is what it compiles to. Six edits
    # had already been made straight to the JSON — five `label: false` on
    # region.show and one place name — and none of them was in script.md, so
    # the next --write would silently have put the map labels back. Nothing
    # reported it: --lab round-trips the JSON through itself, which passes
    # happily while the hand-written source says something else entirely.
    if args.check and not args.write and drifted:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
