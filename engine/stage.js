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
import * as S from './scenes/sound.js';

let lang = 'no';

export function mountStage(container, chapter, people, language) {
  lang = language;
  const map = M.mountMap(container, chapter, language);
  O.mountOverlays(container, chapter, people, language);
  S.mountSound();
  return map;
}

/** Back to a blank slate, before cues are re-applied. */
export function resetStage() {
  M.resetMap();
  O.resetOverlays();
  S.resetSound();
}

const VERBS = {
  'map.flyTo':        (c, i) => M.flyTo(c, i),
  'map.fitRoute':     (c, i) => M.fitRoute(c, i),
  'map.fitPlaces':    (c, i) => M.fitPlaces(c, i),
  'map.time':         (c)    => M.setTime(pick(c.value)),
  'map.mood':         (c, i) => M.setMood(c.value, i),
  'map.flash':        (c, i) => M.flash(i),

  // The political shape of the ground: who holds what, and where the lines
  // are. Subject-neutral — a pack decides whether level 1 means a colony,
  // a German state or a Norwegian kommune.
  'region.show':      (c, i) => M.showRegions(c, i),
  'region.clear':     ()     => M.clearRegions(),
  'border.set':       (c)    => M.setBorders(c),

  // Sound. The soundscape enforces the one-shot rule itself, so these hand
  // `instant` straight through rather than guarding it a second time.
  'sound.play':       (c, i) => S.playSound(c, i),
  'sound.ambience':   (c, i) => S.setAmbience(c, i),
  'sound.music':      (c, i) => S.playMusicCue(c, i),

  'road.draw':        (c)    => M.drawRoad(c),
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

/**
 * Cross-check the handler table against engine/verbs.json.
 *
 * The vocabulary used to live in two hand-maintained lists — this table and
 * VERBS in tools/check-script.py. Adding a verb to one and forgetting the
 * other meant a chapter validated clean and then silently did nothing in the
 * browser, which is the worst possible failure mode: no error, no picture,
 * and a cue that reads correct on the page.
 *
 * The manifest is now the source of truth for BOTH. This reports a drift in
 * either direction, and deliberately only warns: a mismatched manifest must
 * never be the reason a reader cannot hear a chapter.
 */
export async function checkVerbManifest(base = './engine/verbs.json') {
  try {
    const res = await fetch(base);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();

    const declared = new Set(Object.keys(manifest.verbs || {}));
    const implemented = new Set(Object.keys(VERBS));

    const missing = [...declared].filter((v) => !implemented.has(v));
    const extra = [...implemented].filter((v) => !declared.has(v));

    if (missing.length) {
      console.warn('[stage] verbs.json declares verbs with no handler:', missing.join(', '));
    }
    if (extra.length) {
      console.warn('[stage] handlers missing from verbs.json (check-script.py will '
                 + 'reject chapters that use them):', extra.join(', '));
    }
    return { manifest, missing, extra, ok: !missing.length && !extra.length };
  } catch (err) {
    console.warn('[stage] could not read the verb manifest:', err.message);
    return { manifest: null, missing: [], extra: [], ok: false };
  }
}

function pick(field) {
  if (field == null) return null;
  if (typeof field === 'string') return field;
  return field[lang] ?? field.no ?? field.en ?? null;
}
