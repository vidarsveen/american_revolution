#!/usr/bin/env python3
"""
check-published.py — is what GitHub Pages serves the same as what is committed?

"I pushed" and "the site is updated" are different claims. Pages builds
asynchronously, a stale service worker can hide a deploy, and a file that was
never committed 404s in production while working perfectly on localhost. This
walks the app's real dependency graph — index.html, its stylesheets, and the
ES module imports followed transitively — then fetches each file from the
live site and compares its hash against the working tree.

    python tools/check-published.py
    python tools/check-published.py --base https://example.github.io/repo

Exit code 1 if anything is missing or differs.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BASE = "https://vidarsveen.github.io/american_revolution"

CSS_LINK = re.compile(r'<link[^>]+href="\./([^"]+\.css)"')
SCRIPT_SRC = re.compile(r'<script[^>]+src="\./([^"]+\.js)"')
IMPORT = re.compile(r"""(?:^|\n)\s*(?:import|export)[^'"\n]*?['"](\.[^'"]+\.js)['"]""")
# Runtime data the app fetches by literal path.
FETCH = re.compile(r"""fetch\(\s*['"`](\.[^'"`]+)['"`]""")


def norm(base: Path, rel: str) -> Path | None:
    p = (base.parent / rel).resolve()
    try:
        p.relative_to(ROOT)
    except ValueError:
        return None
    return p


def collect() -> set[Path]:
    """Everything index.html pulls in, followed transitively."""
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")

    seen: set[Path] = {index}
    queue: list[Path] = []

    for rel in CSS_LINK.findall(html) + SCRIPT_SRC.findall(html):
        p = norm(index, "./" + rel)
        if p and p.exists():
            seen.add(p)
            if p.suffix == ".js":
                queue.append(p)

    # sw.js is fetched by the registration, not by a tag.
    sw = ROOT / "sw.js"
    if sw.exists():
        seen.add(sw)

    while queue:
        cur = queue.pop()
        try:
            src = cur.read_text(encoding="utf-8")
        except OSError:
            continue
        for rel in IMPORT.findall(src):
            p = norm(cur, rel)
            if p and p.exists() and p not in seen:
                seen.add(p)
                queue.append(p)
        for rel in FETCH.findall(src):
            p = norm(cur, rel)
            if p and p.exists():
                seen.add(p)

    return seen


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    args = ap.parse_args()
    base = args.base.rstrip("/")

    files = sorted(collect())
    print(f"  {len(files)} files reachable from index.html\n")

    missing, stale, ok = [], [], 0
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        local = path.read_bytes()
        try:
            req = urllib.request.Request(f"{base}/{rel}",
                                         headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=30) as r:
                live = r.read()
        except urllib.error.HTTPError as e:
            missing.append((rel, f"HTTP {e.code}"))
            continue
        except Exception as e:                      # noqa: BLE001
            missing.append((rel, str(e)))
            continue

        # Pages normalises line endings on text; compare on normalised bytes.
        if local.replace(b"\r\n", b"\n") == live.replace(b"\r\n", b"\n"):
            ok += 1
        else:
            stale.append((rel, sha(local), sha(live)))

    print(f"  identical : {ok}")
    if stale:
        print(f"  DIFFERENT : {len(stale)}")
        for rel, a, b in stale:
            print(f"    ! {rel}\n        local {a}  live {b}")
    if missing:
        print(f"  MISSING   : {len(missing)}")
        for rel, why in missing:
            print(f"    ! {rel}  ({why})")

    if not stale and not missing:
        print("\n  The published site matches the working tree.")
        return 0
    print("\n  Pages may still be building — it lags a push by a minute or two.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
