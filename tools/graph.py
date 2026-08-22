#!/usr/bin/env python3
"""
graph.py — what the app actually loads, followed transitively.

Walking index.html rather than listing files by hand is the whole point: the
list is then derived from the code, so it cannot drift from it. Two tools need
the same walk and used to be one tool.

    check-published.py   fetches each file from the live site and compares
    build-sw.py          writes the service worker's PRECACHE from it

The walk is deliberately literal. It follows `<link href="./…css">`,
`<script src="./…js">`, static `import`/`export … from './…js'`, and
`fetch('./…')` with a literal path — and nothing computed. A path built at
runtime out of a variable cannot be found by reading the source, so anything
fetched that way has to be declared by the pack manifest instead. That is not a
limitation to work around; it is why pack.json lists its own files.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CSS_LINK = re.compile(r'<link[^>]+href="\./([^"]+\.css)"')
SCRIPT_SRC = re.compile(r'<script[^>]+src="\./([^"]+\.js)"')

# `import { a, b } from './x.js'` — and the named list may wrap over several
# lines, which is the whole reason this is not a one-line pattern. It used to
# be `[^'"\n]*?`, so an import whose braces spanned a newline was invisible:
# map/basemap.js, map/artifacts.js and core/theme.js were reachable from the
# app, never in this graph, and therefore never once compared against the live
# site by check-published.py. Excluding `;` is what stops the match running on
# into the next statement.
IMPORT_FROM = re.compile(
    r"""(?:^|\n)\s*(?:import|export)\b[^'";]*?from\s*['"](\.[^'"]+\.js)['"]""")
# `import './x.js'` for side effects only — no clause, no `from`.
IMPORT_BARE = re.compile(r"""(?:^|\n)\s*import\s*['"](\.[^'"]+\.js)['"]""")
# Runtime data the app fetches by literal path.
FETCH = re.compile(r"""fetch\(\s*['"`](\.[^'"`]+)['"`]""")


def resolve_rel(base: Path, rel: str) -> Path | None:
    """A relative href/import from `base`, or None if it escapes the repo."""
    p = (base.parent / rel).resolve()
    try:
        p.relative_to(ROOT)
    except ValueError:
        return None
    return p


def collect_graph(root: Path = ROOT) -> set[Path]:
    """Everything index.html pulls in, followed transitively."""
    index = root / "index.html"
    html = index.read_text(encoding="utf-8")

    seen: set[Path] = {index}
    queue: list[Path] = []

    for rel in CSS_LINK.findall(html) + SCRIPT_SRC.findall(html):
        p = resolve_rel(index, "./" + rel)
        if p and p.exists():
            seen.add(p)
            if p.suffix == ".js":
                queue.append(p)

    # sw.js is fetched by the registration, not by a tag.
    sw = root / "sw.js"
    if sw.exists():
        seen.add(sw)

    while queue:
        cur = queue.pop()
        try:
            src = cur.read_text(encoding="utf-8")
        except OSError:
            continue
        for rel in IMPORT_FROM.findall(src) + IMPORT_BARE.findall(src):
            p = resolve_rel(cur, rel)
            if p and p.exists() and p not in seen:
                seen.add(p)
                queue.append(p)
        for rel in FETCH.findall(src):
            p = resolve_rel(cur, rel)
            if p and p.exists():
                seen.add(p)

    return seen


def rel_posix(path: Path, root: Path = ROOT) -> str:
    """Repo-relative, forward slashes — the form every consumer wants."""
    return path.relative_to(root).as_posix()
