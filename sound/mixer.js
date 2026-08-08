/* ============================================================
   mixer.js — the audio bus, and nothing else.

   Three buses under one master: music, sfx, ambience. Every method is a
   safe no-op when there is no AudioContext, when unlock() was refused, or
   after dispose(). That is the whole point. The README rule is "audio
   failing is not the app failing", so this is the one module allowed to
   know whether audio exists at all; everything above it just calls and
   carries on.

   What this deliberately does NOT do: touch the narration <audio> element.
   Feeding the voice through a MediaElementAudioSourceNode to drive a
   signal-based ducker would put the one thing that must work behind a graph
   that can fail before a gesture, on iOS, or on an element that has not
   loaded — and fail silently and permanently, because a
   MediaElementAudioSourceNode captures the element for good. Ducking is a
   function of the script's own timings instead; see soundscape.js.

   The AudioContext is built inside unlock(), not in createMixer(). A
   context constructed before a gesture starts suspended and, on some
   builds, logs a warning for every page load that never plays a sound.

   unlock() hooks into the gesture the app already has: the cover's start
   button in engine/story.js — wireCover(), the `.cover__go` click handler
   that calls player.goToScene(0). Nothing else in the app is guaranteed to
   be a real user gesture.
   ============================================================ */

const BUSES = ['music', 'sfx', 'ambience'];

/** −60 dB and below is off. Below that the numbers stop meaning anything. */
export function dbToGain(db) {
  return db <= -60 ? 0 : 10 ** (db / 20);
}

export function gainToDb(v) {
  return v <= 0.001 ? -60 : 20 * Math.log10(v);
}

export function createMixer({ enabled = true } = {}) {
  let ctx = null;
  let dead = !enabled;          // no context will ever be built
  const nodes = new Map();      // 'master' | bus -> GainNode
  // The levels asked for before there was anything to set them on. They are
  // replayed onto the buses the moment the context is built, so a caller can
  // configure the mix at load time and unlock later.
  const wanted = new Map([['master', 0], ...BUSES.map((b) => [b, 0])]);

  function build() {
    if (dead || ctx) return Boolean(ctx);
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (typeof AC !== 'function') { dead = true; return false; }
    try {
      ctx = new AC({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      master.connect(ctx.destination);
      nodes.set('master', master);
      for (const name of BUSES) {
        const g = ctx.createGain();
        g.connect(master);
        nodes.set(name, g);
      }
    } catch {
      // Some embeddings expose the constructor and then refuse to construct.
      ctx = null;
      dead = true;
      return false;
    }
    for (const [name, db] of wanted) setGain(name, db, 0);
    return true;
  }

  /**
   * Call from a real user gesture. Resolves true only if audio is actually
   * running — never throws, so the caller can ignore the answer.
   */
  async function unlock() {
    if (!build()) return false;
    try {
      if (ctx.state !== 'running') await ctx.resume();
      // Safari counts the gesture only once something has been scheduled.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(nodes.get('master'));
      s.start(0);
    } catch {
      return false;
    }
    return ctx.state === 'running';
  }

  function ready() { return Boolean(ctx) && !dead && ctx.state === 'running'; }

  function bus(name) { return nodes.get(name) || null; }

  /**
   * Set a bus level in dB.
   *
   * `rampMs` gives a linear ramp, for a slider or a fade. `tau` gives an
   * exponential approach instead — that is what a ducker wants, and the
   * reason it is an option here rather than a second API: the caller should
   * not have to reach into the GainNode to get a decent envelope.
   */
  function setGain(name, db, rampMs = 0, { tau = 0 } = {}) {
    wanted.set(name, db);
    const g = nodes.get(name);
    if (!g || !ctx) return;
    const v = dbToGain(db);
    const now = ctx.currentTime;
    try {
      if (tau > 0) {
        // No cancelScheduledValues here. Cancelling a setTarget that started
        // in the past does not reset the value, and cancelling one scheduled
        // for later is not what we want either — re-targeting from wherever
        // the parameter has got to is exactly right.
        g.gain.setTargetAtTime(v, now, tau);
      } else if (rampMs > 0) {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(v, now + rampMs / 1000);
      } else {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(v, now);
      }
    } catch { /* a closed context, a bad number — not worth breaking a chapter */ }
  }

  /** The level a bus is actually at right now, in dB. For meters and tests. */
  function levelOf(name) {
    const g = nodes.get(name);
    if (!g) return -60;
    return gainToDb(g.gain.value);
  }

  async function suspend() {
    try { if (ctx && ctx.state === 'running') await ctx.suspend(); } catch { /* fine */ }
  }

  async function resume() {
    try { if (ctx && ctx.state === 'suspended') await ctx.resume(); } catch { /* fine */ }
    return ready();
  }

  function dispose() {
    const c = ctx;
    ctx = null;
    nodes.clear();
    dead = true;
    try { c?.close(); } catch { /* already gone */ }
  }

  return {
    ready, unlock, bus, setGain, levelOf, suspend, resume, dispose,
    /** The live context, for whoever has to create sources. Null until unlock. */
    context: () => ctx,
    now: () => (ctx ? ctx.currentTime : 0),
    buses: () => [...BUSES],
  };
}
