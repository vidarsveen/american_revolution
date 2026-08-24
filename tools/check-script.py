#!/usr/bin/env python3
"""
Validate a chapter script against its generated timings.

    python tools/check-script.py american-revolution/chapter-1775-04-19

The thing most likely to break silently is a cue pinned to a word that is no
longer in the sentence — the player falls back to the start of the beat and the
visual just fires early, which is easy to miss by ear. This catches that, plus
unknown cue verbs and references to places, routes, people or images that do
not exist.

Reading a chapter — the anchor grammar, the reference pools, where a pack lives
— is tools/scriptlib.py, shared with the other tools that have to agree with
the engine about when a cue fires.

Exits non-zero if anything is broken. Notes are advisory.
"""

from __future__ import annotations

import re
import sys

from scriptlib import (
    REF_TYPES, VERB_SPEC, VERBS,
    anchor_for, chapter_langs, check_sound_manifest, cue_time,
    load_chapter, load_timings, norm, resolve_pools, timing_beat, tokens,
)

problems: list[str] = []
notes: list[str] = []


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
    # A plate takes the whole screen and drifts. Under about four seconds it
    # reads as a flicker rather than a shot, and the drift never gets going.
    "plate":    ("plate.show",    "plate.hide",    4.0),
}


# How long a still picture can hold the whole screen before it stops being a
# shot and starts being a wall. Measured, not guessed: the Lexington engraving
# was up for 120 SECONDS over a map that was carrying the narration, because
# the show had no matching hide and the scene ran on for ten more beats.
#
# The other end of the same defect is a plate shown so late in its scene that
# the scene wipe takes it away before anyone sees it -- which reads as a span
# of zero or less, and is a picture nobody ever gets.
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


def check_plate_rhythm(chapter):
    """A picture story, not a slideshow.

    Two things went wrong often enough to be worth encoding. A plate shown
    and hidden inside ONE beat is a flash, not a shot -- it arrives, the
    drift has no time to start, and it is gone. And two DIFFERENT pictures
    starting in adjacent beats read as channel-hopping; the eye has not
    finished the first before the second replaces it.

    Both are about beats rather than seconds on purpose: a beat is a
    sentence, and the unit a viewer actually experiences.
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
                    if last_show_i is not None and i - last_show_i == 1 and mid != last_show_id:
                        found.append(
                            f"{beat['id']}: plate '{mid}' starts one beat after "
                            f"'{last_show_id}' — two pictures back to back reads as "
                            f"channel-hopping. Hold one, or drop one.")
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


def check_overlays_readable(chapter, timings, langs):
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
    return found


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
    problems.extend(check_overlays_readable(chapter, timings, langs) or [])
    problems.extend(check_plates_hold(chapter, timings, langs) or [])
    problems.extend(check_plate_rhythm(chapter) or [])
    problems.extend(check_numbers_clear(chapter, timings, langs) or [])
    plate_bad, plate_note = check_plates_over_map(chapter)
    problems.extend(plate_bad)
    notes.extend(plate_note)

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
