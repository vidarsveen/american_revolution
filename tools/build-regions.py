#!/usr/bin/env python3
"""
Build a pack's administrative regions from Natural Earth admin-1.

    .venv/Scripts/python.exe tools/build-regions.py --country Italy \
        --out content/italy-wine/geo/regions.geojson

For a MODERN subject, modern boundaries are simply correct — the opposite of
the historical case, where CLAUDE.md's rule stands: Massachusetts included
Maine in 1775 and drawing today's line is a lie. Italian wine is grown inside
Italy's present regions, and the DOCG map is drawn on them, so the honest
default here is the shipped one.

Reuses simplify_together() and report_seams() from build-colonies.py rather
than copying them. That matters: simplifying areas one at a time tears the
borders BETWEEN them, because Shapely preserves the topology of the geometry
you hand it and not the topology between geometries. Measured on the file
build-colonies replaced: twelve overlapping pairs, the worst 151 km². Two
implementations of that would be the verbs.json mistake in geometry.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from shapely.geometry import shape, mapping                # noqa: E402
from shapely.ops import unary_union                        # noqa: E402

_bc = __import__("importlib").import_module("build-colonies") \
    if False else None
# build-colonies has a hyphen in its name, so it cannot be imported by the
# statement form. Load it by path instead of renaming a file five other
# things reference.
import importlib.util                                      # noqa: E402
_spec = importlib.util.spec_from_file_location(
    "build_colonies", pathlib.Path(__file__).with_name("build-colonies.py"))
BC = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BC)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "geo" / "_src" / "ne_10m_admin_1_states_provinces.json"

# 800 m, the same tolerance the colonies use. A phone is 393 px wide and a
# region 200 km across is 60 px of it; anything finer is bytes nobody sees.
TOLERANCE = BC.TOLERANCE


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", required=True,
                    help="Natural Earth `admin` value, e.g. Italy")
    ap.add_argument("--out", required=True, help="path under content/")
    ap.add_argument("--short", default=None,
                    help="json file of {name: short label} for small screens")
    ap.add_argument("--group-by", default=None, metavar="PROP",
                    help="merge admin-1 units by this property. Natural "
                         "Earth gives Italy 110 PROVINCES; the twenty regions "
                         "a wine map is drawn on are in the `region` field.")
    ap.add_argument("--list", action="store_true",
                    help="print the region names and stop")
    a = ap.parse_args()

    if not SRC.exists():
        print(f"missing {SRC.name} — run tools/build-basemap.py first")
        return 1

    data = json.loads(SRC.read_text(encoding="utf-8"))
    found = {}
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        admin = props.get("admin") or props.get("ADMIN") or ""
        if admin != a.country:
            continue
        name = (props.get(a.group_by) if a.group_by else None)             or props.get("name") or props.get("name_en")
        if not name:
            continue
        g = shape(feat["geometry"]).buffer(0)   # buffer(0) repairs self-touches
        found[name] = unary_union([found[name], g]) if name in found else g

    if not found:
        admins = sorted({(f.get("properties") or {}).get("admin") or ""
                         for f in data.get("features", [])})
        print(f"no regions with admin == {a.country!r}")
        print("try one of:", ", ".join(x for x in admins if x)[:600])
        return 1

    if a.list:
        for n in sorted(found):
            print(" ", n)
        return 0

    short = json.loads(pathlib.Path(a.short).read_text(encoding="utf-8")) \
        if a.short else {}

    units = BC.simplify_together(found, TOLERANCE)
    touching = BC.neighbours_of(units)

    features = []
    for name, merged in units.items():
        props = {
            "name": name,
            "label": {"no": name, "en": name},
            "short": short.get(name, name),
            # Who this region borders. The renderer turns that into colours,
            # and check-contrast.py uses it to know which pairs must differ.
            "neighbours": sorted(touching[name]),
        }
        features.append({"type": "Feature", "properties": props,
                         "geometry": BC.round_coords(mapping(merged))})
        print(f"  {name:26} {BC.count_points(mapping(merged)):5} points")

    # On the geometry as WRITTEN, not as computed: rounding happens between
    # the two, and a check that skips it is checking the wrong file.
    BC.report_seams({f["properties"]["name"]: shape(f["geometry"])
                     for f in features})

    dest = ROOT / a.out
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(
        {"type": "FeatureCollection",
         "note": f"Administrative regions of {a.country}, from Natural Earth "
                 f"10m admin-1. Built by tools/build-regions.py.",
         "features": features},
        separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"\n  {len(features)} regions -> {a.out}  "
          f"{dest.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
