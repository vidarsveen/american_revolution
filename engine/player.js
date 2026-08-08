/* ============================================================
   player.js — the clock.

   The rule that makes scrubbing work:

       the picture is a function of time, not a history of events.

   Playing forward we fire cues as the audio passes them. Seeking anywhere —
   backwards, or into another scene — we wipe the stage and re-apply every cue
   up to that point with animation suppressed. So "play that bit again" always
   lands on a correct picture instead of a half-drawn one.
   ============================================================ */

import { applyCue, resetStage } from './stage.js';
import { beatAt, wordAt } from './script.js';

export class Player {
  constructor(chapter, { onTick, onScene, onState } = {}) {
    this.chapter = chapter;
    this.onTick = onTick || (() => {});
    this.onScene = onScene || (() => {});
    this.onState = onState || (() => {});

    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.sceneIndex = -1;
    this.cursor = 0;          // index of the next cue to fire
    this.playing = false;
    this.waitingForTap = false;
    // If the audio cannot play — blocked before a gesture, failed to load, a
    // muted phone with the file missing — the chapter still runs on a plain
    // timer so the pictures and captions carry it. Silence is a degraded
    // experience; a frozen screen is a broken one.
    this.silent = false;
    // True between asking the element to seek and it confirming. A media
    // element keeps reporting the OLD currentTime until then, so trusting it
    // during a scrub snapped the playhead back to where the audio had not
    // left yet — which read as "dragging the bar always returns to the start".
    this._seeking = false;
    this._pos = 0;
    this._t0 = 0;
    this._raf = 0;
    this._lastBeat = null;
    this._lastWord = -1;

    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('seeked', () => { this._seeking = false; });
    // Not every browser fires `seeked` when you would like it to. Once the
    // element has actually arrived, stop waiting for the event.
    this.audio.addEventListener('timeupdate', () => {
      if (this._seeking && Math.abs(this.audio.currentTime - this._pos) < 0.35) {
        this._seeking = false;
      }
    });
    this.audio.addEventListener('error', () => {
      console.warn('[player] audio unavailable, falling back to a timed run');
      this.silent = true;
    });
  }

  get scene() { return this.chapter.scenes[this.sceneIndex] || null; }

  /**
   * Seconds into the current scene, from whichever clock is actually running.
   *
   * The audio element carries the clock when it can, because it is the thing
   * the listener hears. It cannot be trusted while a seek is in flight: it
   * reports where it still is, not where it was told to go, and a scrubber
   * that believes that jumps back on every frame of the drag.
   */
  now() {
    // The element only gets to answer when it has a timeline to answer from.
    // A file that has not loaded, or has failed to decode, happily reports
    // currentTime 0 for ever — so a seek to 1:27 would be thrown away on the
    // very next frame and the playhead would sit at the start, which is
    // exactly what it did.
    const carrying = !this.silent
      && !this._seeking
      && this.audio.readyState >= 1
      && this.audio.duration > 0;
    if (!carrying) {
      return this.playing ? this._pos + (performance.now() - this._t0) / 1000 : this._pos;
    }
    return this.audio.currentTime;
  }

  /** Move both clocks to the same place. */
  setNow(t) {
    this._pos = t;
    this._t0 = performance.now();
    if (Math.abs(this.audio.currentTime - t) < 0.05) return;
    try {
      this._seeking = true;
      this.audio.currentTime = t;
    } catch {
      // Not seekable yet — the timer carries the clock until it is.
    }
  }

  /* ---------- Scene selection ------------------------------- */

  async goToScene(i, { autoplay = true, at = 0 } = {}) {
    const scene = this.chapter.scenes[i];
    if (!scene) return;
    const changed = i !== this.sceneIndex;
    this.sceneIndex = i;

    if (changed) {
      this.audio.pause();
      if (scene.audio) this.audio.src = scene.audio;
      this.onScene(scene, i);
    }
    this.rebuildTo(at);
    this.setNow(at);
    const beat = beatAt(scene, at);
    this._lastBeat = beat;
    this._lastWord = wordAt(beat, at);
    this.onTick(at, scene, beat, this._lastWord);
    if (autoplay) await this.play(); else this.onState(this.state());
  }

  next() {
    if (this.sceneIndex < this.chapter.scenes.length - 1) {
      this.goToScene(this.sceneIndex + 1, { autoplay: true });
    } else {
      this.pause();
      this.onState({ ...this.state(), finished: true });
    }
  }

  prev() {
    // Restart the scene first, jump back only if already near its start.
    if (this.now() > 3 || this.sceneIndex === 0) this.seek(0);
    else this.goToScene(this.sceneIndex - 1, { autoplay: this.playing });
  }

  /* ---------- Transport ------------------------------------- */

  async play() {
    if (!this.scene) return;
    this.waitingForTap = false;
    try {
      await this.audio.play();
      this.silent = false;
    } catch {
      // Browsers refuse to start audio before a real gesture. Rather than sit
      // dead, run the chapter silently — the captions carry the words.
      this.silent = true;
    }
    this._t0 = performance.now();
    this.playing = true;
    this.loop();
    this.onState(this.state());
  }

  pause() {
    this._pos = this.now();
    this.audio.pause();
    this.playing = false;
    cancelAnimationFrame(this._raf);
    clearTimeout(this._tick);
    this.onState(this.state());
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  /** Seek within the current scene. */
  seek(t) {
    if (!this.scene) return;
    const clamped = Math.max(0, Math.min(this.scene.dur - 0.05, t));
    this.rebuildTo(clamped);
    this.setNow(clamped);
    // Report the beat and word too, or the caption stays blank until playback
    // resumes — which also made every paused screenshot look caption-less.
    const beat = beatAt(this.scene, clamped);
    this._lastBeat = beat;
    this._lastWord = wordAt(beat, clamped);
    this.onTick(clamped, this.scene, beat, this._lastWord);
    if (!this.playing) this.onState(this.state());
  }

  nudge(sec) { this.seek(this.now() + sec); }

  /** Jump to the start of the beat before/after the one playing. */
  skipBeat(dir) {
    const scene = this.scene;
    if (!scene) return;
    const t = this.now();
    if (dir < 0) {
      const cur = beatAt(scene, t);
      // Within the first second of a beat, go to the previous one.
      const target = (cur && t - cur.start < 1.0)
        ? scene.beats[Math.max(0, scene.beats.indexOf(cur) - 1)]
        : cur;
      this.seek(target ? target.start : 0);
    } else {
      const nextBeat = scene.beats.find((b) => b.start > t + 0.05);
      if (nextBeat) this.seek(nextBeat.start);
      else this.next();
    }
  }

  setRate(rate) {
    this.audio.playbackRate = rate;
    this.onState(this.state());
  }

  /* ---------- The bit that makes seeking safe --------------- */

  /**
   * Wipe the stage and replay every cue up to `t` without animating, so the
   * picture matches the moment exactly. Cheap enough to run on every seek —
   * a scene has a few dozen cues.
   */
  rebuildTo(t) {
    const scene = this.scene;
    if (!scene) return;
    resetStage();
    this.cursor = 0;
    while (this.cursor < scene.cues.length && scene.cues[this.cursor].t <= t) {
      applyCue(scene.cues[this.cursor], true);
      this.cursor += 1;
    }
    this._lastBeat = null;
    this._lastWord = -1;
  }

  /* ---------- Frame loop ------------------------------------ */

  loop() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._tick);
    const step = () => {
      if (!this.playing) return;
      this.tick();
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
    // Animation frames stop arriving in a background tab. A slower timer keeps
    // cues and captions in step with audio that is still playing.
    const beat = () => {
      if (!this.playing) return;
      this.tick();
      this._tick = setTimeout(beat, 120);
    };
    this._tick = setTimeout(beat, 120);
  }

  tick() {
    const scene = this.scene;
    if (!scene) return;
    const t = this.now();

    if (t >= scene.dur - 0.02) { this.next(); return; }

    // Fire everything the playhead has passed, in order.
    while (this.cursor < scene.cues.length && scene.cues[this.cursor].t <= t) {
      const cue = scene.cues[this.cursor];
      this.cursor += 1;
      if (cue.do === 'pause') {
        applyCue(cue, false);
        this.waitingForTap = true;
        this.pause();
        this.onState(this.state());
        return;
      }
      applyCue(cue, false);
    }

    const beat = beatAt(scene, t);
    const word = wordAt(beat, t);
    if (beat !== this._lastBeat || word !== this._lastWord) {
      this._lastBeat = beat;
      this._lastWord = word;
      this.onTick(t, scene, beat, word);
    }
  }

  state() {
    return {
      playing: this.playing,
      waitingForTap: this.waitingForTap,
      sceneIndex: this.sceneIndex,
      scene: this.scene,
      time: this.now(),
      rate: this.audio.playbackRate,
      silent: this.silent,
    };
  }

  /** Elapsed across the whole chapter, for the overall progress read-out. */
  elapsed() {
    let n = 0;
    for (let i = 0; i < this.sceneIndex; i++) n += this.chapter.scenes[i].dur;
    return n + this.now();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._tick);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
