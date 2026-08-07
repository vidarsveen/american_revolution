/* ============================================================
   basemap.js — the parchment basemap, shared by every map surface.

   Label-free modern tiles, aged with a CSS filter and a warm wash (see
   css/map.css). Falls through to other providers if one is unreachable.
   ============================================================ */

const PROVIDERS = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/{style}_nolabels/{z}/{x}/{y}{r}.png',
    themed: true,
    opts: { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' },
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

export function isDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Attach tiles to a map and keep them alive.
 * Returns { refresh() } — call it when the theme changes.
 */
export function attachTiles(map) {
  let layer = null;
  let idx = 0;
  let errors = 0;

  function mount(i) {
    idx = i;
    errors = 0;
    const p = PROVIDERS[i];
    const url = p.themed ? p.url.replace('{style}', isDark() ? 'dark' : 'light') : p.url;
    if (layer) map.removeLayer(layer);
    layer = L.tileLayer(url, { ...p.opts, crossOrigin: true, keepBuffer: 2 }).addTo(map);
    layer.on('tileerror', () => {
      errors += 1;
      // A few misses at the edges are normal; a wall of them is not.
      if (errors > 6 && idx < PROVIDERS.length - 1) {
        console.warn('[basemap] provider unreachable, falling back');
        mount(idx + 1);
      }
    });
  }

  mount(0);
  return {
    refresh() { if (PROVIDERS[idx].themed) mount(idx); },
  };
}
