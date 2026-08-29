"""Is there ever nothing on the screen?

Answered from the script and the timing file, before anything runs. That is
the whole point: this question was previously answered either by playing a
chapter and watching it for ten minutes, or by a tool that kept its own copy
of the cue vocabulary and got it backwards.

    python tools/check-cover.py                  # the gate
    python tools/check-cover.py --sheet          # and print the timeline
    python tools/check-cover.py beer --sheet

A course is chapters; a chapter is scenes; a scene is a continuous run of
artifacts with no hole in it. A scene change wipes the stage, so every scene
has to establish its own picture and cannot inherit one.

WHAT COUNTS AS THE SCREEN BEING FULL is declared per verb in
engine/verbs.json under `occupies`, and read from there rather than guessed
at here. A `frame` artifact can carry the screen; `trim` cannot. A fact box,
a caption note and a row of stat chips are really on screen and really are
not a picture -- docs/design-direction.md calls a fact box "the picture's
edge, and nothing else" -- so a stretch showing only trim is still an empty
screen, and it is reported as one.

THE BED IS THE SAME QUESTION one channel over. A bed is state, not an event:
engine/surfaces/sound.js drops it at every scene change unless the new scene
asks again. Chapter one asked in its first scene and its last, so eight of
its ten minutes played in silence and nothing noticed, because the only rule
in the repo fired when EVERY scene was scored and had no opinion about five
of seven being silent. So a scene must now either carry a bed or say
`bed: none` out loud.
"""

import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scriptlib as S                                    # noqa: E402

ROOT = S.ROOT
CONTENT = S.CONTENT

# ONLY THE COURSE BEING BUILT. Rome, Narvik, the Revolution and the wine
# course are frozen -- CLAUDE.md is explicit that their content is not the
# work, and a day was already lost to fixing courses because a check reported
# them. They are skipped BY NAME and the skip is printed, so it is a visible
# decision rather than a silent hole in the coverage of the checker itself.
CHECKED = {"beer"}


def sentence(chapter, sid, bid, lang):
    for scene in chapter["scenes"]:
        if scene["id"] != sid:
            continue
        for b in scene["beats"]:
            if b["id"] == bid:
                return (b.get("say") or {}).get(lang, "")
    return ""


def beat_at(timing, sid, t):
    """Which beat is being spoken at this second."""
    st = (timing.get("scenes") or {}).get(sid) or {}
    for b in st.get("beats", []):
        end = b["start"] + b.get("dur", 0) + b.get("gapAfter", 0)
        if b["start"] <= t < end:
            return b["id"]
    return (st.get("beats") or [{}])[-1].get("id", "?")


def mmss(t):
    return f"{int(t) // 60}:{int(t) % 60:02d}"


def check_chapter(pack, cid, sheet=False):
    d = os.path.join(CONTENT, pack)
    chapter = S.load_json(os.path.join(d, f"{cid}.json"))
    if chapter is None:
        return [f"{pack}/{cid}: no compiled chapter"], []
    langs = S.chapter_langs(chapter)
    timings, notes = S.load_timings(pack, cid, langs)
    fails = list(f"{pack}/{cid}: {n}" for n in notes)

    for lang in langs:
        tm = timings.get(lang)
        if not tm:
            continue
        occ = S.occupancy(chapter, tm, lang)
        if sheet and lang == langs[0]:
            print(f"\n{pack}/{cid}")
        for scene in chapter["scenes"]:
            sid = scene["id"]
            if sid not in occ:
                continue
            so = occ[sid]
            gaps = S.holes(so)
            if sheet and lang == langs[0]:
                bed = next((s["id"] for s in so["spans"]
                            if s["channel"] == "bed"), None)
                title = (scene.get("title") or {}).get(lang, sid)
                cov = 100 * (1 - sum(b - a for a, b in gaps) / so["dur"])
                print(f"  {sid:4} {title[:30]:32} {mmss(so['dur']):>6}   "
                      f"bed {bed or '— none'}")
                for s in so["spans"]:
                    if s["weight"] != "frame":
                        continue
                    print(f"        {mmss(s['start'])}–{mmss(s['end'])}  "
                          f"{s['channel']:9} {s['id'] or ''}")
                worst = max((b - a for a, b in gaps), default=0.0)
                print(f"        covered {cov:.0f}%  ·  "
                      + (f"{len(gaps)} hole(s), longest {worst:.1f}s"
                         if gaps else "no holes"))

            for a, b in gaps:
                bid = beat_at(tm, sid, a)
                say = sentence(chapter, sid, bid, lang)
                fails.append(
                    f"{pack}/{cid} [{lang}] {sid} {mmss(a)}: {b - a:.1f}s with "
                    f"nothing on the screen — {bid} \"{say[:56]}\"")

            # The bed, in the same walk. `bed: none` is how a scene says its
            # silence is a decision.
            has_bed = any(s["channel"] == "bed" for s in so["spans"])
            if not has_bed and scene.get("bed") != "none":
                fails.append(
                    f"{pack}/{cid} [{lang}] {sid} carries no bed and does not "
                    f"say `bed: none` — a bed is dropped at every scene change "
                    f"unless the scene asks again, so this is silence by "
                    f"omission. Say which it is.")
    return fails, []


def main(argv):
    sheet = "--sheet" in argv
    named = [a for a in argv if not a.startswith("-")]
    on_disk = sorted(p for p in os.listdir(CONTENT)
                     if os.path.isdir(os.path.join(CONTENT, p))
                     and not p.startswith("_"))
    packs = named or sorted(CHECKED)
    skipped = [p for p in on_disk if p not in packs]

    fails = []
    for pack in packs:
        for f in sorted(os.listdir(os.path.join(CONTENT, pack))):
            if f.startswith("chapter-") and f.endswith(".json"):
                fails += check_chapter(pack, f[:-5], sheet)[0]

    print()
    if skipped:
        print(f"skipped by name (frozen courses): {', '.join(skipped)}")
    for m in fails:
        print(f"  FAIL: {m}")
    print()
    if fails:
        print(f"{len(fails)} problem(s). The screen is never allowed to be empty.")
        return 1
    print(f"Every scene of {', '.join(packs)} is covered end to end, and every "
          f"scene says what it carries.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
