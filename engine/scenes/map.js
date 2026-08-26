/* ============================================================
   scenes/map.js — a handle on the map surface, and NOT the map.

   The module itself moved to engine/surfaces/map.js. This file is what is
   left, and it is thirty lines on purpose.

   engine/story.js and engine/depth.js need `getStoryMap()` and `mapScene()`,
   and two python probes (tools/check-contrast.py, tools/check-legible.py)
   reach the live map by dynamically importing this path. All five are
   loaded for EVERY pack. So if this file imported the surface — or
   re-exported from it, which is the same thing — then map/index.js,
   map/basemap.js and their Path2D machinery would be in the module graph of
   a pack that has no map, and the one measurable payoff of the surface
   refactor would be gone. Silently, and with everything still working.

   So it goes through the registry, which holds the module only if the pack
   asked for it. A pack with no map gets null and every call is a no-op,
   which is the correct answer rather than an error: "there is no map" is a
   legitimate thing for a subject to be.

   This file exists only because the three modules above import this path. It
   goes away the day they import ../surfaces/map.js instead.
   ============================================================ */

import { surfaceModule } from '../surfaces/registry.js';

const M = () => surfaceModule('map');

/** The live map instance, or null when this pack has no map surface. */
export function getStoryMap() { return M()?.getStoryMap() ?? null; }

/** Which scene we are in, so a place can arrive when the story reaches it. */
export function mapScene(i) { M()?.mapScene(i); }

/* Where the camera puts a point so it lands in the part of the map you can
   actually SEE — the host less the caption, the transport and any card. A
   probe that re-centres the camera has to use the same offset or it measures a
   frame no viewer is shown; tools/check-legible.py does exactly that. Returns
   [0, 0] when this pack has no map, which is the honest answer. */
export function composeOffset() { return M()?.composeOffset() ?? [0, 0]; }
