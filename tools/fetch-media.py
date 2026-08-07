#!/usr/bin/env python3
"""
Fetch period images from Wikimedia Commons and record where they came from.

    python tools/fetch-media.py american-revolution

Reads a `media` block from the pack's media-sources.json, downloads each file,
downscales it, and writes content/<pack>/media.json with the artist, date,
source URL and licence for every image, so the app can credit them properly.

Only public-domain works are wanted here. The script prints the licence it
found for each file — if something is not PD, that is a decision to make, not
something to paper over.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "AmericanRevolutionTimeline/1.0 (personal learning project; vidarsveen@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"
MAX_W = 1200


def api(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def plain(html):
    """Commons metadata comes back as HTML fragments."""
    import re
    text = re.sub(r"<[^>]+>", " ", str(html or ""))
    text = text.replace("&amp;", "&").replace("&nbsp;", " ").replace("&#160;", " ")
    return " ".join(text.split())


def fetch_one(title):
    """Returns (bytes, meta) for a Commons File: title."""
    data = api({
        "action": "query", "titles": title, "prop": "imageinfo",
        "iiprop": "url|extmetadata|size", "iiurlwidth": MAX_W,
    })
    pages = data.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]:
        return None, {"error": f"not found: {title}"}
    info = pages[0]["imageinfo"][0]
    ext = info.get("extmetadata", {})

    src = info.get("thumburl") or info.get("url")
    req = urllib.request.Request(src, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()

    return raw, {
        "artist": plain(ext.get("Artist", {}).get("value")),
        "year": plain(ext.get("DateTimeOriginal", {}).get("value")),
        "licence": plain(ext.get("LicenseShortName", {}).get("value")) or "unknown",
        "credit": plain(ext.get("Credit", {}).get("value"))[:160],
        "source": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title)}",
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    pack = sys.argv[1]
    pack_dir = os.path.join(ROOT, "content", pack)
    src_path = os.path.join(pack_dir, "media-sources.json")
    if not os.path.exists(src_path):
        print(f"error: no {src_path}", file=sys.stderr)
        return 2

    with open(src_path, encoding="utf-8") as fh:
        sources = json.load(fh)

    out_dir = os.path.join(pack_dir, "media")
    os.makedirs(out_dir, exist_ok=True)
    media = {}
    failed = []

    for mid, spec in sources.items():
        title = spec["commons"]
        fname = f"{mid}.jpg"
        dest = os.path.join(out_dir, fname)
        try:
            time.sleep(1.2)
            raw, meta = fetch_one(title)
            if raw is None:
                failed.append((mid, meta.get("error")))
                print(f"  {mid:16} FAILED  {meta.get('error')}")
                continue

            im = Image.open(io.BytesIO(raw))
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            im.thumbnail((MAX_W, MAX_W), Image.LANCZOS)
            im.convert("RGB").save(dest, "JPEG", quality=84, optimize=True, progressive=True)

            media[mid] = {
                "file": fname,
                "title": spec.get("title", {}),
                "year": spec.get("year") or meta["year"],
                "artist": spec.get("artist") or meta["artist"],
                "licence": meta["licence"],
                "source": meta["source"],
            }
            kb = os.path.getsize(dest) // 1024
            print(f"  {mid:16} ok  {im.size[0]}x{im.size[1]}  {kb:4} KB  [{meta['licence']}]")
            if "public domain" not in meta["licence"].lower() and "pd" not in meta["licence"].lower():
                print(f"  {'':16}     ! licence is not obviously public domain — check before shipping")
        except Exception as e:
            failed.append((mid, repr(e)[:90]))
            print(f"  {mid:16} FAILED  {repr(e)[:90]}")

    out = os.path.join(pack_dir, "media.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(media, fh, ensure_ascii=False, indent=2)
    print(f"\n{len(media)} images -> {os.path.relpath(out, ROOT)}")
    if failed:
        print(f"{len(failed)} failed:")
        for mid, why in failed:
            print(f"  - {mid}: {why}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
