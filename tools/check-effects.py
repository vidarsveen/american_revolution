#!/usr/bin/env python3
"""
check-effects.py — can two sound effects be told apart, measured on the audio?

    python tools/check-effects.py
    python tools/check-effects.py american-revolution --verbose

The falsifiable question, which is the same one dev/map-lab.html asks about
two regions that share a border: **an effect that means one thing must not
measure the same as an effect that means another.**

This exists because `crowd` was a flat broadband hiss. It had a sensible
prompt, a real licence and a correct level, and every check in the repo passed
it — and it sounded like wind, because its amplitude modulation was 0.31 when
wind's own was 0.55. A crowd murmurs: voices swell, someone shouts, it breaks
up. A number can see that, and nobody had asked for one.

Two measures, both cheap:

  modulation  how much the loudness moves over the clip, as a coefficient of
              variation. Near zero is a steady hiss. A crowd, hooves, a fire
              spitting and a bell decaying all move; only wind and water
              legitimately sit still.
  spectrum    24 log-spaced bands, normalised, compared as an L1 distance.
              Two effects that occupy the same bands in the same proportion
              are the same noise wearing different names.

Neither is a classifier and neither is trying to be. They are a floor: below
it, two things a listener is supposed to distinguish are not distinguishable.
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
import wave

try:
    import numpy as np
except ImportError:
    raise SystemExit("numpy is needed for this check — it lives in .venv")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Below this, two effects occupy the same bands in the same proportions.
# Measured: oars/wind sat at 0.335 and crowd/hooves at 0.469 when this was
# written, so the floor is set where a real confusion has been heard rather
# than where a round number falls.
SPECTRUM_FLOOR = 0.30

# A loop of something ALIVE has to move. Wind and water do not, and say so.
MODULATION_FLOOR = 0.45
STEADY_BY_NATURE = {"wind", "rain", "sea", "fire", "oars"}


def load(path):
    with wave.open(path, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def features(a, sr):
    win, hop = 2048, 1024
    if len(a) < win * 2:
        return None
    frames = np.stack([a[i:i + win] * np.hanning(win)
                       for i in range(0, len(a) - win, hop)])
    spec = np.abs(np.fft.rfft(frames, axis=1))
    mag = spec.mean(axis=0) + 1e-9
    freqs = np.fft.rfftfreq(win, 1 / sr)

    edges = np.geomspace(60, min(sr / 2, 12000), 25)
    bands = []
    for i in range(24):
        sel = (freqs >= edges[i]) & (freqs < edges[i + 1])
        bands.append(mag[sel].mean() if sel.any() else 1e-9)
    bands = np.array(bands)
    bands = bands / bands.sum()

    env = np.sqrt((frames ** 2).mean(axis=1))
    modulation = float(env.std() / (env.mean() + 1e-9))
    centroid = float((freqs * mag).sum() / mag.sum())
    return {"bands": bands, "modulation": modulation, "centroid": centroid}


def packs_on_disk():
    listed = os.path.join(ROOT, "content", "packs.json")
    if os.path.exists(listed):
        with open(listed, encoding="utf-8") as fh:
            return json.load(fh)
    base = os.path.join(ROOT, "content")
    return sorted(d for d in os.listdir(base)
                  if os.path.isdir(os.path.join(base, d)) and not d.startswith("_"))


def check_pack(pack, verbose=False) -> list[str]:
    pd = os.path.join(ROOT, "content", pack)
    manifest_path = os.path.join(pd, "sound.json")
    if not os.path.exists(manifest_path):
        print(f"{pack}: no sound.json — the synthesised catalogue is the whole palette")
        return []
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)

    feat, problems = {}, []
    for name, entry in manifest.items():
        path = os.path.join(pd, entry.get("file", ""))
        if not path.endswith(".wav") or not os.path.exists(path):
            continue
        a, sr = load(path)
        f = features(a, sr)
        if f:
            feat[name] = (f, entry)

    print(f"{pack}: {len(feat)} recorded effect(s)")
    for name, (f, entry) in sorted(feat.items()):
        flag = ""
        kind = entry.get("kind", "")
        if (kind == "loop" and name not in STEADY_BY_NATURE
                and f["modulation"] < MODULATION_FLOOR):
            flag = "  <-- too steady"
            problems.append(
                f"{name}: modulation {f['modulation']:.2f} is below "
                f"{MODULATION_FLOOR:.2f} — a steady hiss, not a {name}. "
                f"Regenerate with a prompt that asks for unevenness.")
        if verbose or flag:
            print(f"    {name:12s} modulation {f['modulation']:5.2f}  "
                  f"centroid {f['centroid']:6.0f} Hz{flag}")

    pairs = []
    for a_, b_ in itertools.combinations(sorted(feat), 2):
        dist = float(np.abs(feat[a_][0]["bands"] - feat[b_][0]["bands"]).sum())
        pairs.append((dist, a_, b_))
    pairs.sort()

    if pairs:
        print(f"    closest pair: {pairs[0][1]} / {pairs[0][2]} "
              f"at {pairs[0][0]:.3f} (floor {SPECTRUM_FLOOR:.2f})")
    if verbose:
        for dist, a_, b_ in pairs[:6]:
            print(f"      {dist:.3f}  {a_} / {b_}")
    for dist, a_, b_ in pairs:
        if dist < SPECTRUM_FLOOR:
            problems.append(
                f"{a_} and {b_} measure {dist:.3f} apart, under {SPECTRUM_FLOOR:.2f} "
                f"— they occupy the same bands in the same proportions, so a "
                f"listener has no way to tell which one is playing.")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("packs", nargs="*")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    problems = []
    for pack in (args.packs or packs_on_disk()):
        problems += check_pack(pack, args.verbose)

    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  FAIL: {p}")
        return 1
    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
