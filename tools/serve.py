#!/usr/bin/env python3
"""
serve.py — the dev server, with the caching trap removed.

`python -m http.server` sends Last-Modified and no Cache-Control. Browsers
then apply *heuristic* freshness: with no explicit lifetime they invent one,
commonly a fraction of the file's age. So you edit a module, reload, and get
the previous version back — silently, with no error and nothing in the
console — and spend the next twenty minutes debugging code that is not
running. This has already cost an afternoon on this project once.

Everything here is served no-store. It is a development server; there is
nothing to gain from caching and a great deal to lose.

    python tools/serve.py            # http://localhost:8000
    python tools/serve.py --port 8080

It also binds every interface and prints the LAN address, because this app is
mobile-first and most of its bugs only show up on an actual phone.
"""
from __future__ import annotations

import argparse
import http.server
import socket
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXTRA_TYPES = {
    ".geojson": "application/geo+json",
    ".webmanifest": "application/manifest+json",
    ".mjs": "text/javascript",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        # The whole point of this file.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        for ext, mime in EXTRA_TYPES.items():
            if str(path).endswith(ext):
                return mime
        return super().guess_type(path)

    def log_message(self, fmt, *args):
        # Only complain about failures; a wall of 200s hides the 404 that matters.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            print(f"  {status}  {args[0]}")


def lan_address() -> str | None:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))          # no packets sent; just picks a route
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", args.port), Handler) as httpd:
        print(f"\n  serving {ROOT.name} with caching off\n")
        print(f"    http://localhost:{args.port}/")
        ip = lan_address()
        if ip:
            print(f"    http://{ip}:{args.port}/            <- on your phone, same wifi")
        print(f"    http://localhost:{args.port}/dev/map-lab.html")
        print(f"    http://localhost:{args.port}/dev/sound-lab.html\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  stopped\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
