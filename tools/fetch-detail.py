#!/usr/bin/env python3
"""
fetch-detail.py — close-in water and coastline for one pack's theatre.

Natural Earth is 1:10 000 000. At the zooms a chapter actually plays at —
11 to 13.5, standing on Lexington Green — it has nothing to say: Boston's
peninsula is a blob, the Charles does not exist, and the map is an empty
field. That is worse than the raster tiles it replaced, so a pack that goes
in close has to ship its own geometry.

Source: OpenStreetMap via Overpass. ODbL, so the credit is mandatory and is
written into the output alongside the geometry.

    python tools/fetch-detail.py american-revolution

Output: content/<pack>/geo/detail.json, in the same baked shape as
assets/geo/*.json so the map module needs no new code path.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from shapely.geometry import LineString, box, mapping, shape
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# pack -> (south, west, north, east)
THEATRES = {
    "american-revolution": (42.05, -71.70, 42.75, -70.75),
}

QUERY = """[out:json][timeout:180];
(
  way["natural"="coastline"]({s},{w},{n},{e});
  way["natural"="water"]({s},{w},{n},{e});
  relation["natural"="water"]({s},{w},{n},{e});
  way["waterway"="river"]({s},{w},{n},{e});
  way["natural"="wood"]({s},{w},{n},{e});
  relation["natural"="wood"]({s},{w},{n},{e});
  way["landuse"="forest"]({s},{w},{n},{e});
  relation["landuse"="forest"]({s},{w},{n},{e});
);
out geom;
"""


def simplify(points, tol):
    """Douglas-Peucker, same as build-basemap.py — kept local to stay dependency-free."""
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


def fetch(query: str) -> dict:
    last = None
    for url in ENDPOINTS:
        try:
            print(f"  asking {url.split('/')[2]} …")
            req = urllib.request.Request(
                url, data=query.encode("utf-8"),
                headers={"User-Agent": "revolusjonen-basemap/1.0 (educational)"})
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            print(f"    failed: {err}")
            last = err
    raise SystemExit(f"every Overpass endpoint failed: {last}")


def geom_of(el):
    """Overpass `out geom` puts coordinates inline, on ways and on members."""
    if el.get("type") == "way" and el.get("geometry"):
        return [[(p["lon"], p["lat"]) for p in el["geometry"]]]
    if el.get("type") == "relation":
        rings = []
        for m in el.get("members", []):
            if m.get("geometry"):
                rings.append([(p["lon"], p["lat"]) for p in m["geometry"]])
        return rings
    return []


def span(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return max(max(xs) - min(xs), max(ys) - min(ys))


def flatten(points, q=5):
    out = []
    for x, y in points:
        out.append(round(x, q))
        out.append(round(y, q))
    return out


def build_land(coast_rings, bbox, ne_land_path):
    """
    Assemble OSM coastline lines into land polygons.

    OSM does not ship land as polygons — it ships `natural=coastline` as
    directed lines, and every renderer is expected to close them itself.
    Skipping that step is what produced the visible bug: the land/sea shape
    still came from Natural Earth (1:10M, roughly a kilometre out) while the
    fine OSM coastline was stroked on top of it, so Boston had two coastlines
    about a kilometre apart.

    The assembly: cut the bounding box along the coastline and polygonize the
    result, which yields faces that are each wholly land or wholly sea. Then
    ask Natural Earth which is which — it is too coarse to draw with, but it
    is entirely accurate enough to classify a face tens of kilometres across.
    """
    w, s_, e, n = bbox
    frame = box(w, s_, e, n)

    lines = [LineString(r) for r in coast_rings if len(r) >= 2]
    if not lines:
        return []

    # unary_union nodes the lines against each other and the frame, which
    # matters: OSM ways meet end to end but polygonize needs them noded.
    faces = list(polygonize(unary_union(lines + [frame.boundary])))
    if not faces:
        return []

    print(f"  coastline splits the box into {len(faces)} faces")

    ne = load_ne_land(ne_land_path, frame)
    if ne is None:
        return []

    land = [f for f in faces if ne.contains(f.representative_point())]
    print(f"  {len(land)} of them are land")
    if not land:
        return []

    merged = unary_union(land).intersection(frame)
    return merged


def load_ne_land(path: Path, frame):
    """Natural Earth land, clipped to the frame — used only to classify."""
    if not path.exists():
        print(f"  ! {path.name} not downloaded — cannot classify land from sea")
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    parts = []
    for feat in data.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        g = shape(geom)
        if g.intersects(frame):
            parts.append(g.buffer(0).intersection(frame))
    return unary_union(parts) if parts else None


def rings_of_geom(geom):
    """Flatten a (Multi)Polygon into exterior + interior rings."""
    if geom.is_empty:
        return []
    polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    out = []
    for poly in polys:
        parts = [list(poly.exterior.coords)]
        parts += [list(r.coords) for r in poly.interiors]
        out.append(parts)
    return out


def main() -> int:
    pack = sys.argv[1] if len(sys.argv) > 1 else "american-revolution"
    if pack not in THEATRES:
        print(f"no theatre bbox declared for {pack}")
        return 1

    s, w, n, e = THEATRES[pack]

    # Cache the raw response. Overpass is a shared public service and this
    # query is expensive; re-running the trim should not cost them anything.
    raw = ROOT / "assets" / "geo" / "_src" / f"osm-{pack}.json"
    if raw.exists() and "--refresh" not in sys.argv:
        print(f"  using cached {raw.name} (pass --refresh to re-query)")
        data = json.loads(raw.read_text(encoding="utf-8"))
    else:
        data = fetch(QUERY.format(s=s, w=w, n=n, e=e))
        raw.parent.mkdir(parents=True, exist_ok=True)
        raw.write_text(json.dumps(data), encoding="utf-8")

    els = data.get("elements", [])
    print(f"  {len(els)} elements")

    # Tolerance ~11 m: finer than a pixel at zoom 14, and the whole point is
    # that this level is only ever drawn when you are standing in it.
    TOL = 0.0001
    MIN_WATER = 0.0016   # bbox diagonal in degrees, roughly 150 m
    # Woods are kept only when they are big enough to read as ground rather
    # than as speckle. Modern OSM maps every copse behind a supermarket; at
    # the zooms this level is drawn, anything under about half a kilometre is
    # noise that costs bytes and says nothing.
    MIN_WOOD = 0.007
    water, coast, rivers, woods = [], [], [], []
    for el in els:
        tags = el.get("tags") or {}
        kind = tags.get("natural") or tags.get("waterway") or tags.get("landuse")
        for ring in geom_of(el):
            pts = simplify(ring, TOL)
            if len(pts) < 2:
                continue
            flat = flatten(pts)
            if kind == "coastline":
                coast.append([flat])
            elif kind == "water":
                # Eastern Massachusetts has thousands of ponds smaller than a
                # pixel at the zooms this level is drawn at. Keeping them costs
                # megabytes and shows nothing.
                if len(pts) >= 3 and span(pts) >= MIN_WATER:
                    water.append([flat])
            elif kind in ("river", "stream"):
                rivers.append([flat])
            elif kind in ("wood", "forest"):
                if len(pts) >= 3 and span(pts) >= MIN_WOOD:
                    woods.append([flat])

    # Coastline lines -> land polygons, so the map has ONE coast.
    coast_rings = []
    for parts in coast:
        for flat in parts:
            coast_rings.append([(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)])
    land_geom = build_land(coast_rings, (w, s, e, n),
                           ROOT / "assets" / "geo" / "_src" / "ne_10m_land.json")

    land = []
    if land_geom is not None and not getattr(land_geom, "is_empty", True):
        for parts in rings_of_geom(land_geom.simplify(TOL, preserve_topology=True)):
            land.append([flatten(r) for r in parts])

    out = {
        "name": f"{pack}-detail",
        "scale": "osm",
        "bbox": [w, s, e, n],
        # Woods are the reason inland New England is worth drawing at all.
        # Without them the ground between Boston and Concord is blank: this
        # extract is otherwise water, and away from the harbour there is
        # hardly any. The men at Meriam's Corner were firing from behind
        # trees; the map should have some.
        "layers": {"land": land, "woods": woods, "lakes": water, "rivers": rivers},
        "credit": "© OpenStreetMap contributors, ODbL",
    }
    dest = ROOT / "content" / pack / "geo" / "detail.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    pts = sum(len(f) // 2 for layer in out["layers"].values() for sh in layer for f in sh)
    print(f"  land {len(land)}, woods {len(woods)}, water {len(water)}, "
          f"rivers {len(rivers)}")
    print(f"  {pts} points -> {dest.relative_to(ROOT)}  {dest.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
