/* ============================================================
   scenes/overlays.js — a handle on the overlays surface.

   The module moved to engine/surfaces/overlays.js. engine/story.js imports
   `factBeatIs` from this path on every tick, for every pack, so this stays a
   handle rather than a re-export: see the header of scenes/map.js for why
   that distinction is the whole point of the refactor.

   It goes away the day engine/story.js imports ../surfaces/overlays.js.
   ============================================================ */

import { surfaceModule } from '../surfaces/registry.js';

const O = () => surfaceModule('overlays');

/** The fact box belongs to the sentence that raised it. */
export function factBeatIs(beatId) { O()?.factBeatIs(beatId); }
