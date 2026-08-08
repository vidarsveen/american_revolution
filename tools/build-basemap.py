#!/usr/bin/env python3
"""
build-basemap.py — turn Natural Earth into a basemap we own.

The map was unreadable because it was a colour filter over somebody else's
raster tiles: sepia collapsed the hue that separated land from water, and no
amount of contrast could put it back. This draws the ground ourselves, so the
palette is authored rather than recovered, there are no tiles to arrive late,
and a 1775 map stops containing motorways.

Source: Natural Earth (public domain) via martynafford/natural-earth-geojson,
already converted to GeoJSON so no shapefile toolchain is needed. Put the
downloaded files in assets/geo/_src/ and run this.

    python tools/build-basemap.py

Output (committed, cached forever by the service worker):

    assets/geo/world-110m.json   whole world, coarse   — zoom 0-3
    assets/geo/world-50m.json    whole world, medium   — zoom 4-6
    assets/geo/atlantic-10m.json the theatre, fine     — zoom 7+
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "geo" / "_src"
OUT = ROOT / "assets" / "geo"

# name -> (source scale, simplify tolerance in degrees, bbox or None)
# Tolerance is chosen so a feature never wobbles by more than about a pixel at
# the zoom the level is used at; past that you are storing detail nobody sees.
LEVELS = {
    "world-110m":   ("110m", 0.090, None),
    "world-50m":    ("50m",  0.030, None),
    # The theatre of this war, with room for Quebec, the Caribbean and the
    # Atlantic crossing. A pack declares its own box; this is the default.
    "atlantic-10m": ("10m",  0.004, (-98.0, 22.0, -55.0, 52.0)),
}

LAYERS = ["land", "lakes", "rivers_lake_centerlines"]
SHORT = {"land": "land", "lakes": "lakes", "rivers_lake_centerlines": "rivers"}

# Administrative boundaries, by level: 0 country, 1 state/province.
#
# Natural Earth ships these as LINE layers as well as polygons, and the lines
# are the right source: a border shared by two adjacent polygons gets drawn
# twice, which doubles its weight and makes a dashed stroke stutter wherever
# the two dash phases disagree.
#
# These are MODERN boundaries. They are the framework default because that is
# the honest general answer, and a historical pack overrides them with its own
# geo/borders.geojson — Massachusetts in 1775 included Maine, Vermont was
# disputed, and West Virginia did not exist.
BORDERS = {
    "world-110m":   [],
    "world-50m":    [(0, "50m", "admin_0_boundary_lines_land")],
    "atlantic-10m": [(0, "50m", "admin_0_boundary_lines_land"),
                     (1, "10m", "admin_1_states_provinces_lines")],
}

# Named admin-1 polygons, so a region can be filled, highlighted and labelled
# rather than merely outlined.
REGIONS = ("10m", "admin_1_states_provinces", (-98.0, 22.0, -55.0, 52.0), 0.006)
REGION_NAME_KEYS = ("name", "name_en", "gn_name", "woe_name")

# Rivers carry a scale rank; drawing every creek at continental zoom is noise.
RIVER_RANK = {"110m": 4, "50m": 6, "10m": 8}


# ---------------------------------------------------------------- geometry

def simplify(points, tol):
    """
    Douglas-Peucker. Twenty lines, no dependency — which is the point: the
    whole toolchain here stays `pip install pillow playwright` and nothing else.
    """
    if len(points) < 3:
        return points

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    tol2 = tol * tol

    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        ax, ay = points[lo]
        bx, by = points[hi]
        dx, dy = bx - ax, by - ay
        norm = dx * dx + dy * dy

        far, far_d = -1, tol2
        for i in range(lo + 1, hi):
            px, py = points[i]
            if norm == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / norm
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > far_d:
                far, far_d = i, d

        if far > 0:
            keep[far] = True
            stack.append((lo, far))
            stack.append((far, hi))

    return [p for p, k in zip(points, keep) if k]


def clip_bbox(points, box, pad=2.0):
    """Keep rings that touch the box at all — cheap reject, no true clipping."""
    if box is None:
        return True
    x0, y0, x1, y1 = box
    for x, y in points:
        if x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad:
            return True
    return False


def rings_of(geom):
    """Normalise Polygon / MultiPolygon / LineString / MultiLineString."""
    t, c = geom["type"], geom["coordinates"]
    if t == "Polygon":
        return [c]
    if t == "MultiPolygon":
        return list(c)
    if t == "LineString":
        return [[c]]
    if t == "MultiLineString":
        return [[line] for line in c]
    return []


def flatten(points, q=4):
    out = []
    for x, y in points:
        out.append(round(x, q))
        out.append(round(y, q))
    return out


# ---------------------------------------------------------------- build

def build_layer(path: Path, tol, box, min_rank=None):
    data = json.loads(path.read_text(encoding="utf-8"))
    shapes = []
    kept = dropped = 0

    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        if min_rank is not None:
            rank = props.get("scalerank")
            if rank is not None and rank > min_rank:
                dropped += 1
                continue

        geom = feat.get("geometry")
        if not geom:
            continue

        for group in rings_of(geom):
            parts = []
            for ring in group:
                pts = [(float(p[0]), float(p[1])) for p in ring]
                if not clip_bbox(pts, box):
                    continue
                pts = simplify(pts, tol)
                if len(pts) < 2:
                    continue
                parts.append(flatten(pts))
            if parts:
                shapes.append(parts)
                kept += 1

    return shapes, kept, dropped


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC} — download the Natural Earth GeoJSON there first")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)

    for name, (scale, tol, box) in LEVELS.items():
        result = {"name": name, "scale": scale, "bbox": box, "layers": {}}
        print(f"\n{name}  (Natural Earth {scale}, tolerance {tol} deg)")

        for layer in LAYERS:
            path = SRC / f"ne_{scale}_{layer}.json"
            if not path.exists():
                print(f"  {SHORT[layer]:8} - not downloaded, skipping")
                continue
            rank = RIVER_RANK[scale] if layer.startswith("rivers") else None
            shapes, kept, dropped = build_layer(path, tol, box, rank)
            result["layers"][SHORT[layer]] = shapes
            pts = sum(len(p) // 2 for s in shapes for p in s)
            note = f", {dropped} below rank" if dropped else ""
            print(f"  {SHORT[layer]:8} {kept:5} shapes, {pts:7} points{note}")

        borders = []
        for admin, scale_b, layer in BORDERS.get(name, []):
            bpath = SRC / f"ne_{scale_b}_{layer}.json"
            if not bpath.exists():
                print(f"  border{admin} - not downloaded, skipping")
                continue
            shapes, kept, _ = build_layer(bpath, tol, box)
            for parts in shapes:
                borders.append([admin, parts])
            bpts = sum(len(q) // 2 for sh in shapes for q in sh)
            print(f"  border{admin} {kept:5} lines,  {bpts:7} points")
        if borders:
            result["borders"] = borders

        dest = OUT / f"{name}.json"
        dest.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
        print(f"  -> {dest.relative_to(ROOT)}  {dest.stat().st_size / 1024:.0f} KB")

    build_regions()
    print("\ndone")
    return 0



def build_regions():
    """Named administrative areas — fillable, highlightable, labellable."""
    scale, layer, box, tol = REGIONS
    path = SRC / f"ne_{scale}_{layer}.json"
    if not path.exists():
        print(f"regions - {path.name} not downloaded, skipping")
        return

    print(f"regions  (Natural Earth {scale}, tolerance {tol} deg)")
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        name = next((props[k] for k in REGION_NAME_KEYS if props.get(k)), None)
        geom = feat.get("geometry")
        if not name or not geom:
            continue

        rings = []
        for group in rings_of(geom):
            for ring in group:
                pts = [(float(q[0]), float(q[1])) for q in ring]
                if not clip_bbox(pts, box, pad=0.5):
                    continue
                pts = simplify(pts, tol)
                if len(pts) >= 3:
                    rings.append(flatten(pts))
        if rings:
            out.append({
                "name": name,
                "country": props.get("admin") or props.get("iso_a2") or "",
                "rings": rings,
            })

    dest = OUT / "regions-10m.json"
    dest.write_text(json.dumps({"level": 1, "regions": out}, separators=(",", ":")),
                    encoding="utf-8")
    pts = sum(len(r) // 2 for reg in out for r in reg["rings"])
    print(f"  {len(out):5} regions, {pts:7} points")
    print(f"  -> {dest.relative_to(ROOT)}  {dest.stat().st_size / 1024:.0f} KB")

if __name__ == "__main__":
    raise SystemExit(main())
