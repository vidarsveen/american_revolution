#!/usr/bin/env python3
"""
Turn a URL into a QR code you can point a phone at.

    python tools/qr.py                       # whatever is on the clipboard
    python tools/qr.py https://example.com   # or a URL you pass
    python tools/qr.py --ascii               # print it in the terminal instead

Why it exists: `/remote-control` and the dev server both hand you a long URL,
and typing one of those on a phone is miserable. Copy it, run this, point the
camera at the screen.

Writes shots/qr.png and also prints the code as text, so it works whether or
not anything can display an image.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shots", "qr.png")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


def from_clipboard() -> str:
    """Windows first, then the usual Unix helpers. Empty string if none work."""
    tries = [
        ["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
        ["pbpaste"],
        ["xclip", "-selection", "clipboard", "-o"],
        ["wl-paste"],
    ]
    for cmd in tries:
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip().splitlines()[0].strip()
    return ""


def repair(url: str) -> str:
    """Put back what a terminal copy or a fast paste took off the front.

    `ttps://claude.ai/...` is the one that actually happened — one character
    short at the start, which is what selecting a link by dragging usually
    costs. A bare `claude.ai/...` is the other. Refusing either is technically
    correct and useless: the whole point of this tool is that the URL is long
    and awkward, so it should be generous about how it arrives.
    """
    u = url.strip().strip('<>"')
    for broken, fixed in (("ttps://", "https://"), ("tps://", "https://"),
                          ("ttp://", "http://"), ("tp://", "http://")):
        if u.startswith(broken):
            return fixed + u[len(broken):]
    if u.startswith(("localhost", "127.0.0.1")) or (
            "." in u.split("/")[0] and "://" not in u):
        return "https://" + u if not u.startswith("localhost") else "http://" + u
    return u


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?", help="default: the clipboard")
    ap.add_argument("--ascii", action="store_true",
                    help="print the code in the terminal and write no file")
    args = ap.parse_args()

    url = args.url or from_clipboard()
    if not url:
        print("nothing on the clipboard and no URL given.\n"
              "  copy the link, then: python tools/qr.py", file=sys.stderr)
        return 2
    url = repair(url)
    if not url.startswith(("http://", "https://")):
        print(f"that does not look like a URL: {url[:60]!r}", file=sys.stderr)
        return 2

    try:
        import qrcode
    except ImportError:
        print("pip install qrcode", file=sys.stderr)
        return 2

    q = qrcode.QRCode(box_size=12, border=3)
    q.add_data(url)
    q.make(fit=True)

    print(url)
    if args.ascii:
        # The block characters are not in cp1252, which is what a Windows
        # console defaults to, and print_ascii() dies on it. Draw it with
        # two-space cells instead: wider, but it scans and it never throws.
        m = q.get_matrix()
        for row in m:
            print("".join("  " if cell else "██" for cell in row))
        return 0

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    q.make_image(fill_color="black", back_color="white").save(OUT)
    print(f"-> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
