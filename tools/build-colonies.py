#!/usr/bin/env python3
"""
build-colonies.py — the thirteen colonies as they were in 1775.

The file this replaces had fifteen features, including a separate *Maine* and
a *West Virginia*. Both are wrong, and wrong in a way that teaches something
false the moment a scene says "the thirteen colonies":

  * Massachusetts governed the District of Maine until 1820.
  * West Virginia split from Virginia in 1863 — 88 years later — over this
    war's unfinished business, not during it.
  * Kentucky was Virginia's western county until 1792.
  * Tennessee was North Carolina's western land until 1796.
  * Vermont was the New Hampshire Grants, claimed by BOTH New York and New
    Hampshire, and declared itself independent of both in 1777.

So the units are built by dissolving modern states into their colonial
parents. Shapely does the union: adjacent states share a boundary, and
drawing them as a MultiPolygon instead of a true union leaves that shared
line stroked down the middle of Virginia, which reads as a border that was
not there.

This is still an approximation. Colonial charters ran to vague western
limits and several overlapped; what this gives you is the settled extent,
with the anachronisms removed. Provenance is recorded per feature so the
next person can see what was merged into what.

    python tools/build-colonies.py

Needs shapely, which is a BUILD-time dependency only — the site ships the
JSON and nothing else.
"""
from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "geo" / "_src" / "ne_10m_admin_1_states_provinces.json"
DEST = ROOT / "content" / "american-revolution" / "geo" / "colonies.geojson"
# Everything the narration can name as an area, which is more than the
# thirteen: an establishing shot has to be able to point at Britain and France.
DEST_REGIONS = ROOT / "content" / "american-revolution" / "geo" / "regions.geojson"
COUNTRIES_SRC = ROOT / "assets" / "geo" / "_src" / "ne_50m_admin_0_countries.json"
COUNTRIES = {
    "United Kingdom": {"name": "Britain",
                       "label": {"no": "Storbritannia", "en": "Britain"},
                       "side": "british"},
    "France":         {"name": "France",
                       "label": {"no": "Frankrike", "en": "France"},
                       "side": "french"},
}

# colonial unit -> the modern states it covered in 1775
COLONIES = {
    "New Hampshire":  ["New Hampshire"],
    "Massachusetts":  ["Massachusetts", "Maine"],
    "Rhode Island":   ["Rhode Island"],
    "Connecticut":    ["Connecticut"],
    "New York":       ["New York", "Vermont"],
    "New Jersey":     ["New Jersey"],
    "Pennsylvania":   ["Pennsylvania"],
    "Delaware":       ["Delaware"],
    "Maryland":       ["Maryland"],
    "Virginia":       ["Virginia", "West Virginia", "Kentucky"],
    "North Carolina": ["North Carolina", "Tennessee"],
    "South Carolina": ["South Carolina"],
    "Georgia":        ["Georgia"],
}

# Said out loud by the narration, so it has to be right in both languages.
# Most are identical; only note the ones that are not.
NAMES = {
    "New Hampshire":  {"no": "New Hampshire",  "en": "New Hampshire"},
    "Massachusetts":  {"no": "Massachusetts",  "en": "Massachusetts"},
    "Rhode Island":   {"no": "Rhode Island",   "en": "Rhode Island"},
    "Connecticut":    {"no": "Connecticut",    "en": "Connecticut"},
    "New York":       {"no": "New York",       "en": "New York"},
    "New Jersey":     {"no": "New Jersey",     "en": "New Jersey"},
    "Pennsylvania":   {"no": "Pennsylvania",   "en": "Pennsylvania"},
    "Delaware":       {"no": "Delaware",       "en": "Delaware"},
    "Maryland":       {"no": "Maryland",       "en": "Maryland"},
    "Virginia":       {"no": "Virginia",       "en": "Virginia"},
    "North Carolina": {"no": "Nord-Carolina",  "en": "North Carolina"},
    "South Carolina": {"no": "Sør-Carolina",   "en": "South Carolina"},
    "Georgia":        {"no": "Georgia",        "en": "Georgia"},
}

# Things worth saying about a colony when it is highlighted. Kept here rather
# than in the script so a scene can name one without re-researching it.
NOTE = {
    "Massachusetts": {"no": "Styrte også Maine", "en": "Also governed Maine"},
    "New York":      {"no": "Kranglet med New Hampshire om Vermont",
                      "en": "Disputed Vermont with New Hampshire"},
    "Virginia":      {"no": "Strakte seg vest til Kentucky",
                      "en": "Reached west to Kentucky"},
    "North Carolina": {"no": "Strakte seg vest til Tennessee",
                       "en": "Reached west to Tennessee"},
}

# Where the name sits, [lat, lon], for the colonies whose centroid is
# misleading. Virginia ran west to Kentucky and North Carolina to Tennessee,
# so their centroids land in the mountains — but the settled part, and the
# part a reader is looking at, is the coast.
LABEL_AT = {
    "Virginia":       [37.8, -78.2],
    "North Carolina": [35.6, -79.2],
    "Massachusetts":  [42.3, -71.9],
    "New York":       [42.9, -75.4],
    "Georgia":        [32.7, -83.2],
}

# ~900 m. The colonies are only ever drawn at seaboard zoom, where finer
# detail is smaller than a pixel and costs bytes for nothing.
TOLERANCE = 0.008


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC.name} — run tools/build-basemap.py first to fetch it")
        return 1

    data = json.loads(SRC.read_text(encoding="utf-8"))
    by_state = {}
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        if (props.get("admin") or "") != "United States of America":
            continue
        name = props.get("name") or props.get("name_en")
        if name:
            by_state[name] = feat.get("geometry")

    features = []
    for colony, parts in COLONIES.items():
        geoms = []
        missing = []
        for part in parts:
            g = by_state.get(part)
            if g is None:
                missing.append(part)
                continue
            geoms.append(shape(g).buffer(0))   # buffer(0) repairs self-touches
        if missing:
            print(f"  ! {colony}: no geometry for {', '.join(missing)}")
        if not geoms:
            continue

        merged = unary_union(geoms).simplify(TOLERANCE, preserve_topology=True)
        props = {
            "name": colony,
            "label": NAMES[colony],
            "side": "patriot",
            # Provenance, so the anachronism cannot quietly come back.
            "modern": parts,
        }
        if colony in NOTE:
            props["note"] = NOTE[colony]
        if colony in LABEL_AT:
            props["labelAt"] = LABEL_AT[colony]
        features.append({"type": "Feature", "properties": props,
                         "geometry": mapping(merged)})

        pts = count_points(mapping(merged))
        merged_from = f"  ({' + '.join(parts)})" if len(parts) > 1 else ""
        print(f"  {colony:16} {pts:5} points{merged_from}")

    out = {
        "type": "FeatureCollection",
        "note": ("The thirteen colonies in 1775, dissolved from modern state "
                 "boundaries. Approximate: charters ran to vague western limits "
                 "and several overlapped. Built by tools/build-colonies.py."),
        "features": features,
    }
    DEST.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False),
                    encoding="utf-8")
    print(f"\n  {len(features)} colonies -> {DEST.relative_to(ROOT)}  "
          f"{DEST.stat().st_size / 1024:.0f} KB")

    countries = build_countries()
    regions = {
        "type": "FeatureCollection",
        "note": ("Everything this pack's narration can name as an area: the "
                 "thirteen colonies plus the European powers. Built by "
                 "tools/build-colonies.py."),
        "features": features + countries,
    }
    DEST_REGIONS.write_text(
        json.dumps(regions, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8")
    print(f"  {len(features) + len(countries)} regions -> "
          f"{DEST_REGIONS.relative_to(ROOT)}  "
          f"{DEST_REGIONS.stat().st_size / 1024:.0f} KB")
    return 0 if len(features) == 13 else 1


def count_points(geom):
    c = geom["coordinates"]
    if geom["type"] == "Polygon":
        return sum(len(r) for r in c)
    return sum(len(r) for poly in c for r in poly)




def build_countries():
    """Britain and France, coarse — they are only ever seen from orbit."""
    from shapely.geometry import box

    if not COUNTRIES_SRC.exists():
        print(f"  ! {COUNTRIES_SRC.name} not downloaded — no countries")
        return []

    data = json.loads(COUNTRIES_SRC.read_text(encoding="utf-8"))
    out = []
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        # Natural Earth is not consistent about case: the admin-1 file uses
        # lowercase property keys, the admin-0 file uses UPPERCASE. Try both
        # rather than silently matching nothing.
        key = next((props[k] for k in ("admin", "ADMIN", "name", "NAME")
                    if props.get(k)), None)
        spec = COUNTRIES.get(key)
        if not spec or not feat.get("geometry"):
            continue

        # Metropolitan territory only. France's overseas departments are a
        # modern arrangement, and an intro set in 1763 does not want a stray
        # French shape appearing in the Caribbean.
        geom = shape(feat["geometry"]).buffer(0).intersection(box(-12, 40, 12, 62))
        if geom.is_empty:
            continue
        geom = geom.simplify(0.02, preserve_topology=True)

        out.append({
            "type": "Feature",
            "properties": {"name": spec["name"], "label": spec["label"],
                           "side": spec["side"], "level": 0},
            "geometry": mapping(geom),
        })
        print(f"  {spec['name']:16} {count_points(mapping(geom)):5} points")
    return out
if __name__ == "__main__":
    raise SystemExit(main())
