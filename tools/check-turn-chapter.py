#!/usr/bin/env python3
"""
check-turn-chapter.py — drive dev/turn-lab.html and fail on an uncovered turn.

    python tools/serve.py                    # in another shell
    python tools/check-turn-chapter.py
    python tools/check-turn-chapter.py --pack italy-wine --keep-open

Two questions, one per turn, and both are about whether a device that exists
is actually in front of the thing it exists to hide:

    scene -> scene    is the veil opaque when the stage is rebuilt, and does
                      the turn begin BEFORE the audio runs out?
    chapter -> chapter is there any frame in which the outgoing chapter has
                      been torn down and nothing is covering the hole?

WHY THIS IS A SECOND TOOL AND NOT A FLAG ON check-turn.py

check-turn.py measures one instant — veil opacity at the rebuild — by driving
the player directly. That is the right shape for the question it asks and the
wrong shape for this one: a chapter turn is a property of story.js's teardown
AND of the stylesheet's stacking order, so it only exists when the whole app
is running. dev/turn-lab.html therefore drives the real app in a same-origin
iframe, and this drives the lab.

The blank between two chapters was measured at ~19 ms on warm localhost. A
40 ms sampler misses it more often than it catches it, so the lab uses a
MutationObserver on the stage rather than a poll — which is also why "it looked
fine when I watched it" was never evidence either way.

Runs per pack. A pack with one chapter reports "no door to turn through" and
passes: there is nothing to measure, and saying so is better than a skip
nobody reads.

LAB_BASE overrides http://localhost:8000.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    raise SystemExit("playwright is not installed in this venv — "
                     "pip install playwright && playwright install chromium")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("LAB_BASE", "http://localhost:8000").rstrip("/")

# The Windows console is cp1252 and raises on an arrow, which is a silly way for
# a check to die — and it dies reporting a UnicodeEncodeError where the failure
# it was actually measuring should be. Same guard as tools/check-all.py.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


def packs_on_disk() -> list[str]:
    """content/packs.json is the registry, and it is data. One copy."""
    with open(os.path.join(ROOT, "content", "packs.json"), encoding="utf-8") as fh:
        listed = json.load(fh)
    return [p["id"] if isinstance(p, dict) else p
            for p in (listed.get("packs", listed) if isinstance(listed, dict) else listed)]


def run_pack(page, pack: str, timeout: int):
    page.select_option("#pack", pack)
    # Clear the previous result first. wait_for_function would otherwise return
    # on the stale one and every pack would report the first pack's numbers —
    # the mistake check-engine.py's comment records making.
    page.evaluate("window.turnLab.done = false; window.turnLab.results = null")
    page.evaluate("() => window.turnLab.run('all')")
    page.wait_for_function("window.turnLab.done === true", timeout=timeout)
    return page.evaluate("window.turnLab.results")


def report(pack: str, results) -> bool:
    """Print one pack's result. True if anything failed."""
    print(f"\npack: {pack}")
    bad = False
    for res in results or []:
        print(f"  {res['title']}")
        for key, value in res["rows"]:
            print(f"      {key:<34} {value}")
        for fail in res["fails"]:
            print(f"      FAIL  {fail}")
            bad = True
    if not results:
        print("      nothing ran — the lab returned no results at all")
        bad = True
    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", default=None, help="one pack; default is every pack")
    ap.add_argument("--timeout", type=int, default=180_000,
                    help="ms to wait for one pack's two turns")
    ap.add_argument("--keep-open", action="store_true",
                    help="leave the browser up so the lab can be read by hand")
    args = ap.parse_args()

    packs = [args.pack] if args.pack else packs_on_disk()
    if not packs:
        print("no packs in content/ — nothing to check", file=sys.stderr)
        return 1

    bad = False
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.keep_open)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"{BASE}/dev/turn-lab.html")
        page.wait_for_function("() => !!window.turnLab", timeout=30_000)

        for pack in packs:
            try:
                bad |= report(pack, run_pack(page, pack, args.timeout))
            except Exception as err:                       # noqa: BLE001
                print(f"\npack: {pack}\n      FAIL  {err}")
                bad = True

        if errors:
            # A module that threw is why the numbers look fine and the app does
            # not. Never let it pass quietly.
            print("\nuncaught page errors:")
            for e in errors[:10]:
                print(f"      {e}")
            bad = True

        if not args.keep_open:
            browser.close()

    print("\n" + ("PROBLEMS" if bad else "Both turns are covered, every pack."))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
