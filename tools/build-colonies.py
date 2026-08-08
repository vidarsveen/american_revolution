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

import shapely
from shapely.geometry import mapping, shape
from shapely.ops import polygonize, unary_union

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

# What the name shrinks to when there is no room for it. A phone is 393 px
# across and the map has to hold thirteen of these at once; the alternative to
# abbreviating is dropping the label, and an unnamed colony teaches nothing.
# These are the forms a period atlas used, not invented contractions.
SHORT = {
    "New Hampshire":  {"no": "N.H.",    "en": "N.H."},
    "Massachusetts":  {"no": "Mass.",   "en": "Mass."},
    "Rhode Island":   {"no": "R.I.",    "en": "R.I."},
    "Connecticut":    {"no": "Conn.",   "en": "Conn."},
    "New York":       {"no": "N.Y.",    "en": "N.Y."},
    "New Jersey":     {"no": "N.J.",    "en": "N.J."},
    "Pennsylvania":   {"no": "Penn.",   "en": "Penn."},
    "Delaware":       {"no": "Del.",    "en": "Del."},
    "Maryland":       {"no": "Md.",     "en": "Md."},
    "Virginia":       {"no": "Virg.",   "en": "Virg."},
    "North Carolina": {"no": "N.-Car.", "en": "N. Car."},
    "South Carolina": {"no": "S.-Car.", "en": "S. Car."},
    "Georgia":        {"no": "Georgia", "en": "Georgia"},
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

# A face that overlaps no colony by at least this fraction of itself is not a
# colony: it is a lake punched out of one. There are 209 of them in Virginia,
# New York and North Carolina, and they must stay punched out.
CLAIM = 0.5

# Coordinates are written to this many decimals. Five is about a metre, which
# is absurd precision next to an 800 m simplification tolerance — and it is
# the cheap half of the file. Full float64 costs 265 KB; five decimals costs
# 143 KB, less than the topologically broken file this replaces. Rounding is
# a pure function of the value, so the two sides of a shared border round to
# the same place and the seam stays a seam.
DECIMALS = 5


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

    units = {}
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
        if geoms:
            units[colony] = unary_union(geoms)

    units = simplify_together(units, TOLERANCE)
    tints, _ = assign_tints(units)

    features = []
    for colony, merged in units.items():
        parts = COLONIES[colony]
        props = {
            "name": colony,
            "label": NAMES[colony],
            # A phone is 393 px wide and "MASSACHUSETTS" is most of it. The
            # short form is what a paper atlas falls back to at small scale.
            "short": SHORT[colony],
            "side": "patriot",
            # Which of the side's tints this colony wears, and how many there
            # are. Solved against the adjacency graph — see assign_tints.
            "tint": tints[colony],
            "tints": len(tints),
            # Provenance, so the anachronism cannot quietly come back.
            "modern": parts,
        }
        if colony in NOTE:
            props["note"] = NOTE[colony]
        if colony in LABEL_AT:
            props["labelAt"] = LABEL_AT[colony]
        features.append({"type": "Feature", "properties": props,
                         "geometry": round_coords(mapping(merged))})

        pts = count_points(mapping(merged))
        merged_from = f"  ({' + '.join(parts)})" if len(parts) > 1 else ""
        print(f"  {colony:16} {pts:5} points{merged_from}")

    # Checked on the geometry as WRITTEN, not as computed. Rounding happens
    # between the two, and a check that skips it is checking the wrong file.
    report_seams({f["properties"]["name"]: shape(f["geometry"]) for f in features})

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


def simplify_together(units, tolerance):
    """
    Simplify a set of touching areas without tearing their shared borders.

    Simplifying each colony on its own is the obvious thing and it is wrong.
    `preserve_topology` preserves the topology of the geometry it is given,
    not the topology BETWEEN geometries — so Virginia's southern edge and
    North Carolina's northern edge, which are the same line in the source,
    get thinned to two different lines. Measured on the file this replaces:
    151 km2 where Virginia and North Carolina were both, 75 km2 for North
    Carolina and Georgia, twelve overlapping pairs in all. On screen that is
    a border drawn twice, a few pixels apart, with the wash of two colonies
    stacked in the gap between them. That is the "borders on top of each
    other" this function exists to prevent.

    So the border network is simplified once, as a network:

      1. Union the boundaries. This nodes them at every crossing AND collapses
         the two copies of a shared border into one line.
      2. Simplify. Each arc runs between nodes, and its endpoints are kept, so
         both neighbours move together or not at all.
      3. Polygonize back into faces and give each face to the colony it came
         from.

    The result is an exact partition: no overlaps, no slivers, one line per
    border. Verified by report_seams() below, which is why that runs on every
    build rather than living in a comment.
    """
    network = unary_union([g.boundary for g in units.values()])
    network = shapely.simplify(network, tolerance)

    names = list(units)
    tree = shapely.STRtree([units[n] for n in names])

    claimed = {n: [] for n in names}
    dropped = 0
    for face in polygonize(network):
        best, share = None, 0.0
        for i in tree.query(face):
            overlap = face.intersection(units[names[i]]).area
            if overlap > share:
                best, share = names[i], overlap
        # A face nobody claims is a lake punched out of a colony, not a
        # colony. Assigning it by nearest-neighbour would fill in every
        # reservoir in Virginia.
        if best is None or share < CLAIM * face.area:
            dropped += 1
            continue
        claimed[best].append(face)

    out = {}
    for name in names:
        out[name] = unary_union(claimed[name]) if claimed[name] else units[name]
        if not claimed[name]:
            print(f"  ! {name}: no faces survived, kept unsimplified")
    print(f"  {dropped} interior faces left as holes (lakes, reservoirs)")
    return out


def assign_tints(units):
    """
    Give each colony a slot on the colour wheel, far from its neighbours'.

    The map module spreads a side's colour into as many tints as there are
    regions. Which region gets which tint is a graph colouring problem and it
    has to be solved HERE, because only here is it known which colonies touch:
    the renderer sees a list, and a list has no idea that New York and
    Pennsylvania share four hundred kilometres of border.

    Handing out slots in list order looks fine and is not. The list runs north
    to south, so any rule based on position in it gives similar tints to
    colonies that are two apart — and two apart in a north-south list is very
    often adjacent on the ground. Measured on the rendered pixels, that put
    New York next to Pennsylvania at deltaE 4.0 and North Carolina next to
    Georgia at 5.5, which is "the same colour" to anyone not comparing them
    side by side.

    So: maximise the smallest wheel distance between any two colonies that
    touch. Greedy most-constrained-first, then hill-climb by swapping pairs.
    Deterministic — same input, same colours, every build.
    """
    names = list(units)
    n = len(names)
    touching = {a: set() for a in names}
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if units[a].touches(units[b]) or units[a].intersects(units[b]):
                touching[a].add(b)
                touching[b].add(a)

    # Distance between two slots, around a wheel of n.
    def apart(x, y):
        d = abs(x - y) % n
        return min(d, n - d)

    def worst(slots):
        return min((apart(slots[a], slots[b])
                    for a in names for b in touching[a]), default=n)

    slots = {}
    for name in sorted(names, key=lambda x: (-len(touching[x]), x)):
        free = [s for s in range(n) if s not in slots.values()]
        placed = [slots[b] for b in touching[name] if b in slots]
        slots[name] = max(free, key=lambda s: (
            min((apart(s, p) for p in placed), default=n), -s))

    best = worst(slots)
    improved = True
    while improved:
        improved = False
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                slots[a], slots[b] = slots[b], slots[a]
                got = worst(slots)
                if got > best:
                    best, improved = got, True
                else:
                    slots[a], slots[b] = slots[b], slots[a]

    print(f"  colour slots: closest neighbours are {best} of {n} apart "
          f"on the wheel")
    return slots, best


def round_coords(obj, n=DECIMALS):
    """Round every coordinate in a GeoJSON geometry, in place-ish."""
    if isinstance(obj, float):
        return round(obj, n)
    # shapely's mapping() hands back tuples, not lists — miss that and the
    # walk returns the geometry untouched and the file silently stays fat.
    if isinstance(obj, (list, tuple)):
        return [round_coords(v, n) for v in obj]
    if isinstance(obj, dict):
        return {k: round_coords(v, n) for k, v in obj.items()}
    return obj


# Two colonies may share a border but never any ground. The floor is not zero
# because coordinates are rounded to a metre on the way out, which leaves
# slivers a metre wide along a border hundreds of kilometres long. 0.05 km2 is
# far above that noise and far below anything a screen could show — the file
# this replaced had twelve overlaps, the worst of them 151 km2.
SEAM_FLOOR_KM2 = 0.05


def report_seams(units):
    """
    Fail loudly if two colonies claim the same ground.

    This is the assertion the old build did not make, and not making it is why
    the seams were wrong for as long as they were: a 300 m overlap is invisible
    at seaboard zoom and unmistakable the moment you zoom into the seam, so
    looking at the map was never going to catch it. Measuring does.
    """
    names = list(units)
    bad = 0
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ga, gb = units[a], units[b]
            if not ga.intersects(gb):
                continue
            km2 = ga.intersection(gb).area * 12300
            if km2 > SEAM_FLOOR_KM2:
                bad += 1
                print(f"  ! {a} and {b} overlap by {km2:.1f} km2")
    print(f"  seams: {'clean' if not bad else f'{bad} OVERLAPPING PAIRS'}")
    return bad == 0


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
            # No tint: Britain and France are each the only region of their
            # side ever on screen, so there is nothing to tell them apart
            # from. They wear the side's own colour.
            "properties": {"name": spec["name"], "label": spec["label"],
                           "short": spec["label"], "side": spec["side"],
                           "level": 0},
            "geometry": round_coords(mapping(geom)),
        })
        print(f"  {spec['name']:16} {count_points(mapping(geom)):5} points")
    return out
if __name__ == "__main__":
    raise SystemExit(main())
