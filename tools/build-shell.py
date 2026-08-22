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


def default_pack():
    listed = ROOT / "content" / "packs.json"
    if not listed.exists():
        return None, {}
    ids = json.loads(listed.read_text(encoding="utf-8"))
    if not ids:
        return None, {}
    mf = ROOT / "content" / ids[0] / "pack.json"
    return ids[0], (json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {})


def pick(field, lang="no"):
    if field is None:
        return ""
    if isinstance(field, str):
        return field
    return field.get(lang) or field.get("no") or field.get("en") or ""


def build(manifest):
    work = pick(manifest.get("work"))
    years = pick(manifest.get("years"))
    short = pick(manifest.get("shortName")) or work
    desc = pick(manifest.get("description")) or work
    return {
        "title": f"{work} {years}".strip(),
        "work": work,
        "short": short,
        "desc": desc,
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

    pack, manifest = default_pack()
    if not pack:
        print("no packs in content/packs.json", file=sys.stderr)
        return 2
    v = build(manifest)

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

    label = f"{pack}: {v['title']}"
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
