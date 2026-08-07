/* ============================================================
   stage.js — the cue vocabulary.

   One table mapping a verb to what it does. This is the whole contract
   between a chapter script and the engine: a content pack can only ask for
   things listed here, and tools/check-script.py validates against the same
   list so a typo fails at build time rather than silently doing nothing.

   Every handler takes (cue, instant). `instant` means "we are rebuilding the
   picture after a seek — get to the end state without animating".
   ============================================================ */

import * as M from './scenes/map.js';
import * as O from './scenes/overlays.js';

let lang = 'no';

export function mountStage(container, chapter, people, language) {
  lang = language;
  const map = M.mountMap(container, chapter, language);
  O.mountOverlays(container, chapter, people, language);
  return map;
}

/** Back to a blank slate, before cues are re-applied. */
export function resetStage() {
  M.resetMap();
  O.resetOverlays();
}

const VERBS = {
  'map.flyTo':        (c, i) => M.flyTo(c, i),
  'map.fitRoute':     (c, i) => M.fitRoute(c, i),
  'map.fitPlaces':    (c, i) => M.fitPlaces(c, i),
  'map.time':         (c)    => M.setTime(pick(c.value)),
  'map.mood':         (c, i) => M.setMood(c.value, i),
  'map.flash':        (c, i) => M.flash(i),

  'route.draw':       (c, i) => M.drawRoute(c, i),
  'route.clear':      ()     => M.clearRoutes(),

  'marker.show':      (c, i) => M.showMarker(c, i),
  'marker.hide':      (c)    => M.hideMarker(c),
  'marker.clear':     ()     => M.clearMarkers(),

  // "point at the map while you talk"
  'place.highlight':  (c, i) => M.highlight(c, i),
  'place.clear':      ()     => M.clearHighlights(),

  // generic: these named places moved on that one
  'converge':         (c, i) => M.converge(c, i),

  'portrait.show':    (c, i) => O.showPortrait(c, i),
  'portrait.hide':    ()     => O.hidePortrait(),

  'image.show':       (c, i) => O.showImage(c, i),
  'image.hide':       ()     => O.hideImage(),

  'quote.show':       (c, i) => O.showQuote(c, i),
  'quote.hide':       ()     => O.hideQuote(),

  'stat.show':        (c, i) => O.showStat(c, i),
  'stat.clear':       ()     => O.clearStats(),

  'caption.note':     (c, i) => O.showNote(c, i),


  // Pacing verbs are handled by the player, not the stage.
  hold:  () => {},
  pause: () => {},
};

export function applyCue(cue, instant = false) {
  const fn = VERBS[cue.do];
  if (!fn) {
    console.warn(`[stage] unknown cue verb "${cue.do}" (${cue.beat})`);
    return;
  }
  try {
    fn(cue, instant);
  } catch (err) {
    // One bad cue must never take the whole narration down.
    console.warn(`[stage] cue "${cue.do}" failed in ${cue.beat}:`, err);
  }
}

export function knownVerbs() { return Object.keys(VERBS); }

function pick(field) {
  if (field == null) return null;
  if (typeof field === 'string') return field;
  return field[lang] ?? field.no ?? field.en ?? null;
}
