#!/usr/bin/env python3
"""
Drive dev/sound-lab.html in a real browser and check what the sound module
claims about itself.

    python -m http.server 8000
    python tools/check-sound.py

Four claims, none of which can be judged by reading the code:

  · with no AudioContext the mixer reports not-ready and every call is a
    safe no-op — that is the README rule, "audio failing is not the app
    failing", and it is worth a number rather than a promise;
  · the music bed really is a function of time: targetAt(t) is compared
    against the level read off the live GainNode;
  · the duck is fast down and slow up, measured 120 ms after each edge;
  · a one-shot fired with `instant` is not played, so scrubbing back
    through Lexington does not fire forty muskets.

Screenshots land in shots/. Exits non-zero if anything is broken.
"""

from __future__ import annotations

import json
import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:                                   # pragma: no cover
    print("error: playwright is not installed in this venv", file=sys.stderr)
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "shots")
BASE = os.environ.get("LAB_BASE", "http://localhost:8000")

results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> None:
    results.append((bool(ok), name, detail))
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}{'  - ' + detail if detail else ''}")


def main() -> int:
    os.makedirs(SHOTS, exist_ok=True)

    with sync_playwright() as pw:
        # Chromium will not start an AudioContext without a gesture, and the
        # bench has one — but the flag keeps a headless run from depending on
        # click timing for anything except the unlock test itself.
        browser = pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        page = browser.new_page(viewport={"width": 1420, "height": 1180})
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.goto(f"{BASE}/dev/sound-lab.html", wait_until="networkidle")
        page.wait_for_timeout(400)

        # ---- no AudioContext at all -----------------------------------
        print("\nwithout an AudioContext")
        stub = page.evaluate("""async () => {
            const AC = window.AudioContext, WAC = window.webkitAudioContext;
            delete window.AudioContext; delete window.webkitAudioContext;
            const { createMixer } = await import('../sound/mixer.js');
            const { createLibrary } = await import('../sound/library.js');
            const { createSoundscape } = await import('../sound/soundscape.js');
            const out = { threw: null };
            try {
              const m = createMixer({ enabled: true });
              const s = createSoundscape({ mixer: m, library: createLibrary(),
                                           schedule: [{ start: 1, end: 3 }] });
              out.readyBefore = m.ready();
              out.unlocked = await m.unlock();
              out.readyAfter = m.ready();
              out.bus = m.bus('music');
              m.setGain('music', -12, 200);
              m.setGain('music', -3, 0, { tau: 0.08 });
              await m.suspend(); await m.resume();
              out.music = await s.playMusic('bedSolemn');
              out.amb = await s.setAmbience('wind');
              out.sfx = s.playSfx('musket');
              s.tick(0); s.tick(2); s.tick(5);
              out.speech = s.targetAt(2);
              out.gap = s.targetAt(5);
              s.reset();
              m.dispose();
              m.setGain('music', -6, 100);        // after dispose, still fine
              s.playSfx('cannon');
            } catch (e) { out.threw = String(e); }
            if (AC) window.AudioContext = AC;
            if (WAC) window.webkitAudioContext = WAC;
            return out;
        }""")
        check(stub["threw"] is None, "nothing throws", str(stub["threw"] or ""))
        check(stub["readyBefore"] is False and stub["readyAfter"] is False, "ready() stays false")
        check(stub["unlocked"] is False, "unlock() declines")
        check(stub["bus"] is None, "bus() is null")
        check(stub["music"] is False and stub["amb"] is False and stub["sfx"] is False,
              "music, ambience and sfx all decline")
        check(stub["speech"] == -26 and stub["gap"] == -14,
              "the duck curve is still computable",
              f'speech {stub["speech"]} dB, gap {stub["gap"]} dB')

        # ---- the curve, with no audio involved ------------------------
        print("\nthe duck as a function of time")
        c = page.evaluate("""() => {
            const s = window.lab.scape;
            return { before: s.targetAt(0.2), lookAhead: s.targetAt(0.6),
                     during: s.targetAt(2.0), shortGap: s.targetAt(4.6),
                     longGap: s.targetAt(13.9), after: s.targetAt(27.6),
                     merged: s.schedule().length };
        }""")
        check(c["before"] == -14, "open before the first beat")
        check(c["lookAhead"] == -26, "already down 250 ms before the first syllable")
        check(c["during"] == -26, "down through the beat")
        check(c["shortGap"] == -26, "a 500 ms gap does not pump")
        check(c["longGap"] == -14, "a 1.5 s pause opens back up")
        check(c["after"] == -14, "open after the last beat")
        check(c["merged"] == 3, "six beats merge to three real pauses", str(c["merged"]))

        # ---- the same thing, measured on the GainNode -----------------
        print("\nthe duck as measured on the bus")
        page.click("#unlock")
        page.wait_for_timeout(300)
        check(page.evaluate("() => window.lab.mixer.ready()") is True, "ready after the gesture")

        page.click('#musicBtns button[data-music="bedSolemn"]')
        page.wait_for_timeout(1500)

        def seek(t: float) -> None:
            page.evaluate(f"""() => {{
                const s = document.querySelector('#scrub');
                s.value = String(Math.round({t} * 100));
                s.dispatchEvent(new Event('input'));
            }}""")

        lin = lambda: page.evaluate(                                   # noqa: E731
            "() => { const b = window.lab.mixer.bus('music'); return b ? b.gain.value : 0; }")
        db = lambda: page.evaluate("() => window.lab.mixer.levelOf('music')")  # noqa: E731

        seek(13.9); page.wait_for_timeout(1600)
        v_open, open_db = lin(), db()
        seek(16.0); page.wait_for_timeout(120)
        v_attack = lin()
        page.wait_for_timeout(1000)
        v_duck, duck_db = lin(), db()
        seek(13.9); page.wait_for_timeout(120)
        v_release = lin()
        page.wait_for_timeout(1600)
        v_back, back_db = lin(), db()

        down = (v_open - v_attack) / max(1e-9, v_open - v_duck)
        up = (v_release - v_duck) / max(1e-9, v_back - v_duck)

        check(open_db > -16.0, "open in a pause", f"{open_db:.2f} dB, asked for -14")
        check(duck_db < open_db - 8, "down under speech",
              f"{duck_db:.2f} dB, a drop of {open_db - duck_db:.1f} dB")
        check(back_db > duck_db + 8, "back up in the next pause", f"{back_db:.2f} dB")
        check(down > up * 1.5, "attack is faster than release",
              f"{down * 100:.0f} % down against {up * 100:.0f} % up, both 120 ms after the edge")

        # ---- instant suppression --------------------------------------
        print("\ninstant")
        page.evaluate("() => window.lab.scape.reset()")
        page.click("#instant")
        for _ in range(12):
            page.click('#sfxBtns button[data-sfx="musket"]')
        page.wait_for_timeout(600)
        st = page.evaluate("() => window.lab.scape.stats()")
        check(st["sfx"] == 0 and st["sfxSkipped"] == 12,
              "twelve muskets fired while rebuilding, none played", json.dumps(st))

        page.click("#instant")
        for _ in range(3):
            page.click('#sfxBtns button[data-sfx="musket"]')
        page.wait_for_timeout(1500)
        live = page.evaluate("() => window.lab.scape.stats()")
        check(live["sfx"] == 3, "the same button plays when not rebuilding", json.dumps(live))

        page.click("#silent")
        page.evaluate("() => window.lab.scape.playSfx('cannon')")
        page.wait_for_timeout(400)
        sil = page.evaluate("""() => ({ stats: window.lab.scape.stats(),
                                        state: window.lab.scape.state() })""")
        check(sil["state"]["music"] is None and sil["stats"]["sfx"] == live["sfx"],
              "the player's silent fallback keeps the mixer off")
        page.click("#silent")

        # ---- every effect actually makes a sound ----------------------
        print("\nthe library")
        rendered = page.evaluate("""async () => {
            const { EFFECTS } = await import('../sound/library.js');
            const ctx = window.lab.mixer.context();
            const out = {};
            for (const n of EFFECTS) {
              const b = await window.lab.library.get(n, ctx);
              if (!b) { out[n] = null; continue; }
              let peak = 0, sum = 0, n2 = 0;
              for (let c = 0; c < b.numberOfChannels; c++) {
                const d = b.getChannelData(c);
                for (let i = 0; i < d.length; i++) {
                  const a = Math.abs(d[i]);
                  if (a > peak) peak = a;
                  sum += d[i] * d[i]; n2++;
                }
              }
              out[n] = { dur: +b.duration.toFixed(2), ch: b.numberOfChannels,
                         peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n2).toFixed(4) };
            }
            return out;
        }""")
        empty = [n for n, v in rendered.items() if not v or v["peak"] < 0.05 or v["rms"] < 0.001]
        check(not empty, f"all {len(rendered)} effects render with signal", f"silent: {empty}")
        for name, v in rendered.items():
            if v:
                print(f"        {name:11s} {v['dur']:6.2f} s  {v['ch']}ch  "
                      f"peak {v['peak']:.2f}  rms {v['rms']:.4f}")

        # ---- pictures --------------------------------------------------
        seek(0)
        page.click('#musicBtns button[data-music="bedMarch"]')
        page.click('#ambBtns button[data-amb="wind"]')
        page.click("#run")
        page.wait_for_timeout(29000)              # one full pass of the schedule
        page.screenshot(path=os.path.join(SHOTS, "sound-lab-light.png"))
        page.click('#theme button[data-theme-set="dark"]')
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(SHOTS, "sound-lab-dark.png"))
        page.click('#theme button[data-theme-set="light"]')

        # ---- the bench's own no-AudioContext switch --------------------
        print("\nthe bench with AudioContext removed")
        page.click("#noctx")
        page.wait_for_timeout(300)
        for sel in ('#sfxBtns button[data-sfx="volley"]',
                    '#musicBtns button[data-music="bedSolemn"]',
                    '#ambBtns button[data-amb="wind"]',
                    "#unlock"):
            page.click(sel)
        page.wait_for_timeout(700)
        off = page.evaluate("() => ({ ready: window.lab.mixer.ready(), "
                            "state: window.lab.scape.state() })")
        check(off["ready"] is False and off["state"]["music"] is None,
              "not ready, nothing playing, page still alive")
        page.screenshot(path=os.path.join(SHOTS, "sound-lab-noctx.png"))

        page.wait_for_timeout(300)
        print()
        check(not errors, "no console errors", "; ".join(errors[:5]))
        browser.close()

    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)} of {len(results)} checks passed."
          f"  Screenshots in shots/.")
    if failed:
        print("\nPROBLEMS:")
        for _, name, detail in failed:
            print(f"  FAIL: {name}{'  - ' + detail if detail else ''}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
