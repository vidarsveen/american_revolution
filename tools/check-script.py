#!/usr/bin/env python3
"""
Validate a chapter script against its generated timings.

    python tools/check-script.py american-revolution/chapter-1775-04-19

The thing most likely to break silently is a cue pinned to a word that is no
longer in the sentence — the player falls back to the start of the beat and the
visual just fires early, which is easy to miss by ear. This catches that, plus
unknown cue verbs and references to places, routes, people or images that do
not exist.

It also multiplies out the things whose duration nobody wrote down: a march
that cannot reach its destination before the scene wipes it, and a camera
flight that cannot land before the scene ends. The second is the harder one,
because `over` is optional on a camera cue and the map works the duration out
from how far it has to travel — so the flight is simulated, cue by cue, from
wherever the previous one left the camera. Every flight is printed with its
margin, worst first, because that arithmetic is a copy of the map's and a list
is how you find out whether it is lying.

Reading a chapter — the anchor grammar, the reference pools, the camera model,
where a pack lives — is tools/scriptlib.py, shared with the other tools that
have to agree with the engine about when a cue fires.

Exits non-zero if anything is broken. Notes are advisory.
"""

from __future__ import annotations

import os
import re
import sys

from scriptlib import (
    REF_TYPES, VERB_SPEC, VERBS,
    anchor_for, auto_over, chapter_langs, check_sound_manifest, cue_time,
    ease_flight, fit_bounds, flight_constants, load_chapter, load_json,
    load_timings, map_conf, norm, pack_dir, pack_era, resolve_pools,
    sound_years, timing_beat, tokens,
)

problems: list[str] = []
notes: list[str] = []


# ------------------------------------------------------------------
# surfaces
# ------------------------------------------------------------------
#
# engine/verbs.json names the surface that answers each verb, and a pack
# declares which surfaces it wants. Before that existed, a chapter written
# against a pack with no map validated perfectly and then drew nothing: the
# verb was real, the handler was real, and the surface was simply not there.
# That is the `kind`-on-marker.show failure one level up — the manifest is the
# contract, and anything not in it is decoration.
#
# Absent means the four that always existed, so no pack file had to change.
DEFAULT_SURFACES = ("map", "plate", "overlays", "sound")

# Where core/entries.js's built-in kinds get their pool. Kept in step with
# BUILT_IN there; a kind a pack declares itself names its own pool with `from`.
BUILTIN_POOL = {"person": "people", "term": "terms", "topic": "topics",
                "place": "placeNotes"}


def pack_info(pack: str) -> dict:
    return load_json(os.path.join(pack_dir(pack), "pack.json")) or {}


def pack_surfaces(pack: str) -> list[str]:
    want = pack_info(pack).get("surfaces")
    return [str(s) for s in want] if isinstance(want, list) else list(DEFAULT_SURFACES)


def entry_pools(pack: str) -> dict[str, dict]:
    """{kind: {id: entry}} for every entry kind the pack declares.

    core/entries.js builds this in the browser; chart.show and fact.show
    resolve against it. It is rebuilt here rather than routed through
    resolve_pools() because that returns the manifest's REFERENCE types —
    place, route, person — and an entry KIND is a pack's own invention:
    `wine` and `grape` exist in one subject and nowhere else.
    """
    pd = pack_dir(pack)
    info = pack_info(pack)
    pools_decl = info.get("pools") or {}
    declared = info.get("entries") or {}
    kinds = list(declared) or list(BUILTIN_POOL)
    out: dict[str, dict] = {}
    for kind in kinds:
        spec = declared.get(kind) or {}
        key = spec.get("from") or BUILTIN_POOL.get(kind, kind)
        rel = pools_decl.get(key) or f"{key}.json"
        data = load_json(os.path.join(pd, rel))
        if data is None:
            continue
        if isinstance(data, list):
            out[kind] = {p["id"]: p for p in data if isinstance(p, dict) and p.get("id")}
        else:
            out[kind] = {k: v for k, v in data.items() if not str(k).startswith("//")}
    return out


def declared_axes(pack: str, kind: str) -> list[str]:
    """The axis ids the pack declares for a kind, in order, or []."""
    spec = ((pack_info(pack).get("entries") or {}).get(kind) or {})
    axes = ((spec.get("profile") or {}).get("axes")) or []
    return [a.get("id") for a in axes if isinstance(a, dict) and a.get("id")]


def check_chart_refs(pack, bid, cue, epools):
    """chart.show points at entries, and the entries have to carry numbers.

    The manifest's per-argument reference types cannot express `<kind>:<id>`,
    the same way they cannot express term.mark's kind-plus-id — so it is
    written out, and for the same reason: a chart whose ref resolves to
    nothing draws nothing at all, silently, with the cue reading correct.
    """
    found = []
    resolved = []
    for arg in ("ref", "against"):
        ref = cue.get(arg)
        if not ref:
            continue
        kind, sep, eid = str(ref).partition(":")
        if not sep or not eid:
            found.append(f"{bid}: chart.show {arg} '{ref}' is not '<kind>:<id>'")
            continue
        if kind not in epools:
            found.append(f"{bid}: chart.show {arg} names kind '{kind}', which "
                         f"{pack}/pack.json does not declare "
                         f"(has: {', '.join(sorted(epools)) or 'none'})")
            continue
        entry = epools[kind].get(eid)
        if entry is None:
            found.append(f"{bid}: chart.show -> unknown {kind} '{eid}'")
            continue
        profile = entry.get("profile")
        if not isinstance(profile, dict) or not profile:
            found.append(f"{bid}: chart.show -> {kind} '{eid}' carries no `profile`, "
                         f"so the chart would draw nothing")
            continue
        bad = [k for k, v in profile.items()
               if not isinstance(v, (int, float)) or not 0.0 <= float(v) <= 1.0]
        if bad:
            found.append(f"{bid}: {kind} '{eid}' profile axes {', '.join(sorted(bad))} "
                         f"are not numbers in 0..1 — the track IS the scale")
        resolved.append((kind, eid, profile))

    if not resolved:
        return found

    # Two profiles over each other is the case this verb exists for, and it
    # only means anything if both are measured on the same axes in the same
    # order. Comparing two things across two different rulers is a picture
    # that looks like an argument and is not one.
    if len(resolved) == 2:
        a_axes = declared_axes(pack, resolved[0][0]) or list(resolved[0][2])
        b_axes = declared_axes(pack, resolved[1][0]) or list(resolved[1][2])
        if set(a_axes) != set(b_axes):
            found.append(
                f"{bid}: chart.show lays {resolved[0][0]}:{resolved[0][1]} over "
                f"{resolved[1][0]}:{resolved[1][1]}, but they are measured on "
                f"different axes ({', '.join(a_axes)} against {', '.join(b_axes)})")

    kind, eid, profile = resolved[0]
    axes = declared_axes(pack, kind)
    if cue.get("axes"):
        known = set(axes) | set(profile)
        for axis in cue["axes"]:
            if axis not in known:
                found.append(f"{bid}: chart.show names axis '{axis}', which neither "
                             f"pack.json nor {kind} '{eid}' has")
    return found


# Verbs that draw themselves in over time, and the layer a clear wipes. A
# route drawing itself is the most visible thing the map does, so a route that
# cannot finish is the most visible way for a chapter to look broken.
ANIMATED = {"route.draw": ("routes", 2.6), "converge": ("routes", 3.2)}
CLEARS = {"route.clear": "routes"}


def check_animations_finish(chapter, timings, langs):
    """
    Every march must have time to reach its destination.

    The engine rebuilds the stage from scratch on a scene change — that is how
    seeking stays correct — so anything still drawing when the scene ends is
    not paused, it is erased. The same goes for a `route.clear` in a later
    beat. Neither shows up as an error: the line simply stops partway and the
    picture is quietly wrong, which is how "the British march out of Boston"
    spent months stopping two thirds of the way to Concord. It was anchored to
    the end of the last beat of its scene, leaving 3.15 s of gap for 4.5 s of
    animation.

    Nothing about that is visible in the script. It only shows up if you
    multiply the numbers out, so the numbers get multiplied out here.
    """
    found = []
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            st = tm["scenes"].get(scene["id"])
            if not st:
                continue
            events = []
            for beat in scene["beats"]:
                tb = timing_beat(tm, scene["id"], beat["id"])
                for cue in beat.get("cues", []):
                    at = cue_time(cue, tb, lang)
                    if at is not None:
                        events.append((at, cue, beat["id"]))
            events.sort(key=lambda e: e[0])

            for i, (at, cue, bid) in enumerate(events):
                spec = ANIMATED.get(cue["do"])
                if not spec:
                    continue
                layer, default_over = spec
                over = float(cue.get("over", default_over))
                # The scene ending wipes the stage just as surely as a clear.
                deadline = st.get("dur", 0.0)
                for at2, cue2, _ in events[i + 1:]:
                    if CLEARS.get(cue2["do"]) == layer:
                        deadline = min(deadline, at2)
                        break
                room = deadline - at
                if room < over - 0.05:
                    what = cue.get("id") or cue.get("to") or cue["do"]
                    found.append(
                        f"{bid}: '{lang}' {cue['do']} '{what}' animates for {over:.1f}s "
                        f"but is wiped after {room:.1f}s — it would stop "
                        f"{100 * max(0.0, room) / over:.0f}% of the way there")
    return found


# ------------------------------------------------------------------
# the camera
# ------------------------------------------------------------------
#
# The three cues that move the camera. Not a vocabulary — engine/verbs.json is
# still the only place that says which verbs exist — but each of these three
# works out WHERE the camera is going in a different way, and that geometry is
# what the check needs. Named here so that renaming one in the manifest fails
# loudly below rather than silently switching the check off.
CAMERA_VERBS = ("map.flyTo", "map.fitRoute", "map.fitPlaces")

# The default zoom engine/scenes/map.js:299 uses for a flyTo whose place
# declares none. Two copies of one number, so it is named in both places.
FLYTO_ZOOM = 12


def camera_target(cue, chapter, conf, cam):
    """Where a camera cue is sending the camera, as (lat, lon, zoom).

    None when the cue names something the chapter does not have — that is
    already a reference failure, and reporting it twice helps nobody.
    """
    zmin, zmax = conf["zoom"]["min"], conf["zoom"]["max"]
    places = chapter.get("places") or {}

    def fly(place, z):
        return (place["coords"][0], place["coords"][1],
                min(max(z, zmin), zmax))

    if cue["do"] == "map.flyTo":
        place = places.get(cue.get("to"))
        if not place or not place.get("coords"):
            return None
        return fly(place, cue.get("zoom") or place.get("zoom") or FLYTO_ZOOM)

    if cue["do"] == "map.fitRoute":
        route = (chapter.get("routes") or {}).get(cue.get("id"))
        coords = (route or {}).get("coords")
        if not coords:
            return None
        return fit_bounds(coords, zmin, conf["zoom"]["maxFit"])

    if cue["do"] == "map.fitPlaces":
        ids = [i for i in (cue.get("places") or []) if places.get(i, {}).get("coords")]
        if not ids:
            return None
        # Fitting ONE place is flying to it — engine/scenes/map.js:326, and
        # the zoom it uses there is the pack default, not flyTo's 12.
        if len(ids) == 1:
            only = places[ids[0]]
            return fly(only, cue.get("zoom") or only.get("zoom")
                       or conf["zoom"]["default"])
        return fit_bounds([places[i]["coords"] for i in ids],
                          zmin, conf["zoom"]["maxFit"])
    return None


# The camera keys a pack may tune, with the range engine/style.js clamps them
# to. Kept short deliberately: this is not a second implementation of that
# module, it is the three numbers autoOver() actually uses.
_CAMERA_SPEC = {"flyOver": (0.2, 12.0), "clamp": (0.2, 20.0)}


def camera_style(pack: str) -> dict:
    """`camera` from the pack's style.json, merged over the documented defaults.

    flight_constants() reads map/index.js, and map/index.js only carries the
    FALLBACKS — the ones a bench gets when nothing applied a style. In the app
    engine/surfaces/map.js hands createMap() the pack's values, so a pack that
    slows its camera down would have had every flight here simulated at 2.8 s
    while the browser flew at 4.5, and the check would have called an overrun
    scene fine. Same shape as the DECK_RESERVE_PX story: a number derived from
    what ships has to be re-derived where it is read.

    Anything malformed is dropped and the default stands, which is the same
    answer engine/style.js gives — a tuning file may not break a check either.
    """
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base = (load_json(os.path.join(root, "engine", "defaults", "style.json"))
            or {}).get("camera") or {}
    own = (load_json(os.path.join(pack_dir(pack), "style.json")) or {}).get("camera") or {}
    out = {}
    for key, (lo, hi) in _CAMERA_SPEC.items():
        v = own.get(key, base.get(key))
        if key == "clamp":
            if (isinstance(v, list) and len(v) == 2
                    and all(isinstance(n, (int, float)) for n in v)):
                a, b = (min(hi, max(lo, float(n))) for n in v)
                if a <= b:
                    out[key] = [a, b]
        elif isinstance(v, (int, float)):
            out[key] = min(hi, max(lo, float(v)))
    return out


def turn_seconds(pack: str) -> float:
    """`motion.turn` from the pack's style.json — how long the veil is closed.

    A scene turn dims the stage, rebuilds behind it, and lifts. Player.tailFor()
    starts it IN_MS EARLY, inside the trailing gap, so the LAST `motion.turn` of
    a scene is behind a closing veil. Read from the pack rather than hardcoded
    at 1200: a subject with a slower turn hides more of its own ending, and this
    file has been bitten once already by a number that lived in a module while
    the app read it from a style file.
    """
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base = (load_json(os.path.join(root, "engine", "defaults", "style.json"))
            or {}).get("motion") or {}
    own = (load_json(os.path.join(pack_dir(pack), "style.json")) or {}).get("motion") or {}
    v = own.get("turn", base.get("turn", 1200))
    return (float(v) if isinstance(v, (int, float)) else 1200.0) / 1000.0


def check_camera_lands(pack, chapter, timings, langs):
    """A flight the scene ends in the middle of.

    The loudest complaint about the app in the language of the person who
    watched it: "while zooming into a map it certainly stops and we jump to
    the next chapter." That is check_animations_finish's hazard one artifact
    type further out — a scene change wipes the stage and replays, so a camera
    move still in the air when the scene ends is not paused, it is cut, and
    the next scene's establishing shot snaps the ground somewhere else.

    What makes it invisible to reading is that the duration is usually not in
    the chapter at all: `over` is optional and the map works it out from how
    far the camera has to travel (map/index.js autoOver). So the numbers are
    worked out here, from the camera's real position — which means tracking
    that position cue by cue, scene by scene, because map.reset() does not
    touch the camera and scene five opens wherever scene four left it.

    Returns (problems, rows) — rows is every flight, for the human-readable
    margin table, because getting this wrong in the LENIENT direction is much
    worse than in the strict one and a list can be read.
    """
    k, problems = flight_constants()
    if problems:
        return problems, [], []
    veil = turn_seconds(pack)
    veiled: list[str] = []
    # …and then this pack's own pacing over the module's fallbacks. See above.
    cam_style = camera_style(pack)
    if "flyOver" in cam_style:
        k["speed"] = cam_style["flyOver"]
    if "clamp" in cam_style:
        k["lo"], k["hi"] = cam_style["clamp"]

    missing = [v for v in CAMERA_VERBS if v not in VERBS]
    if missing:
        return [f"engine/verbs.json no longer declares {', '.join(missing)} — "
                f"the camera check in tools/check-script.py names them"], []

    conf = map_conf(pack)
    places = chapter.get("places") or {}
    home = places.get(chapter.get("home")) or next(iter(places.values()), None)
    start = ((home["coords"][0], home["coords"][1], conf["zoom"]["default"])
             if home and home.get("coords")
             else (0.0, 0.0, conf["zoom"]["default"]))

    found, rows = [], []
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        cam = start
        for scene in chapter["scenes"]:
            st = tm["scenes"].get(scene["id"])
            if not st:
                continue
            end = st.get("dur") or 0.0

            events = []
            for beat in scene["beats"]:
                tb = timing_beat(tm, scene["id"], beat["id"])
                for cue in beat.get("cues", []):
                    if cue["do"] not in CAMERA_VERBS:
                        continue
                    at = cue_time(cue, tb, lang)
                    if at is not None:
                        events.append((at, cue, beat["id"]))
            events.sort(key=lambda e: e[0])

            flight = None       # (from, to, t0, secs)
            for at, cue, bid in events:
                if flight:
                    f, t, t0, secs = flight
                    cam = ease_flight(f, t, (at - t0) / secs if secs else 1.0)
                target = camera_target(cue, chapter, conf, cam)
                if target is None:
                    continue
                over = cue.get("over")
                over = float(over) if over is not None else auto_over(cam, target, k)
                room = end - at
                what = cue.get("to") or cue.get("id") or ",".join(cue.get("places") or [])
                rows.append((room - over, lang, bid, cue["do"], what, over, room))
                # LANDING IS NOT THE SAME AS BEING SEEN. The veil closes
                # `turn` seconds before the scene ends, so a flight that
                # arrives inside that window arrives behind it: on screen the
                # camera is still moving when the picture dims. It is a note
                # and not a failure — a move whose LAST second is covered is a
                # judgement about the writing, and only the author knows
                # whether the arrival was the point.
                if over - 0.05 <= room < over + veil:
                    veiled.append(
                        f"{bid}: '{lang}' {cue['do']} '{what}' lands "
                        f"{room - over:.1f}s before the scene ends, and the "
                        f"last {veil:.1f}s is behind the closing veil — the "
                        f"camera is still moving when the picture dims.")
                if room < over - 0.05:
                    found.append(
                        f"{bid}: '{lang}' {cue['do']} '{what}' flies for {over:.1f}s "
                        f"but the scene ends after {room:.1f}s — the camera is cut "
                        f"{100 * max(0.0, room) / over:.0f}% of the way there and the "
                        f"next scene snaps the ground somewhere else."
                        + ("" if cue.get("over") is not None else
                           " No `over` is authored; the map computes this one from "
                           "the distance."))
                flight = (cam, target, at, max(over, 1e-6))
            # Whatever the flight got to by the wipe is where the next scene
            # opens: map.reset() clears the artifacts, not the camera.
            if flight:
                f, t, t0, secs = flight
                cam = ease_flight(f, t, (end - t0) / secs if secs else 1.0)
    return found, rows, veiled


# An overlay that appears and disappears before anyone can read it.
#
# `portrait.show` at the END of one beat and `portrait.hide` at the START of
# the next gives the face exactly the gap between them — 1.1 seconds in the
# case that produced this check, which is a flash, not a portrait. Nothing in
# the script shows it: both cues are individually correct and the arithmetic
# only appears once the narration has been recorded.
#
# Floors are what it takes to READ the thing, not what looks tidy: a name and
# a role is about two and a half seconds, a quote is a sentence you have to
# get through, a number is quick.
READABLE = {
    "portrait": ("portrait.show", "portrait.hide", 2.5),
    "image":    ("image.show",    "image.hide",    2.0),
    "quote":    ("quote.show",    "quote.hide",    3.0),
    # A fact box is three short lines. Under three seconds it is a
    # flicker in the corner of the eye rather than something read,
    # and the reader is listening to a voice at the same time.
    "fact":     ("fact.show",     "fact.hide",     3.0),
    # A plate takes the whole screen and drifts. Under about four seconds it
    # reads as a flicker rather than a shot, and the drift never gets going.
    "plate":    ("plate.show",    "plate.hide",    4.0),
    # A chart is five labelled rows and up to two series, and the reader has
    # to read the axis name before the bar means anything. That is strictly
    # more work than a three-line fact box, so it gets a longer floor. The
    # bars themselves take --t-enter (0.9 s) to arrive, so anything under
    # about four seconds is a chart the viewer watches grow and then loses.
    "chart":    ("chart.show",    "chart.hide",    4.0),
}


# How long a still picture can hold the whole screen before it stops being a
# shot and starts being a wall. Measured, not guessed: the Lexington engraving
# was up for 120 SECONDS over a map that was carrying the narration, because
# the show had no matching hide and the scene ran on for ten more beats.
#
# The other end of the same defect is a plate shown so late in its scene that
# the scene wipe takes it away before anyone sees it -- which reads as a span
# of zero or less, and is a picture nobody ever gets.
# How long a definition can sit on screen before it stops being information.
# Three short lines is four to six seconds of reading while a voice is
# running. Measured before this existed: median 21.3 s, worst 37.9, and 31 of
# 45 over twenty seconds -- the stats-deck problem again, in a different box.
FACT_CEILING = 14.0
# Must match FACT_SECONDS in engine/script.js. Two copies of one number
# is the verbs.json mistake in miniature, so it is named in both places
# and any drift shows up as a chapter that checks clean and plays wrong.
FACT_SECONDS = 6.5

PLATE_CEILING = 34.0
# And a floor that works for a plate with NO hide, which runs to the scene
# wipe. READABLE only measures show/hide pairs, so the closing picture of
# chapter two was on screen for 2 seconds and nothing said so. Six, not
# four: four is where a plate stops being legible, six is where it stops
# being a shot and starts being a blink.
PLATE_FLOOR = 6.0


# Cues that PLAY OUT: a march that draws itself over seven seconds, a front
# that advances, a flash. Run one of these under a plate and it finishes
# behind the picture -- when the plate lifts the march is simply already
# there, and the viewer never saw it move. That is the same defect as an
# animation outliving its scene, which check_animations_finish already
# catches; this is the other way to lose one.
LOST_UNDER_PLATE = {"route.draw", "front.show", "crossing.draw", "map.flash"}

# Cues that leave something STANDING. These survive behind a plate and are
# there when it lifts, so they are not lost -- but if the sentence is pointing
# at the map ("here they are: thirteen colonies along the coast") then a
# picture over the top is answering a question with the wrong thing. A tool
# cannot read the sentence, so these are listed, not failed.
STAGED_UNDER_PLATE = {"region.show", "marker.show", "battle.show", "area.show"}


# A number on screen is a claim about the sentence being spoken. Two at once
# is a comparison; five at once is a scoreboard, and the oldest of them is
# about something the narration left a minute ago.
STAT_STACK = 3
# How long a chip or a bar may stand. Longer than a plate, because a number is
# small and sits at the edge -- but a stat with no stat.clear runs to the
# scene wipe, and that is how one ended up on screen for seventy-two seconds
# under three later ones.
STAT_CEILING = 45.0


def check_ending_lands(chapter):
    """Nothing ARRIVES in the last beat of a chapter.

    docs/design-direction.md section 4 states it as a rule and section 6 lists
    it as a check. The rule was written; the check never was. So the wine
    chapter's final sentence — "next time we go south, to Tuscany" — raised a
    region wash AND a caption pill while it was still being spoken, and then
    the scene wiped both 2 s later on its way to the end card. That is the
    "the end of the chapter is not working, and it is so abrupt" complaint, and
    it had been reported repeatedly against an app whose own standard forbids
    exactly this.

    "A chapter whose final sentence is competing with something appearing has
    no ending to give."

    What is allowed in the last beat: a hide, a clear, a camera move (the
    camera is where the picture is going to REST, which is the opposite of an
    arrival), and sound, which is not on the stage. Everything else is an
    arrival and belongs earlier, or belongs on the end card — which is what
    `chapter.ending` is for.
    """
    scenes = chapter.get("scenes") or []
    if not scenes:
        return []
    beats = scenes[-1].get("beats") or []
    if not beats:
        return []
    last = beats[-1]

    def arrives(name):
        # A verb arrives if it is not a hide/clear, not a camera move, not
        # sound, and not something the compiler resolves off the stage.
        if name.split(".")[-1] in ("hide", "clear"):
            return False
        if name.startswith(("map.", "sound.")):
            return False
        if name in ("term.mark", "pause"):
            return False
        return True

    # FURNITURE fails. A pill, a pin or a number arriving under the closing
    # sentence is decoration competing with it, and there is never a reason.
    #
    # THE FINAL PICTURE is reported, not failed. `plate.show` and `region.show`
    # in a last beat are usually the image the chapter means to rest on — and
    # the ending sits on the unreset stage, so it needs one. But arriving in
    # the last beat is still wrong: a 16 s Ken Burns drift started six seconds
    # before the end is still moving when the prescription says "2.0 s of
    # silence, nothing moves, the last picture holds". The fix is to establish
    # it a beat earlier, and that is a re-cut of the chapter's closing rhythm
    # rather than a deletion — an editorial call, on somebody's writing.
    FURNITURE = ("caption.note", "marker.show", "stat.show", "compare.show",
                 "fact.show", "quote.show", "portrait.show", "image.show")
    bad, note = [], []
    for cue in last.get("cues", []):
        name = cue.get("do", "")
        if not arrives(name):
            continue
        where = (f"{last['id']}: `{name}` arrives in the chapter's last beat. "
                 f"The final sentence has to be the last thing asking for "
                 f"attention. See docs/design-direction.md section 4.")
        if name in FURNITURE:
            bad.append(where + " Furniture never has a reason to be here — "
                               "put it on the end card, or cut it.")
        else:
            note.append(where + " If this is the picture the chapter rests on, "
                                "establish it a beat earlier so it has settled "
                                "before the silence.")
    return bad, note


def check_numbers_clear(chapter, timings, langs):
    """Stat chips and comparison bars: how many, and for how long."""
    found = []
    for scene in chapter["scenes"]:
        live = 0
        for beat in scene["beats"]:
            for cue in beat.get("cues", []):
                if cue["do"] == "stat.show":
                    live += 1
                    if live > STAT_STACK:
                        found.append(
                            f"{beat['id']}: {live} stat chips on screen at once, over "
                            f"{STAT_STACK} — the older ones are about a sentence that "
                            f"has gone. Add a stat.clear.")
                elif cue["do"] == "stat.clear":
                    live = 0

    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            st = tm["scenes"].get(scene["id"])
            if not st:
                continue
            end = st.get("dur") or 0
            for show, clear, what in (("stat.show", "stat.clear", "stat"),
                                      ("compare.show", "compare.clear", "compare")):
                at = bid = None
                for beat in scene["beats"]:
                    tb = timing_beat(tm, scene["id"], beat["id"])
                    for cue in beat.get("cues", []):
                        if cue["do"] == show and at is None:
                            at, bid = cue_time(cue, tb, lang), beat["id"]
                        elif cue["do"] == clear and at is not None:
                            at = None
                if at is not None and end - at > STAT_CEILING:
                    found.append(
                        f"{bid}: '{lang}' {what} stands for {end - at:.0f}s to the scene "
                        f"wipe, over {STAT_CEILING:.0f}s. Clear it when the narration "
                        f"moves on.")
    return found


# The sound grammar from docs/design-direction.md §3, in numbers.
#
# The score tells you where you are, an effect tells you what was just
# named, and silence is a decision. None of that is checkable. What is:
#
#   · one bed per scene, in its first beat, with no gainDb of its own —
#     19 April changed bed twelve times across eight scenes, which is
#     scoring the beat rather than the scene, and a bed that changes
#     mid-scene is a bed you can hear working;
#   · effects sparse enough to stay events — three cannon and a volley
#     inside twenty seconds is ordnance, not a chapter;
#   · one ambience per scene, because a place lasts a scene;
#   · and the level rule, so re-balancing the app is one number and not
#     a hundred and sixty-three.
EFFECT_GAP = 20.0          # seconds between two sound.play cues
EFFECTS_PER_SCENE = 3
AMBIENCE_DB = (-18.0, -12.0)     # -15 ± 3
EFFECT_DB = (-12.0, -4.0)        # -8 ± 4


def check_sound_grammar(pack, chapter, timings, langs):
    """Density, placement and level — and whether the era had the thing."""
    found, seen = [], []
    years = sound_years(pack)
    era = pack_era(pack)

    for scene in chapter["scenes"]:
        beats = scene["beats"]
        music = [(b, c) for b in beats for c in b.get("cues", []) if c["do"] == "sound.music"]
        amb = [(b, c) for b in beats for c in b.get("cues", []) if c["do"] == "sound.ambience"]
        plays = [(b, c) for b in beats for c in b.get("cues", []) if c["do"] == "sound.play"]

        # --- the bed -------------------------------------------------
        if len(music) > 1:
            where = ", ".join(b["id"] for b, _ in music[1:])
            found.append(
                f"{scene['id']}: {len(music)} sound.music cues in one scene ({where}) — "
                f"one bed per scene, set in its first beat. A bed that changes "
                f"mid-scene is a bed you can hear working.")
        for b, c in music:
            if b["id"] != beats[0]["id"]:
                found.append(
                    f"{b['id']}: sound.music is not in the scene's first beat — "
                    f"the bed is under the whole scene or it is under none of it.")
            if c.get("gainDb") is not None:
                found.append(
                    f"{b['id']}: sound.music carries gainDb={c['gainDb']}. The bed's "
                    f"level is bedDb in sound/soundscape.js, once, for the whole app.")

        # --- ambience ------------------------------------------------
        named = [(b, c) for b, c in amb if c.get("id")]
        if len(named) > 1:
            where = ", ".join(b["id"] for b, _ in named[1:])
            found.append(
                f"{scene['id']}: {len(named)} sound.ambience cues in one scene ({where}) "
                f"— ambience is a place, and a place lasts a scene.")
        for b, c in named:
            db = c.get("gainDb")
            if db is None or not (AMBIENCE_DB[0] <= db <= AMBIENCE_DB[1]):
                found.append(
                    f"{b['id']}: sound.ambience '{c['id']}' at gainDb={db}, outside "
                    f"{AMBIENCE_DB[0]:.0f}…{AMBIENCE_DB[1]:.0f}. A level further out "
                    f"than that is the recording being wrong, not the cue.")

        # --- effects -------------------------------------------------
        if len(plays) > EFFECTS_PER_SCENE:
            found.append(
                f"{scene['id']}: {len(plays)} sound.play cues in one scene, over "
                f"{EFFECTS_PER_SCENE} — an effect stops being an event when there "
                f"is another one along in a moment.")
        per_beat = {}
        for b, c in plays:
            per_beat.setdefault(b["id"], []).append(c)
            db = c.get("gainDb")
            if db is None or not (EFFECT_DB[0] <= db <= EFFECT_DB[1]):
                found.append(
                    f"{b['id']}: sound.play '{c.get('id')}' at gainDb={db}, outside "
                    f"{EFFECT_DB[0]:.0f}…{EFFECT_DB[1]:.0f}.")
        for bid, cues in per_beat.items():
            if len(cues) > 1:
                names = ", ".join(str(c.get("id")) for c in cues)
                found.append(
                    f"{bid}: {len(cues)} sound.play cues on one sentence ({names}) — "
                    f"at most one. Several reports of one gun are ONE cue with "
                    f"`times` and `spread`.")

    # --- how far apart, in seconds a listener actually hears ---------
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            fired = []
            for beat in scene["beats"]:
                tb = timing_beat(tm, scene["id"], beat["id"])
                for cue in beat.get("cues", []):
                    if cue["do"] != "sound.play":
                        continue
                    at = cue_time(cue, tb, lang)
                    if at is not None:
                        fired.append((at, cue, beat["id"]))
            fired.sort(key=lambda e: e[0])
            for (t0, c0, _), (t1, c1, b1) in zip(fired, fired[1:]):
                gap = t1 - (t0 + float(c0.get("spread") or 0))
                if gap < EFFECT_GAP:
                    found.append(
                        f"{b1}: '{lang}' sound.play '{c1.get('id')}' fires {gap:.1f}s "
                        f"after '{c0.get('id')}', under {EFFECT_GAP:.0f}s.")

    # --- did the thing exist yet -------------------------------------
    if era:
        for scene in chapter["scenes"]:
            for beat in scene["beats"]:
                for cue in beat.get("cues", []):
                    if not str(cue.get("do", "")).startswith("sound."):
                        continue
                    span = years.get(cue.get("id"))
                    if not span:
                        continue
                    if era[1] < span[0] or era[0] > span[1]:
                        found.append(
                            f"{beat['id']}: {cue['do']} '{cue['id']}' belongs to "
                            f"{span[0]}…{span[1]} and this pack's era is "
                            f"{era[0]}…{era[1]} — it did not exist yet, or not any more.")

    # --- silence, which cannot be failed but can be counted ----------
    scored = sum(1 for s in chapter["scenes"]
                 if any(c["do"] == "sound.music" and c.get("id")
                        for b in s["beats"] for c in b.get("cues", [])))
    total = len(chapter["scenes"])
    if total and scored == total:
        seen.append(
            f"every one of the {total} scenes carries a bed. Music everywhere is "
            f"music nowhere — at least one scene should be unscored.")
    return found, seen


def check_places_have_ground(chapter):
    """A place a cue points at must have somewhere to be pointed.

    `places` is a dict, so a typo in the key is a new place rather than an
    error, and a place written with `at:` instead of `coords:` validates
    clean as a reference and then throws in the browser -- mapScene reads
    `place.coords[0]` and gets undefined. Caught once, on Jossingfjord, and
    only because check-engine reads the console.
    """
    found = []
    for pid, place in (chapter.get("places") or {}).items():
        c = place.get("coords")
        if c is None:
            if "at" in place or "lat" in place or "coord" in place:
                found.append(f"place '{pid}': coordinates are there but not under `coords` "
                             f"-- the map reads coords[0] and will throw")
            continue
        if not isinstance(c, list) or len(c) != 2 or not all(
                isinstance(v, (int, float)) for v in c):
            found.append(f"place '{pid}': coords must be [lat, lon], got {c!r}")
    return found


def check_plate_rhythm(chapter):
    """A picture story, not a slideshow.

    A plate shown and hidden inside ONE beat is a flash, not a shot: it
    arrives, the drift has no time to start, and it is gone.

    Adjacent plates were forbidden here too, until plate.js learned to
    cross-dissolve. See the note in the loop -- the rule was protecting
    against a hard cut, and a hard cut is not the same thing as a sequence.

    Beats rather than seconds on purpose: a beat is a sentence, and the unit
    a viewer actually experiences.
    """
    found = []
    for scene in chapter["scenes"]:
        beats = scene["beats"]
        open_i = open_id = None
        last_show_i = last_show_id = None
        for i, beat in enumerate(beats):
            for cue in beat.get("cues", []):
                if cue["do"] == "plate.show":
                    mid = cue.get("id")
                    # Adjacent plates USED to be forbidden outright. That rule
                    # was guarding a missing transition, not a real defect:
                    # showPlate() reassigned one <img>'s src, so a second
                    # picture arrived as a hard cut and read as
                    # channel-hopping. plate.js cross-dissolves now, and a
                    # sequence of pictures is how a picture-led story is told
                    # at all -- the wine course is mostly pictures and the map
                    # is the interruption.
                    #
                    # What is left is the defect underneath: a picture nobody
                    # had time to see. That is check_plates_hold()'s floor, and
                    # it applies to every plate whether or not another follows.
                    last_show_i, last_show_id = i, mid
                    open_i, open_id = i, mid
                elif cue["do"] == "plate.hide" and open_i is not None:
                    if i == open_i:
                        found.append(
                            f"{beat['id']}: plate '{open_id}' is shown and hidden "
                            f"inside one beat — that is a flash, not a shot.")
                    open_i = open_id = None
    return found


def check_plates_over_map(chapter):
    """What a plate is covering, beat by beat."""
    bad, seen = [], []
    for scene in chapter["scenes"]:
        up = None
        for beat in scene["beats"]:
            dos = [c["do"] for c in beat.get("cues", [])]
            # A plate shown in this beat covers the rest of the beat; one
            # hidden here uncovers it. Both are judged on what else is here.
            for cue in beat.get("cues", []):
                if cue["do"] == "plate.show":
                    up = cue.get("id")
                elif cue["do"] == "plate.hide":
                    up = None
            if not up:
                continue
            lost = sorted(set(dos) & LOST_UNDER_PLATE)
            staged = sorted(set(dos) & STAGED_UNDER_PLATE)
            if lost:
                bad.append(f"{beat['id']}: plate '{up}' covers {', '.join(lost)} — "
                           f"that animation plays out behind the picture and is "
                           f"never seen. Move the plate, or the cue.")
            if staged:
                seen.append(f"{beat['id']}: plate '{up}' is over {', '.join(staged)} "
                            f"— fine if the plate is pre-staging the map, wrong if "
                            f"the line is pointing at it.")
    return bad, seen


def check_plates_hold(chapter, timings, langs):
    """Every plate's real time on screen, including the ones with no hide.

    check_overlays_readable only measures show->hide pairs. A plate can also
    end by being REPLACED by another plate, or by its scene ending, and those
    are exactly the cases that produced the two-minute stills.
    """
    found = []
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            st = tm["scenes"].get(scene["id"])
            if not st:
                continue
            # The scene's own duration. Beats carry `start` and `dur`, not an
            # `end` -- reading a key that is not there returned None, fell back
            # to the last beat's START, and reported every closing plate as
            # shown after the scene finished. The first run of this check was
            # wrong before any chapter was.
            scene_end = st.get("dur") or 0

            events = []
            for beat in scene["beats"]:
                tb = timing_beat(tm, scene["id"], beat["id"])
                for cue in beat.get("cues", []):
                    if cue["do"] not in ("plate.show", "plate.hide"):
                        continue
                    at = cue_time(cue, tb, lang)
                    if at is not None:
                        events.append((at, cue, beat["id"]))
            events.sort(key=lambda e: e[0])

            open_at = open_id = open_beat = None

            def close(end):
                if open_at is None:
                    return
                span = end - open_at
                if 0.5 < span < PLATE_FLOOR:
                    found.append(
                        f"{open_beat}: '{lang}' plate '{open_id}' is on screen for "
                        f"{span:.1f}s, under {PLATE_FLOOR:.0f}s — a blink, not a shot. "
                        f"Show it earlier in the beat, or hide it later.")
                elif span <= 0.5:
                    found.append(
                        f"{open_beat}: '{lang}' plate '{open_id}' is shown "
                        f"{-span:.1f}s after its scene ends — the wipe takes it "
                        f"away and nobody ever sees it.")
                elif span > PLATE_CEILING:
                    found.append(
                        f"{open_beat}: '{lang}' plate '{open_id}' holds the whole "
                        f"screen for {span:.0f}s, over {PLATE_CEILING:.0f}s — the map "
                        f"is blocked that long. Add a plate.hide, or a second picture.")

            for at, cue, bid in events:
                if cue["do"] == "plate.show":
                    if open_id is not None and open_id != cue.get("id"):
                        close(at)
                        open_at = open_id = open_beat = None
                    if open_id != cue.get("id"):
                        open_at, open_id, open_beat = at, cue.get("id"), bid
                else:
                    close(at)
                    open_at = open_id = open_beat = None
            close(scene_end)
    return found


# Four words in a pill. The portrait floor next door is 1.1 s called "a flash,
# not a portrait"; a line of text you have to read, on a map you are also
# looking at, wants longer than that.
NOTE_FLOOR = 3.0


def check_overlays_readable(chapter, timings, langs):
    found = []
    notes = []
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            st = tm["scenes"].get(scene["id"])
            if not st:
                continue
            events = []
            for beat in scene["beats"]:
                tb = timing_beat(tm, scene["id"], beat["id"])
                for cue in beat.get("cues", []):
                    at = cue_time(cue, tb, lang)
                    if at is not None:
                        events.append((at, cue, beat["id"]))
            events.sort(key=lambda e: e[0])

            # A box shown near the end of a scene whose lifetime runs PAST that scene.
    #
    # The derived hide is clamped in engine/script.js, so this cannot happen
    # any more -- but it is the defect that survived being reported repeatedly,
    # because it hit two boxes out of nine and the compiled span said 6.5 s
    # while the screen disagreed. A rule that only lives in one function is a
    # rule nobody can see, so it is measured here too.
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            beats = scene["beats"]
            last = timing_beat(tm, scene["id"], beats[-1]["id"]) if beats else None
            if not last:
                continue
            scene_end = last.get("start", 0.0) + last.get("dur", 0.0)
            for beat in beats:
                tb = timing_beat(tm, scene["id"], beat["id"])
                if not tb:
                    continue
                for cue in beat.get("cues", []):
                    if cue["do"] != "fact.show":
                        continue
                    at = cue_time(cue, tb, lang)
                    if at is None:
                        continue
                    over = (at + cue.get("until", FACT_SECONDS)) - scene_end
                    if over > 0.2:
                        found.append(
                            f"{beat['id']}: '{lang}' fact box '{cue.get('id')}' would "
                            f"outlive its scene by {over:.1f}s. It is clamped at "
                            f"runtime, but the box then sits through the scene card "
                            f"and reads as never going away. Show it earlier, or "
                            f"give it a shorter `until`.")

    # A NOTE THAT DIES AS IT ARRIVES.
    #
    # `caption.note` is a pill under the caption saying where or when we are,
    # and it is taken down by the scene wipe like everything else. Anchored
    # `@end` in the LAST beat of a scene it therefore has no life at all: it
    # appears in the trailing gap and the turn takes it away. Measured across
    # the four packs that ship, sixteen of nineteen notes had exactly 0.0 s —
    # including both in the wine chapter, where it was reported as "on screen
    # for one or two seconds and then it jumps somewhere else and disappears",
    # about ten times, while every fix went looking at the region label instead.
    #
    # A note, not a failure, and deliberately: fourteen of the sixteen are in
    # packs CLAUDE.md freezes, and moving somebody's cue a beat earlier is a
    # re-cut of their chapter. The two in the live course were removed.
    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        for scene in chapter["scenes"]:
            beats = scene["beats"]
            last = timing_beat(tm, scene["id"], beats[-1]["id"]) if beats else None
            if not last:
                continue
            scene_end = last.get("start", 0.0) + last.get("dur", 0.0)
            for beat in beats:
                tb = timing_beat(tm, scene["id"], beat["id"])
                if not tb:
                    continue
                for cue in beat.get("cues", []):
                    if cue["do"] != "caption.note":
                        continue
                    at = cue_time(cue, tb, lang)
                    if at is None:
                        continue
                    life = scene_end - at
                    if life < NOTE_FLOOR:
                        text = (cue.get("value") or {}).get(lang, "")
                        notes.append(
                            f"{beat['id']}: '{lang}' caption.note '{text[:38]}' has "
                            f"{life:.1f}s before the scene wipes it — under "
                            f"{NOTE_FLOOR:.0f}s nobody reads it. Move it earlier or "
                            f"take it out.")

    # The hide is derived at compile time from `until`, so there is nothing
    # in the file to measure a span between. Check the declared lifetime.
    for scene in chapter["scenes"]:
        for beat in scene["beats"]:
            for cue in beat.get("cues", []):
                if cue["do"] != "fact.show":
                    continue
                secs = cue.get("until", FACT_SECONDS)
                if secs > FACT_CEILING:
                    found.append(
                        f"{beat['id']}: fact box '{cue.get('id')}' declares "
                        f"until={secs}s, over {FACT_CEILING:.0f}s — a definition "
                        f"that outstays its sentence stops being read.")
                elif secs < 3.0:
                    found.append(
                        f"{beat['id']}: fact box '{cue.get('id')}' declares "
                        f"until={secs}s — under three seconds is a flicker, not "
                        f"something read.")

    for what, (show, hide, floor) in READABLE.items():
                open_at = None
                open_id = None
                open_beat = None
                for at, cue, bid in events:
                    if cue["do"] == show:
                        open_at, open_id, open_beat = at, cue.get("id", what), bid
                    elif cue["do"] == hide and open_at is not None:
                        span = at - open_at
                        if span < floor:
                            found.append(
                                f"{open_beat}: '{lang}' {what} '{open_id}' is on screen "
                                f"for {span:.1f}s, under {floor:.1f}s — too brief to read. "
                                f"Anchor the show to a word rather than to the beat end.")
                        open_at = None
    return found, notes


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    try:
        pack, cid, chapter = load_chapter(sys.argv[1])
    except SystemExit as err:
        print(str(err), file=sys.stderr)
        return 2

    pools, pool_problems = resolve_pools(pack, chapter)
    problems.extend(pool_problems)

    # What this pack's stage is made of, and what a reader can look up in it.
    surfaces = pack_surfaces(pack)
    epools = entry_pools(pack)

    # A pack may ship recorded sound effects instead of using the synthesised
    # ones in sound/library.js. Same shape as media.json, same rule: a file
    # with no licence and no credit does not go in a build.
    sound_problems, n_sounds = check_sound_manifest(pack)
    problems.extend(sound_problems)
    if n_sounds:
        print(f"sound.json: {n_sounds} recorded effect(s)")

    langs = chapter_langs(chapter)
    timings, timing_notes = load_timings(pack, cid, langs)
    notes.extend(timing_notes)

    n_beats = n_cues = n_word = 0

    for scene in chapter["scenes"]:
        sid = scene["id"]
        for beat in scene["beats"]:
            bid = beat["id"]
            n_beats += 1

            if not bid.startswith(sid + "."):
                notes.append(f"{bid}: id does not start with its scene id '{sid}'")

            for lang in langs:
                text = (beat.get("say") or {}).get(lang, "").strip()
                if not text:
                    problems.append(f"{bid}: no '{lang}' text")
                elif len(text) > 320:
                    notes.append(f"{bid}: '{lang}' beat is {len(text)} chars — long to hold on one picture")

            for cue in beat.get("cues", []) or []:
                n_cues += 1
                verb = cue.get("do")
                if verb not in VERBS:
                    problems.append(f"{bid}: unknown cue verb '{verb}'")

                # Reference integrity, driven by the manifest: any argument
                # whose declared type is a reference must name something that
                # exists. Adding a verb with a `place` argument gets this check
                # for free, which is the point of the manifest.
                spec = VERB_SPEC.get(verb) or {}

                # THE SURFACE HAS TO BE THERE.
                #
                # A verb whose surface the pack does not declare is a chapter
                # written against the wrong subject: the handler exists, the
                # manifest is correct, and nothing is mounted to answer it. It
                # fails silently in the browser with one console warning, and
                # before this it validated clean.
                needs = spec.get("surface")
                if needs and needs not in surfaces:
                    problems.append(
                        f"{bid}: {verb} is answered by the '{needs}' surface, which "
                        f"content/{pack}/pack.json does not declare "
                        f"(surfaces: {', '.join(surfaces)})")

                # An argument the manifest does not declare is read by nobody.
                # `kind` on marker.show and `tone` on place.highlight sat in
                # this chapter for months doing exactly nothing: every pin drew
                # British-red and every "red" ring drew gold, and the script
                # validated clean the whole time because only the verb name was
                # ever checked. Same failure mode as an undeclared verb, so it
                # gets the same answer.
                declared = set(spec.get("args") or {}) | {"on", "do"}
                for arg in cue:
                    if arg not in declared and verb in VERBS:
                        problems.append(
                            f"{bid}: {verb} has no argument '{arg}' "
                            f"(declare it in engine/verbs.json or the engine ignores it)")

                for arg, adef in (spec.get("args") or {}).items():
                    atype = adef.get("type", "")
                    base = atype[:-2] if atype.endswith("[]") else atype
                    value = cue.get(arg)

                    if adef.get("required") and value in (None, "", [], {}):
                        problems.append(f"{bid}: {verb} is missing required '{arg}'")
                        continue
                    if atype == "enum" and value is not None:
                        allowed = adef.get("values") or []
                        if allowed and value not in allowed:
                            problems.append(
                                f"{bid}: {verb} '{arg}' is '{value}', "
                                f"not one of {', '.join(map(str, allowed))}")
                    if base not in REF_TYPES or value is None:
                        continue

                    pool, what = pools[base]
                    wanted = value if atype.endswith("[]") else [value]
                    if atype.endswith("[]") and not isinstance(value, list):
                        problems.append(f"{bid}: {verb} '{arg}' should be a list")
                        continue
                    for ref in wanted:
                        if ref not in pool:
                            hint = ""
                            if base == "media" and not pool:
                                hint = " (no media.json — run tools/fetch-media.py)"
                            problems.append(
                                f"{bid}: {verb} -> unknown {what} '{ref}'{hint}")

                # `term.mark` names its pool in one argument and its id in
                # another, so the manifest's per-argument reference types
                # cannot express it. Without this a marked word pointing at a
                # term nobody wrote resolves to nothing at all: the caption
                # underlines it, the reader taps, and the app shrugs.
                if verb == 'term.mark':
                    kind = cue.get('kind')
                    ref = cue.get('id')
                    pool = pools.get(kind)
                    if kind and ref and pool and ref not in pool[0]:
                        problems.append(
                            f"{bid}: term.mark -> unknown {kind} '{ref}' "
                            f"(nothing to open when a reader taps it)")

                # chart.show resolves '<kind>:<id>' against the pack's entry
                # pools, which the manifest's reference types cannot express
                # for the same reason term.mark's kind-plus-id cannot.
                if verb == 'chart.show':
                    problems.extend(check_chart_refs(pack, bid, cue, epools))

                # the important one: does the anchor word actually get spoken?
                for lang in langs:
                    spec = anchor_for(cue, lang)
                    if spec is None:
                        problems.append(f"{bid}: cue has no '{lang}' anchor")
                        continue
                    if not isinstance(spec, str):
                        problems.append(f"{bid}: anchor must be a string, got {spec!r}")
                        continue
                    if spec.startswith("word:"):
                        if lang == langs[0]:
                            n_word += 1
                        wanted, _, nth = spec[5:].partition("#")
                        want = int(nth) if nth.isdigit() else 1
                        target = norm(wanted)
                        text = (beat.get("say") or {}).get(lang, "")
                        hits = [w for w in tokens(text) if norm(w) == target]
                        if len(hits) < want:
                            nth_label = f" #{want}" if want > 1 else ""
                            problems.append(
                                f"{bid}: '{lang}' cue anchored to word '{wanted}'"
                                f"{nth_label} but that text has "
                                f"{len(hits)} — the visual would fire at the start of the beat")
                            continue
                        # and against what was actually spoken
                        tb = timing_beat(timings.get(lang), sid, bid)
                        if tb and len([w for w in tb["words"] if norm(w["w"]) == target]) < want:
                            problems.append(
                                f"{bid}: '{lang}' word '{wanted}' is in the text but was not "
                                f"recorded as spoken — re-run tools/narrate.py")
                    elif spec not in ("start", "end") and not re.fullmatch(r"(t|pct):[\d.]+", spec):
                        problems.append(f"{bid}: unrecognised '{lang}' anchor '{spec}'")

    problems.extend(check_animations_finish(chapter, timings, langs))
    camera_bad, camera_rows, camera_veiled = check_camera_lands(
        pack, chapter, timings, langs)
    problems.extend(camera_bad)
    notes.extend(camera_veiled)
    overlay_bad, overlay_notes = check_overlays_readable(chapter, timings, langs)
    problems.extend(overlay_bad or [])
    notes.extend(overlay_notes or [])
    problems.extend(check_plates_hold(chapter, timings, langs) or [])
    problems.extend(check_plate_rhythm(chapter) or [])
    problems.extend(check_places_have_ground(chapter) or [])
    problems.extend(check_numbers_clear(chapter, timings, langs) or [])
    end_bad, end_note = check_ending_lands(chapter)
    problems.extend(end_bad)
    notes.extend(end_note)
    plate_bad, plate_note = check_plates_over_map(chapter)
    problems.extend(plate_bad)
    notes.extend(plate_note)
    sound_bad, sound_note = check_sound_grammar(pack, chapter, timings, langs)
    problems.extend(sound_bad)
    notes.extend(sound_note)

    # A tool cannot hear whether an effect names the thing the sentence
    # names, so it prints the pairs and a human reads them — the same
    # answer as the list of plates over a region.show.
    #
    # It CAN say what is on screen while the effect plays, and that half is
    # worth having: "why is the map showing when you can hear a glass being
    # poured" is the report that produced this. The fermentation fizz was
    # firing one beat after its own picture came down, so the one sound in the
    # chapter that had a picture of itself was heard over empty ground. Both
    # halves were individually valid — the plate was under its 34-second
    # ceiling, the sound was on the right word — and nothing was in a position
    # to notice, because no check had ever looked at the two together.
    #
    # A note and not a failure: an effect over a bare map is sometimes exactly
    # right. A musket you do not see is more frightening than one you do.
    for scene in chapter["scenes"]:
        plate = None
        for beat in scene["beats"]:
            heard = []
            for cue in beat.get("cues", []):
                # Walk the beat in cue order: a plate that goes up in the same
                # beat as the sound counts as being on screen for it, and one
                # that comes down before the cue does not.
                if cue["do"] == "plate.show":
                    plate = cue.get("id")
                elif cue["do"] == "plate.hide":
                    plate = None
                elif cue["do"] == "sound.play":
                    heard.append((cue.get("id"), plate))
            say = (beat.get("say") or {}).get(langs[0], "")
            for sound_id, seen in heard:
                where = f"over '{seen}'" if seen else "over the BARE MAP"
                notes.append(f"{beat['id']}: hears '{sound_id}' {where} — {say}")

    # totals
    print(f"{len(chapter['scenes'])} scenes, {n_beats} beats, {n_cues} cues "
          f"({n_word} pinned to words), languages: {', '.join(langs)}")
    for lang, tm in timings.items():
        total = sum(s["dur"] for s in tm["scenes"].values())
        missing = [b["id"] for s in chapter["scenes"] for b in s["beats"]
                   if not timing_beat(tm, s["id"], b["id"])]
        m, sec = divmod(int(round(total)), 60)
        print(f"  {lang}: {m}:{sec:02d} of audio, voice {tm.get('voice')}"
              + (f", MISSING {len(missing)} beats" if missing else ""))
        for b in missing:
            problems.append(f"{b}: no timing for '{lang}' — re-run tools/narrate.py")

    # Every flight, worst margin first. Printed rather than summarised because
    # the whole formula is a reimplementation of one in map/index.js, and the
    # way to find out whether it is lying is to read the numbers next to a
    # chapter you have watched. `-1.4s` is a cut; `+0.2s` is one word of
    # narration away from being one.
    if camera_rows:
        camera_rows.sort(key=lambda r: r[0])
        tight = sum(1 for r in camera_rows if r[0] < 1.0)
        print(f"\ncamera ({len(camera_rows)} flights, {tight} with under a second "
              f"to spare, worst {camera_rows[0][0]:+.1f}s):")
        for margin, lang, bid, verb, what, over, room in camera_rows:
            print(f"  {margin:+6.1f}s  {bid:<12} {lang}  {verb:<14} "
                  f"'{what}' flies {over:.1f}s, scene has {room:.1f}s")

    if notes:
        print(f"\nnotes ({len(notes)}):")
        for n in notes:
            print(f"  - {n}")
    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1

    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
