/* ============================================================
   surfaces/pitch.js — the story stage's pitch, as an adapter.

   The same shape engine/surfaces/map.js has: cue objects in, pitch-module
   calls out. The drawing lives in pitch/ and is developed against its own
   bench (dev/pitch-lab.html) with no app, no narration and no chapter
   anywhere near it.

   Nothing here draws. If a line in this file computes a coordinate, it is in
   the wrong file — that was the lesson of the map surface, which spent a year
   as four hundred lines of Leaflet before the geometry moved out.

   WHY A PITCH IS A SURFACE AND NOT A KIND OF CHART

   Because the pack decides. A course with no pitch never imports pitch/ and
   pays nothing for it, exactly as a course with no map pays nothing for
   map/ — that boundary is the whole point of the registry, and folding this
   into chart.js would put a football pitch on the critical path of a wine
   course.

   THE VERB NAMES ARE ALL PREFIXED, ON PURPOSE

   `zone.show` and `line.show` would read better in a script and would be a
   mistake. The verb table is global across the manifest, tools/check-script.py
   validates against all of it at once, and `region.show` already exists one
   surface over. A reader of engine/verbs.json should be able to tell which
   surface answers a verb without looking it up.
   ============================================================ */

import { createPitch } from '../../pitch/index.js';
import { watchTheme } from '../../core/theme.js';

let pitch = null;
let hostEl = null;
let chapter = null;
let lang = 'no';
let unwatchTheme = null;

export function mountPitch(container, ch, language) {
  chapter = ch || null;
  lang = language || ch?.narrationLang || 'no';

  hostEl = document.createElement('div');
  hostEl.className = 'stage-pitch';
  container.appendChild(hostEl);

  const conf = chapter?.packInfo?.pitch || {};
  pitch = createPitch(hostEl, {
    panels: conf.panels ?? 1,
    view: conf.view ?? 'full',
    numbers: conf.numbers ?? false,
    lang,
  });

  // The dots take their colour from the pack's factions, which core/palette.js
  // re-publishes on :root at every theme change. Reading them once at mount
  // would freeze a light-mode blue into a dark-mode stage. watchTheme() is the
  // one probe for this in the repo; a second hand-rolled copy here is exactly
  // the drift css/story.css spent a year demonstrating.
  unwatchTheme = watchTheme(() => pitch?.refreshTheme());

  return {
    invalidate: () => pitch?.invalidate(),
    refreshTheme: () => pitch?.refreshTheme(),
  };
}

/**
 * Back to an empty pitch.
 *
 * `soft` is the scene-change fade, and it means the same here as everywhere
 * else: the picture is about to be replaced, so do not cut. There is nothing
 * to fade on a canvas that is about to be redrawn from scratch, so both paths
 * are the same — but the parameter is read rather than ignored, because a
 * surface that silently accepts an argument it does not honour is the
 * `kind`-on-`marker.show` mistake in a smaller costume.
 */
export function resetPitch({ soft = false } = {}) {
  pitch?.reset();
  if (!soft) hostEl?.classList.remove('is-on');
}

export function unmountPitch() {
  unwatchTheme?.();
  unwatchTheme = null;
  pitch?.destroy();
  pitch = null;
  hostEl?.remove();
  hostEl = null;
  chapter = null;
}

/** Debug hook, the way getStoryMap() is one — dev/pitch-lab.js drives this. */
export function getStoryPitch() { return pitch; }

/* ------------------------------------------------------------
   Cues
   ------------------------------------------------------------ */

/** Every handler funnels `instant` in the same way, so no verb can forget. */
const withInstant = (cue, instant) => ({ ...cue, instant: instant || cue.instant });

export function showPitch(cue, instant) {
  if (!pitch) return;
  if (cue.panels != null || cue.views) {
    pitch.setPanels(cue.panels ?? 1, cue.views);
  }
  if (cue.view) pitch.setView(cue.panel ?? 0, cue.view);
  if (cue.numbers !== undefined) pitch.setNumbers(cue.numbers);
  hostEl?.classList.add('is-on');
  // A seek must not run the fade-in: the stylesheet's transition is on the
  // class, and `.is-instant` turns it off for exactly one frame. Same three
  // lines chart.js and overlays.js each write out for themselves.
  if (instant) {
    hostEl?.classList.add('is-instant');
    requestAnimationFrame(() => hostEl?.classList.remove('is-instant'));
  }
}

export function hidePitch() {
  hostEl?.classList.remove('is-on');
}

export function teamCue(cue, instant) { pitch?.team(withInstant(cue, instant)); }
export function teamClearCue(cue) { pitch?.clearTeam(cue); }
export function moveCue(cue, instant) { pitch?.move(withInstant(cue, instant)); }
export function passCue(cue, instant) { pitch?.pass(withInstant(cue, instant)); }
export function runCue(cue, instant) { pitch?.run(withInstant(cue, instant)); }
export function crossCue(cue, instant) { pitch?.cross(withInstant(cue, instant)); }
export function zoneCue(cue, instant) { pitch?.zone(withInstant(cue, instant)); }
export function lanesCue(cue, instant) { pitch?.lanes(withInstant(cue, instant)); }
export function zoneHideCue(cue, instant) { pitch?.hideZone(withInstant(cue, instant)); }
export function lineCue(cue, instant) { pitch?.line(withInstant(cue, instant)); }
export function ballCue(cue, instant) { pitch?.ball(withInstant(cue, instant)); }
export function clearCue(cue) { pitch?.clear(cue); }

/* ------------------------------------------------------------
   The surface
   ------------------------------------------------------------ */

export default {
  id: 'pitch',
  // The ground, exactly where the map sits. Everything else on the stage —
  // plates at 20, charts at 25, the caption and the decks at 30 — draws over
  // it, and css/pitch.css puts the canvas at z-index 1 to match .stage-map.
  layer: 10,
  verbs: {
    'pitch.show':      (c, i) => showPitch(c, i),
    'pitch.hide':      ()     => hidePitch(),

    // Eleven dots in a shape. Calling it twice for one side is a morph.
    'pitch.team':      (c, i) => teamCue(c, i),
    'pitch.teamClear': (c)    => teamClearCue(c),
    'pitch.move':      (c, i) => moveCue(c, i),

    // The ball moving, and a person moving. Different marks on purpose.
    'pitch.pass':      (c, i) => passCue(c, i),
    'pitch.run':       (c, i) => runCue(c, i),
    'pitch.cross':     (c, i) => crossCue(c, i),

    // Ground: a pressing trap, a half-space, the block, the five lanes.
    'pitch.zone':      (c, i) => zoneCue(c, i),
    'pitch.lanes':     (c, i) => lanesCue(c, i),
    'pitch.zoneHide':  (c, i) => zoneHideCue(c, i),

    // A line across the pitch, with the metres between two of them.
    'pitch.line':      (c, i) => lineCue(c, i),

    'pitch.ball':      (c, i) => ballCue(c, i),
    'pitch.clear':     (c)    => clearCue(c),
  },
  mount(container, ch, ctx = {}) { return mountPitch(container, ch, ctx.lang); },
  reset(opts) { resetPitch(opts); },
  unmount() { unmountPitch(); },
};
