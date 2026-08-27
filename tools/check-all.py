#!/usr/bin/env python3
"""
check-all.py — every check, one command.

    python tools/check-all.py
    python tools/check-all.py american-revolution
    python tools/check-all.py --skip contrast sound

The pre-commit list in CLAUDE.md was five commands, two of which needed a
server running in another shell, and one of which had to be repeated per
chapter. That is a list people run four fifths of. So it is one command, it
finds the chapters itself, and it starts its own server for the benches that
need one.

Exit code 1 if any check fails. Each check's own output is passed through, so
a failure reads the same here as it does on its own.
"""
from __future__ import annotations

import argparse
import http.server
import os
import socket
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable

# The Windows console is cp1252 and raises on an em-dash, which is a silly way
# for a check run to die. Sub-tools inherit the byte stream and are unaffected.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


# The checks run against tools/serve.py's OWN handler, imported, not against a
# second one written to look like it.
#
# There used to be a copy here that did the no-store part and nothing else. It
# looked equivalent and was not: serve.py answers Range requests and
# http.server does not, so under this server every <audio> element streamed
# whole, reported `seekable` as an empty range and silently refused to move.
# That is the exact defect serve.py exists to prevent and CLAUDE.md warns about
# — and the check suite was reproducing it on itself. dev/turn-lab.html could
# not seek to the end of a scene, timed out, and reported "timed out waiting"
# on all four packs while passing every time against serve.py.
#
# check-plate.py's docstring records having been bitten by the same thing from
# the other side and working around it with a fresh page per beat. The
# workaround was for a server we wrote.
#
# So: one server, one behaviour, one place. If serve.py grows a header the app
# needs, the checks get it too, and there is no second implementation to notice
# it in.
from importlib import util as _importlib_util

_spec = _importlib_util.spec_from_file_location(
    "fortell_serve", Path(__file__).with_name("serve.py"))
_serve = _importlib_util.module_from_spec(_spec)
_spec.loader.exec_module(_serve)


class Handler(_serve.Handler):
    """serve.py's handler, quiet. Its __init__ already pins the directory."""

    def log_message(self, *a):
        pass


def serve() -> str:
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}"


def chapters(packs: list[str]) -> list[str]:
    """'<pack>/<chapter>' for every narrated chapter on disk."""
    out = []
    for pack in packs:
        for path in sorted((ROOT / "content" / pack).glob("chapter-*.json")):
            out.append(f"{pack}/{path.stem}")
    return out


def packs_on_disk() -> list[str]:
    content = ROOT / "content"
    # Everything on disk, NOT content/packs.json. That file says what SHIPS;
    # this asks what exists. A pack taken out of the build is still a pack
    # that has to stay correct, and silently dropping it from the checks is
    # how it would rot.
    return sorted(p.name for p in content.iterdir()
                  if p.is_dir() and not p.name.startswith("_"))


def run(label: str, args: list[str], env=None) -> bool:
    print(f"\n\033[1m── {label}\033[0m")
    r = subprocess.run([PY, *args], cwd=ROOT, env=env)
    if r.returncode != 0:
        print(f"\033[31m   {label} FAILED (exit {r.returncode})\033[0m")
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("packs", nargs="*", help="default: every pack in content/")
    ap.add_argument("--skip", nargs="*", default=[],
                    metavar="NAME",
                    help="any of: script era data effects shell sw css engine "
                         "turn plate sound contrast author outline overlap")
    args = ap.parse_args()

    packs = args.packs or packs_on_disk()
    skip = set(args.skip)

    base = serve()
    env = {**os.environ, "LAB_BASE": base}
    print(f"serving {ROOT} at {base}")
    print(f"packs: {', '.join(packs)}")

    ok = True

    if "script" not in skip:
        for ref in chapters(packs):
            ok &= run(f"check-script {ref}", ["tools/check-script.py", ref])

    if "era" not in skip:
        ok &= run("era --selftest", ["tools/era.py", "--selftest"])

    if "data" not in skip:
        ok &= run("check-data", ["tools/check-data.py"])

        # A ship's track has to stay in the water. Only packs with their own
        # close-in coastline can be asked, so the rest are skipped silently.
        for pack in packs_on_disk():
            if (ROOT / "content" / pack / "geo" / "detail.json").exists():
                ok &= run(f"check-sealanes {pack}",
                          ["tools/check-sealanes.py", pack])

    if "effects" not in skip:
        ok &= run("check-effects", ["tools/check-effects.py"])

    if "shell" not in skip:
        ok &= run("build-shell --check", ["tools/build-shell.py", "--check"])

    if "sw" not in skip:
        ok &= run("build-sw --check", ["tools/build-sw.py", "--check"])

    # Cheap, no browser: a class in css/ that nothing ever writes. It belongs
    # before the slow ones because it costs a tenth of a second, and it is in
    # this list at all because "no infinite animation" was enforced against
    # .story-ring while the ring on screen (.atlas-ring) went on pulsing.
    if "css" not in skip:
        ok &= run("check-dead-css", ["tools/check-dead-css.py"])

    # Every chapter still decompiles to its script and back to itself. The
    # authoring format is only worth having if it can express what already
    # ships -- the day it cannot, the source and the JSON have quietly become
    # two different truths and whichever one you edit is the wrong one.
    if "author" not in skip:
        ok &= run("author --lab", ["tools/author.py", "--lab"])

        # And the other direction, which --lab cannot see: a chapter written
        # as prose must still compile to the chapter that SHIPS. --lab
        # round-trips the JSON through itself and passes while the
        # hand-written source says something else — which is exactly what had
        # happened. Six edits (five map labels off, one place name) were made
        # straight to the wine chapter and never to its script.md, so the next
        # compile would have put the labels back on the map, silently.
        # `script.<chapter>.md`, the way timing files are keyed, plus the bare
        # `script.md` a pack with one chapter may still use. A pack with two
        # chapters and one checked source is how the prose quietly stops being
        # the source for the other one.
        for pack in packs:
            for src in sorted((ROOT / "content" / pack).glob("script*.md")):
                ok &= run(f"author --check {pack}/{src.name}",
                          ["tools/author.py", str(src), "--check"])

    # The level above a chapter: does the course still say what it teaches,
    # and does pack.json still agree with it? A pack with no outline.md is
    # skipped rather than failed — three of the four here are frozen.
    if "outline" not in skip:
        for pack in packs:
            if (ROOT / "content" / pack / "outline.md").exists():
                ok &= run(f"outline {pack}", ["tools/outline.py", pack])

    # The three that drive a browser. Slowest last, so a cheap failure is
    # reported before you have waited two minutes for a screenshot.
    if "engine" not in skip:
        ok &= run("check-engine", ["tools/check-engine.py"], env)

    if "turn" not in skip:
        ok &= run("check-turn", ["tools/check-turn.py"], env)
        # And the turn one scale up. check-turn.py drives the player directly,
        # which is right for "is the veil opaque at the rebuild" and cannot see
        # a chapter turn at all: that one is a property of story.js's teardown
        # AND of the stylesheet's stacking order, so it only exists when the
        # whole app is running. Per pack; a one-chapter pack passes with
        # "no door to turn through".
        for pack in packs:
            ok &= run(f"check-turn-chapter {pack}",
                      ["tools/check-turn-chapter.py", "--pack", pack], env)

    if "plate" not in skip:
        for pack, chapter in [("italy-wine", "chapter-1-piemonte"),
                              ("american-revolution", "chapter-1775-04-19")]:
            ok &= run(f"check-plate {pack}", ["tools/check-plate.py",
                                              "--pack", pack, "--chapter", chapter], env)

    # Two things the reader is meant to read, on top of each other. A ratchet
    # rather than a gate: the known ones are listed in the tool with the count
    # they were measured at, and anything new fails.
    if "overlap" not in skip:
        ok &= run("check-overlap", ["tools/check-overlap.py", *packs], env)

    if "sound" not in skip:
        ok &= run("check-sound", ["tools/check-sound.py"], env)

    # Once per pack, with --pack. It used to be one bare call, and
    # check-contrast.py falls back to packs[0] — which became "roman-empire"
    # when content/packs.json was reordered. So the tool that exists BECAUSE
    # the map was unreadable was measuring one assertion on one scaffold pack
    # and printing "no samples" three times, at exit 0. Same shape as
    # BACKLOG.md's "it sampled whichever chapter the cover loaded": --pack was
    # added to fix that and this list was never taught to pass it.
    if "contrast" not in skip:
        for pack in packs:
            ok &= run(f"check-contrast {pack}",
                      ["tools/check-contrast.py", "--pack", pack], env)

    print("\n" + ("\033[1mAll checks passed.\033[0m" if ok
                  else "\033[31m\033[1mSomething failed — see above.\033[0m"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
