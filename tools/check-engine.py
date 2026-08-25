#!/usr/bin/env python3
"""
check-engine.py — drive dev/engine-lab.html and fail on a rule-1 violation.

    python tools/serve.py                # in another shell
    python tools/check-engine.py
    python tools/check-engine.py --chapter 1 --motion no-preference --keep-open

The lab answers one question — does rebuildTo(t) produce the same picture as
playing forward to t? — across every cue time in the chapter, plus the
corollaries: one-shots stay silent under `instant`, the region epoch guard
holds when the fetch is slow, the date parser agrees with tools/era.py, and
every word anchor resolved.

It runs the whole sweep TWICE, once with prefers-reduced-motion and once
without, and that is not thoroughness for its own sake. Overlays set
`is-instant` when `instant || reduced()`, so with motion reduced both passes
carry it and a genuine difference agrees by accident. The bench was clean that
way and failed the moment it was opened in an ordinary browser.

Same arrangement as check-sound.py: the bench is what you open when something
is wrong, and this is what notices.

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

BASE = os.environ.get("LAB_BASE", "http://localhost:8000").rstrip("/")
SHOTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "shots")


def run_chapter(page, i, timeout):
    page.select_option("#pick", str(i))
    page.wait_for_function(
        "document.querySelector('#status').textContent === 'ready'",
        timeout=timeout)
    # Clear the last result first, or wait_for_function returns on the stale
    # one and every chapter reports the first one's numbers.
    page.evaluate("window.__engineLab = undefined")
    page.click("#run")
    page.wait_for_function("window.__engineLab !== undefined", timeout=timeout)
    name = page.eval_on_selector("#chapter", "el => el.textContent")
    return page.evaluate("window.__engineLab"), name


def report(r, name) -> bool:
    """Print one chapter's result. True if anything failed."""
    bad = False
    print(f"\n{name.strip()}")

    sweep = r["sweep"]
    print(f"  seek == play      : {sweep['samples']} samples, "
          f"{len(sweep['failures'])} failing")
    for f in sweep["failures"]:
        bad = True
        print(f"    FAIL {f['scene']} at {f['t']:.2f}s — last cue {f['cue']}")

    one = r["oneShots"]
    print(f"  one-shots silent  : {one['nOneShots']} cue(s), "
          f"{one['skipped']} skipped, {len(one['problems'])} problem(s)")
    for p in one["problems"]:
        bad = True
        print(f"    FAIL {p}")

    ep = r["epoch"]
    if ep.get("skipped"):
        print("  epoch guard       : no region.show in this chapter")
    else:
        print(f"  epoch guard       : {len(ep['problems'])} problem(s)")
        for p in ep["problems"]:
            bad = True
            print(f"    FAIL {p}")

    d = r.get("dates") or {}
    if d.get("skipped"):
        print("  date parser       : no fixture")
    else:
        print(f"  date parser       : {d.get('n', 0)} cases, "
              f"{len(d.get('problems', []))} problem(s)")
        for p in d.get("problems", [])[:10]:
            bad = True
            print(f"    FAIL {p}")

    dp = r.get("depth") or {}
    if dp.get("skipped"):
        print("  card vs stage     : no marked terms in this chapter")
    else:
        print(f"  card vs stage     : {len(dp.get('problems', []))} problem(s)")
        for p in dp.get("problems", []):
            bad = True
            print(f"    FAIL {p}")

    vis = r.get("visible") or {}
    if not vis:
        pass
    elif not vis.get("checked") and not vis.get("problems"):
        print("  overlays hide     : no hideable overlay in this chapter")
    else:
        print(f"  overlays hide     : {len(vis.get('checked', []))} surface(s) "
              f"measured on pixels, {len(vis.get('problems', []))} problem(s)")
        for p in vis.get("problems", []):
            bad = True
            print(f"    FAIL {p}")

    # The chart is driven synthetically by the lab: no chapter carries a
    # chart.show yet, and a surface that is only measured once some content
    # happens to use it is a surface nothing measures. `.stage-chart` is in
    # the lab's signature() as well, so the sweep above picks it up for free
    # the day a chapter does carry one.
    ch = r.get("chart") or {}
    if ch.get("skipped"):
        print(f"  chart             : {ch['skipped']}")
    elif ch:
        print(f"  chart             : {ch.get('what', '?')}, "
              f"{ch.get('rows', 0)} axes x {ch.get('series', 0)} series, "
              f"{ch.get('zeros', 0)} zero axis/axes at "
              f"{ch.get('narrowest', 0):.1f} px, "
              f"{len(ch.get('problems', []))} problem(s)")
        for p in ch.get("problems", []):
            bad = True
            print(f"    FAIL {p}")

    if r["anchors"]:
        print(f"  word anchors      : {len(r['anchors'])} fell back to the "
              f"start of the beat")
        for w in r["anchors"][:10]:
            print(f"    - {w}")
    else:
        print("  word anchors      : all resolved")

    if r["idle"]:
        shown = ", ".join(r["idle"][:6])
        more = "…" if len(r["idle"]) > 6 else ""
        print(f"  beats that sit out: {len(r['idle'])} ({shown}{more})")

    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chapter", type=int, default=None,
                    help="index into the lab's chapter list; default is every one")
    ap.add_argument("--motion", choices=["reduce", "no-preference", "both"],
                    default="both",
                    help="prefers-reduced-motion. Both by default — see the "
                         "module docstring for why that matters.")
    ap.add_argument("--timeout", type=int, default=900_000)
    ap.add_argument("--keep-open", action="store_true")
    args = ap.parse_args()

    modes = (["reduce", "no-preference"] if args.motion == "both"
             else [args.motion])
    failed = False

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.keep_open)
        errors: list[str] = []

        for motion in modes:
            print(f"\n=== prefers-reduced-motion: {motion} ===")
            page = browser.new_page(viewport={"width": 1280, "height": 900},
                                    device_scale_factor=1, reduced_motion=motion)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console",
                    lambda m: errors.append(m.text) if m.type == "error" else None)
            # "Failed to load resource: 404" without the URL is a message that
            # tells you a file is missing and refuses to say which. Catch the
            # response instead, so the report names the path.
            page.on("response",
                    lambda r: errors.append(f"HTTP {r.status}  {r.url}")
                    if r.status >= 400 else None)

            page.goto(f"{BASE}/dev/engine-lab.html", wait_until="load")
            page.wait_for_function(
                "document.querySelector('#status').textContent === 'ready'",
                timeout=args.timeout)

            n = page.eval_on_selector_all("#pick option", "els => els.length")
            which = [args.chapter] if args.chapter is not None else list(range(n))

            for i in which:
                r, name = run_chapter(page, i, args.timeout)
                failed |= report(r, name)
                os.makedirs(SHOTS, exist_ok=True)
                page.screenshot(
                    path=os.path.join(SHOTS, f"engine-lab-{i}-{motion}.png"),
                    full_page=False)

            if not args.keep_open:
                page.close()

        # A console error during the sweep is a failure even if every
        # comparison passed: the picture matching by accident is not the same
        # as the engine working.
        real = [e for e in errors if "favicon" not in e.lower()
                and not e.startswith("Failed to load resource")]
        if real:
            failed = True
            print(f"\n  {len(real)} console error(s):")
            for e in real[:10]:
                print(f"    ! {e}")

        if not args.keep_open:
            browser.close()

    print("\n" + ("PROBLEMS — see above." if failed
                  else "Rule 1 holds on every chapter, in both motion modes."))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
