#!/usr/bin/env python3
"""
check-rhythm-selftest.py — prove each of check-rhythm.py's gates can fail.

    python tools/check-rhythm-selftest.py

Four checks in this repo have passed while measuring nothing at all: one had
never looked at the main screen, one scored a map pin against its own label,
one flew to the wrong continent, one ran a weaker copy of the dev server than
the app uses. A bench that has never failed has not been shown to measure
anything, and check-rhythm.py exists precisely because a chapter can be green
everywhere and still be worthless.

So: build a chapter that is clean, confirm it passes; then break it one way at
a time and confirm the matching gate — and only that gate — fires.

The fixtures are built in memory rather than by editing a real chapter, because
the thing being tested is the MEASUREMENT and a fixture makes the intended
defect exact. tools/check-pack-selftest.py takes the other route (reintroduce
the bug in real files) for the same reason in reverse: what it tests is whether
a real course's wiring is read correctly.
"""

from __future__ import annotations

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

_spec = importlib.util.spec_from_file_location(
    "check_rhythm", os.path.join(HERE, "check-rhythm.py"))
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


def build(scenes):
    """A chapter and a matching timing file from a compact description.

    `scenes` is a list of (scene_id, [(beat_id, seconds, [cue, ...]), ...]).
    Every beat is `on: start`, which is all these fixtures need — the gates
    measure WHEN something fills the frame, and beat-start is a time like any
    other.
    """
    chapter = {"id": "fixture", "pack": "fixture", "langs": ["no"], "scenes": []}
    timing = {"scenes": {}}
    for sid, beats in scenes:
        t = 0.0
        tb = []
        cb = []
        for bid, dur, cues in beats:
            cb.append({"id": bid, "say": {"no": "en setning her"},
                       "cues": [dict(c, **{"on": "start"}) for c in cues]})
            tb.append({"id": bid, "start": t, "dur": dur, "gapAfter": 0.0})
            t += dur
        chapter["scenes"].append({"id": sid, "title": {"no": sid}, "beats": cb})
        timing["scenes"][sid] = {"dur": t, "beats": tb}
    return chapter, timing


PLATE = lambda i: {"do": "plate.show", "id": i}          # noqa: E731


def clean():
    """Beer's shape: a new picture roughly every 20 s, all of them different."""
    beats = []
    for i in range(12):
        beats.append((f"b{i + 1}", 20.0, [PLATE(f"picture-{i}")]))
    return build([("s0", beats[:6]), ("s1", beats[6:])])


CASES = []


def case(name, expect):
    def wrap(fn):
        CASES.append((name, expect, fn))
        return fn
    return wrap


@case("the picture rarely changes", "changes every")
def slow():
    # One picture per scene, 120 s a scene: median interval 120.
    return build([("s0", [("b1", 60.0, [PLATE("a")]), ("b2", 60.0, [])]),
                  ("s1", [("b1", 60.0, [PLATE("b")]), ("b2", 60.0, [])])])


@case("one dead stretch in an otherwise brisk chapter", "with no change to the frame")
def stall():
    beats = [("b1", 20.0, [PLATE("a")]), ("b2", 20.0, [PLATE("b")]),
             ("b3", 70.0, [PLATE("c")]),          # 70 s before the next one
             ("b4", 20.0, [PLATE("d")]), ("b5", 20.0, [PLATE("e")])]
    return build([("s0", beats)])


@case("the same picture, called up again and again", "distinct picture")
def samey():
    # Changes often, and it is the same two images the whole way: the football
    # defect exactly. The median and the worst gap are both fine.
    beats = [(f"b{i + 1}", 20.0, [PLATE("a" if i % 2 else "b")]) for i in range(14)]
    return build([("s0", beats[:7]), ("s1", beats[7:])])


@case("opens on an empty stage", "opens on an empty stage")
def empty_open():
    ch, tm = clean()
    # Strip the frame cue off the very first beat and put it a beat later,
    # which is what "pitch.show on an empty pitch" amounts to.
    first = ch["scenes"][0]["beats"][0]
    moved = first["cues"]
    first["cues"] = [{"on": "start", "do": "sound.music", "id": "bedOpen"}]
    ch["scenes"][0]["beats"][1]["cues"] = moved + ch["scenes"][0]["beats"][1]["cues"]
    return ch, tm


def run():
    bad = False

    ch, tm = clean()
    fails = R.analyse("fixture/clean", ch, tm, "no")
    ok = not fails
    bad = bad or not ok
    print(f"  {'ok  ' if ok else 'FAIL'} a clean chapter passes")
    for f in fails:
        print(f"        unexpected: {f}")

    for name, expect, fn in CASES:
        ch, tm = fn()
        fails = R.analyse("fixture/broken", ch, tm, "no")
        hit = [f for f in fails if expect in f]
        other = [f for f in fails if expect not in f]
        ok = bool(hit)
        bad = bad or not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name}")
        if not ok:
            print(f"        expected a failure containing {expect!r}, got "
                  f"{fails or 'nothing at all — the gate measures nothing'}")
        for f in other:
            # Not an error: one defect can trip a neighbouring gate. Printed so
            # a fixture that is testing two things at once is visible.
            print(f"        (also tripped: {f.split(': ', 1)[-1][:70]})")

    print("\nFAIL — a gate that cannot fail is not a gate." if bad
          else "\nEvery gate fires when its defect is reintroduced.")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(run())
