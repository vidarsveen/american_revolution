"""Does tools/check-pack.py actually catch anything?

Four checks in this repo have passed while measuring nothing at all, so a
new one does not get to be trusted on the strength of a green line. This
reintroduces each bug into the beer course one at a time, confirms the
check fails, and puts the course back.

It edits real files and restores them. If it is interrupted, `git checkout
content/beer/pack.json content/beer/media.json content/packs.json` undoes it.

    python tools/check-pack-selftest.py
"""

import io, json, os, subprocess, sys, shutil

PACK = "content/beer/pack.json"
MEDIA = "content/beer/media.json"
orig_pack = io.open(PACK, encoding="utf-8").read()
orig_media = io.open(MEDIA, encoding="utf-8").read()

def run():
    r = subprocess.run([sys.executable, "tools/check-pack.py", "beer"],
                       capture_output=True, text=True)
    return r.returncode, r.stdout

def with_pack(fn):
    d = json.loads(orig_pack); fn(d)
    io.open(PACK, "w", encoding="utf-8", newline="\n").write(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n")

def restore():
    io.open(PACK, "w", encoding="utf-8", newline="\n").write(orig_pack)
    io.open(MEDIA, "w", encoding="utf-8", newline="\n").write(orig_media)

CASES = []

def case(name, setup):
    CASES.append((name, setup))

case("pool on disk, not declared (the music bug)",
     lambda: with_pack(lambda d: d["pools"].pop("sound")))
case("pool declared, file not there",
     lambda: with_pack(lambda d: d["pools"].update({"terms": "nope.json"})))
case("chapter declared, never compiled",
     lambda: with_pack(lambda d: d["chapters"].append({"id": "chapter-9-ghost"})))
case("surface declared that does not exist",
     lambda: with_pack(lambda d: d["surfaces"].append("hologram")))
case("picture declared, no file on disk",
     lambda: io.open(MEDIA, "w", encoding="utf-8", newline="\n").write(
         json.dumps({**json.loads(orig_media),
                     "spokelse": {"kind": "made", "file": "spokelse.jpg",
                                  "title": {"no": "x", "en": "x"}}},
                    ensure_ascii=False, indent=2) + "\n"))

def case_unregistered():
    p = "content/packs.json"
    d = json.load(io.open(p, encoding="utf-8"))
    io.open(p + ".bak", "w", encoding="utf-8", newline="\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    io.open(p, "w", encoding="utf-8", newline="\n").write(
        json.dumps([x for x in d if x != "beer"], ensure_ascii=False, indent=1) + "\n")
case("course not on the front door", case_unregistered)

ok = True
for name, setup in CASES:
    restore()
    setup()
    code, out = run()
    hit = [l.strip() for l in out.splitlines() if "FAIL:" in l]
    caught = code == 1 and hit
    print(f"{'CAUGHT ' if caught else 'MISSED '} {name}")
    if caught:
        print(f"         {hit[0][6:130]}")
    else:
        ok = False
    if name.startswith("course not"):
        shutil.move("content/packs.json.bak", "content/packs.json")

restore()
code, out = run()
print()
print("restored, and clean again:" , code == 0)
sys.exit(0 if ok and code == 0 else 1)
