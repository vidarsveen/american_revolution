#!/usr/bin/env python3
"""
Check the content files before publishing.

Catches the things that are easy to get wrong when editing history by hand:
a missing translation, a person id that does not exist, coordinates in the
wrong hemisphere, an event that falls between two chapters, a portrait file
that was never downloaded.

    python tools/check-data.py                     # every pack
    python tools/check-data.py american-revolution

The sides a pack recognises, the box its coordinates should fall in and where
its portraits live all come from content/<pack>/pack.json, so a second subject
does not mean a second copy of this file.

Exits non-zero if anything is actually broken. Notes are advisory.
"""

import json
import os
import re
import sys

from era import parse_date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ("no", "en")
# Dates go through tools/era.py, the twin of core/era.js, so a checker and
# the app agree about what "-0044" means (44 BC) and about there being no
# year zero. A regex alone would accept 1775-13-45.
DATE_RE = re.compile(r"-?\d{4}(-\d{2}(-\d{2})?)?$")

PACK = "american-revolution"      # set per pack in main()
MANIFEST: dict = {}

problems: list[str] = []
notes: list[str] = []


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return json.load(fh)


def pack_load(name, default=None):
    """A file inside the pack being checked."""
    path = os.path.join(ROOT, "content", PACK, name)
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def packs_on_disk():
    # Everything on disk, NOT content/packs.json — that file says what ships,
    # and a pack out of the build still has to stay correct.
    base = os.path.join(ROOT, "content")
    return sorted(d for d in os.listdir(base)
                  if os.path.isdir(os.path.join(base, d)) and not d.startswith("_"))


def bilingual(obj, field, where, minlen=1):
    """Every user-facing string must exist in both languages."""
    value = obj.get(field)
    if not isinstance(value, dict):
        problems.append(f"{where}: {field} is missing or not a {{no, en}} pair")
        return
    for lang in LANGS:
        text = (value.get(lang) or "").strip()
        if not text:
            problems.append(f"{where}: {field}.{lang} is empty")
        elif len(text) < minlen:
            problems.append(f"{where}: {field}.{lang} looks too short ({len(text)} chars)")


def sides():
    """The party names this pack recognises. Was a four-name tuple in here."""
    return set((MANIFEST.get("factions") or {}).keys())


def in_bounds(lat, lon):
    """Inside the box the pack says its subject happens in.

    A coordinate in the wrong hemisphere is the classic sign of a swapped
    lat/lon, and the box that catches it is a fact about the subject: the
    Atlantic and western Europe for this one, the Mediterranean for a Roman
    one. Note this is `map.extent`, not `map.explore.bounds` — where the
    subject happens, not where the camera opens. This war is fought on the
    seaboard and decided partly in Paris.
    """
    box = (MANIFEST.get("map") or {}).get("extent")
    if not box:
        return True
    (s_lat, w_lon), (n_lat, e_lon) = box
    return s_lat <= lat <= n_lat and w_lon <= lon <= e_lon


def check_pack(pack):
    global PACK, MANIFEST
    PACK = pack
    MANIFEST = pack_load("pack.json", {}) or {}
    if not MANIFEST:
        problems.append(f"{pack}: no pack.json — nothing knows what sides it has")

    pools = MANIFEST.get("pools", {})
    events = pack_load(pools.get("events", "events.json"), [])
    people = pack_load(pools.get("people", "people.json"), [])
    chapters = pack_load(pools.get("episodes", "chapters.json"), [])
    routes = pack_load(pools.get("routes", "geo/routes.json"), {"routes": []})
    places = pack_load(pools.get("places", "geo/places.json"), [])

    SIDES = sides()
    event_ids, person_ids = set(), set()
    route_ids = {r["id"] for r in routes["routes"]}

    # ---- events -----------------------------------------------------------
    for e in events:
        where = f"event {e.get('id', '?')}"
        if e["id"] in event_ids:
            problems.append(f"{where}: duplicate id")
        event_ids.add(e["id"])

        if not DATE_RE.fullmatch(e.get("date", "")) or not parse_date(e.get("date", "")):
            problems.append(f"{where}: date must be YYYY-MM-DD (or -0044-03-15 for BC), "
                            f"got {e.get('date')!r}")
        if e.get("kind") not in ("battle", "politics", "people"):
            problems.append(f"{where}: unknown kind {e.get('kind')!r}")
        if e.get("side") not in SIDES:
            problems.append(f"{where}: unknown side {e.get('side')!r}")
        if e.get("importance") not in (1, 2, 3):
            problems.append(f"{where}: importance must be 1, 2 or 3")

        for field, minlen in (
            ("title", 2), ("dateDisplay", 4), ("hook", 20),
            ("body", 400), ("why", 30), ("fact", 30),
        ):
            bilingual(e, field, where, minlen)

        if "coords" in e:
            lat, lon = e["coords"]
            # The map can pan from the Caribbean to Paris and no further.
            if not in_bounds(lat, lon):
                problems.append(f"{where}: coords {e['coords']} are outside the map bounds")
        else:
            notes.append(f"{where}: no coords, so it appears only in the timeline")

        wiki = e.get("wiki") or {}
        if not wiki.get("no") and not wiki.get("en"):
            problems.append(f"{where}: no wiki title in either language")

        for lang in LANGS:
            words = len((e.get("body", {}).get(lang) or "").split())
            if words > 190:
                notes.append(f"{where}: body.{lang} is {words} words - long for a phone")

        # Compared as Julian days, not as text. "-0100" sorts after
        # "-0044-03-15" alphabetically and before it historically, so string
        # comparison is right only as long as every year is positive and the
        # same width — which is exactly the assumption this pass removes.
        jd = (parse_date(e.get("date", "")) or {}).get("jd")
        spans = [(parse_date(c.get("from")), parse_date(c.get("to"))) for c in chapters]
        if jd is None or not any(a and b and a["jd"] <= jd <= b["jd"] for a, b in spans):
            problems.append(f"{where}: {e['date']} falls outside every chapter range")

    # ---- people -----------------------------------------------------------
    for p in people:
        where = f"person {p.get('id', '?')}"
        if p["id"] in person_ids:
            problems.append(f"{where}: duplicate id")
        person_ids.add(p["id"])

        for field, minlen in (
            ("name", 2), ("role", 5), ("hook", 15), ("body", 300), ("fact", 20),
        ):
            bilingual(p, field, where, minlen)

        # A portrait is optional — some people have no surviving likeness — but a
        # named file must actually exist, and an image that is not a contemporary
        # likeness must carry a note saying so.
        portrait = p.get("portrait")
        if portrait and not os.path.exists(os.path.join(ROOT, "content", PACK, "portraits", portrait)):
            problems.append(f"{where}: portrait file content/{PACK}/portraits/{portrait} is missing")
        if not portrait and not p.get("portraitNote"):
            notes.append(f"{where}: no portrait and no note explaining why")
        if p.get("portraitNote"):
            bilingual(p, "portraitNote", where, 10)

    # ---- cross references -------------------------------------------------
    for e in events:
        for pid in e.get("people", []):
            if pid not in person_ids:
                problems.append(f"event {e['id']}: links to unknown person {pid!r}")
        route = e.get("route")
        if route and route not in route_ids:
            problems.append(f"event {e['id']}: links to unknown route {route!r}")

    for p in people:
        for eid in p.get("events", []):
            if eid not in event_ids:
                problems.append(f"person {p['id']}: links to unknown event {eid!r}")

    # ---- routes and places ------------------------------------------------
    for r in routes["routes"]:
        where = f"route {r.get('id', '?')}"
        if len(r.get("coords", [])) < 2:
            problems.append(f"{where}: needs at least two points")
        if not DATE_RE.fullmatch(r.get("from", "")) or not parse_date(r.get("from", "")):
            problems.append(f"{where}: 'from' must be YYYY-MM-DD")
        bilingual(r, "label", where, 8)

    for t in routes.get("theatres", []):
        bilingual(t, "label", f"theatre {t.get('id', '?')}", 3)

    for i, pl in enumerate(places):
        bilingual(pl, "name", f"place #{i}", 2)
        if pl.get("type") not in ("city", "region"):
            problems.append(f"place #{i}: type must be 'city' or 'region'")

    # ---- report -----------------------------------------------------------
    print(
        f"{len(events)} events, {len(people)} people, {len(chapters)} chapters, "
        f"{len(routes['routes'])} routes, {len(places)} place labels"
    )
    turning = sum(1 for e in events if e.get("importance") == 3)
    print(f"{turning} turning points (these drive the guided tour and the gold markers)")
    print(f"{len(SIDES)} sides: {', '.join(sorted(SIDES))}")


def main():
    wanted = sys.argv[1:] or packs_on_disk()
    for i, pack in enumerate(wanted):
        if len(wanted) > 1:
            print(f"{'' if i == 0 else chr(10)}{pack}")
        check_pack(pack)

    if notes:
        print(f"\nnotes ({len(notes)}):")
        for n in notes:
            print(f"  - {n}")

    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1

    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
