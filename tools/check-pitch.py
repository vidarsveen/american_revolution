#!/usr/bin/env python3
"""
check-pitch.py — drive dev/pitch-lab.html and fail on a broken pitch.

    python tools/serve.py            # in another shell
    python tools/check-pitch.py
    python tools/check-pitch.py --keep-open

Seven questions, all with right answers, all of them things that would be
invisible on screen until a chapter was written against them:

  1. does a picture reached by PLAYING match the one reached by SEEKING?
     Rule 1 for this surface. Every scenario runs twice — real durations,
     waited out, against `instant` — and the two snapshots must be identical.
     A morph is the case that matters: 2-3-5 becoming a WM over 1.2 s has to
     land on exactly the WM `instant` draws.
  2. is every player on the pitch, for every shape at every line and depth?
  3. do the five lanes tile the width with no gap and no overlap?
  4. can two dots be told apart at 390 x 700, which is what a phone browser
     actually hands the page?
  5. does `view` actually crop, or only reposition? Measured on the pixels,
     because the other four measure metres and all four were green while a
     final-third panel was drawing the whole 105 m of markings out of the
     bottom of itself.
  6. do two teams on one panel attack in opposite directions? It was wrong
     when the opposition was placed first with an explicit facing, and one
     whole team was then drawn outside a cropped band and silently absent.
  7. does `pitch.focus` light exactly the players it names, and does it clear?
     The surface's answer to docs/dramaturgy.md rule 6 -- a diagram that shows
     everything equally shows nothing.

Same arrangement as check-engine.py and check-sound.py: the bench is what you
open when something is wrong, and this is what notices.

LAB_BASE overrides http://localhost:8000.
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    raise SystemExit("playwright is not installed in this venv — "
                     "pip install playwright && playwright install chromium")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

BASE = os.environ.get("LAB_BASE", "http://localhost:8000").rstrip("/")


def report(r) -> bool:
    """Print the result. True if anything failed."""
    bad = False

    print("\n1 · seeking matches playing")
    for case in r["rule1"]["cases"]:
        ok = case["ok"]
        bad = bad or not ok
        print(f"   {'ok  ' if ok else 'FAIL'} {case['name']}")
        for p in case["problems"]:
            print(f"        {p}")

    on = r["onPitch"]
    bad = bad or not on["ok"]
    print(f"\n2 · every player on the pitch — {on['checked']} placements")
    print(f"   {'ok' if on['ok'] else 'FAIL'}")
    for p in on["problems"]:
        print(f"        {p}")

    lanes = r["lanes"]
    bad = bad or not lanes["ok"]
    print(f"\n3 · the five lanes tile the width — {' / '.join(map(str, lanes['widths']))} m")
    print(f"   {'ok' if lanes['ok'] else 'FAIL'}")
    for p in lanes["problems"]:
        print(f"        {p}")

    dots = r["dots"]
    bad = bad or not dots["ok"]
    print(f"\n4 · two dots on a 390x700 phone — radius {dots['radius']} px, "
          f"so centres need {dots['floor']} px")
    for row in dots["rows"]:
        flag = "ok  " if row["ok"] else "FAIL"
        print(f"   {flag} {row['shape']:<12} closest {row['pair']} at {row['px']} px")

    crop = r["crop"]
    bad = bad or not crop["ok"]
    print(f"\n5 · cropping actually crops — panels {', '.join(crop['frames'])}")
    print(f"   {'ok' if crop['ok'] else 'FAIL'}"
          + (f"  {crop['outside']} lit pixels outside, first at {crop['firstAt']}"
             if not crop["ok"] else ""))

    face = r["facing"]
    bad = bad or not face["ok"]
    print(f"\n6 · two teams never attack the same way — "
          f"{face['checked']} arrangements")
    print(f"   {'ok' if face['ok'] else 'FAIL'}")
    for p in face["problems"]:
        print(f"        {p}")

    foc = r["focus"]
    bad = bad or not foc["ok"]
    print(f"\n7 · focus lights exactly what it names — {foc['checked']} cases")
    print(f"   {'ok' if foc['ok'] else 'FAIL'}")
    for p in foc["problems"]:
        print(f"        {p}")

    return bad


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--keep-open", action="store_true",
                    help="leave the browser up to look at")
    ap.add_argument("--timeout", type=int, default=30000)
    args = ap.parse_args(argv)

    url = f"{BASE}/dev/pitch-lab.html"
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.keep_open)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=args.timeout)
        except Exception as err:
            print(f"could not open {url}: {err}\n"
                  f"is `python tools/serve.py` running?", file=sys.stderr)
            return 2

        page.wait_for_function(
            "document.querySelector('#status').textContent === 'ready'",
            timeout=args.timeout)
        page.evaluate("window.__pitchLab = undefined")
        page.click("#run")
        page.wait_for_function("window.__pitchLab !== undefined", timeout=args.timeout)
        result = page.evaluate("window.__pitchLab")
        if not args.keep_open:
            browser.close()

        bad = report(result)
        if errors:
            bad = True
            print("\nconsole errors:")
            for e in errors[:10]:
                print(f"   {e}")

        print("\nFAIL" if bad else "\nAll seven hold.")
        return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
