#!/usr/bin/env python3
"""
Describe a generated sound in numbers, because the person choosing one may not
be the one who can hear it.

    .venv-moss/Scripts/python.exe tools/describe-sound.py sound-candidates/pour
    .venv-moss/Scripts/python.exe tools/describe-sound.py content/beer/sound/pour.mp3

This does NOT replace listening, and it is not a quality score. It exists for
one narrow reason: `gen-sound.py` writes four candidates and the choice between
them is a listening job, so anything that can be settled by measurement should
be settled before anyone puts headphones on. Four of the five things below are
defects you can hear instantly and would otherwise waste a listen on:

    dead        a long unbroken run of actual silence inside the clip
    clipped     samples pinned at full scale, which is audible as crackle
    truncated   still loud at the last sample, so it stops rather than ends
    thin        almost nothing under 1 kHz, which is what "tinny" actually is
    hissy       most of the energy above 6 kHz, i.e. noise and not an event

Two of those five were WRONG on their first run and are worth recording,
because both fired on all four candidates of a perfectly good pour. `thin` was
written as "under 300 Hz" and every pour failed it at 0.0% -- but pouring
liquid has almost no energy down there; the gurgle of the first candidate sits
70% in 300-1000 Hz, which is the right place for it, and 300 Hz was measuring
bass rumble rather than body. And `dead` counted every frame under a tenth of
peak, which for a ONE-SHOT is mostly its decay tail: a clip that ends properly
looked half dead. It counts the longest unbroken run of near-silence now.
Both were confirmed against a synthesised sine at 100, 1000 and 8000 Hz.

The fifth is the one that matters for a POUR specifically, and it is why this
file exists at all rather than a generic loudness check. A pour is not a flat
noise: it is a stream that GLUGS -- amplitude wobbling a few times a second as
air replaces liquid -- and then, in beer and not in wine, a foam tail that is
quieter and much brighter than the stream that made it. So the report prints
the modulation rate in the low band and the brightness of the last third
against the first third. A clip with no wobble is a tap running; a clip whose
tail is not brighter is a pour with no head on it.

Read those two numbers, then listen to the two that survive.
"""

from __future__ import annotations

import math
import os
import sys

import torch


def load(path: str):
    """Read a WAV with the standard library.

    torchaudio.load() now routes through TorchCodec, which is a second binary
    dependency for a job the `wave` module has always done. The masters
    gen-sound.py writes are 16-bit PCM WAVs; the .mp3 beside each one is a
    convenience copy for double-clicking, and is not what gets measured.
    """
    import wave
    with wave.open(path, "rb") as fh:
        sr = fh.getframerate()
        width = fh.getsampwidth()
        chans = fh.getnchannels()
        raw = fh.readframes(fh.getnframes())
    if width != 2:
        raise SystemExit(f"{path}: expected 16-bit PCM, got {width * 8}-bit")
    x = torch.frombuffer(bytearray(raw), dtype=torch.int16).float() / 32768.0
    if chans > 1:
        x = x.reshape(-1, chans).mean(1)
    return x, sr


def rms_envelope(x: torch.Tensor, sr: int, hop_ms: float = 10.0):
    hop = max(1, int(sr * hop_ms / 1000))
    n = len(x) // hop
    frames = x[: n * hop].reshape(n, hop)
    return frames.pow(2).mean(1).sqrt(), hop / sr


def band_energy(x: torch.Tensor, sr: int, lo: float, hi: float) -> float:
    n = 1 << (len(x) - 1).bit_length()
    spec = torch.fft.rfft(x, n=n).abs().pow(2)
    freqs = torch.fft.rfftfreq(n, 1 / sr)
    band = spec[(freqs >= lo) & (freqs < hi)].sum().item()
    return band / max(spec.sum().item(), 1e-12)


def modulation_rate(env: torch.Tensor, step: float) -> tuple[float, float]:
    """How fast the loudness wobbles, and how deep. A glug is 2-8 Hz."""
    e = env - env.mean()
    if e.abs().max() < 1e-9:
        return 0.0, 0.0
    spec = torch.fft.rfft(e).abs()
    freqs = torch.fft.rfftfreq(len(e), step)
    keep = (freqs > 1.0) & (freqs < 12.0)
    if not keep.any():
        return 0.0, 0.0
    sub = spec[keep]
    peak = int(sub.argmax())
    depth = (env.max() - env.min()) / max(env.mean().item(), 1e-9)
    return float(freqs[keep][peak]), float(depth)


def loop_seam(x: torch.Tensor, sr: int) -> tuple[float, float]:
    """How badly a file clicks when it is played back to back with itself.

    A bed is a LOOP, and the join is where a generated or downloaded track
    gives itself away: the last sample and the first sample are neighbours the
    moment it repeats, and if they are far apart you hear a click every time
    round. sound/library.js already solves this for SYNTHESISED beds by
    rendering past the end and folding the overhang back with an equal-power
    crossfade — but a FILE has no overhang, so a track from a music library
    has to either loop already or be cut until it does.

    Two numbers, both in dB relative to the clip's own peak:

      step   the jump from the last sample to the first, which is the click
      match  how different the last 200 ms are from the first 200 ms, which
             is whether the MUSIC arrives back where it started rather than
             merely at the same sample value

    Under about -40 dB on both is inaudible. A track that fails `match` is not
    fixable by trimming a few samples; it is the wrong length.
    """
    peak = float(x.abs().max()) or 1e-9
    step = abs(float(x[0]) - float(x[-1])) / peak
    n = min(int(0.2 * sr), len(x) // 4)
    head, tail = x[:n], x[-n:]
    match = float((head - tail).pow(2).mean().sqrt()) / peak
    to_db = lambda v: 20 * math.log10(max(v, 1e-9))
    return to_db(step), to_db(match)


def describe(path: str) -> None:
    x, sr = load(path)
    env, step = rms_envelope(x, sr)
    peak = x.abs().max().item()
    active = (env > env.max() * 0.1)
    lead = float((~active).cumsum(0).eq(torch.arange(1, len(active) + 1)).sum()) * step
    # The longest unbroken run of near-silence, which is the thing a listener
    # would call a gap. Not "time under a tenth of peak" -- that is a decay.
    quiet, run, worst = (env <= env.max() * 0.01), 0, 0
    for q in quiet.tolist():
        run = run + 1 if q else 0
        worst = max(worst, run)
    gap = worst * step

    third = len(x) // 3
    bright_head = band_energy(x[:third], sr, 4000, 16000)
    bright_tail = band_energy(x[-third:], sr, 4000, 16000)
    low = band_energy(x, sr, 20, 1000)
    high = band_energy(x, sr, 6000, 20000)
    rate, depth = modulation_rate(env, step)
    step_db, match_db = loop_seam(x, sr)
    tail_level = float(env[-int(0.15 / step):].mean() / max(env.max(), 1e-9))
    clipped = float((x.abs() > 0.995).sum()) / len(x)

    flags = []
    if gap > 1.0:
        flags.append("DEAD %.1f s of unbroken near-silence inside it" % gap)
    if clipped > 0.001:
        flags.append("CLIPPED %.2f%% of samples at full scale" % (100 * clipped))
    if tail_level > 0.35:
        flags.append("TRUNCATED still at %.0f%% of peak at the last sample" % (100 * tail_level))
    # THIN and HISSY are asked as questions, not asserted as defects, and the
    # beer set is why. Foam crackle came out 0% under 1 kHz and 73% over 6 kHz,
    # and dry barley hitting a floor came out 97% over 6 kHz -- both are
    # exactly what those two things sound like. On a pour or a boil the same
    # numbers would mean the model gave back hiss instead of an event. The
    # tool cannot tell which effect it is looking at; the person reading it
    # can, in one word.
    if low < 0.20:
        flags.append("BRIGHT only %.0f%% of energy under 1 kHz — right for foam "
                     "or dry grain, wrong for anything with weight" % (100 * low))
    if match_db > -20:
        flags.append("DOES NOT LOOP  the last 200 ms are %.0f dB away from the "
                     "first — this is the wrong length, not a bad cut" % match_db)
    if high > 0.55:
        flags.append("HISSY %.0f%% of energy over 6 kHz — same question"
                     % (100 * high))

    print(f"\n{os.path.basename(path)}   {len(x)/sr:.1f}s  {sr} Hz  peak {peak:.2f}")
    print(f"  lead-in silence      {lead:5.2f} s")
    print(f"  loudness wobble      {rate:5.2f} Hz, depth {depth:4.1f}   "
          f"(a glug is 2-8 Hz; a flat stream is 0)")
    print(f"  brightness head/tail {bright_head*100:4.1f}% -> {bright_tail*100:4.1f}%   "
          f"(foam should RISE)")
    print(f"  under 1 kHz          {low*100:4.1f}%   (body)")
    print(f"  longest silent gap   {gap:5.2f} s")
    print(f"  over 6 kHz           {high*100:4.1f}%")
    print(f"  ends at              {tail_level*100:4.0f}% of peak")
    print(f"  loop seam            step {step_db:5.0f} dB, match {match_db:5.0f} dB"
          f"   (under -40 is inaudible)")
    for f in flags:
        print(f"  !! {f}")
    if not flags:
        print("  no mechanical defect — this one is worth listening to")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    for target in sys.argv[1:]:
        if os.path.isdir(target):
            names = sorted(f for f in os.listdir(target)
                           if f.endswith((".wav", ".mp3")))
            # The .wav is the master; the .mp3 beside it is the same audio.
            wavs = [f for f in names if f.endswith(".wav")]
            for name in (wavs or names):
                describe(os.path.join(target, name))
        else:
            describe(target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
