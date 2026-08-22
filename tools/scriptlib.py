#!/usr/bin/env python3
"""
scriptlib.py — reading a chapter the way the engine reads it.

Four tools need to answer the same questions: where does this pack live, what
languages does this chapter have, what does the cue vocabulary declare, and —
the awkward one — at what second does this cue actually fire? That last answer
is thirty lines of anchor grammar that has to agree exactly with `resolve()` in
engine/script.js, and a second copy of it is the engine/verbs.json mistake
waiting to happen again: two implementations, one of them quietly wrong, and a
chapter that validates clean and then does the wrong thing in the browser.

So it lives here once, and check-script.py, check-timing.py, narrate.py and
shoot.py import it.

Nothing in here reports. Functions that can find a problem return it as a list
of strings and let the caller decide whether it fails a build.
"""
from __future__ import annotations

import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# The cue vocabulary comes from engine/verbs.json, which engine/stage.js also
# reads. It used to be copied by hand into the checker, so adding a verb to one
# and not the other meant a chapter validated clean and then silently did
# nothing in the browser.
MANIFEST_PATH = os.path.join(ROOT, "engine", "verbs.json")
SOUND_LIB = os.path.join(ROOT, "sound", "library.js")

try:
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        MANIFEST = json.load(fh)
except FileNotFoundError:
    raise SystemExit(f"missing {MANIFEST_PATH} — it is the source of truth for cue verbs")

VERB_SPEC = MANIFEST["verbs"]
VERBS = set(VERB_SPEC)
REF_TYPES = MANIFEST.get("refTypes", {})


# ------------------------------------------------------------------
# text
# ------------------------------------------------------------------

def norm(s: str) -> str:
    """Match the engine's normalisation: letters and digits only, lowercased.

    Norwegian æøå are letters and must survive, so this folds case but not
    accents — NFC, not NFKD. "Concord," and "concord" are the same word;
    "for" and "fôr" are not.
    """
    return "".join(
        c for c in unicodedata.normalize("NFC", str(s)).lower()
        if c.isalnum()
    )


def tokens(text: str) -> list[str]:
    """Whitespace-separated tokens — the same split captions.js renders."""
    return re.findall(r"[^\s]+", text or "")


# ------------------------------------------------------------------
# where things live
# ------------------------------------------------------------------

def pack_dir(pack: str) -> str:
    return os.path.join(CONTENT, pack)


def split_ref(rel: str) -> tuple[str, str]:
    """'american-revolution/chapter-1775-04-19' -> (pack, chapter id)."""
    parts = rel.strip("/").split("/")
    if len(parts) != 2:
        raise SystemExit(f"expected <pack>/<chapter>, got '{rel}'")
    return parts[0], parts[1]


def chapter_path(pack: str, chapter_id: str) -> str:
    return os.path.join(pack_dir(pack), chapter_id + ".json")


def load_json(path: str, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_chapter(rel: str) -> tuple[str, str, dict]:
    """(pack, chapter id, chapter) for a '<pack>/<chapter>' reference."""
    pack, cid = split_ref(rel)
    path = chapter_path(pack, cid)
    chapter = load_json(path)
    if chapter is None:
        raise SystemExit(f"error: no chapter at {path}")
    return pack, cid, chapter


def chapter_langs(chapter: dict) -> list[str]:
    """Every language any beat is written in, sorted."""
    return sorted({l for s in chapter["scenes"] for b in s["beats"]
                   for l in (b.get("say") or {})})


def timing_path(pack: str, chapter_id: str, lang: str) -> str:
    # Keyed by chapter as well as language: scene ids restart at s0 in every
    # chapter, so a per-pack timing file had the second chapter overwriting the
    # first scene for scene — silently, because the wrong file still parses and
    # still has an s0.
    return os.path.join(pack_dir(pack), f"timing.{chapter_id}.{lang}.json")


def load_timings(pack: str, chapter_id: str, langs) -> tuple[dict, list[str]]:
    """{lang: timing}, plus a note per language not yet narrated."""
    timings, notes = {}, []
    for lang in langs:
        tm = load_json(timing_path(pack, chapter_id, lang))
        if tm is None:
            notes.append(f"no timing.{chapter_id}.{lang}.json yet — "
                         f"run tools/narrate.py --lang {lang}")
        else:
            timings[lang] = tm
    return timings, notes


def timing_beat(timing: dict, scene_id: str, beat_id: str):
    """The recorded beat, or None if this beat was never narrated."""
    if not timing:
        return None
    scene = timing.get("scenes", {}).get(scene_id) or {}
    return next((b for b in scene.get("beats", []) if b["id"] == beat_id), None)


# ------------------------------------------------------------------
# the anchor grammar — must agree with resolve() in engine/script.js
# ------------------------------------------------------------------

def anchor_for(cue: dict, lang: str):
    """A cue's anchor for one language.

    A bare string anchors every language; a {no, en} pair lets them differ,
    which they must whenever the anchor is not a proper noun ("syttisju" vs
    "seventy-seven").
    """
    on = cue.get("on", "start")
    if isinstance(on, dict):
        return on.get(lang)
    return on


def cue_time(cue: dict, tb, lang: str):
    """When a cue actually fires, in scene seconds. None if unknowable.

    `tb` is the recorded beat from the timing file. Without one there are no
    word times, so a word anchor has no answer — and guessing would be worse
    than saying so.
    """
    if tb is None:
        return None
    start = tb.get("start", 0.0)
    on = anchor_for(cue, lang)
    if not isinstance(on, str):
        return None
    if on == "start":
        return start
    if on == "end":
        return start + tb.get("dur", 0.0)
    if on.startswith("t:"):
        return start + float(on[2:] or 0)
    if on.startswith("pct:"):
        return start + float(on[4:] or 0) * tb.get("dur", 0.0)
    if on.startswith("word:"):
        wanted, _, nth = on[5:].partition("#")
        want = int(nth) if nth.isdigit() else 1
        seen = 0
        for w in tb.get("words", []):
            if norm(w["w"]) == norm(wanted):
                seen += 1
                if seen == want:
                    return w["t"]
        return start
    return start


# ------------------------------------------------------------------
# reference pools
# ------------------------------------------------------------------

def builtin_effects() -> set[str]:
    """
    The effect names sound/library.js synthesises.

    A pack does not have to ship a single audio file — the default library
    builds every effect from an oscillator — so validating a `sound` reference
    against the pack's sound.json alone rejects every name that actually
    works. Read from the catalogue itself so the two cannot drift: adding an
    effect there is enough to be able to name it in a script.
    """
    try:
        with open(SOUND_LIB, encoding="utf-8") as fh:
            src = fh.read()
    except OSError:
        return set()
    start = src.find("const CATALOGUE = {")
    if start < 0:
        return set()
    end = src.find("export const EFFECTS", start)
    block = src[start:end if end > 0 else len(src)]
    return set(re.findall(r"^\s{2}(\w+):\s*\{\s*kind:", block, re.M))


def region_names(pack: str, chapter: dict) -> tuple[set[str], list[str]]:
    """The area names a script may name, from the GeoJSON the chapter declares.

    A typo in "Massachusetts" fails here rather than drawing nothing in the
    browser with a 200 in the network panel.
    """
    rel = chapter.get("regions")
    if not rel:
        return set(), []
    path = os.path.join(pack_dir(pack), rel)
    geo = load_json(path)
    if geo is None:
        return set(), [f"chapter declares regions '{rel}' but {path} does not exist"]
    names = {(f.get("properties") or {}).get("name") for f in geo.get("features", [])}
    names.discard(None)
    return names, []


def resolve_pools(pack: str, chapter: dict) -> tuple[dict, list[str]]:
    """
    What each reference type in the manifest points at, and what to call it
    when it is missing.

    Returns {type: (pool, noun)} plus any problems found while loading. Adding
    a verb with a `place` argument gets its integrity check for free, which is
    the point of the manifest.
    """
    pd = pack_dir(pack)
    people = {p["id"] for p in (load_json(os.path.join(pd, "people.json")) or [])}
    media = set(load_json(os.path.join(pd, "media.json")) or {})
    sounds = set(load_json(os.path.join(pd, "sound.json")) or {})
    regions, problems = region_names(pack, chapter)
    pools_decl = (load_json(os.path.join(pd, "pack.json")) or {}).get("pools", {})
    terms = set(load_json(os.path.join(pd, pools_decl.get("terms", "terms.json"))) or {})
    topics = set(load_json(os.path.join(pd, pools_decl.get("topics", "topics.json"))) or {})

    pools = {
        "place":  (set(chapter.get("places", {})), "place"),
        "route":  (set(chapter.get("routes", {})), "route"),
        "person": (people, "person"),
        "media":  (media, "image"),
        "quote":  (set(chapter.get("quotes", {})), "quote"),
        # The pack's recorded effects, plus everything the shipped library can
        # synthesise. A pack that records nothing still has a full palette.
        "sound":  (sounds | builtin_effects(), "sound"),
        "region": (regions, "region"),
        "term": (terms, "term"),
        "topic": (topics, "topic"),
    }
    return pools, problems


def check_sound_manifest(pack: str) -> tuple[list[str], int]:
    """content/<pack>/sound.json — one entry per recorded effect, or no file.

    Absent by design: the default library is synthetic and has nothing to
    attribute. Present means a file went in a build, and a file with no licence
    and no credit does not.
    """
    pd = pack_dir(pack)
    manifest = load_json(os.path.join(pd, "sound.json"))
    if manifest is None:
        return [], 0
    problems = []
    for name, entry in manifest.items():
        if not isinstance(entry, dict) or not entry.get("file"):
            problems.append(f"sound.json {name}: no 'file' — drop the entry "
                            f"and the synthesised effect is used")
            continue
        for field in ("licence", "credit"):
            if not entry.get(field):
                problems.append(f"sound.json {name}: no '{field}'")
        if not os.path.exists(os.path.join(pd, entry["file"])):
            problems.append(f"sound.json {name}: '{entry['file']}' is not on disk")
    return problems, len(manifest)
