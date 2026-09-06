#!/usr/bin/env python3
"""
check-rhythm.py — is this chapter worth watching, in the ways a machine can tell.

    python tools/check-rhythm.py
    python tools/check-rhythm.py --pack football
    python tools/check-rhythm.py --sheet          # the full report per chapter

WHY THIS EXISTS

A chapter was written that passed every check in this repo and was read as
"so unengaging and boring ... it's really not there". Nothing was broken. The
prose was accurate, the cues were valid, the rule-1 bench was green, the screen
was never empty. It was simply not worth five minutes of anybody's attention.

docs/design-direction.md already forbade most of what was wrong with it -- a
plate is legal for 6 to 34 seconds and that chapter's one image held for 87 --
but nothing counted, and a rule nobody counts is a rule nobody follows. Every
rule that has ever stuck in this repo became a check. Dramaturgy was left to
taste, and taste regressed.

The measured gap that prompted it, beer/chapter-1-fire-ting against
football/chapter-1-baklengs, same engine and same author:

    new full-frame picture every        24.1 s      67.0 s
    longest stretch with no change      32.2 s      87.0 s
    distinct pictures                   22 + 2      0
    numbers spoken / shown              6 / 6       5 / 0
    music beds                          6           0
    distinct pictures on screen         24          1

FOUR GATES AND A REPORT

They are calibrated against beer, and beer VETOED two of the four on the first
run -- see STATE_EVERY below. A threshold the good course fails is a wrong
threshold, every time.

The gates are the ones with a right answer. Everything else is printed and
never failed, because a tool that fails on judgement gets turned off -- and
three of the twelve rules in docs/dramaturgy.md (the curiosity chain, the
stakes, and whether the chapter is an argument or an inventory) cannot be
measured at all. Those are read by a person.

Scope is opt-in BY NAME, the way tools/check-cover.py does it: the frozen
courses are skipped and the skip is printed, because a course silently outside
a checker's coverage is the same defect one level up.
"""

from __future__ import annotations

import argparse
import os
import re
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scriptlib as S                                    # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

CONTENT = S.CONTENT

# The courses being built. Rome, Narvik, the Revolution and the wine course are
# frozen; CLAUDE.md is explicit that their content is not the work.
CHECKED = {"beer", "football"}

# ---------------------------------------------------------------- thresholds
#
# Every one of these is the beer chapters' measured behaviour with slack, not a
# number somebody liked. docs/dramaturgy.md carries the derivation.
#
#   MEDIAN_MAX   beer runs 21.3-24.1 s. The engine's own PLATE_CEILING is 34,
#                so a median above 30 means the median picture is already at
#                the edge of what one image may legally hold.
#   WORST_MAX    beer's worst mid-chapter stretch is 32.2 s. 45 is generous.
#   STATE_EVERY  DISTINCT pictures, one per this many seconds. This replaced a
#                gate on how much of the frame one SURFACE carried, and the
#                replacement is the whole lesson of calibrating against the
#                good course: beer runs 82-94% of its frame on `plate` and is
#                the chapter everything here is measured against. Surface share
#                is not the defect. Showing the SAME image is. Beer ch1 has 22
#                distinct plates in 602 s, one every 27; the football chapter
#                has exactly one picture -- an empty pitch -- for 342 s, and
#                every "frame change" in it is that same picture being shown
#                again at the top of a scene.
#
# A fourth threshold was tried and deleted: "at least two frame states inside
# the first twenty seconds". It failed every beer chapter, because beer opens
# on one picture and holds it for its full legal 24 s, which is correct. The
# opening rule that survives is only that the first beat must carry SOMETHING.
MEDIAN_MAX = 30.0
WORST_MAX = 45.0
STATE_EVERY = 45.0

# Numbers said out loud, for the "spoken but never shown" report. Deliberately
# crude: it is a report, and a missed `sju` costs nothing.
#
# `en` and `ett` are NOT in here, and that is the whole subtlety: they are the
# Norwegian indefinite article as well as the number one, so a chapter saying
# "en spiller" forty times reported forty unshown figures and the line became
# noise. A report nobody reads is worse than no report. Same reason `per` and
# `cent` are gone from the English list -- they double-counted "per cent",
# which the digits regex already catches.
NUM_WORDS = {
    "no": {"to", "tre", "fire", "fem", "seks", "sju", "syv", "åtte",
           "ni", "ti", "elleve", "tolv", "tretten", "tjue", "tretti", "førti",
           "femti", "seksti", "sytti", "åtti", "nitti", "hundre", "tusen",
           "million", "milliard", "halvparten", "dobbelt", "prosent"},
    "en": {"one", "two", "three", "four", "five", "six", "seven", "eight",
           "nine", "ten", "eleven", "twelve", "thirteen", "twenty", "thirty",
           "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred",
           "thousand", "million", "billion", "double"},
}
DIGITS = re.compile(r"\d")

# The verbs that put a number on screen. `compare.show` counts once per part,
# because the whole point of it is that three numbers land as one picture.
SHOWN_NUMBER = {"stat.show": 1, "chart.show": 1}


def mmss(t):
    return f"{int(t) // 60}:{int(t) % 60:02d}"


def surface_of(verb):
    return (S.VERB_SPEC.get(verb) or {}).get("surface") or "—"


def frame_events(chapter, occ):
    """Every moment the thing filling the screen changes, in chapter seconds.

    Absolute rather than scene-relative, because the question is what the
    VIEWER experiences and a viewer does not restart the clock at a scene
    boundary. The scene turn itself is 4 s of veil and card (design-direction
    section 1) and is not in any timing file; it is left out, which makes every
    interval reported here slightly PESSIMISTIC across a boundary. That is the
    right direction for a gate to be wrong in.
    """
    events = []
    base = 0.0
    total = 0.0
    for scene in chapter.get("scenes", []):
        sid = scene["id"]
        so = occ.get(sid)
        if not so:
            continue
        for span in so["spans"]:
            if span["weight"] != "frame":
                continue
            events.append({"t": base + span["start"], "scene": sid,
                           "verb": span["verb"], "id": span.get("id"),
                           "channel": span["channel"]})
        base += so["dur"]
        total = base
    events.sort(key=lambda e: e["t"])
    return events, total


def opening_shape(chapter, occ, events):
    """Does the chapter open on something, and does it move?

    Two separate failures with one symptom. A chapter can open on an empty
    stage -- an unlabelled pitch, a map with nothing on it, a chart with no
    series -- which is the screen design-direction.md calls "waiting to be told
    what it is for". And a chapter can open on a perfectly good establishing
    shot and then hold it for ninety seconds.
    """
    problems = []
    scenes = chapter.get("scenes", [])
    if not scenes:
        return ["no scenes"]
    first = scenes[0]
    beats = first.get("beats", [])
    if not beats:
        return ["first scene has no beats"]
    opener = [c["do"] for c in beats[0].get("cues", [])]
    weights = [(S.VERB_SPEC.get(v) or {}).get("occupies") or {} for v in opener]
    if not any(w.get("weight") == "frame" for w in weights):
        problems.append(
            f"the first beat carries no frame cue (it has {', '.join(opener) or 'nothing'}) "
            f"— the chapter opens on an empty stage")
    return problems


def spoken_numbers(chapter, lang):
    said = 0
    for scene in chapter.get("scenes", []):
        for beat in scene.get("beats", []):
            text = (beat.get("say") or {}).get(lang, "")
            if DIGITS.search(text):
                said += 1
                continue
            words = {w.strip(".,:;!?—–\"'()").lower() for w in text.split()}
            if words & NUM_WORDS.get(lang, set()):
                said += 1
    return said


def shown_numbers(chapter):
    shown = 0
    for scene in chapter.get("scenes", []):
        for beat in scene.get("beats", []):
            for cue in beat.get("cues", []):
                if cue["do"] in SHOWN_NUMBER:
                    shown += 1
                elif cue["do"] == "compare.show":
                    shown += max(1, len(cue.get("parts") or []))
    return shown


def beat_lengths(chapter, timing):
    out = []
    for scene in chapter.get("scenes", []):
        for beat in scene.get("beats", []):
            tb = S.timing_beat(timing, scene["id"], beat["id"])
            if tb:
                out.append(tb.get("dur", 0.0))
    return out


def scene_openers(chapter):
    out = []
    for scene in chapter.get("scenes", []):
        beats = scene.get("beats", [])
        cues = tuple(c["do"] for c in (beats[0].get("cues", []) if beats else []))
        out.append((scene["id"], cues))
    return out


def check_chapter(pack, cid, sheet=False):
    d = os.path.join(CONTENT, pack)
    chapter = S.load_json(os.path.join(d, f"{cid}.json"))
    if chapter is None:
        return [f"{pack}/{cid}: no compiled chapter"]
    langs = S.chapter_langs(chapter)
    timings, notes = S.load_timings(pack, cid, langs)
    fails = [f"{pack}/{cid}: {n}" for n in notes]
    if fails:
        return fails

    lang = langs[0]
    timing = timings.get(lang)
    if not timing:
        return [f"{pack}/{cid}: no timing for {lang}"]
    return analyse(f"{pack}/{cid}", chapter, timing, lang, sheet=sheet)


def analyse(name, chapter, timing, lang, sheet=False):
    """The measurement, on data rather than on files.

    Split out so tools/check-rhythm-selftest.py can feed it a chapter built to
    break exactly one gate. Four checks in this repo have passed while
    measuring nothing; the only defence is a fixture that makes each one fire.
    """
    pack, cid = name.split("/", 1) if "/" in name else (name, name)
    fails = []
    occ = S.occupancy(chapter, timing, lang)
    events, total = frame_events(chapter, occ)

    # --- gate 1 and 2: how often the picture turns over -------------------
    gaps = [b["t"] - a["t"] for a, b in zip(events, events[1:])]
    median = statistics.median(gaps) if gaps else float("inf")
    worst = max(gaps) if gaps else float("inf")
    worst_at = events[gaps.index(worst)]["t"] if gaps else 0.0
    tail = total - events[-1]["t"] if events else total

    if not events:
        fails.append(f"{pack}/{cid}: nothing ever fills the frame")
    else:
        if median > MEDIAN_MAX:
            fails.append(
                f"{pack}/{cid}: the picture changes every {median:.0f}s "
                f"(limit {MEDIAN_MAX:.0f}). One image may legally hold 34s; "
                f"the beer chapters run 21-24")
        if worst > WORST_MAX:
            fails.append(
                f"{pack}/{cid}: {worst:.0f}s with no change to the frame at "
                f"{mmss(worst_at)} (limit {WORST_MAX:.0f})")

    # --- gate 3: the pictures have to be DIFFERENT pictures ---------------
    #
    # The gate the surface-share one became. A chapter may put all of its frame
    # on `plate` -- beer does, at 82-94% -- and be excellent, because every
    # plate is a different photograph. A chapter that shows one image and calls
    # it up again at the top of each scene has a frame that technically changes
    # and visibly does not.
    states = {(e["channel"], e["id"]) for e in events}
    per = total / len(states) if states else float("inf")
    by_surface = {}
    for e in events:
        by_surface[surface_of(e["verb"])] = by_surface.get(surface_of(e["verb"]), 0) + 1
    if total and per > STATE_EVERY:
        distinct = ", ".join(sorted(f"{c}:{i or '—'}" for c, i in states)[:4])
        fails.append(
            f"{pack}/{cid}: {len(states)} distinct picture(s) in {mmss(total)} "
            f"— one every {per:.0f}s (limit {STATE_EVERY:.0f}). It is the same "
            f"screen for most of the chapter: {distinct}")

    # --- gate 4: the opening ----------------------------------------------
    for p in opening_shape(chapter, occ, events):
        fails.append(f"{pack}/{cid}: {p}")

    if not sheet:
        return fails

    # ------------------------------------------------------------- report
    #
    # Judgement, printed and never failed. Everything here is something a
    # person has to weigh: a chapter may have a good reason to be silent, or
    # to say a number it does not show.
    print(f"\n{pack}/{cid}  —  {mmss(total)}, {len(chapter.get('scenes', []))} scenes, "
          f"{len(events)} frame changes")
    print(f"  frame turns over   median {median:5.1f}s   worst {worst:5.1f}s "
          f"at {mmss(worst_at)}   closing hold {tail:.0f}s")
    mix = ", ".join(f"{k} {v / len(events):.0%}" for k, v in
                    sorted(by_surface.items(), key=lambda kv: -kv[1])) if events else "—"
    print(f"  surfaces           {mix}")
    print(f"  distinct pictures  {len(states)} in {mmss(total)} — one every {per:.0f}s")

    said, shown = spoken_numbers(chapter, lang), shown_numbers(chapter)
    flag = "  <-- numbers spoken and never shown" if said and shown < said / 2 else ""
    print(f"  numbers            {said} beats say one, {shown} on screen{flag}")

    beds = [c for sc in chapter.get("scenes", []) for b in sc.get("beats", [])
            for c in b.get("cues", []) if c["do"] == "sound.music"]
    silent = len(chapter.get("scenes", [])) - len(beds)
    bedflag = "  <-- no bed at all, so no silence to spend" if not beds else ""
    print(f"  sound              {len(beds)} bed(s), {silent} scene(s) silent{bedflag}")

    lens = beat_lengths(chapter, timing)
    if lens:
        short = sum(1 for x in lens if x < 4.0)
        print(f"  beats              median {statistics.median(lens):.1f}s   "
              f"longest {max(lens):.1f}s   {short} under 4s "
              f"({short / len(lens):.0%} — beer runs 8-10%)")

    openers = scene_openers(chapter)
    seen = {}
    for sid, cues in openers:
        seen.setdefault(cues, []).append(sid)
    repeated = [(c, s) for c, s in seen.items() if len(s) > 1]
    if repeated:
        for cues, sids in repeated:
            print(f"  scene openings     {', '.join(sids)} open identically: "
                  f"{' + '.join(cues) or 'nothing'}")
    else:
        print(f"  scene openings     all different")

    return fails


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pack", help="just this course")
    ap.add_argument("--sheet", action="store_true",
                    help="print the full report, not only the failures")
    args = ap.parse_args(argv)

    listed = S.load_json(os.path.join(CONTENT, "packs.json"), []) or []
    wanted = [args.pack] if args.pack else [p for p in listed if p in CHECKED]
    skipped = [p for p in listed if p not in CHECKED and p != args.pack]
    if skipped and not args.pack:
        print(f"skipped by name (frozen courses): {', '.join(sorted(skipped))}")

    fails = []
    seen = 0
    for pack in wanted:
        d = os.path.join(CONTENT, pack)
        if not os.path.isdir(d):
            print(f"{pack}: no such course", file=sys.stderr)
            return 2
        for name in sorted(os.listdir(d)):
            if not (name.startswith("chapter-") and name.endswith(".json")):
                continue
            seen += 1
            fails += check_chapter(pack, name[:-5], sheet=args.sheet)

    print()
    for f in fails:
        print(f"  FAIL: {f}")
    if fails:
        print(f"\n{len(fails)} problem(s) in {seen} chapter(s). "
              f"docs/dramaturgy.md says why each of these matters.")
        return 1
    print(f"{seen} chapter(s) hold their rhythm.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
