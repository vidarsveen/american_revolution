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
import math
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
MAP_INDEX = os.path.join(ROOT, "map", "index.js")

try:
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        MANIFEST = json.load(fh)
except FileNotFoundError:
    raise SystemExit(f"missing {MANIFEST_PATH} — it is the source of truth for cue verbs")

VERB_SPEC = MANIFEST["verbs"]
VERBS = set(VERB_SPEC)
REF_TYPES = MANIFEST.get("refTypes", {})

# EVERY verb must say what it does to the screen. This is checked at import,
# so it is checked by every tool that reads a chapter, and adding a verb
# without a decision fails immediately rather than being silently absent from
# the occupancy model -- which is how tools/check-blank.py came to read four
# real hide-verbs as shows while inventing three verb names that do not exist.
# `null` is a legitimate decision: a camera move, a one-shot flash, a sound.
_undeclared = sorted(v for v, d in VERB_SPEC.items() if "occupies" not in d)
if _undeclared:
    raise SystemExit(
        "engine/verbs.json: no `occupies` decision for "
        + ", ".join(_undeclared)
        + " — say which channel it fills and how, or `null` if it draws "
          "nothing. See the //occupies note in that file.")


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
        try:
            return json.load(fh)
        except json.JSONDecodeError as e:
            # Name the file and the line. A course has a dozen JSON files and a
            # bare JSONDecodeError says which line of WHICH is anybody's guess.
            raise SystemExit(
                f"{os.path.relpath(path, ROOT)} is not valid JSON: "
                f"line {e.lineno} column {e.colno}, {e.msg}") from None


def pool_ids(path: str) -> set:
    """The ids in a pool file, whichever of the two shapes it is written in.

    Pools are objects keyed by id -- `{"chardonnay": {...}}` -- and that is
    what the app expects. But `people.json` is an array of objects with an
    `id` field, and a hand-written pool comes out as an array often enough
    that it is worth tolerating rather than crashing.

    It used to crash. `set(some_list_of_dicts)` dies with `unhashable type:
    'dict'`, which is a Python traceback ending in a line of scriptlib and
    names neither the course nor the file the author actually got wrong.
    """
    data = load_json(path)
    if data is None:
        return set()
    if isinstance(data, dict):
        return set(data)
    if isinstance(data, list):
        return {x.get("id") for x in data if isinstance(x, dict) and x.get("id")} \
            | {x for x in data if isinstance(x, str)}
    raise SystemExit(f"{os.path.relpath(path, ROOT)} should be an object keyed "
                     f"by id, and it is a {type(data).__name__}")


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
# the camera — must agree with map/index.js and engine/scenes/map.js
# ------------------------------------------------------------------
#
# THIS IS A SECOND IMPLEMENTATION OF A JAVASCRIPT FORMULA, and that is the
# same burden the anchor grammar above already carries: two implementations,
# one of them quietly wrong, and a chapter that validates clean and then does
# the wrong thing in the browser. It is here for a reason the anchor grammar
# does not have — a camera flight's duration is usually NOT AUTHORED. `over`
# is optional on map.flyTo, map.fitRoute and map.fitPlaces, and when it is
# absent the map works the duration out from how far the camera has to
# travel. So there is no number in the chapter to multiply out, and the
# defect the user actually sees — "zooming into a map it stops dead and we
# jump to the next chapter" — is invisible to reading.
#
# It is kept in step MECHANICALLY, not by discipline: flight_constants()
# below reads the numbers out of map/index.js and fails loudly if the
# expressions there no longer have the shape this file reimplements. Change
# autoOver() and this check tells you to come here, the way builtin_effects()
# reads the catalogue rather than copying it.
#
# What is NOT modelled, and why each is safe to leave out:
#   · `offset` on flyTo — no CUE passes one, but the surface now does: every
#     flyTo composes into the part of the map that is not caption, transport
#     or card, so the camera centre lands (pad.top - pad.bottom) / 2 px above
#     the target. Left out on purpose. Both ends of a flight are composed by
#     the same rule, so the offset cancels out of the distance except for the
#     part that scales with zoom — under a tenth of a second of `over` on the
#     flights that ship, against margins measured in seconds. If a flight ever
#     fails here by a hair, this is the first thing to model.
#   · prefers-reduced-motion — a flight becomes a cut, so it always fits.
#   · the exact stage size (below).

WORLD = 256                     # world pixels at zoom 0, as map/geo.js
MAX_LAT = 85.0511287798

# The phone, because the app is mobile first and a phone is the worst case:
# the smaller the viewport, the more screens wide a given move is, and
# `screens` is what autoOver() charges for. Measured, not guessed — the
# number is engine/scenes/map.js's own ("the map is 393x742 while the part
# you can actually see is more like 393x540"), which is a 393x852 viewport
# less the topbar and the transport.
#
# Precision here matters much less than it looks: the stage size enters
# autoOver() twice, as max(w, h) in `screens` and through the fit zoom in
# `dz`, and a 40 px error in either moves a computed `over` by under 0.06 s
# against margins measured in seconds.
STAGE_W, STAGE_H = 393.0, 742.0

# What the furniture covers at the bottom of that stage — the caption slot
# and the transport, the two framePadding() measures off the real elements.
# 742 - 540, from the same comment.
FURNITURE_BOTTOM = 202.0


def clampf(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def project(lon, lat):
    """[lon, lat] -> world pixels at zoom 0. map/geo.js project()."""
    x = (lon + 180.0) / 360.0 * WORLD
    phi = clampf(lat, -MAX_LAT, MAX_LAT) * math.pi / 180.0
    y = (1 - math.log(math.tan(phi) + 1 / math.cos(phi)) / math.pi) / 2 * WORLD
    return x, y


def unproject(x, y):
    lon = x / WORLD * 360.0 - 180.0
    n = math.pi - 2 * math.pi * y / WORLD
    lat = 180.0 / math.pi * math.atan(0.5 * (math.exp(n) - math.exp(-n)))
    return lon, lat


def scale_for(zoom):
    return 2.0 ** zoom


_FLIGHT_SHAPE = (
    # const s = scaleFor(Math.min(from.zoom, to.zoom));
    r"const s = scaleFor\(Math\.min\(from\.zoom, to\.zoom\)\);",
    # const screens = (Math.hypot(bx - ax, by - ay) * s) / Math.max(size.w, size.h, 1);
    r"const screens = \(Math\.hypot\(bx - ax, by - ay\) \* s\)"
    r" / Math\.max\(size\.w, size\.h, 1\);",
    # const dz = Math.abs(to.zoom - from.zoom);
    r"const dz = Math\.abs\(to\.zoom - from\.zoom\);",
)

_FLIGHT_RETURN = re.compile(
    r"return clamp\(speed \* \(([\d.]+) \+ ([\d.]+) \* Math\.min\(screens, ([\d.]+)\)"
    r" \+ ([\d.]+) \* dz\), flyLo, flyHi\);")

_FLY_OVER = re.compile(r"^\s*flyOver = ([\d.]+),", re.M)

# The clamp moved out of the return and into a createMap option, because a
# pack's style.json sets it (`camera.clamp`) and a literal buried in autoOver()
# is not reachable from a pack. The bounds are still READ FROM THE MODULE, and
# still by regex, for the reason the header gives: a retune moves this check
# with it and a rewrite of the shape fails out loud instead of quietly
# computing durations from the wrong formula.
_FLY_CLAMP = re.compile(r"^\s*flyClamp = \[([\d.]+), ([\d.]+)\]", re.M)


def flight_constants() -> tuple[dict, list[str]]:
    """autoOver()'s numbers, read out of map/index.js.

    Returns ({speed, base, per_screen, screen_cap, per_zoom, lo, hi}, problems).
    A problem here is not a broken chapter — it is this file having gone stale
    against the module it copies, which is exactly the failure that made
    engine/verbs.json the single source of truth for the cue vocabulary. It is
    reported as a problem anyway, because a camera check computing durations
    from the wrong formula is worse than no camera check.
    """
    try:
        with open(MAP_INDEX, encoding="utf-8") as fh:
            src = fh.read()
    except OSError:
        return {}, [f"cannot read {MAP_INDEX} — the camera check needs autoOver()"]

    problems = []
    for pattern in _FLIGHT_SHAPE:
        if not re.search(pattern, src):
            problems.append(
                f"map/index.js autoOver() no longer contains `{pattern}` — the camera "
                f"check in tools/scriptlib.py reimplements that formula and must be "
                f"updated with it")
    ret = _FLIGHT_RETURN.search(src)
    speed = _FLY_OVER.search(src)
    bounds = _FLY_CLAMP.search(src)
    if not ret:
        problems.append(
            "map/index.js autoOver()'s return no longer matches "
            "`clamp(speed * (a + b * Math.min(screens, c) + d * dz), flyLo, flyHi)` — "
            "update AUTO_OVER in tools/scriptlib.py to match")
    if not speed:
        problems.append("map/index.js no longer declares `flyOver = <seconds>`")
    if not bounds:
        problems.append("map/index.js no longer declares `flyClamp = [lo, hi]` — "
                        "the camera check needs autoOver()'s bounds")
    if problems:
        return {}, problems

    base, per_screen, screen_cap, per_zoom = (float(g) for g in ret.groups())
    return {
        "speed": float(speed.group(1)),
        "base": base, "per_screen": per_screen, "screen_cap": screen_cap,
        "per_zoom": per_zoom,
        "lo": float(bounds.group(1)), "hi": float(bounds.group(2)),
    }, []


def auto_over(frm, to, k, size=(STAGE_W, STAGE_H)) -> float:
    """How long the map will take to fly `frm` -> `to`, in seconds.

    `frm` and `to` are (lat, lon, zoom). `k` is flight_constants().
    map/index.js:814 autoOver().
    """
    s = scale_for(min(frm[2], to[2]))
    ax, ay = project(frm[1], frm[0])
    bx, by = project(to[1], to[0])
    screens = math.hypot(bx - ax, by - ay) * s / max(size[0], size[1], 1.0)
    dz = abs(to[2] - frm[2])
    return clampf(
        k["speed"] * (k["base"] + k["per_screen"] * min(screens, k["screen_cap"])
                      + k["per_zoom"] * dz),
        k["lo"], k["hi"])


def ease_flight(frm, to, t: float):
    """Where the camera is `t` of the way through a flight. stepFlight()."""
    t = clampf(t, 0.0, 1.0)
    e = 4 * t * t * t if t < 0.5 else 1 - pow(-2 * t + 2, 3) / 2
    return (frm[0] + (to[0] - frm[0]) * e,
            frm[1] + (to[1] - frm[1]) * e,
            frm[2] + (to[2] - frm[2]) * e)


def frame_padding(size=(STAGE_W, STAGE_H)) -> dict:
    """engine/scenes/map.js framePadding(), for a phone with nothing over the map.

    The real one measures the caption, the transport and any portrait or plate
    off the DOM. A plate over a camera move is already a failure by another
    check (check_plates_over_map), so the case worth modelling is the plain
    one: an even edge, plus the furniture along the bottom.
    """
    w, h = size
    edge = max(20.0, min(w * 0.07, h * 0.07))
    return {
        "top": min(edge, h * 0.34),
        "right": min(edge, w * 0.42),
        "bottom": min(max(edge, FURNITURE_BOTTOM), h * 0.42),
        "left": min(edge, w * 0.42),
    }


def fit_bounds(coords, zoom_min, max_z, size=(STAGE_W, STAGE_H)):
    """Where fitCoords() puts the camera. map/index.js:873 fitBounds().

    Returns (lat, lon, zoom). `coords` is a list of [lat, lon].
    """
    w, h = size
    s = min(c[0] for c in coords)
    n = max(c[0] for c in coords)
    west = min(c[1] for c in coords)
    east = max(c[1] for c in coords)

    x0, y1 = project(west, s)
    x1, y0 = project(east, n)
    p = frame_padding(size)
    avail_w = max(1.0, w - p["left"] - p["right"])
    avail_h = max(1.0, h - p["top"] - p["bottom"])

    # A single point has no extent, so log2(avail / 0) is infinite; the real
    # code gets +Infinity and clamps it to max_z, which is the behaviour
    # fitPlaces() went out of its way to avoid for one place. Match it.
    zx = math.log2(avail_w / abs(x1 - x0)) if abs(x1 - x0) > 1e-12 else math.inf
    zy = math.log2(avail_h / abs(y1 - y0)) if abs(y1 - y0) > 1e-12 else math.inf
    z = clampf(min(zx, zy), zoom_min, max_z)

    sc = scale_for(z)
    cx = (x0 + x1) / 2 + (w / 2 - (p["left"] + avail_w / 2)) / sc
    cy = (y0 + y1) / 2 + (h / 2 - (p["top"] + avail_h / 2)) / sc
    lon, lat = unproject(cx, cy)
    return (lat, lon, z)


def map_conf(pack: str) -> dict:
    """pack.json's map block with the defaults engine/scenes/map.js fills in."""
    m = (load_json(os.path.join(pack_dir(pack), "pack.json")) or {}).get("map") or {}
    zoom = {"min": 2, "max": 15, "default": 10.5, "maxFit": 13.5, **(m.get("zoom") or {})}
    return {"home": m.get("home"), "zoom": zoom,
            "detail": m.get("detail"), "basemap": m.get("basemap")}


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


def effect_years() -> dict[str, tuple[int, int]]:
    """
    The span in which each synthesised effect's subject existed.

    Read out of sound/library.js for the same reason the names are: two
    copies of the catalogue is the engine/verbs.json mistake waiting to
    happen. An entry with no `years` is timeless — wind, a crowd, the sea —
    and is simply absent from this map.

    This is what `content/roman-empire/chapter-44bc-octavian.json` needed
    and did not have: three cannon, a musket, two volleys and a church bell
    in 44 BC, and every one of them validating clean because nothing ever
    asked when gunpowder was invented.
    """
    try:
        with open(SOUND_LIB, encoding="utf-8") as fh:
            src = fh.read()
    except OSError:
        return {}
    start = src.find("const CATALOGUE = {")
    if start < 0:
        return {}
    end = src.find("export const EFFECTS", start)
    block = src[start:end if end > 0 else len(src)]
    out = {}
    for name, lo, hi in re.findall(
            r"^\s{2}(\w+):\s*\{[^\n]*?years:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]", block, re.M):
        out[name] = (int(lo), int(hi))
    return out


def _year(value) -> int | None:
    """The year out of an era date. '-0044-01-01' is 44 BC, not minus one."""
    m = re.match(r"\s*(-?)(\d{1,4})", str(value or ""))
    if not m:
        return None
    y = int(m.group(2))
    return -y if m.group(1) else y


def pack_era(pack: str) -> tuple[int, int] | None:
    """(first year, last year) from the pack's declared era, or None."""
    era = (load_json(os.path.join(pack_dir(pack), "pack.json")) or {}).get("era") or {}
    lo, hi = _year(era.get("start")), _year(era.get("end"))
    if lo is None or hi is None:
        return None
    return (min(lo, hi), max(lo, hi))


def sound_years(pack: str) -> dict[str, tuple[int, int]]:
    """Catalogue year spans, with the pack's own recordings layered on top."""
    years = effect_years()
    for name, entry in (load_json(os.path.join(pack_dir(pack), "sound.json")) or {}).items():
        span = (entry or {}).get("years")
        if isinstance(span, list) and len(span) == 2:
            years[name] = (int(span[0]), int(span[1]))
    return years


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
    people = pool_ids(os.path.join(pd, "people.json"))
    media = pool_ids(os.path.join(pd, "media.json"))
    sounds = pool_ids(os.path.join(pd, "sound.json"))
    regions, problems = region_names(pack, chapter)
    pools_decl = (load_json(os.path.join(pd, "pack.json")) or {}).get("pools", {})
    terms = pool_ids(os.path.join(pd, pools_decl.get("terms", "terms.json")))
    topics = pool_ids(os.path.join(pd, pools_decl.get("topics", "topics.json")))

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


# ------------------------------------------------------------------
# what is on the screen — the ONE implementation
# ------------------------------------------------------------------

# fact.show's default life, and it must match FACT_SECONDS in
# engine/script.js, which derives a hide cue at compile time.
FACT_SECONDS = 6.5


def _cue_key(cue, occ):
    """The id this cue's span is filed under, for targeted clears.

    A `key` in the manifest names the ARGUMENT that identifies the artifact --
    `marker.hide at=lexington` frees one marker, not every marker. Without a
    key the channel holds a single thing and the id is only for reporting.
    """
    field = occ.get("key")
    val = cue.get(field) if field else cue.get("id")
    if isinstance(val, list):
        return tuple(val)
    return val


def occupancy(chapter, timing, lang, verbs=None):
    """Every span in which a channel is occupied, per scene.

    THE single answer to "what is on the screen at time t", and the reason it
    is here rather than in a checker: the same walk was written four times --
    check-script.py's check_plates_hold, check-pictures.py, review-pictures.py
    and check-blank.py -- three of them plate-only and the fourth simply
    wrong, because each re-derived show-versus-hide from the verb's NAME.
    engine/verbs.json states it now, and this reads it.

    Returns {scene_id: {"dur": float, "spans": [span]}} where a span is
    {channel, weight, id, start, end, beat, verb}. Times are scene-relative,
    which is what the timing file uses.

    Everything open is closed at the scene's end, because a scene change wipes
    the stage: engine/player.js rebuildTo() replays only the current scene's
    cues, so nothing standing survives the boundary.
    """
    spec = verbs if verbs is not None else VERB_SPEC
    out = {}
    for si, scene in enumerate(chapter.get("scenes", [])):
        sid = scene["id"]
        st = (timing.get("scenes") or {}).get(sid) or {}
        dur = st.get("dur")
        if dur is None:
            continue                      # not narrated yet; nothing to time
        beats = scene.get("beats", [])

        events = []
        for bi, beat in enumerate(beats):
            tb = timing_beat(timing, sid, beat["id"])
            if tb is None:
                continue
            b_end = tb.get("start", 0.0) + tb.get("dur", 0.0)
            for ci, cue in enumerate(beat.get("cues", [])):
                occ = (spec.get(cue["do"]) or {}).get("occupies")
                if not occ:
                    continue
                at = cue_time(cue, tb, lang)
                if at is None:
                    continue
                events.append((at, bi, ci, cue, occ, beat["id"], b_end))
        # (time, then authored order) — the same stable sort engine/script.js
        # applies, and the tie-break matters when a beat clears something and
        # sets it again in the same instant.
        events.sort(key=lambda e: (e[0], e[1], e[2]))

        open_spans = {}                   # (channel, key) -> span dict
        spans = []

        def close(span, at):
            span["end"] = max(span["start"], at)
            spans.append(span)

        for at, _bi, _ci, cue, occ, bid, b_end in events:
            ch, effect = occ["channel"], occ["effect"]
            key = _cue_key(cue, occ)

            # A show with no id is a stop: `sound.music` and `sound.ambience`
            # both stop by being called with the id left off.
            if effect in ("fill", "add") and cue.get("id", "?") is None:
                effect = "free"

            if effect == "free":
                # With a `key` whose argument is present this is targeted;
                # otherwise it empties the whole channel.
                for k in [k for k in open_spans if k[0] == ch
                          and (key is None or occ.get("key") is None or k[1] == key)]:
                    close(open_spans.pop(k), at)
                continue
            if effect == "free-one":
                k = (ch, key)
                if k in open_spans:
                    close(open_spans.pop(k), at)
                continue

            if effect == "fill":
                # Re-showing what is already up is a no-op in the engine
                # (plate.js returns early when showing === cue.id), so it must
                # not close and reopen the span here either.
                same = [k for k in open_spans if k[0] == ch and k[1] == key]
                if same:
                    continue
                for k in [k for k in open_spans if k[0] == ch]:
                    close(open_spans.pop(k), at)
            elif effect == "add" and (ch, key) in open_spans:
                continue

            span = {"channel": ch, "weight": occ.get("weight", "frame"),
                    "id": key, "start": at, "end": None,
                    "beat": bid, "verb": cue["do"]}
            open_spans[(ch, key)] = span

            # Two lifetimes that are not cues at all.
            expires = occ.get("expires")
            if expires == "beat":
                # A definition dies with its own sentence: the beat end is a
                # hard ceiling and `until` can only shorten it.
                until = cue.get("until", FACT_SECONDS)
                close(open_spans.pop((ch, key)), min(at + until, b_end))
            elif isinstance(expires, (int, float)):
                close(open_spans.pop((ch, key)), at + expires)

        for span in open_spans.values():
            close(span, dur)

        spans.sort(key=lambda s: (s["start"], s["channel"]))
        out[sid] = {"dur": dur, "spans": spans, "index": si}
    return out


def holes(scene_occ, weight="frame", channels=None):
    """The spans of a scene with nothing on the screen.

    Only `frame` weight counts by default. A fact box, a caption note and a
    row of stat chips are really on screen and really cannot carry it --
    docs/design-direction.md calls a fact box "the picture's edge, and nothing
    else" -- so a stretch showing only those is still an empty screen.
    """
    live = [s for s in scene_occ["spans"]
            if s["weight"] == weight
            and (channels is None or s["channel"] in channels)]
    live.sort(key=lambda s: s["start"])
    gaps, at = [], 0.0
    for s in live:
        if s["start"] > at:
            gaps.append((at, s["start"]))
        at = max(at, s["end"])
    if at < scene_occ["dur"]:
        gaps.append((at, scene_occ["dur"]))
    return [(a, b) for a, b in gaps if b - a > 1e-6]
