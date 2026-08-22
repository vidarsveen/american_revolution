#!/usr/bin/env python3
"""
check-all.py — every check, one command.

    python tools/check-all.py
    python tools/check-all.py american-revolution
    python tools/check-all.py --skip contrast sound

The pre-commit list in CLAUDE.md was five commands, two of which needed a
server running in another shell, and one of which had to be repeated per
chapter. That is a list people run four fifths of. So it is one command, it
finds the chapters itself, and it starts its own server for the benches that
need one.

Exit code 1 if any check fails. Each check's own output is passed through, so
a failure reads the same here as it does on its own.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
import socket
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable

# The Windows console is cp1252 and raises on an em-dash, which is a silly way
# for a check run to die. Sub-tools inherit the byte stream and are unaffected.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


class Handler(http.server.SimpleHTTPRequestHandler):
    """Same no-store rule as tools/serve.py, for the same reason: a browser
    that heuristically caches serves you the file you edited two minutes ago
    and you debug code that is not running."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, *a):
        pass


def serve() -> str:
    handler = functools.partial(Handler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}"


def chapters(packs: list[str]) -> list[str]:
    """'<pack>/<chapter>' for every narrated chapter on disk."""
    out = []
    for pack in packs:
        for path in sorted((ROOT / "content" / pack).glob("chapter-*.json")):
            out.append(f"{pack}/{path.stem}")
    return out


def packs_on_disk() -> list[str]:
    content = ROOT / "content"
    # Everything on disk, NOT content/packs.json. That file says what SHIPS;
    # this asks what exists. A pack taken out of the build is still a pack
    # that has to stay correct, and silently dropping it from the checks is
    # how it would rot.
    return sorted(p.name for p in content.iterdir()
                  if p.is_dir() and not p.name.startswith("_"))


def run(label: str, args: list[str], env=None) -> bool:
    print(f"\n\033[1m── {label}\033[0m")
    r = subprocess.run([PY, *args], cwd=ROOT, env=env)
    if r.returncode != 0:
        print(f"\033[31m   {label} FAILED (exit {r.returncode})\033[0m")
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("packs", nargs="*", help="default: every pack in content/")
    ap.add_argument("--skip", nargs="*", default=[],
                    metavar="NAME",
                    help="any of: script era data effects shell sw engine sound contrast")
    args = ap.parse_args()

    packs = args.packs or packs_on_disk()
    skip = set(args.skip)

    base = serve()
    env = {**os.environ, "LAB_BASE": base}
    print(f"serving {ROOT} at {base}")
    print(f"packs: {', '.join(packs)}")

    ok = True

    if "script" not in skip:
        for ref in chapters(packs):
            ok &= run(f"check-script {ref}", ["tools/check-script.py", ref])

    if "era" not in skip:
        ok &= run("era --selftest", ["tools/era.py", "--selftest"])

    if "data" not in skip:
        ok &= run("check-data", ["tools/check-data.py"])

    if "effects" not in skip:
        ok &= run("check-effects", ["tools/check-effects.py"])

    if "shell" not in skip:
        ok &= run("build-shell --check", ["tools/build-shell.py", "--check"])

    if "sw" not in skip:
        ok &= run("build-sw --check", ["tools/build-sw.py", "--check"])

    # The three that drive a browser. Slowest last, so a cheap failure is
    # reported before you have waited two minutes for a screenshot.
    if "engine" not in skip:
        ok &= run("check-engine", ["tools/check-engine.py"], env)

    if "sound" not in skip:
        ok &= run("check-sound", ["tools/check-sound.py"], env)

    if "contrast" not in skip:
        ok &= run("check-contrast", ["tools/check-contrast.py"], env)

    print("\n" + ("\033[1mAll checks passed.\033[0m" if ok
                  else "\033[31m\033[1mSomething failed — see above.\033[0m"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
