#!/usr/bin/env python3
"""
build-sw.py — write the service worker's PRECACHE list from the real graph.

    python tools/build-sw.py            # rewrite the generated block in sw.js
    python tools/build-sw.py --check    # exit 1 if sw.js is out of date
    python tools/build-sw.py --print    # show the block, write nothing

Why this exists: PRECACHE was a hand-maintained array of fifty relative paths,
installed with Promise.allSettled so that one wrong entry does not sink the
install. That combination means a file you forgot to list works perfectly
online and 404s offline, silently, and a VERSION you forgot to bump serves the
old cache to everyone who already has one. Both halves of that hazard are
bookkeeping, and bookkeeping is what a tool is for.

THIS IS NOT A BUILD STEP. sw.js stays a committed, hand-readable artifact;
nothing is compiled at load; the app works exactly as before if you never run
this. Forget to run it and you get the status quo — a stale precache — which
is why --check exists and belongs in the pre-commit run. Only the block
between the generated markers is touched: the fetch strategy below it is
subtle, correct, hand-written, and must not be regenerated.

VERSION is a hash of the precached files' contents, so it changes exactly when
the cache would serve something different, and never otherwise.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from pathlib import Path

from graph import ROOT, collect_graph, rel_posix

SW = Path(ROOT) / "sw.js"
BEGIN = "/* BEGIN GENERATED — tools/build-sw.py */"
END = "/* END GENERATED */"

# Files the app really loads but no walk of the source can see, because the
# path is computed at runtime. Each one needs a reason, and the reason is the
# test of whether it belongs here at all.
SW_EXTRA: list[tuple[str, str]] = [
    ("./", "the navigation fallback — a cold offline launch asks for the root"),
    ("./manifest.webmanifest", "linked from index.html by rel=manifest, not by a script or style tag"),
    ("./engine/verbs.json", "fetched by checkVerbManifest() through a default argument"),
    ("./assets/geo/world-110m.json",
     "the coarse world level only — first paint needs it. The 50m, 10m and pack-detail\n"
     "  // levels are megabytes and are fetched when the camera asks for them; networkFirst\n"
     "  // caches each one the first time it is used."),
    ("./assets/fonts/fraunces-latin.woff2", "referenced from css/fonts.css by url(), which is not walked"),
]

# Runtime data inside a pack. Deliberately narrow: everything here is small,
# needed on a first offline launch, and fetched by a path built at runtime.
PACK_ROOT_JSON = {"events.json", "people.json", "chapters.json", "media.json", "sound.json"}
PACK_ROOT_GLOBS = ("chapter-*.json", "timing.*.json")

# Not precached, on purpose:
#   audio/**          ~7.6 MB across two languages. Scene files are cached by
#                     the fetch handler the first time they are played, so
#                     anything you have listened to works offline afterwards.
#   geo/detail.json   megabytes of close-in coastline, fetched above zoom 9.5.
#   sound/*.wav       recorded effects, fetched on demand; the synthesised
#                     catalogue in sound/library.js needs no files at all.
#   *-sources.json    build inputs for fetch-media.py and gen-sound.py, never
#                     read by the app.
PACK_SKIP_DIRS = {"audio", "sound"}
PACK_SKIP_FILES = {"detail.json"}

# Not shipped: packs.dev.json lists what EXISTS for the benches under
# dev/, which is a different question from what this build is about.
ROOT_SKIP = {"packs.dev.json"}


def packs() -> list[str]:
    """Every pack under content/. content/packs.json wins once it exists."""
    content = Path(ROOT) / "content"
    if not content.is_dir():
        return []
    listed = content / "packs.json"
    if listed.exists():
        import json
        return list(json.loads(listed.read_text(encoding="utf-8")))
    return sorted(p.name for p in content.iterdir()
                  if p.is_dir() and not p.name.startswith("_"))


def pack_files(pack: str) -> list[str]:
    """The runtime files of one pack, as './content/<pack>/…' paths."""
    base = Path(ROOT) / "content" / pack
    if not base.is_dir():
        return []
    out: set[Path] = set()

    for name in PACK_ROOT_JSON:
        p = base / name
        if p.exists():
            out.add(p)
    for pattern in PACK_ROOT_GLOBS:
        out.update(p for p in base.glob(pattern) if p.is_file())

    for sub in ("geo", "media"):
        d = base / sub
        if not d.is_dir():
            continue
        for p in sorted(d.iterdir()):
            if p.is_file() and p.name not in PACK_SKIP_FILES:
                out.add(p)

    return ["./" + rel_posix(p) for p in sorted(out)]


def precache() -> list[str]:
    """Everything to install up front, deduplicated, in a stable order."""
    seen = {"./" + rel_posix(p) for p in collect_graph()}
    for url, _ in SW_EXTRA:
        seen.add(url)
    for pack in packs():
        seen.update(pack_files(pack))
    # sw.js must not cache itself: the browser fetches it fresh, and a cached
    # copy is how a service worker becomes impossible to update.
    seen.discard("./sw.js")
    for name in ROOT_SKIP:
        seen.discard(f"./content/{name}")
    return sorted(seen)


def version_for(urls: list[str]) -> str:
    """A hash of what is in the cache, so it moves only when the cache would."""
    h = hashlib.sha256()
    for url in urls:
        if url == "./":
            continue
        path = Path(ROOT) / url[2:]
        h.update(url.encode("utf-8"))
        h.update(b"\0")
        try:
            # Normalise line endings so a checkout with CRLF does not produce
            # a different VERSION from the same commit on another machine.
            h.update(hashlib.sha256(
                path.read_bytes().replace(b"\r\n", b"\n")).digest())
        except OSError:
            h.update(b"missing")
    return "v" + h.hexdigest()[:10]


def render(urls: list[str]) -> str:
    extra = {url: why for url, why in SW_EXTRA}
    lines = [
        BEGIN,
        "// Written by tools/build-sw.py from the files index.html actually reaches,",
        "// plus each pack's runtime data. Do not edit by hand — run the tool.",
        f"const VERSION = '{version_for(urls)}';",
        "const APP_CACHE = `fortell-app-${VERSION}`;",
        "const TILE_CACHE = `fortell-tiles-${VERSION}`;",
        "const TILE_LIMIT = 400;",
        "",
        "// Deliberately no audio here. The narration is ~7.6 MB across two languages,",
        "// and pulling that down on a first visit over mobile data to cache a chapter",
        "// you may not play is the wrong trade. Scene files are cached by the fetch",
        "// handler the first time they are played, so anything you have listened to",
        "// works offline afterwards.",
        "const PRECACHE = [",
    ]
    for url in urls:
        why = extra.get(url)
        if why:
            lines.append(f"  // {why}")
        lines.append(f"  '{url}',")
    lines.append("];")
    lines.append(END)
    return "\n".join(lines)


def splice(src: str, block: str) -> str:
    """Put the block into sw.js, adding the markers the first time."""
    if BEGIN in src and END in src:
        head, rest = src.split(BEGIN, 1)
        _, tail = rest.split(END, 1)
        return head + block + tail

    # First run: swallow the hand-written VERSION/cache constants and the
    # PRECACHE array, wherever they currently sit.
    m = re.search(r"^const VERSION = .*?^\];\s*$", src, re.S | re.M)
    if not m:
        raise SystemExit("could not find the VERSION…PRECACHE block in sw.js — "
                         "add the markers by hand and re-run")
    return src[:m.start()] + block + src[m.end():]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if sw.js does not match what would be written")
    ap.add_argument("--print", dest="show", action="store_true",
                    help="print the generated block and write nothing")
    args = ap.parse_args()

    urls = precache()
    block = render(urls)

    if args.show:
        print(block)
        return 0

    src = SW.read_text(encoding="utf-8")
    out = splice(src, block)

    n_pack = sum(1 for u in urls if u.startswith("./content/"))
    summary = (f"{len(urls)} files precached "
               f"({len(urls) - n_pack} app, {n_pack} pack), "
               f"VERSION {version_for(urls)}")

    if args.check:
        if out.replace("\r\n", "\n") == src.replace("\r\n", "\n"):
            print(f"sw.js is up to date — {summary}")
            return 0
        print(f"sw.js is OUT OF DATE — run tools/build-sw.py\n  would be: {summary}",
              file=sys.stderr)
        return 1

    if out.replace("\r\n", "\n") != src.replace("\r\n", "\n"):
        SW.write_text(out, encoding="utf-8", newline="\n")
        print(f"sw.js rewritten — {summary}")
    else:
        print(f"sw.js unchanged — {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
