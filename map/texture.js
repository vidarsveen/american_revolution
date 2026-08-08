/* ============================================================
   texture.js — the parchment treatment, in the right place.

   The wash, grain and time-of-day tint used to be siblings of the map
   container (index.html, and the stage-map template) at z-index 2/3/4 while
   #map sat at z-index 1. Everything Leaflet paints lives inside #map, so
   every place name, marker and route was being read through a multiply wash
   at .34, a noise grain at .24 and a night tint at .30. The texture was
   meant to age the tiles; it was ageing the information.

   Leaflet's own panes are tilePane 200, overlayPane 400, markerPane 600.
   A pane at 250 is above the tiles and below every artifact, which is what
   the CSS comments always said was intended.

   The catch: panes live inside .leaflet-map-pane, which Leaflet translates
   as you drag. A wash that pans with the map would drift off the viewport,
   so each layer is re-anchored to the container's top-left on every move.
   This is the same trick Leaflet's own SVG/Canvas renderers use.
   ============================================================ */

/**
 * @param {L.Map} map
 * @param {{ mood?: boolean }} opts  mood adds the time-of-day tint (story stage only)
 * @returns {{ moodEl: HTMLElement|null, destroy(): void }}
 */
export function mountTexture(map, { mood = false } = {}) {
  const pane = map.createPane('texture');
  pane.style.zIndex = '250';
  pane.style.pointerEvents = 'none';

  const layers = [];
  const add = (cls) => {
    const el = document.createElement('div');
    el.className = cls;
    // Positioned by anchor(); Leaflet panes have no intrinsic size.
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    pane.appendChild(el);
    layers.push(el);
    return el;
  };

  // Order matters: the tint reads as light on the ground, so it goes under
  // the paper treatment rather than on top of it.
  const moodEl = mood ? add('stage-map__mood') : null;
  add('map-wash');
  add('map-grain');

  function anchor() {
    const size = map.getSize();
    const origin = map.containerPointToLayerPoint([0, 0]);
    for (const el of layers) {
      L.DomUtil.setPosition(el, origin);
      el.style.width = `${size.x}px`;
      el.style.height = `${size.y}px`;
    }
  }

  map.on('move zoom viewreset resize zoomend', anchor);
  anchor();

  return {
    moodEl,
    destroy() {
      map.off('move zoom viewreset resize zoomend', anchor);
      pane.remove();
    },
  };
}
