#!/usr/bin/env python3
"""Put a parked plate cue back once its picture has been accepted.

    .venv/Scripts/python.exe tools/unpark-plates.py italy-wine/chapter-1-piemonte

Pictures take three minutes each to generate, and a chapter that names one
which does not exist fails check-script -- correctly. So the plate cues for
pictures still in the queue are parked in a sidecar and the chapter ships
with what it has. This puts them back, one at a time, as each picture lands.

Parked rather than deleted on purpose: a cue quietly dropped is a picture
nobody remembers was meant to be there.
"""
import io, json, os, sys, collections

O = collections.OrderedDict
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIDE = os.path.join(os.environ.get("TEMP", "/tmp"), "parked-plates.json")

target = sys.argv[1] if len(sys.argv) > 1 else "italy-wine/chapter-1-piemonte"
pack, cid = target.split("/", 1)
cpath = os.path.join(ROOT, "content", pack, f"{cid}.json")

parked = json.loads(io.open(SIDE, encoding="utf-8").read()) if os.path.exists(SIDE) else {}
media = set(json.loads(io.open(os.path.join(ROOT, "content", pack, "media.json"),
                              encoding="utf-8").read()))
ch = json.loads(io.open(cpath, encoding="utf-8").read(), object_pairs_hook=O)
beats = {b["id"]: b for s in ch["scenes"] for b in s["beats"]}

restored = []
for mid, rec in list(parked.items()):
    if mid not in media:
        continue
    bid, cue = rec["show"]
    beat = beats.get(bid)
    if not beat:
        print(f"  ! {mid}: no beat {bid}")
        continue
    if any(c["do"] == "plate.show" and c.get("id") == mid for c in beat["cues"]):
        del parked[mid]
        continue
    beat["cues"].append(cue)
    restored.append(f"{mid} -> {bid}")
    del parked[mid]

io.open(cpath, "w", encoding="utf-8", newline="\n").write(
    json.dumps(ch, ensure_ascii=False, indent=2) + "\n")
io.open(SIDE, "w", encoding="utf-8", newline="\n").write(
    json.dumps(parked, ensure_ascii=False, indent=1) + "\n")
print("restored:", ", ".join(restored) or "none")
print("still parked:", ", ".join(sorted(parked)) or "none")
