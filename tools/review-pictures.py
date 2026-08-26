#!/usr/bin/env python3
"""
review-pictures.py — put every picture beside the sentence it sits under.

    python tools/review-pictures.py italy-wine
    python tools/review-pictures.py italy-wine hender-host
    python tools/review-pictures.py italy-wine --json
    python tools/review-pictures.py italy-wine --set hender-host "a corrected prompt"

`gen-image.py` makes pictures and `check-pictures.py` prints the rhythm. The
review between them did not exist, and it is the one that matters: EVERY defect
in the first nine generated pictures was semantic. A pit instead of a redoubt.
Two bottles instead of one. A steamboat behind an 18th-century hillside — and of
two candidates for the same prompt, the prettier painting was the one with the
steamboat in it. Nothing about how good a picture looks says whether it shows
the thing being said.

So this tool does not judge. It ASSEMBLES the packet a judgement needs, which is
the part that is tedious enough to be skipped:

    the picture, and the file to open
    every sentence it is on screen for, in both languages, in order
    the prompt that produced it, and its recorded claims and omits
    how long it holds, and what it interrupts

and then it asks the question out loud, because no tool reads a sentence.

ONE NUMBER IS PRINTED, AND IT IS NOT A VERDICT. `claims` is written in English
and so is the English narration, so the words a picture ASSERTS can be counted
against the words actually SPOKEN while it is up, and the ones never said are
listed. The wine chapter's harvest plate claims "shears at the stem, the moment
before picking" over a sentence about why Nebbiolo is called Nebbiolo — the fog
it hangs into and the grey bloom on its skin. Neither shears nor picking is ever
said, and the shears the model drew are a pair of pliers.

The number was tried as a flag and then as an order, and both are recorded here
rather than quietly dropped:

  as a FLAG it fired on all twelve pictures in the chapter, good ones included.
  Of course it did — `claims` describes a picture and narration is prose about a
  subject, and they are supposed to share few words. A note on everything says
  nothing: a bench that never fails, with the sign flipped.

  as an ORDER it put three pictures at the top on 0 of 9 or 10 words and all
  three were right. "Italy is full of mountains" over a narrow valley with one
  road matches no word and says exactly the right thing. The picture that IS
  wrong sat in the middle.

So the report comes out in the order a viewer meets the pictures, which is how a
chapter is read, and the number is one more line for the reader to weigh.

--set writes a corrected prompt back into content/<pack>/image-prompts.json and
prints the command that re-renders it. Nothing regenerates automatically:
a picture costs a GPU minute and a person has to look at the result anyway.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# The Windows console is cp1252 and raises on an em-dash, which is a silly way
# for a report to die. Same three lines as check-all.py.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# Words that carry no claim. Small on purpose: a list long enough to be safe is
# long enough to hide the noun that matters.
STOP = {
    "a", "an", "and", "the", "of", "on", "in", "at", "to", "with", "from",
    "for", "it", "its", "is", "are", "was", "were", "be", "been", "that",
    "this", "these", "those", "not", "no", "or", "but", "as", "by", "into",
    "over", "under", "above", "below", "behind", "front", "frame", "left",
    "right", "one", "two", "three", "some", "any", "all", "more", "most",
    "very", "same", "other", "another", "there", "here", "than", "then",
    "which", "who", "what", "where", "when", "how", "picture", "photograph",
    "image", "shot", "view", "scene", "light", "colour", "color", "soft",
    "close", "up", "out", "down", "off", "still", "just", "only", "own",
}


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def chapters_of(pack: str) -> list[str]:
    d = os.path.join(CONTENT, pack)
    return sorted(f[:-5] for f in os.listdir(d)
                  if f.startswith("chapter-") and f.endswith(".json"))


def beat_times(pack: str, chapter_id: str, lang: str) -> dict:
    """{beat id: (start, dur)} — the recorded timing is the only place a beat
    has a duration at all. Same reader as check-pictures.py."""
    t = load(os.path.join(CONTENT, pack, f"timing.{chapter_id}.{lang}.json"))
    if not t:
        return {}
    out = {}
    scenes = t.get("scenes", t)
    for _sid, scene in (scenes.items() if isinstance(scenes, dict) else []):
        for b in (scene.get("beats") if isinstance(scene, dict) else scene) or []:
            out[b["id"]] = (b.get("start", 0.0), b.get("dur", 0.0))
    return out


def spans(chapter: dict, times: dict) -> list[dict]:
    """Every stretch a plate is on screen, and the beats it covers.

    A plate goes down three ways — hidden, replaced, or wiped by the scene
    change — and the third is the one a reader of the script never sees. The
    Bunker Hill bug was this shape one layer over: what is on screen at the end
    of a scene is not in the script anywhere.
    """
    out = []
    for scene in chapter["scenes"]:
        beats = scene["beats"]
        s_end = sum(times.get(beats[-1]["id"], (0.0, 0.0)))
        open_at = open_id = None
        covered: list[dict] = []

        def close(end):
            nonlocal open_id, open_at, covered
            if open_id:
                out.append({"id": open_id, "scene": scene["id"],
                            "start": open_at, "end": end,
                            "beats": covered})
            open_id = open_at = None
            covered = []

        for b in beats:
            at, dur = times.get(b["id"], (0.0, 0.0))
            if open_id:
                covered.append(b)
            for cue in b.get("cues", []):
                if cue["do"] == "plate.show":
                    if open_id != cue.get("id"):
                        close(at)
                        open_id, open_at = cue.get("id"), at
                        covered = [b]
                elif cue["do"] == "plate.hide" and open_id:
                    close(at + (dur if cue.get("on") == "end" else 0.0))
        close(s_end)                      # the scene wipe takes it down
    return out


def words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-zA-Z']{3,}", (text or "").lower())
            if w not in STOP]


def overlap(claims: str, sentences: list[str]) -> tuple[int, int, list[str]]:
    """How much of what the picture asserts is actually spoken while it is up.

    INFORMATION, NOT A VERDICT — see the module docstring for the two things
    this number was tried as first, and why it is neither. `claims` describes a
    PICTURE ("large wooden casks in an old cellar") and narration is prose about
    a SUBJECT ("at least eighteen of them in wood"); they are supposed to share
    few words, so a low score is a prompt to look and nothing more.

    Crude on purpose: no stemming beyond a plural, no synonyms. A word that IS
    in the narration under another form scores as missing and a reader dismisses
    it in a second; a word genuinely never said is the point.
    """
    spoken = set()
    for s in sentences:
        for w in words(s):
            spoken.add(w)
            spoken.add(w.rstrip("s"))
    asked, hit, missing = [], 0, []
    for w in words(claims):
        if w in asked:
            continue
        asked.append(w)
        # Both ways round: "wooden" against a spoken "wood" as well as the
        # reverse. One-directional, it scored the cellar plate 0 of 9 over a
        # sentence that says "eighteen of them in wood".
        stem = w[:5]
        if w in spoken or w.rstrip("s") in spoken or (len(w) >= 5 and any(
                sp.startswith(stem) or stem.startswith(sp[:5]) for sp in spoken)):
            hit += 1
        else:
            missing.append(w)
    return hit, len(asked), missing


def review(pack: str, only: list[str], as_json: bool) -> int:
    media = load(os.path.join(CONTENT, pack, "media.json"), {}) or {}
    prompts = load(os.path.join(CONTENT, pack, "image-prompts.json"), {}) or {}

    # Where every picture is used, across every chapter of the pack.
    used: dict[str, list[dict]] = {}
    for cid in chapters_of(pack):
        chapter = load(os.path.join(CONTENT, pack, f"{cid}.json"))
        if not chapter:
            continue
        langs = chapter.get("langs") or ["no", "en"]
        times = beat_times(pack, cid, langs[0])
        if not times:
            print(f"  no timing for {cid} — run tools/narrate.py", file=sys.stderr)
            continue
        for span in spans(chapter, times):
            span["chapter"] = cid
            span["langs"] = langs
            used.setdefault(span["id"], []).append(span)

    ids = [i for i in (only or sorted(prompts)) if i != "//"]
    packet = []
    for pid in ids:
        entry = media.get(pid) or {}
        prompt = prompts.get(pid) or {}
        if not entry and not prompt:
            print(f"  '{pid}' is in neither media.json nor image-prompts.json",
                  file=sys.stderr)
            continue
        item = {
            "id": pid,
            "kind": entry.get("kind", "?"),
            "file": os.path.join("content", pack, "media", entry.get("file", "")),
            "prompt": prompt.get("prompt") or entry.get("prompt", ""),
            "style": prompt.get("style", ""),
            "aspect": prompt.get("aspect", ""),
            "claims": entry.get("claims") or prompt.get("claims", ""),
            "omits": entry.get("omits") or prompt.get("omits", ""),
            "uses": [],
            "notes": [],
        }
        for span in used.get(pid, []):
            lang = span["langs"][-1]        # the English, to compare with claims
            first = span["langs"][0]
            item["uses"].append({
                "chapter": span["chapter"],
                "scene": span["scene"],
                "start": round(span["start"], 1),
                "seconds": round(span["end"] - span["start"], 1),
                "beats": [{"id": b["id"],
                           first: (b.get("say") or {}).get(first, ""),
                           lang: (b.get("say") or {}).get(lang, "")}
                          for b in span["beats"]],
            })
        # The English, because `claims` is written in English. A pack with no
        # English simply gets no note rather than a nonsense one.
        spoken = [text for use in item["uses"] for b in use["beats"]
                  for key, text in b.items() if key == "en" and text]
        if not item["uses"]:
            item["notes"].append("never shown — no plate.show names it")
        if not item["claims"]:
            item["notes"].append("no `claims` recorded")
        if not item["omits"] and item["kind"] == "made":
            item["notes"].append("no `omits` recorded — that is the field that "
                                 "says what the picture is NOT evidence of")
        if item["claims"] and spoken:
            hit, asked, missing = overlap(item["claims"], spoken)
            item["match"] = {"spoken": hit, "asserted": asked,
                             "share": round(hit / asked, 2) if asked else None,
                             "missing": missing}
        packet.append(item)

    # IN THE ORDER A VIEWER MEETS THEM, and not by the score. Sorting by the
    # word match was tried, and it is recorded here rather than quietly dropped:
    # of the twelve wine pictures it put dal-avstengt, gammel-stokk and
    # kjeller-fat at the top on 0 of 9 or 10 words, and all three are right —
    # "Italy is full of mountains" over a valley with one road matches nothing
    # and says exactly the right thing. The one picture that IS wrong sat in
    # the middle. An order implies that what it is ordered by predicts
    # something, and this one does not. Chapter order is how a chapter is read.
    def when(item):
        # A timing file starts each SCENE at zero, so a beat offset only orders
        # within its scene. Sorting on it alone put scene 4 before scene 1.
        if not item["uses"]:
            return ("zzz", 999, 0.0)
        use = item["uses"][0]
        digits = "".join(c for c in use["scene"] if c.isdigit())
        return (use["chapter"], int(digits or 999), use["start"])

    packet.sort(key=when)

    if as_json:
        print(json.dumps(packet, ensure_ascii=False, indent=1))
        return 0

    for item in packet:
        rule = "─" * 72
        print(f"\n{rule}\n{item['id']}   ({item['kind']})")
        print(f"  file    {item['file']}")
        if not item["uses"]:
            print("  WHERE   never shown")
        for use in item["uses"]:
            print(f"  WHERE   {use['chapter']}  {use['scene']}  "
                  f"{use['seconds']:.0f}s over {len(use['beats'])} beat(s)")
            for b in use["beats"]:
                head = f"    {b['id']:<7}"
                for lang, text in b.items():
                    if lang == "id" or not text:
                        continue
                    print(f"{head} {lang}  {text}")
                    head = " " * len(head)
        if item["prompt"]:
            print(f"  ASKED   {item['prompt']}")
        if item["style"]:
            print(f"  STYLE   {item['style']}")
        if item["claims"]:
            print(f"  CLAIMS  {item['claims']}")
        if item["omits"]:
            print(f"  OMITS   {item['omits']}")
        m = item.get("match")
        if m and m["asserted"]:
            print(f"  MATCH   {m['spoken']} of {m['asserted']} words this "
                  f"picture asserts are spoken while it is up")
            if m["missing"]:
                print(f"          never said: {', '.join(m['missing'])}")
        for note in item["notes"]:
            print(f"  NOTE    {note}")
        print("  ASK     Does this picture show the thing being said? Open the "
              "file and read the sentences above it.")

    print(f"\n{len(packet)} picture(s). Nothing here fails a build: whether a "
          f"picture shows what a sentence says\nis a judgement, and this tool "
          f"exists so that making it does not mean opening four files.")
    return 0


def set_prompt(pack: str, pid: str, prompt: str) -> int:
    path = os.path.join(CONTENT, pack, "image-prompts.json")
    data = load(path)
    if data is None:
        print(f"no {path}", file=sys.stderr)
        return 2
    if pid not in data:
        print(f"'{pid}' is not in image-prompts.json — the ones there are: "
              f"{', '.join(k for k in data if k != '//')}", file=sys.stderr)
        return 2
    before = data[pid].get("prompt", "")
    if before == prompt:
        print("that is already the prompt")
        return 0
    data[pid]["prompt"] = prompt
    # The old one is not thrown away: what was asked for last time is how the
    # next person knows what the correction was FOR.
    data[pid]["//prompt-was"] = before
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {os.path.relpath(path, ROOT)}\n"
          f"  was: {before}\n  now: {prompt}\n\n"
          f"render it, then look at the candidates before accepting one:\n"
          f"  .venv/Scripts/python.exe tools/gen-image.py {pack} {pid} --candidates 4\n"
          f"  .venv/Scripts/python.exe tools/gen-image.py {pack} --accept {pid}=<n>")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pack")
    ap.add_argument("ids", nargs="*", help="default: every picture with a prompt")
    ap.add_argument("--json", action="store_true",
                    help="the same packet as JSON, for an agent to read")
    ap.add_argument("--set", nargs=2, metavar=("ID", "PROMPT"),
                    help="write a corrected prompt back into image-prompts.json")
    args = ap.parse_args()

    if not os.path.isdir(os.path.join(CONTENT, args.pack)):
        print(f"no pack '{args.pack}' in content/", file=sys.stderr)
        return 2
    if args.set:
        return set_prompt(args.pack, args.set[0], args.set[1])
    return review(args.pack, args.ids, args.json)


if __name__ == "__main__":
    sys.exit(main())
