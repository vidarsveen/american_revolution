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

from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# pack -> (south, west, north, east)
def theatre(pack):
    """The close-in box, from content/<pack>/pack.json map.detail.bbox.

    It used to be a table in here keyed by pack name, which is a tool holding
    a fact about a subject. The bbox is written [w, s, e, n] in the manifest,
    the way GeoJSON and the map module write it; Overpass wants (s, w, n, e).
    """
    path = ROOT / "content" / pack / "pack.json"
    if not path.exists():
        return None
    manifest = json.loads(path.read_text(encoding="utf-8"))
    bbox = ((manifest.get("map") or {}).get("detail") or {}).get("bbox")
    if not bbox or len(bbox) != 4:
        return None
    w, s_, e, n = bbox
    return (s_, w, n, e)

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
    result, which yields faces that are each wholly land or wholly sea. Which
    is which comes from the coastline's own direction — see classify() below.
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
    land = classify(faces, lines, ne)
    print(f"  {len(land)} of them are land")
    if not land:
        return []

    merged = unary_union(land).intersection(frame)
    return merged


# A ring edge either lies ON a coastline segment or it does not. Noding splits
# segments; it does not move their points, so the distance is a floating-point
# residue rather than a tolerance to tune.
ON_LINE = 1e-9


def classify(faces, lines, ne):
    """Which faces are land, from the coastline's own direction.

    OSM draws `natural=coastline` with LAND ON THE LEFT of the way. That is
    the only statement in the data about which side is which, and it is the
    one that holds at any scale.

    This used to ask Natural Earth instead — is this face's representative
    point inside NE's land polygon? — on the reasoning that 1:10M is coarse to
    draw with but accurate enough to classify a face tens of kilometres
    across. That reasoning is true for a harbour and false for a fjord, and
    the difference is not a matter of degree. Natural Earth has no Ofotfjord
    at all: the whole of Nordland is one land polygon, so every face inside it
    — sea and mountain alike — came back "land", and the Narvik pack rendered
    a hundred kilometres of coast with no water anywhere in it. It looked like
    a rendering bug and it was a classification bug.

    So the test is on the EDGE, not on the middle of the face. Orient the face
    counter-clockwise, which puts its interior on the left of its own ring, and
    find a ring edge that lies on a coastline segment. If the two run the same
    way, land-on-the-left and interior-on-the-left are the same side, and the
    face is land. If they run opposite, it is sea. Comparing a point in the
    middle of the face against the NEAREST coastline instead fails wherever a
    channel is narrow, because the nearest coast is then the far shore: it put
    Ofotfjord on the land side of both its own banks at once.

    A face that touches no coastline at all — open sea past the last island, or
    inland past the last shore — has nothing to be left or right of, and
    Natural Earth decides that one, which is what it is good at.
    """
    segs = []
    for line in lines:
        cs = list(line.coords)
        segs.extend((a, b) for a, b in zip(cs, cs[1:]) if a != b)
    if not segs:
        return [f for f in faces if ne is not None
                and ne.contains(f.representative_point())]

    tree = STRtree([LineString(s) for s in segs])
    land, by_ne = [], 0

    for f in faces:
        ring = orient(f, 1.0).exterior          # CCW: interior on the left
        cs = list(ring.coords)
        verdict = None
        for a, b in zip(cs, cs[1:]):
            mid = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            i = tree.nearest(mid)
            (sa, sb) = segs[i]
            if mid.distance(LineString((sa, sb))) > ON_LINE:
                continue                        # this edge is frame, not coast
            same = ((b[0] - a[0]) * (sb[0] - sa[0])
                    + (b[1] - a[1]) * (sb[1] - sa[1])) > 0
            verdict = same
            break
        if verdict is None:
            by_ne += 1
            verdict = ne is not None and ne.contains(f.representative_point())
        if verdict:
            land.append(f)

    if by_ne:
        print(f"  {by_ne} face(s) touch no coastline — classified from Natural Earth")
    return land


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
    """Flatten a (Multi)Polygon into exterior + interior rings.

    Tolerates a GeometryCollection: unioning a few thousand faces and clipping
    to the frame can leave a stray LineString where two of them met along an
    edge, and one of those used to stop the whole build with
    'GeometryCollection object has no attribute exterior'.
    """
    if geom.is_empty:
        return []
    polys = (list(geom.geoms) if geom.geom_type in ("MultiPolygon", "GeometryCollection")
             else [geom])
    polys = [p for p in polys if p.geom_type == "Polygon" and not p.is_empty]
    out = []
    for poly in polys:
        parts = [list(poly.exterior.coords)]
        parts += [list(r.coords) for r in poly.interiors]
        out.append(parts)
    return out


def main() -> int:
    pack = sys.argv[1] if len(sys.argv) > 1 else None
    if not pack:
        print("usage: fetch-detail.py <pack>", file=sys.stderr)
        return 2
    box = theatre(pack)
    if box is None:
        print(f"no theatre bbox declared for {pack}")
        return 1

    s, w, n, e = box

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
    # Roughly 440 m. Eastern Massachusetts has three thousand ponds inside
    # this box and half of them are under 360 m — a dozen pixels at the zooms
    # this level is drawn at. They are not water you can see, they are
    # speckle, and every one of them is re-walked whenever the ground is
    # baked. Keeping only the ones big enough to be a place cuts the lake
    # geometry by 60% and loses nothing anyone could point at.
    MIN_WATER = 0.004
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
