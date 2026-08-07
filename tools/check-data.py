#!/usr/bin/env python3
"""
Check the content files before publishing.

Catches the things that are easy to get wrong when editing history by hand:
a missing translation, a person id that does not exist, coordinates in the
wrong hemisphere, an event that falls between two chapters, a portrait file
that was never downloaded.

    python tools/check-data.py

Exits non-zero if anything is actually broken. Notes are advisory.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ("no", "en")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

problems: list[str] = []
notes: list[str] = []


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return json.load(fh)


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


def main():
    events = load("data/events.json")
    people = load("data/people.json")
    chapters = load("data/chapters.json")
    routes = load("data/geo/routes.json")
    places = load("data/geo/places.json")

    event_ids, person_ids = set(), set()
    route_ids = {r["id"] for r in routes["routes"]}

    # ---- events -----------------------------------------------------------
    for e in events:
        where = f"event {e.get('id', '?')}"
        if e["id"] in event_ids:
            problems.append(f"{where}: duplicate id")
        event_ids.add(e["id"])

        if not DATE_RE.fullmatch(e.get("date", "")):
            problems.append(f"{where}: date must be YYYY-MM-DD, got {e.get('date')!r}")
        if e.get("kind") not in ("battle", "politics", "people"):
            problems.append(f"{where}: unknown kind {e.get('kind')!r}")
        if e.get("side") not in ("british", "patriot", "french", "neutral"):
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
            if not (14 <= lat <= 62 and -110 <= lon <= 22):
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

        if not any(c["from"] <= e["date"] <= c["to"] for c in chapters):
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

        portrait = p.get("portrait", "")
        if not portrait or not os.path.exists(os.path.join(ROOT, "assets/portraits", portrait)):
            problems.append(f"{where}: portrait file assets/portraits/{portrait} is missing")

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
        if not DATE_RE.fullmatch(r.get("from", "")):
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
