#!/usr/bin/env python3
"""
build-shell.py — write the subject's name into the parts JavaScript is too late for.

    python tools/build-shell.py
    python tools/build-shell.py --check

Most of the interface asks the pack what this build is about at runtime: the
topbar, the document title, the cover. But four things are read before a line
of JavaScript runs, and a pack cannot answer in time:

    index.html   <title>, the meta description, the boot line, and the iOS
                 home-screen name — all seen during the first paint
    manifest.webmanifest   fetched by the browser, not by us

So they are generated from the FIRST pack in content/packs.json — the one the
build is about — and committed like everything else.

THIS IS NOT A BUILD STEP, for the same reason tools/build-sw.py is not: the
files stay committed and hand-readable, nothing compiles at load, and the app
works if you never run this. You get a stale title, which `--check` in the
pre-commit run is there to notice.

Only the marked regions are touched. The rest of index.html is hand-written
and stays that way.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


# What the app is called when it is not about one thing. Matches the i18n
# fallback in js/i18n.js, which is what the chooser screen shows.
NEUTRAL = "Fortell"


def shipped():
    """Every pack in the build, in order. The first one is the default."""
    listed = ROOT / "content" / "packs.json"
    if not listed.exists():
        return []
    out = []
    for pid in json.loads(listed.read_text(encoding="utf-8")):
        mf = ROOT / "content" / pid / "pack.json"
        out.append((pid, json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}))
    return out


def pick(field, lang="no"):
    if field is None:
        return ""
    if isinstance(field, str):
        return field
    return field.get(lang) or field.get("no") or field.get("en") or ""


def build(packs):
    """The four strings the browser reads before any JavaScript runs.

    With one pack they name the subject, which is what a single-subject build
    should say in a bookmark and on a home screen. With more than one they
    must NOT: the page that loads is the chooser, and calling it Romerriket
    when it is about to offer you two subjects is a lie told in the tab
    title, where nobody thinks to look for one.
    """
    if len(packs) == 1:
        m = packs[0][1]
        work = pick(m.get("work"))
        years = pick(m.get("years"))
        return {
            "title": f"{work} {years}".strip(),
            "work": work,
            "short": pick(m.get("shortName")) or work,
            "desc": pick(m.get("description")) or work,
        }
    works = [pick(m.get("work")) for _, m in packs if pick(m.get("work"))]
    return {
        "title": NEUTRAL,
        "work": NEUTRAL,
        "short": NEUTRAL,
        "desc": " · ".join(works) if works else NEUTRAL,
    }


def splice(src: str, tag: str, value: str, pattern: str) -> str:
    """Replace one generated field, leaving everything around it alone."""
    out, n = re.subn(pattern, value, src, count=1)
    if not n:
        print(f"  ! could not find {tag} — left alone", file=sys.stderr)
    return out


def render_index(src: str, v: dict) -> str:
    src = splice(src, "<title>", f"<title>{v['title']}</title>",
                 r"<title>.*?</title>")
    src = splice(src, "description",
                 f'<meta name="description" content="{v["desc"]}">',
                 r'<meta name="description" content="[^"]*">')
    src = splice(src, "apple title",
                 f'<meta name="apple-mobile-web-app-title" content="{v["short"]}">',
                 r'<meta name="apple-mobile-web-app-title" content="[^"]*">')
    src = splice(src, "boot mark",
                 f'<div class="boot__mark">{v["work"]}</div>',
                 r'<div class="boot__mark">.*?</div>')
    return src


def render_manifest(src: str, v: dict) -> str:
    data = json.loads(src)
    data["name"] = v["title"]
    data["short_name"] = v["short"]
    data["description"] = v["desc"]
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    packs = shipped()
    if not packs:
        print("no packs in content/packs.json", file=sys.stderr)
        return 2
    v = build(packs)

    # What EXISTS, for the benches under dev/.
    #
    # content/packs.json says what ships. dev/engine-lab.html has to sweep
    # every pack on disk, or a pack taken out of the build silently stops
    # being checked against rule 1 — which is the one check nothing else
    # covers. A browser page cannot list a directory, so the directory is
    # written down for it.
    all_packs = sorted(p.name for p in (ROOT / "content").iterdir()
                       if p.is_dir() and not p.name.startswith("_"))

    def render_dev(_src, _v):
        return json.dumps(all_packs, indent=1) + "\n"

    targets = [
        (ROOT / "index.html", render_index),
        (ROOT / "manifest.webmanifest", render_manifest),
        (ROOT / "content" / "packs.dev.json", render_dev),
    ]
    stale = []
    for path, render in targets:
        src = path.read_text(encoding="utf-8") if path.exists() else ""
        out = render(src, v)
        if out.replace("\r\n", "\n") == src.replace("\r\n", "\n"):
            continue
        stale.append(path.name)
        if not args.check:
            path.write_text(out, encoding="utf-8", newline="\n")

    label = f"{', '.join(p for p, _ in packs)}: {v['title']}"
    if args.check:
        if stale:
            print(f"shell is OUT OF DATE ({', '.join(stale)}) — "
                  f"run tools/build-shell.py\n  would be: {label}", file=sys.stderr)
            return 1
        print(f"shell is up to date — {label}")
        return 0

    print(f"shell {'rewritten' if stale else 'unchanged'} — {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
