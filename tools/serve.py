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

It answers Range requests, which `http.server` does not. Without them a media
element streams the whole file, reports `seekable` as an empty range, and
silently refuses to seek — so dragging the scrubber does nothing and the
playhead sits at the start. That is a real production bug you cannot reproduce
on a server that hands back the whole file every time.
"""
from __future__ import annotations

import argparse
import http.server
import os
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

    def send_head(self):
        """
        Serve a byte range when one is asked for.

        SimpleHTTPRequestHandler ignores Range entirely and always answers 200
        with the whole file. A browser will happily play that, and then mark
        the media unseekable, because it has no way to fetch from the middle.
        """
        rng = self.headers.get("Range")
        if not rng or not rng.startswith("bytes="):
            return super().send_head()

        path = self.translate_path(self.path)
        try:
            f = open(path, "rb")
        except OSError:
            return super().send_head()

        try:
            size = os.fstat(f.fileno()).st_size
            first, _, last = rng[6:].partition("-")
            try:
                start = int(first) if first else max(0, size - int(last))
                end = int(last) if (last and first) else size - 1
            except ValueError:
                f.close()
                return super().send_head()
            end = min(end, size - 1)
            if start > end or start >= size:
                f.close()
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None

            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            f.seek(start)
            self.wfile.write(f.read(end - start + 1))
            f.close()
            return None
        except Exception:
            f.close()
            raise

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
