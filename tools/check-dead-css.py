#!/usr/bin/env python3
"""
check-dead-css.py — a class nobody paints is not a rule, it is a comment.

    python tools/check-dead-css.py
    python tools/check-dead-css.py --list     # every class and where it is written

Why this exists, in one sentence: `docs/design-direction.md`'s "no infinite
animation" rule was applied to `.story-ring` in css/story.css, and nothing has
ever rendered `.story-ring` — the story stage draws the `.atlas-*` classes
that map/index.js writes, so the ring on screen went on pulsing for ever from
`.atlas-ring` in css/atlas.css. The fix was real, the file was real, the
selector was dead, and every reading of the stylesheet said the rule was
enforced.

That is the `.ov-fact` lesson in a third shape (BACKLOG.md): a probe that
reads a class name is not a visibility check, and a rule written against a
selector nobody writes is not a rule. So the question this asks is deliberately
narrow and mechanical — for every class selector in css/, does ANY module,
page or tool ever put that class on an element?

It is tuned to be TOLERANT, on purpose. A false positive here sends somebody
to delete live CSS, which is a real bug introduced by a checker; a false
negative leaves one dead selector in place, which is where we already are. So
a class counts as painted if its name appears anywhere in the source at all —
in a className, a classList call, a template literal, an HTML attribute, a
Python tool that writes a page, or even a comment. Three further allowances
are made, each for a shape that genuinely cannot be found literally:

  · **composed at runtime** — `atlas-place atlas-place--${s.kind}`
    (map/index.js:503) never writes the string "atlas-place--town". Any class
    whose name starts with a prefix the source interpolates onto counts.
  · **composed by concatenation** — the same thing written with `+`.
  · **the state vocabulary** — `is-on`, `is-instant`, `is-lifting` and their
    kin are toggled by name and always appear literally, so they need no
    exception; what does is a stylesheet-only modifier hung off one
    (`.card.is-on .card__body`), which the prefix rule above already covers.

Exits non-zero when something in css/ matches nothing anybody writes.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Where the stylesheets are.
CSS_DIR = ROOT / "css"

# Everything that can put a class on an element: the app, the Explore mode,
# and the benches under dev/ — a lab is a real page and its classes are real.
#
# tools/ is deliberately NOT here, and the reason is the whole point of this
# file. A tool does not render the app; it drives it or measures it, and a
# check that QUERIES a selector is exactly the defect being hunted.
# tools/check-turn.py:66 counts `.story-mk, .story-ring, .atlas-place,
# .story-place` — three of those four have never been drawn by anything, so
# the probe has been measuring one class and reporting on four. Let tools/
# into the corpus and that probe would vouch for the very selectors it is
# failing to find, and so would this file's own docstring.
SOURCE_GLOBS = (
    "*.html", "*.js",
    "js/**/*.js", "engine/**/*.js", "core/**/*.js", "map/**/*.js",
    "sound/**/*.js", "dev/**/*.js", "dev/**/*.html",
)

# Selector text only — everything before a `{`. Declarations are never
# scanned, so `content: ".foo"` and `background: url(a.b.png)` cannot invent
# a class, and neither can a decimal.
CLASS_IN_SELECTOR = re.compile(r"\.(-?[A-Za-z_][\w-]*)")

# `foo-${…}` and `foo-' + …` — a class name being built rather than written.
INTERPOLATED = re.compile(r"([A-Za-z_][\w-]*)\$\{")
CONCATENATED = re.compile(r"['\"`]([A-Za-z_][\w-]*)['\"`]\s*\+")


# ---------------------------------------------------------------- the ratchet
#
# What was already dead the day this check was written. Every one of these was
# read and confirmed by hand — none is a false positive — but twelve of them
# sit in css/map.css and css/sheet.css, which Phase 1 freezes, and a check
# that goes red on arrival is a check somebody turns off.
#
# So it is a RATCHET, not an amnesty: a dead selector that is not on this list
# fails the build, and an entry here that no longer exists is reported so the
# list can only get shorter. The intent is that this ends up empty.
#
# The pattern in almost all of them is one thing: a stylesheet outliving the
# renderer it was written for. css/map.css still styles Leaflet panes and SVG
# route paths from before Explore moved onto the shared map module, and
# story.css styled `.stage-map__mood/__time/__flash` for years after the map
# began drawing its own `.atlas__mood/__time/__flash`. That is the
# `.story-ring` defect with a different prefix, and it is why "which selector
# is actually painted" needs a tool rather than a reading.
#
# The dead copies had DRIFTED from the live ones, which is the part that makes
# this more than tidying: night sat at .30 in one and .34 in the other, the
# muzzle flash ran 700ms against 620ms, the clock was var(--fs-xs) against a
# literal 14px. Each of those is a decision someone made twice and could only
# ever see the effect of once.
BASELINE = {
    # css/map.css — Explore's Leaflet era. Frozen in Phase 1; delete with it.
    "basemap-backdrop": "Leaflet pane styling; Explore draws its own ground now",
    "basemap-relief": "Leaflet pane styling; Explore draws its own ground now",
    "colonies-shape": "SVG colony overlay, replaced by map/regions.js",
    "map-grain": "Leaflet pane filter",
    "map-wash": "Leaflet pane filter",
    "route--naval": "SVG route styling, replaced by map/artifacts.js",
    "route-path": "SVG route styling, replaced by map/artifacts.js",
    "story-z-near": "a Leaflet z-index pane",
    "theatre-glow": "an SVG glow filter, replaced by drawGlow()",
    # css/sheet.css, css/base.css — frozen with Explore.
    "btn--ghost": "the transport's ghost button is .tp-btn--ghost, in css/shell.css",
    "sheet__hr": "no rule ever rendered",
    # css/story.css had four more — .ov-portrait__none and
    # .stage-map__mood/__flash/__time — and they are gone, along with the
    # .story-mk/.story-place/.story-ring block that started all this. Every
    # remaining entry is in a file frozen with Explore.
}


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", " ", css, flags=re.S)


def selectors(css: str):
    """Every selector prelude in a stylesheet, as text.

    Split on braces rather than parsing: a rule's selector is whatever sits
    between the previous `}` (or `{`, inside an at-rule) and the next `{`.
    An at-rule prelude (`@media (min-width: 40em)`) comes through too and
    contains no classes, which is why this can afford to be crude.
    """
    depth = 0
    buf = []
    for ch in css:
        if ch == "{":
            yield "".join(buf)
            buf = []
            depth += 1
        elif ch == "}":
            buf = []
            depth = max(0, depth - 1)
        else:
            buf.append(ch)


def css_classes() -> dict[str, set[str]]:
    """{class name: {file:line, …}} for every class selector under css/."""
    out: dict[str, set[str]] = {}
    for path in sorted(CSS_DIR.glob("*.css")):
        raw = path.read_text(encoding="utf-8")
        clean = strip_comments(raw)
        # Line numbers come from the raw text, so a report points at the file
        # as it is on disk. Find each name's first occurrence in a selector.
        lines = raw.splitlines()
        for sel in selectors(clean):
            for name in CLASS_IN_SELECTOR.findall(sel):
                where = out.setdefault(name, set())
                if len(where) < 4:
                    for i, line in enumerate(lines, 1):
                        if "." + name in line and "{" in line or (
                                "." + name in line and line.strip().endswith(",")):
                            where.add(f"{path.name}:{i}")
                            break
                    else:
                        where.add(path.name)
    return out


def source_text() -> str:
    seen = set()
    parts = []
    for pattern in SOURCE_GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file() or path in seen:
                continue
            seen.add(path)
            try:
                parts.append(path.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError):
                pass
    return "\n".join(parts)


def painted(names, text: str) -> dict[str, str]:
    """{class: why it counts as painted} for the ones something writes."""
    prefixes = set(INTERPOLATED.findall(text)) | set(CONCATENATED.findall(text))
    # Longest first, so a report names the most specific prefix that matched.
    ordered = sorted(prefixes, key=len, reverse=True)

    # One pass over the corpus per class would be O(classes x megabytes). Take
    # every identifier-ish token out of the source once instead, and ask a set.
    tokens = set(re.findall(r"[A-Za-z_][\w-]*", text))

    out = {}
    for name in names:
        if name in tokens:
            out[name] = "written literally"
            continue
        for p in ordered:
            if name.startswith(p):
                out[name] = f"composed from '{p}${{…}}'"
                break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true",
                    help="print every class and why it counts as painted")
    args = ap.parse_args()

    classes = css_classes()
    text = source_text()
    alive = painted(classes, text)
    dead = sorted(n for n in classes if n not in alive)

    if args.list:
        for name in sorted(classes):
            print(f"  {name:<34} {alive.get(name, 'NOTHING WRITES IT')}")

    known = [n for n in dead if n in BASELINE]
    new = [n for n in dead if n not in BASELINE]
    gone = sorted(n for n in BASELINE if n not in dead)

    print(f"{len(classes)} class selectors in css/, {len(alive)} painted, "
          f"{len(dead)} dead ({len(known)} known, {len(new)} new)")

    if known:
        print(f"\nknown dead, still there ({len(known)}) — the list is a ratchet, "
              f"it should end up empty:")
        for name in known:
            print(f"  - .{name} ({', '.join(sorted(classes[name]))}) — {BASELINE[name]}")
    if gone:
        print(f"\ngone ({len(gone)}) — delete these from BASELINE in "
              f"tools/check-dead-css.py:")
        for name in gone:
            print(f"  - .{name}")

    if new:
        print(f"\nPROBLEMS ({len(new)}):")
        for name in new:
            where = ", ".join(sorted(classes[name]))
            print(f"  FAIL: .{name} ({where}) — nothing in the app or the labs "
                  f"ever puts this class on an element. A rule written against "
                  f"it is not enforced anywhere, and reading the stylesheet "
                  f"will say it is.")
        return 1

    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
