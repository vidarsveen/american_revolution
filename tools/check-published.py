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

The walk itself lives in tools/graph.py, because build-sw.py needs the same
one and two copies of it would drift.

Exit code 1 if anything is missing or differs.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.error
import urllib.request

from graph import collect_graph, rel_posix

DEFAULT_BASE = "https://vidarsveen.github.io/american_revolution"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    args = ap.parse_args()
    base = args.base.rstrip("/")

    files = sorted(collect_graph())
    print(f"  {len(files)} files reachable from index.html\n")

    missing, stale, ok = [], [], 0
    for path in files:
        rel = rel_posix(path)
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
