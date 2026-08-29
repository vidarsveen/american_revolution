#!/usr/bin/env python3
"""
Does a picture that opens a scene survive the scene change?

    python tools/check-scene-plate.py               # every pack
    python tools/check-scene-plate.py beer          # one

THE ONE QUESTION: when a scene opens on a plate and the scene before it ended
with one still up, is that new picture still on screen a second and a half
later — or has the outgoing scene's fade timer taken it away?

Why this exists, because it is not a shape anyone would think to test.

`resetPlate({soft: true})` fades the outgoing picture at a scene change and
schedules `hardClear()` 650 ms later, so the fade has something to fade. The
player then applies the new scene's cues at once. A chapter whose scene OPENS
on a plate therefore puts the new picture up about 600 ms before that timer
fires — and the timer wiped it. The picture appeared, and then the map came
back for the rest of the sentence.

It needed two unusual conditions at once, which is why four courses never saw
it: the previous scene has to END with a picture still up (the wine chapter
hides its plates first), and the next scene has to OPEN with one on its very
first beat. A picture-led course does both on nearly every scene, and the
report was "pour a glass — why is the map showing???".

AND NO EXISTING CHECK COULD HAVE FOUND IT. Every probe in this repo seeks, and
a seek resets the plate with `soft: false`, which clears synchronously and
schedules no timer at all. The defect exists only while playing forward, which
is CLAUDE.md's "watch it play forward before believing a probe" arriving from
a direction that note had not been read in yet.

So this one plays. It is slower than the seek-based checks by design, and it
only plays the scene turns that qualify — the JSON says which, and it is
usually two or three per chapter.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    raise SystemExit("playwright is not installed in this venv — "
                     "pip install playwright && playwright install chromium")

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("LAB_BASE", "http://localhost:8000").rstrip("/")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

# How long after the new scene's first sentence starts to look. Long enough
# that the 650 ms clear would have fired, short enough to be inside the beat.
LOOK_MS = 1300

# How long to wait for the turn to happen at all. A scene join is the last
# beat's gap, then the veil (coverMs), then a beat of silence before the first
# sentence (leadInMs) -- and a fixed sleep guessed at all three and looked
# while the OLD scene was still running, which reported four false failures on
# the first run. Wait for the caption to say the new scene's first line.
TURN_TIMEOUT_MS = 20000


def packs_on_disk() -> list[str]:
    base = ROOT / "content"
    return sorted(d.name for d in base.iterdir()
                  if d.is_dir() and not d.name.startswith("_"))


def qualifying_turns(chapter: dict) -> list[tuple[int, str, str]]:
    """(scene index, the plate it opens on, the plate the scene before left up).

    Both halves are required. A scene that opens on a plate with nothing
    behind it takes the hard-clear path and was never at risk.
    """
    out = []
    trailing = None
    for i, scene in enumerate(chapter.get("scenes", [])):
        opens = None
        for cue in (scene["beats"][0].get("cues", []) if scene.get("beats") else []):
            # `on: start` only. The hazard is a plate applied in the SAME tick
            # as the scene reset — rebuildTo() applies every cue at t<=0 the
            # instant after resetPlate() schedules its clear. A plate hung on a
            # word fires seconds later, long after that timer has run, and was
            # never at risk. The Roman chapter opens a scene on `word:Roma` and
            # was reported as a failure until this line existed.
            if cue.get("do") == "plate.show" and cue.get("on") == "start":
                opens = cue.get("id")
                break
        if i > 0 and opens and trailing:
            out.append((i, opens, trailing))
        # What this scene leaves up when it ends.
        trailing = None
        for beat in scene.get("beats", []):
            for cue in beat.get("cues", []):
                if cue.get("do") == "plate.show":
                    trailing = cue.get("id")
                elif cue.get("do") == "plate.hide":
                    trailing = None
    return out


PLAY = """
async ([sceneIndex]) => {
  const S = await import('/engine/story.js');
  const p = S.getPlayer(), ch = S.getChapter();
  const prev = ch.scenes[sceneIndex - 1];
  const last = prev.beats[prev.beats.length - 1];
  // Start inside the last beat of the scene BEFORE, so the turn itself plays.
  await p.goToScene(sceneIndex - 1, { autoplay: true, at: Math.max(0, last.start + last.dur - 2.0) });
  return true;
}
"""

READ = """
() => {
  const plate = document.querySelector('.stage-plate');
  if (!plate) return { plate: null, opacity: 0 };
  // .plate__img, not the first <img>: the first one is .plate__ghost and
  // never carries a src, which reports "no picture" for every frame.
  const img = plate.querySelector('.plate__img');
  const raw = img && img.getAttribute('src');
  let op = parseFloat(getComputedStyle(plate).opacity);
  for (let el = plate.parentElement; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    op *= parseFloat(s.opacity);
    if (s.display === 'none' || s.visibility === 'hidden') op = 0;
  }
  return { plate: raw ? raw.split('/').pop() : null, opacity: Number(op.toFixed(2)) };
}
"""


def chapter_index(pack: str, chapter_id: str) -> int:
    """Where this chapter sits in the pack's own list — the cover's order."""
    mf = ROOT / "content" / pack / "pack.json"
    chapters = json.loads(mf.read_text(encoding="utf-8")).get("chapters") or []
    for i, ch in enumerate(chapters):
        if ch.get("id") == chapter_id:
            return i
    return 0


def check_pack(page, pack: str) -> list[str]:
    bad = []
    for path in sorted((ROOT / "content" / pack).glob("chapter-*.json")):
        chapter = json.loads(path.read_text(encoding="utf-8"))
        turns = qualifying_turns(chapter)
        if not turns:
            print(f"  {path.stem}: no scene opens on a picture with one behind it")
            continue
        page.goto(f"{BASE}/index.html?emne={pack}", wait_until="networkidle")
        page.wait_for_function(
            # .story__stage, not #story-map: a chapter with `ground: none`
            # never creates a map host, and waiting on one is a 20 s timeout
            # reported as a failure of something else entirely.
            "() => !!document.querySelector('.story__stage') "
            "&& !document.querySelector('.boot')",
            timeout=20000)
        # OPEN THE CHAPTER BEING CHECKED. Loading the pack opens its FIRST
        # chapter, and this loop then read the second chapter's expectations
        # while the app was still playing the first one — so every plate id
        # it waited for was one this chapter never shows, and it reported
        # "never appeared at all" three times for pictures that were on
        # screen at full opacity one second after the turn. The other packs
        # hid it: their later chapters are map-led and qualify no turns at
        # all, so the loop skipped them before it could be wrong.
        #
        # There is no URL for a chapter — it is picked by tapping it on the
        # cover — so this taps it, the way a reader does.
        index_in_pack = chapter_index(pack, path.stem)
        if index_in_pack > 0:
            page.click(f'[data-chapter="{index_in_pack}"]')
            page.wait_for_function(
                "(want) => window.__ch === want || true", arg=path.stem)
            page.wait_for_timeout(1500)
        got_id = page.evaluate(
            "async () => (await import('/engine/story.js')).getChapter()?.id")
        if got_id != path.stem:
            bad.append(f"{pack}/{path.stem}: could not open it — the app is "
                       f"showing '{got_id}'")
            continue
        page.evaluate("() => document.querySelector('.story__cover')?.classList.remove('is-on')")
        page.wait_for_timeout(500)
        for index, opens, behind in turns:
            page.evaluate(PLAY, [index])
            # Wait for the turn to actually land, then look. Never a fixed
            # sleep: see TURN_TIMEOUT_MS.
            #
            # Ask the PLAYER which scene it is in, not the caption what it
            # says. Matching caption text failed on the Roman chapter and
            # reported a defect that was not there: renderCaption() splits the
            # sentence on whitespace and rejoins it with single spaces, so any
            # sentence whose source spacing is not exactly that never matches
            # itself. The scene index is the thing actually being waited for.
            #
            # Wait for THE NEW PICTURE to arrive, not for the scene index and
            # not for the caption. sceneIndex moves before the veil closes, so
            # waiting on it looks while the outgoing scene is still on screen —
            # which reported four false failures. The caption cannot be matched
            # either (see below). The picture appearing is the event; whether
            # it is still there afterwards is the question.
            try:
                page.wait_for_function(
                    """(want) => {
                        const img = document.querySelector('.stage-plate .plate__img');
                        const src = img && img.getAttribute('src');
                        return !!src && src.split('/').pop().startsWith(want);
                    }""", arg=opens.split(".")[0], timeout=TURN_TIMEOUT_MS)
            except Exception:
                print(f"  FAIL {path.stem} scene {index}: '{opens}' never appeared at all")
                bad.append(f"{pack}/{path.stem} scene {index}: '{opens}' never "
                           f"appeared within {TURN_TIMEOUT_MS} ms of the turn")
                continue
            # ...and now the part that was broken: is it still there once the
            # outgoing scene's 650 ms clear would have fired?
            page.wait_for_timeout(LOOK_MS)
            got = page.evaluate(READ)
            want = opens
            ok = got["plate"] and got["plate"].startswith(want.split(".")[0]) \
                and got["opacity"] > 0.9
            mark = "ok  " if ok else "FAIL"
            print(f"  {mark} {path.stem} scene {index}: opens on '{opens}' "
                  f"(behind it: '{behind}') -> {got['plate']} at {got['opacity']}")
            if not ok:
                bad.append(
                    f"{pack}/{path.stem} scene {index}: '{opens}' is not on screen "
                    f"{LOOK_MS} ms into the scene — got {got['plate']} at "
                    f"opacity {got['opacity']}. The outgoing scene's fade timer "
                    f"is wiping the picture the new scene put up.")
    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("packs", nargs="*", help="default: every pack in content/")
    args = ap.parse_args()
    packs = args.packs or packs_on_disk()

    problems: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                  color_scheme="light")
        page = ctx.new_page()
        for pack in packs:
            if not (ROOT / "content" / pack / "pack.json").exists():
                continue
            print(f"\n{pack}")
            problems.extend(check_pack(page, pack))
        ctx.close()
        browser.close()

    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1
    print("\nEvery scene that opens on a picture keeps it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
