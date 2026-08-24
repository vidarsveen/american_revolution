#!/usr/bin/env python3
"""
check-sealanes.py — a ship's track has to stay in the water.

    python tools/check-sealanes.py norway-1940
    python tools/check-sealanes.py norway-1940 --fix

A route in a chapter is just a list of coordinates, and the engine draws an
arrow along it. That is fine for a march, where the ground is ground. It is
not fine for a destroyer: the endpoints get anchored to the place the
narration names — a town — and the town is on land, so the arrow starts on a
hillside, crosses the fjord and finishes on another hillside. Two of the
Narvik tracks went further and ploughed straight over a headland.

Nothing measured that, because "is this coordinate in the sea" is not a
question the cue vocabulary can ask. This asks it, against the SAME geometry
the map paints — `content/<pack>/geo/detail.json`, drawn from OpenStreetMap —
so a pass here means the arrow you see is in the water you see.

A route declares what it travels on:

    "medium": "sea"    every vertex must be water
    "medium": "land"   every vertex must be land
    "medium": "shore"  an amphibious landing: water, ending on the beach
    (absent)           not checked — rail, front lines, schematic arrows

--fix does the repair rather than only reporting it: it snaps stray vertices
to the nearest water and, where a leg still crosses land, walks a detour
around the headland. It is a search, not a solver; it says what it could not
fix rather than pretending.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import sys
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

# How far a vertex may be moved before the move is a different claim about
# where the ship was, rather than a correction to where the pixel sits.
MAX_SNAP_M = 1200
# How finely a leg is sampled when asking whether it crosses land.
STEP_M = 120


def load_land(pack: str):
    path = ROOT / "content" / pack / "geo" / "detail.json"
    if not path.exists():
        return None, None
    data = json.loads(path.read_text(encoding="utf-8"))
    polys = []
    for poly in data.get("layers", {}).get("land", []):
        rings = []
        for flat in poly:
            if not isinstance(flat, list) or len(flat) < 8:
                continue
            rings.append([(flat[i], flat[i + 1]) for i in range(0, len(flat) - 1, 2)])
        if not rings:
            continue
        try:
            g = Polygon(rings[0], rings[1:])
            if not g.is_valid:
                g = g.buffer(0)
            if not g.is_empty:
                polys.append(g)
        except Exception:
            continue
    return polys, data.get("bbox")


class Ground:
    def __init__(self, polys, bbox):
        self.polys = polys
        self.tree = STRtree(polys) if polys else None
        self.bbox = bbox

    def covered(self, lat, lon):
        """Is this point inside the detail bbox at all? Outside it we know
           nothing, and saying nothing is better than guessing."""
        if not self.bbox:
            return False
        w, s, e, n = self.bbox
        return w <= lon <= e and s <= lat <= n

    def land(self, lat, lon):
        if not self.tree:
            return False
        pt = Point(lon, lat)
        return any(self.polys[i].contains(pt) for i in self.tree.query(pt))

    def water(self, lat, lon):
        return self.covered(lat, lon) and not self.land(lat, lon)


def metres(a, b):
    return math.hypot((a[0] - b[0]) * 111320.0,
                      (a[1] - b[1]) * 111320.0 * math.cos(math.radians(a[0])))


def nearest_water(g: Ground, lat, lon, limit=MAX_SNAP_M):
    """Walk outwards until off the land. Returns None rather than a guess."""
    if g.water(lat, lon):
        return (lat, lon)
    for r in range(60, limit + 1, 60):
        dlat = r / 111320.0
        dlon = r / (111320.0 * math.cos(math.radians(lat)))
        best = None
        for a in range(0, 360, 8):
            la = lat + dlat * math.cos(math.radians(a))
            lo = lon + dlon * math.sin(math.radians(a))
            if g.water(la, lo):
                d = metres((lat, lon), (la, lo))
                if best is None or d < best[0]:
                    best = (d, round(la, 4), round(lo, 4))
        if best:
            return (best[1], best[2])
    return None


def nearest_land(g: Ground, lat, lon, limit=MAX_SNAP_M):
    """The mirror of nearest_water, for a column that ended up in the sea."""
    if g.covered(lat, lon) and g.land(lat, lon):
        return (lat, lon)
    for r in range(60, limit + 1, 60):
        dlat = r / 111320.0
        dlon = r / (111320.0 * math.cos(math.radians(lat)))
        best = None
        for a in range(0, 360, 8):
            la = lat + dlat * math.cos(math.radians(a))
            lo = lon + dlon * math.sin(math.radians(a))
            if g.covered(la, lo) and g.land(la, lo):
                d = metres((lat, lon), (la, lo))
                if best is None or d < best[0]:
                    best = (d, round(la, 4), round(lo, 4))
        if best:
            return (best[1], best[2])
    return None


def leg_hits_land(g: Ground, a, b):
    """Sample the straight leg. Returns the first point that is on land."""
    d = metres(a, b)
    n = max(2, int(d / STEP_M))
    for i in range(1, n):
        t = i / n
        la = a[0] + (b[0] - a[0]) * t
        lo = a[1] + (b[1] - a[1]) * t
        if g.covered(la, lo) and g.land(la, lo):
            return (la, lo)
    return None


# Cell size for the local water grid, in metres. Ofotfjord is about a
# kilometre across at its narrowest, so 150 m keeps a channel several cells
# wide -- fine enough to find a way through, coarse enough to stay quick.
CELL_M = 150


def water_path(g: Ground, a, b, pad_m=4000):
    """A way from a to b that stays in the water, or None.

    A single perpendicular offset gets a ship round a headland. It cannot get
    one round a corner, and Ofotfjord turns twice and then forks -- so the
    Warspite track defeated it every time. This rasterises the water in a box
    around the two ends and walks it, which is what the shape of a fjord
    actually requires.

    Local, not global: the box is the leg plus a margin, so the grid stays a
    few tens of thousands of cells rather than half a million."""
    from collections import deque

    lat0 = min(a[0], b[0]) - pad_m / 111320.0
    lat1 = max(a[0], b[0]) + pad_m / 111320.0
    mlat = (a[0] + b[0]) / 2
    mpd = 111320.0 * math.cos(math.radians(mlat))
    lon0 = min(a[1], b[1]) - pad_m / mpd
    lon1 = max(a[1], b[1]) + pad_m / mpd

    # Coarsen rather than give up. A leg down a fjord wants 150 m cells; a leg
    # from Vestfjorden round Hinnoya to Harstad covers a degree and a half and
    # would be a million of them, and the guard was simply returning None --
    # so the one leg that most obviously ploughed through an island was the
    # one the pathfinder never even tried.
    cell = CELL_M
    while True:
        rows = max(2, int((lat1 - lat0) * 111320.0 / cell))
        cols = max(2, int((lon1 - lon0) * mpd / cell))
        if rows * cols <= 300_000 or cell > 1200:
            break
        cell *= 2
    if rows * cols > 300_000:
        return None

    def to_ll(r, c):
        return (lat0 + (r + 0.5) * (lat1 - lat0) / rows,
                lon0 + (c + 0.5) * (lon1 - lon0) / cols)

    def to_rc(lat, lon):
        r = int((lat - lat0) / (lat1 - lat0) * rows)
        c = int((lon - lon0) / (lon1 - lon0) * cols)
        return max(0, min(rows - 1, r)), max(0, min(cols - 1, c))

    # Rasterise once. Land outside the detail bbox counts as passable: we know
    # nothing there, and refusing to route through it would strand any leg
    # that leaves the mapped area.
    grid = bytearray(rows * cols)
    for r in range(rows):
        for c in range(cols):
            la, lo = to_ll(r, c)
            grid[r * cols + c] = 0 if (g.covered(la, lo) and g.land(la, lo)) else 1

    start, goal = to_rc(*a), to_rc(*b)
    for cell in (start, goal):
        grid[cell[0] * cols + cell[1]] = 1     # the ends are where we are told

    prev = {start: None}
    q = deque([start])
    while q:
        cur = q.popleft()
        if cur == goal:
            break
        r, c = cur
        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
            nr, nc = r + dr, c + dc
            if not (0 <= nr < rows and 0 <= nc < cols):
                continue
            if not grid[nr * cols + nc] or (nr, nc) in prev:
                continue
            prev[(nr, nc)] = cur
            q.append((nr, nc))
    if goal not in prev:
        return None

    cells = []
    cur = goal
    while cur is not None:
        cells.append(cur)
        cur = prev[cur]
    cells.reverse()
    pts = [to_ll(r, c) for r, c in cells]

    # String-pull: keep only the corners. A grid path has a step at every
    # cell and an arrow drawn along it looks like a staircase.
    out = [a]
    i = 0
    while i < len(pts) - 1:
        j = len(pts) - 1
        while j > i + 1 and leg_hits_land(g, out[-1], pts[j]):
            j -= 1
        out.append(pts[j])
        i = j
    if leg_hits_land(g, out[-1], b):
        return None
    out[-1] = b
    return [(round(la, 4), round(lo, 4)) for la, lo in out[1:-1]]


def detour(g: Ground, a, b):
    """One waypoint that gets a leg around a headland.

    Offsets perpendicular to the leg, nearest first, and takes the first
    offset where BOTH halves are clear. A fjord is narrow, so this converges
    in a few hundred metres or not at all."""
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    dy = (b[0] - a[0]) * 111320.0
    dx = (b[1] - a[1]) * 111320.0 * math.cos(math.radians(mid[0]))
    L = math.hypot(dx, dy) or 1.0
    px, py = -dy / L, dx / L          # unit normal, in metres
    for r in range(150, 4000, 150):
        for sign in (1, -1):
            la = mid[0] + sign * r * py / 111320.0
            lo = mid[1] + sign * r * px / (111320.0 * math.cos(math.radians(mid[0])))
            if not g.water(la, lo):
                continue
            p = (round(la, 4), round(lo, 4))
            if not leg_hits_land(g, a, p) and not leg_hits_land(g, p, b):
                return p
    return None


def check_route(g: Ground, rid, route, fix):
    """Returns (problems, fixed_coords_or_None)."""
    medium = route.get("medium")
    if medium not in ("sea", "land", "shore"):
        return [], None
    pts = [tuple(c) for c in route.get("coords") or []]
    if len(pts) < 2:
        return [], None

    problems0 = []
    if medium in ("sea", "shore") and route.get("strength"):
        # An arrow's width means men per metre of front. That is a true
        # statement about an army and a meaningless one about a squadron --
        # and it drew a hundred-metre-wide arrow up a fjord a kilometre across.
        problems0.append(f"{rid}: a sea route declares `strength`, which draws it as "
                         f"an arrow sized by men per metre of front. Use fleet.draw "
                         f"for ships and let the track stay thin.")

    problems, out, moved = list(problems0), [], 0

    for i, (lat, lon) in enumerate(pts):
        if not g.covered(lat, lon):
            out.append((lat, lon))
            continue
        last = (i == len(pts) - 1)
        # A landing ends ON the beach; everything before it is water.
        wants_land = medium == "land" or (medium == "shore" and last)
        if wants_land:
            if not g.land(lat, lon):
                snapped = nearest_land(g, lat, lon) if fix else None
                if snapped:
                    problems.append(f"{rid}: point {i} was in the water, moved "
                                    f"{metres((lat, lon), snapped):.0f} m ashore")
                    out.append(snapped)
                    moved += 1
                    continue
                problems.append(f"{rid}: point {i} is in the water and should be ashore")
            out.append((lat, lon))
            continue
        if g.land(lat, lon):
            if not fix:
                problems.append(f"{rid}: point {i} is on land and the route is at sea")
                out.append((lat, lon))
                continue
            snapped = nearest_water(g, lat, lon)
            if snapped:
                problems.append(
                    f"{rid}: point {i} was on land, moved {metres((lat, lon), snapped):.0f} m to water")
                out.append(snapped)
                moved += 1
            else:
                problems.append(f"{rid}: point {i} is on land and no water within "
                                f"{MAX_SNAP_M} m — needs a human")
                out.append((lat, lon))
        else:
            out.append((lat, lon))

    # Now the legs between them.
    if medium in ("sea", "shore"):
        i = 0
        guard = 0
        while i < len(out) - 1 and guard < 60:
            guard += 1
            a, b = out[i], out[i + 1]
            if not (g.covered(*a) and g.covered(*b)):
                i += 1
                continue
            # The last leg of a landing is supposed to reach the shore.
            if medium == "shore" and i == len(out) - 2:
                i += 1
                continue
            hit = leg_hits_land(g, a, b)
            if not hit:
                i += 1
                continue
            if not fix:
                problems.append(f"{rid}: the leg {i}->{i+1} crosses land")
                i += 1
                continue
            way = detour(g, a, b)
            if way:
                problems.append(f"{rid}: leg {i}->{i+1} crossed land, routed around it")
                out.insert(i + 1, way)
                moved += 1
            elif (path := water_path(g, a, b)
                          or water_path(g, a, b, pad_m=14000)):
                problems.append(f"{rid}: leg {i}->{i+1} crossed land, found a way "
                                f"through in {len(path)} step(s)")
                for k, p in enumerate(path):
                    out.insert(i + 1 + k, p)
                moved += 1
                i += len(path)
            else:
                problems.append(f"{rid}: leg {i}->{i+1} crosses land and no way round "
                                f"was found — needs a human")
                i += 1
    return problems, ([list(p) for p in out] if fix and moved else None)


def main() -> int:
    # Norwegian place names in a Windows console, without a crash.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("pack")
    ap.add_argument("--fix", action="store_true",
                    help="repair what can be repaired, in place")
    args = ap.parse_args()

    polys, bbox = load_land(args.pack)
    if not polys:
        print(f"{args.pack}: no geo/detail.json — nothing to check against")
        return 0
    g = Ground(polys, bbox)
    print(f"{args.pack}: {len(polys)} land polygons, bbox {bbox}")

    problems = 0
    checked = 0
    for path in sorted((ROOT / "content" / args.pack).glob("chapter-*.json")):
        ch = json.loads(path.read_text(encoding="utf-8"))
        routes = ch.get("routes") or {}
        changed = False
        for rid, route in routes.items():
            if not isinstance(route, dict):
                continue
            checked += 1
            found, fixed = check_route(g, rid, route, args.fix)
            for f in found:
                print(f"  {path.name}: {f}")
            problems += sum(1 for f in found if "needs a human" in f
                            or (not args.fix and ("crosses land" in f or "should be" in f)))
            if fixed:
                route["coords"] = fixed
                changed = True
        if changed:
            path.write_text(json.dumps(ch, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8", newline="\n")
            print(f"  {path.name}: rewritten")

    print(f"\n{checked} route(s) declared a medium; {problems} still wrong")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
