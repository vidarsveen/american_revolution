/* ============================================================
   tiles.js — the basemap, in one place.

   Merged from js/map.js (Explore) and engine/basemap.js (story stage),
   which carried byte-equivalent copies of the provider list.

   Two fixes over what those did:

   1. Leaflet defaults `updateWhenIdle` to Browser.mobile — TRUE on phones.
      Neither call site overrode it, so on a phone no tile was requested
      until the drag ENDED. That is the "large blank areas while panning".

   2. A backdrop layer pinned at maxNativeZoom 5 sits under the sharp tiles.
      Leaflet upscales it instead of requesting, so there is always a
      complete (if soft) image behind the map and never bare paper. The
      z0-5 set for any theatre is a few dozen tiles the SW keeps for good.
   ============================================================ */

import { isDark } from '../core/theme.js';

/* Tried in order — if one CDN is unreachable we quietly fall to the next.
   Voyager for light: its water is a distinctly bluer, darker tone than
   light_nolabels, whose #d4dadc water against #fafaf8 land differs mostly
   in hue — which is exactly what a filter flattens away. */
const PROVIDERS = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}{r}.png',
    style: { light: 'rastertiles/voyager_nolabels', dark: 'rastertiles/voyager_nolabels' },
    opts: {
      subdomains: 'abcd', maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 13, attribution: 'Tiles &copy; Esri' },
  },
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { maxZoom: 19, attribution: '&copy; OpenStreetMap' },
  },
];

/* Rural Massachusetts on a label-free basemap is a blank field: no terrain,
   no forest, barely a road. Hillshade underneath gives the ground shape. */
const HILLSHADE =
  'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';

/** Options every tile layer needs and Leaflet gets wrong for our case. */
const LOAD_OPTS = {
  crossOrigin: true,
  updateWhenIdle: false,     // ← the blank-pan fix. Leaflet defaults this true on mobile.
  updateWhenZooming: false,  // don't thrash the grid mid zoom-animation
  updateInterval: 120,       // the grid catches up faster during a drag (default 200)
};

function urlFor(p, el) {
  if (!p.style) return p.url;
  return p.url.replace('{style}', p.style[isDark(el) ? 'dark' : 'light']);
}

/**
 * Attach the basemap to a map and keep it alive.
 *
 * @param {L.Map} map
 * @param {{ relief?: boolean, backdrop?: boolean, keepBuffer?: number }} opts
 * @returns {{ refresh(): void, destroy(): void }}
 */
export function attachTiles(map, { relief = true, backdrop = true, keepBuffer = 4 } = {}) {
  const host = map.getContainer();
  let sharp = null;
  let soft = null;
  let shade = null;
  let idx = 0;
  let errors = 0;

  function mount(i) {
    idx = i;
    errors = 0;
    const p = PROVIDERS[i];
    const url = urlFor(p, host);

    if (sharp) map.removeLayer(sharp);
    if (soft) map.removeLayer(soft);

    // Blurry-but-complete ground first, so a gap in the sharp layer shows
    // upscaled map rather than bare paper.
    if (backdrop) {
      soft = L.tileLayer(url, {
        ...p.opts, ...LOAD_OPTS,
        maxNativeZoom: 5,
        keepBuffer: 8,
        zIndex: 100,
        className: 'basemap-backdrop',
        attribution: null,        // the sharp layer already credits it
      }).addTo(map);
      soft.on('tileerror', () => { /* the backdrop is insurance; losing it is survivable */ });
    }

    sharp = L.tileLayer(url, {
      ...p.opts, ...LOAD_OPTS,
      keepBuffer,
      zIndex: 200,
      className: 'basemap-main',
    }).addTo(map);

    sharp.on('tileerror', () => {
      errors += 1;
      // A handful of misses at the edges is normal; a wall of them is not.
      if (errors > 6 && idx < PROVIDERS.length - 1) {
        console.warn('[tiles] provider unreachable, falling back');
        mount(idx + 1);
      }
    });
  }

  mount(0);

  if (relief) {
    shade = L.tileLayer(HILLSHADE, {
      ...LOAD_OPTS,
      maxZoom: 16, opacity: 0.5, zIndex: 150,
      className: 'basemap-relief',
      attribution: 'Hillshade &copy; Esri',
    }).addTo(map);
    shade.on('tileerror', () => { /* relief is decoration; losing it is fine */ });
  }

  return {
    refresh() { if (PROVIDERS[idx].style) mount(idx); },
    destroy() {
      for (const l of [sharp, soft, shade]) if (l) map.removeLayer(l);
    },
  };
}
