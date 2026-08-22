#!/usr/bin/env python3
"""
build-provinces.py — the Roman world as areas a script can name.

    python tools/build-provinces.py

HOW ACCURATE IS THIS, HONESTLY

Not very, and the app says so. These are modern country outlines grouped and
renamed, not surveyed provincial boundaries — the same trick
tools/build-colonies.py plays with the thirteen colonies, and it carries the
same caveat: good enough to say "Antony took the east" honestly, nowhere near
good enough to argue a frontier from.

Where it is roughly right: Aegyptus really is the Nile and its delta, Sicilia
really is Sicily, Italia really is the peninsula. Where it is wrong and you
should know it: Gallia in 44 BC had only just been conquered and its edge was
nothing like France's; Asia was a slice of Anatolia, not the whole of Turkey;
Africa Proconsularis was a wedge around Carthage rather than all of Tunisia.
`pack.json`'s accuracyNote says the coastline is modern; this file is why the
provinces get the same treatment.

The borders are simplified as a NETWORK, not one area at a time, for the
reason build-colonies.py documents at length: simplifying two adjacent shapes
separately thins one shared line into two different lines, and the map then
draws a border twice with a wash stacked between them.
"""
from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "geo" / "_src" / "ne_50m_admin_0_countries.json"
OUT = ROOT / "content" / "roman-empire" / "geo" / "provinces.geojson"

TOLERANCE = 0.05          # ~5 km. These are schematic; pretending otherwise is worse.
DECIMALS = 4

# province -> the modern countries standing in for it, and who held it when
# the triumvirate split the Roman world at Brundisium in 40 BC.
PROVINCES = [
    ("Italia",     ["Italy", "San Marino", "Vatican"], "caesarian",
     {"no": "Italia", "en": "Italy"}, {"no": "Italia", "en": "Italia"}),
    ("Sicilia",    [], "pompeian",
     {"no": "Sicilia", "en": "Sicily"}, {"no": "Sic.", "en": "Sic."}),
    ("Hispania",   ["Spain", "Portugal"], "caesarian",
     {"no": "Hispania", "en": "Hispania"}, {"no": "Hisp.", "en": "Hisp."}),
    ("Gallia",     ["France", "Belgium", "Switzerland", "Luxembourg"], "caesarian",
     {"no": "Gallia", "en": "Gaul"}, {"no": "Gal.", "en": "Gaul"}),
    ("Illyricum",  ["Croatia", "Bosnia and Herz.", "Montenegro", "Albania",
                    "Slovenia", "Serbia", "Kosovo"], "caesarian",
     {"no": "Illyricum", "en": "Illyricum"}, {"no": "Ill.", "en": "Ill."}),
    ("Macedonia",  ["Macedonia", "North Macedonia", "Bulgaria"], "antonian",
     {"no": "Macedonia", "en": "Macedonia"}, {"no": "Mac.", "en": "Mac."}),
    ("Achaea",     ["Greece"], "antonian",
     {"no": "Achaea", "en": "Achaea"}, {"no": "Ach.", "en": "Ach."}),
    ("Asia",       ["Turkey"], "antonian",
     {"no": "Asia", "en": "Asia"}, {"no": "Asia", "en": "Asia"}),
    ("Syria",      ["Syria", "Lebanon", "Israel", "Palestine", "Jordan"], "antonian",
     {"no": "Syria", "en": "Syria"}, {"no": "Syr.", "en": "Syr."}),
    ("Aegyptus",   ["Egypt"], "ptolemaic",
     {"no": "Egypt", "en": "Egypt"}, {"no": "Egypt", "en": "Egypt"}),
    ("Cyrenaica",  ["Libya"], "antonian",
     {"no": "Cyrenaica", "en": "Cyrenaica"}, {"no": "Cyr.", "en": "Cyr."}),
    ("Africa",     ["Tunisia"], "neutral",
     {"no": "Africa", "en": "Africa"}, {"no": "Afr.", "en": "Afr."}),
    ("Numidia",    ["Algeria"], "neutral",
     {"no": "Numidia", "en": "Numidia"}, {"no": "Num.", "en": "Num."}),
    ("Mauretania", ["Morocco", "W. Sahara"], "neutral",
     {"no": "Mauretania", "en": "Mauretania"}, {"no": "Maur.", "en": "Maur."}),
    ("Parthia",    ["Iran", "Iraq"], "neutral",
     {"no": "Partherriket", "en": "Parthia"}, {"no": "Parthia", "en": "Parthia"}),
]

# Sicily and Sardinia are inside Italy's outline and have to be cut out of it:
# Sextus Pompeius held Sicily against Octavian for years, and a map that draws
# it as part of Italia cannot tell that story at all.
ISLANDS = {"Sicilia": (12.0, 36.6, 15.7, 38.35)}

LABEL_AT = {
    "Italia": [42.6, 12.6],
    "Aegyptus": [26.5, 30.5],
    "Asia": [39.0, 32.5],
    "Gallia": [46.8, 2.5],
    "Parthia": [33.0, 45.0],
}


def load_countries():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    out = {}
    for f in data["features"]:
        p = f["properties"]
        name = p.get("NAME") or p.get("name")
        if not name:
            continue
        out[name] = shape(f["geometry"])
    return out


def round_geom(geom, nd=DECIMALS):
    def r(coords):
        if isinstance(coords[0], (int, float)):
            return [round(coords[0], nd), round(coords[1], nd)]
        return [r(c) for c in coords]
    g = mapping(geom)
    g["coordinates"] = r(g["coordinates"])
    return g


def simplify_together(areas):
    """Simplify the border NETWORK, then rebuild the areas from it.

    Union the boundaries — which nodes every crossing and collapses each
    shared border to ONE line — simplify that, polygonize it back into faces,
    and give each face to whichever area covers most of it. Neighbours then
    share the exact same coordinates along their border, which is what stops
    the renderer drawing it twice.
    """
    edges = unary_union([a.boundary for a in areas.values()])
    edges = edges.simplify(TOLERANCE, preserve_topology=True)
    faces = list(polygonize(edges))
    print(f"  {len(faces)} faces from the simplified border network")

    rebuilt = {name: [] for name in areas}
    for face in faces:
        best, score = None, 0.0
        for name, area in areas.items():
            try:
                overlap = face.intersection(area).area
            except Exception:                      # noqa: BLE001
                continue
            if overlap > score:
                best, score = name, overlap
        # A face nobody claims is a lake or a bay; dropping it is correct.
        if best and score > face.area * 0.5:
            rebuilt[best].append(face)
    return {n: unary_union(parts) for n, parts in rebuilt.items() if parts}


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}")
        return 1

    countries = load_countries()
    from shapely.geometry import box as bbox

    areas, sides, names, shorts = {}, {}, {}, {}
    for pid, members, side, label, short in PROVINCES:
        sides[pid], names[pid], shorts[pid] = side, label, short
        parts = [countries[m] for m in members if m in countries]
        missing = [m for m in members if m not in countries]
        if missing:
            print(f"  {pid}: not in Natural Earth: {', '.join(missing)}")
        if pid in ISLANDS:
            continue
        if not parts:
            print(f"  {pid}: no geometry, skipped")
            continue
        areas[pid] = unary_union(parts)

    # Carve the islands out of their host before anything is simplified.
    for pid, (w, s, e, n) in ISLANDS.items():
        cut = bbox(w, s, e, n)
        host = "Italia"
        if host in areas:
            piece = areas[host].intersection(cut)
            if not piece.is_empty:
                areas[pid] = piece
                areas[host] = areas[host].difference(cut)
                print(f"  {pid}: cut out of {host}")

    areas = simplify_together(areas)

    # Who touches whom — the renderer solves its tints from this graph, so two
    # provinces sharing a border are never given the same colour.
    def neighbours_of(pid):
        out = []
        for other, geom in areas.items():
            if other == pid:
                continue
            if areas[pid].distance(geom) < 0.02:
                out.append(other)
        return sorted(out)

    features = []
    for pid, geom in areas.items():
        props = {
            "name": pid,
            "label": names[pid],
            "short": shorts[pid],
            "side": sides[pid],
            "neighbours": neighbours_of(pid),
        }
        if pid in LABEL_AT:
            props["labelAt"] = LABEL_AT[pid]
        features.append({"type": "Feature", "properties": props,
                         "geometry": round_geom(geom)})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(
        {"type": "FeatureCollection",
         "note": "Schematic. Modern outlines grouped and renamed — see the "
                 "header of tools/build-provinces.py.",
         "features": features}, separators=(",", ":")), encoding="utf-8")
    print(f"\n{len(features)} provinces -> {OUT.relative_to(ROOT)}  "
          f"{OUT.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
