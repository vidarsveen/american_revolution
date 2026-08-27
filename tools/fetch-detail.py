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
import os
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
    # One box or several. A course goes where its chapters go, so `detail` may
    # be a list; `--box <n>` picks one, and the default is the first.
    spec = (manifest.get("map") or {}).get("detail")
    levels = spec if isinstance(spec, list) else ([spec] if spec else [])
    if not levels:
        return None
    which = 0
    for i, arg in enumerate(sys.argv):
        if arg == "--box" and i + 1 < len(sys.argv):
            which = int(sys.argv[i + 1])
    if which >= len(levels):
        return None
    bbox = (levels[which] or {}).get("bbox")
    if not bbox or len(bbox) != 4:
        return None
    globals()["LEVEL"] = levels[which]
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


def deepest_zoom(pack: str) -> float:
    """The closest a chapter of this pack ever gets, from its own data.

    A tolerance is a statement about pixels, and pixels depend on the zoom the
    geometry is actually drawn at — which is a property of the SUBJECT. This
    file used a flat 0.0001 for every pack, described as "finer than a pixel at
    zoom 14", and measured against what the packs really do it is 0.38 px for
    the wine course (deepest zoom 12.4) and 2.03 px for the Revolution (14.8, a
    beach a chapter stands on). One number for every subject is the same defect
    as one fill lightness for every hue.
    """
    zmax = 0.0
    for path in sorted((ROOT / "content" / pack).glob("chapter-*.json")):
        ch = json.loads(path.read_text(encoding="utf-8"))
        for place in (ch.get("places") or {}).values():
            zmax = max(zmax, float(place.get("zoom") or 0))
        for scene in ch.get("scenes", []):
            for beat in scene.get("beats", []):
                for cue in beat.get("cues", []):
                    z = cue.get("zoom")
                    if isinstance(z, (int, float)):
                        zmax = max(zmax, float(z))
    conf = (json.loads((ROOT / "content" / pack / "pack.json")
                       .read_text(encoding="utf-8")).get("map") or {}).get("zoom") or {}
    zmax = max(zmax, float(conf.get("maxFit") or 0))
    return zmax or 14.0


def tolerance_for(pack: str, share: float = 0.7) -> float:
    """Degrees per `share` of a pixel at the deepest zoom this pack reaches."""
    return share * 360.0 / (256.0 * 2 ** deepest_zoom(pack))


def resimplify(pack: str) -> int:
    """Thin an existing detail.json to this pack's own tolerance.

    Separate from the fetch on purpose: Overpass is a shared public service and
    re-querying it to change a rounding is rude. It NEVER refines — a file
    already coarser than the pack's tolerance is left alone, because the detail
    it dropped is not in the file to put back.

    RUN tools/check-sealanes.py AFTERWARDS, and this is not a formality: thinning
    a coastline MOVES THE SHORE, and a ship's track that ran a hundred metres off
    a headland can end up crossing it. Narvik was thinned by 11 % and
    `hardy-ut` leg 4->5 came out over land; the 11 % was not worth a chapter's
    route, and that pack was put back. The check is in check-all, so the system
    caught it — but it caught it after the fact, and this is the note that says
    to expect it.
    """
    done = 0
    for level in levels_of(pack):
        done |= resimplify_one(pack, level)
    return done


def levels_of(pack):
    """Every close-in box this pack declares, as a list."""
    path = ROOT / "content" / pack / "pack.json"
    if not path.exists():
        return []
    spec = ((json.loads(path.read_text(encoding="utf-8")).get("map") or {})
            .get("detail"))
    return spec if isinstance(spec, list) else ([spec] if spec else [])


def resimplify_one(pack, level):
    dest = ROOT / "content" / pack / (level.get("url") or "geo/detail.json")
    if not dest.exists():
        print(f"  {pack}: no {level.get('url', 'geo/detail.json')}")
        return 0
    data = json.loads(dest.read_text(encoding="utf-8"))
    tol = tolerance_for(pack)
    z = deepest_zoom(pack)
    before = sum(len(r) // 2 for lay in data["layers"].values()
                 for shape_ in lay for r in shape_)
    out = {}
    for name, layer in data["layers"].items():
        kept = []
        for shape_ in layer:
            rings = []
            for ring in shape_:
                pts = [(ring[i], ring[i + 1]) for i in range(0, len(ring), 2)]
                if len(pts) < 3:
                    rings.append(ring)
                    continue
                thin = LineString(pts).simplify(tol, preserve_topology=False)
                rings.append(flatten(list(thin.coords)))
            if rings:
                kept.append(rings)
        out[name] = kept
    after = sum(len(r) // 2 for lay in out.values()
                for shape_ in lay for r in shape_)
    # Under 2% is not a thinning, it is a rewrite of a two-megabyte file for
    # nothing — and on a frozen pack it is a diff somebody has to read.
    if after >= before * 0.98:
        print(f"  {pack}: already at or under {tol:.6f}deg "
              f"(0.7 px at zoom {z}) — nothing worth thinning")
        return 0
    data["layers"] = out
    dest.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"  {pack}: deepest zoom {z}, tolerance {tol:.6f}deg (0.7 px there)")
    print(f"    {before} -> {after} points ({100 * after / before:.0f}%), "
          f"{dest.stat().st_size / 1024:.0f} KB")
    return 0


def main() -> int:
    pack = sys.argv[1] if len(sys.argv) > 1 else None
    if not pack:
        print("usage: fetch-detail.py <pack> [--resimplify]", file=sys.stderr)
        return 2
    if "--resimplify" in sys.argv:
        return resimplify(pack)
    box = theatre(pack)
    if box is None:
        print(f"no theatre bbox declared for {pack}")
        return 1

    s, w, n, e = box

    # Cache the raw response. Overpass is a shared public service and this
    # query is expensive; re-running the trim should not cost them anything.
    # Per level: two boxes for one pack are two different queries, and the
    # cache keyed by pack alone silently handed the second one the first
    # one's elements.
    level = globals().get("LEVEL") or {}
    stem = os.path.splitext(os.path.basename(level.get("url", "detail.json")))[0]
    raw = ROOT / "assets" / "geo" / "_src" / f"osm-{pack}-{stem}.json"
    if raw.exists() and "--refresh" not in sys.argv:
        print(f"  using cached {raw.name} (pass --refresh to re-query)")
        data = json.loads(raw.read_text(encoding="utf-8"))
    else:
        data = fetch(QUERY.format(s=s, w=w, n=n, e=e))
        raw.parent.mkdir(parents=True, exist_ok=True)
        raw.write_text(json.dumps(data), encoding="utf-8")

    els = data.get("elements", [])
    print(f"  {len(els)} elements")

    # 0.7 px at the deepest zoom this pack's own chapters reach — see
    # tolerance_for(). It was a flat 0.0001 for every subject, which is 0.38 px
    # for the wine course and 2.03 px for the Revolution: too fine for one and
    # already coarse for the other, from one number that knew about neither.
    TOL = tolerance_for(pack)
    print(f"  tolerance {TOL:.6f}deg (0.7 px at zoom {deepest_zoom(pack)})")
    # Roughly 440 m. Eastern Massachusetts has three thousand ponds inside
    # this box and half of them are under 360 m — a dozen pixels at the zooms
    # this level is drawn at. They are not water you can see, they are
    # speckle, and every one of them is re-walked whenever the ground is
    # baked. Keeping only the ones big enough to be a place cuts the lake
    # geometry by 60% and loses nothing anyone could point at.
    # …and how big a pond or a wood has to be to be worth drawing is a fact
    # about the SUBJECT's country, not about this tool. Eastern Massachusetts
    # has three thousand ponds; Tuscany has four thousand copses, and at the
    # default the box came to 4.4 MB against the Langhe's 1.1. `minWater` and
    # `minWood` on the level in pack.json override these.
    MIN_WATER = float(level.get("minWater", 0.004))
    # Woods are kept only when they are big enough to read as ground rather
    # than as speckle. Modern OSM maps every copse behind a supermarket; at
    # the zooms this level is drawn, anything under about half a kilometre is
    # noise that costs bytes and says nothing.
    MIN_WOOD = float(level.get("minWood", 0.007))
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
    dest = ROOT / "content" / pack / (level.get("url") or "geo/detail.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    pts = sum(len(f) // 2 for layer in out["layers"].values() for sh in layer for f in sh)
    print(f"  land {len(land)}, woods {len(woods)}, water {len(water)}, "
          f"rivers {len(rivers)}")
    print(f"  {pts} points -> {dest.relative_to(ROOT)}  {dest.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
