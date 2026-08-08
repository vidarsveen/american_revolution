/* ============================================================
   fixture.js — demo content for the map lab.

   Deliberately not the real chapter. The lab must keep working while the
   content is being rewritten, and a golden screenshot of the lab should
   fail when the MAP changes, not when someone edits a sentence.
   ============================================================ */

/* Simplified period flags. Inline SVG so they inherit crispness at any DPR
   and cost no request; a content pack ships its own set, which is the whole
   reason factions are data rather than CSS class names. */
const FLAG_BRITISH = `<svg viewBox="0 0 60 40" preserveAspectRatio="none">
  <rect width="60" height="40" fill="#00247d"/>
  <path d="M0 0 60 40M60 0 0 40" stroke="#fff" stroke-width="9"/>
  <path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="15"/>
  <path d="M30 0v40M0 20h60" stroke="#cf142b" stroke-width="9"/>
</svg>`;

const FLAG_PATRIOT = `<svg viewBox="0 0 60 40" preserveAspectRatio="none">
  <rect width="60" height="40" fill="#f4f1e8"/>
  <g fill="#b22234">
    <rect y="0" width="60" height="3.1"/><rect y="6.2" width="60" height="3.1"/>
    <rect y="12.4" width="60" height="3.1"/><rect y="18.6" width="60" height="3.1"/>
    <rect y="24.8" width="60" height="3.1"/><rect y="31" width="60" height="3.1"/>
    <rect y="37" width="60" height="3"/>
  </g>
  <rect width="26" height="21.7" fill="#2c4a6e"/>
  <g fill="#fff"><circle cx="7" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
    <circle cx="21" cy="10" r="1.6"/><circle cx="11" cy="12" r="1.6"/>
    <circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/></g>
</svg>`;

const FLAG_FRENCH = `<svg viewBox="0 0 60 40" preserveAspectRatio="none">
  <rect width="60" height="40" fill="#f4f1e8"/>
  <g fill="#b0803c" transform="translate(30 20) scale(1.5)">
    <path d="M0-7c1.6 2.4 1.6 4 0 5.4C-1.6-3-1.6-4.6 0-7z"/>
    <path d="M-5 0c1.6-2 3.4-1.4 4.2.4C-2.4 1.6-4 1.2-5 0zM5 0c-1.6-2-3.4-1.4-4.2.4 1.8 1.2 3.4.8 4.2-.4z"/>
    <rect x="-4.4" y="1.4" width="8.8" height="1.5"/>
    <path d="M-1.2 3.2h2.4L.8 7h-1.6z"/>
  </g>
</svg>`;

export const FACTIONS = {
  british: {
    label: 'Britiske', flag: FLAG_BRITISH,
    fill: '#a8322d', line: '#7d211d',
    fillDark: '#e0645c', lineDark: '#f0a19b',
  },
  patriot: {
    label: 'Patriotene', flag: FLAG_PATRIOT,
    fill: '#2c4a6e', line: '#1c3050',
    fillDark: '#7ba6d8', lineDark: '#b7d2ee',
  },
  french: {
    label: 'Franske', flag: FLAG_FRENCH,
    fill: '#b0803c', line: '#7d5a26',
    fillDark: '#dfab5e', lineDark: '#f0cd97',
  },
  neutral: { label: 'Nøytral', flag: '', fill: '#55704c', line: '#3b5034',
             fillDark: '#8fb083', lineDark: '#bcd3b2' },
};

export const PLACES = [
  { id: 'boston',   name: 'Boston',       coords: [42.3601, -71.0589], kind: 'city' },
  { id: 'lexington', name: 'Lexington',   coords: [42.4430, -71.2290], kind: 'town', minZoom: 8 },
  { id: 'concord',  name: 'Concord',      coords: [42.4604, -71.3489], kind: 'town', minZoom: 8 },
  { id: 'charlestown', name: 'Charlestown', coords: [42.3782, -71.0602], kind: 'town', minZoom: 9 },
  { id: 'newyork',  name: 'New York',     coords: [40.7128, -74.0060], kind: 'city' },
  { id: 'philly',   name: 'Philadelphia', coords: [39.9526, -75.1652], kind: 'city' },
  { id: 'quebec',   name: 'Québec',       coords: [46.8139, -71.2080], kind: 'city' },
  { id: 'yorktown', name: 'Yorktown',     coords: [37.2387, -76.5077], kind: 'town', minZoom: 6 },
  { id: 'ne',       name: 'New England',  coords: [43.8, -71.6], kind: 'region' },
  { id: 'atl',      name: 'Atlanterhavet', coords: [38.6, -68.5], kind: 'region' },
];

/* The road the British actually took out of Boston, roughly. */
export const ROAD_CONCORD = [
  [42.3736, -71.0590], [42.3860, -71.1050], [42.4010, -71.1470],
  [42.4200, -71.1810], [42.4430, -71.2290], [42.4530, -71.2900],
  [42.4604, -71.3489],
];

export const REVERE_RIDE = [
  [42.3782, -71.0602], [42.3960, -71.0790], [42.4140, -71.1250],
  [42.4330, -71.1760], [42.4430, -71.2290],
];

export const BRITISH_ADVANCE = [
  [42.3690, -71.0700], [42.3900, -71.1200], [42.4150, -71.1700],
  [42.4430, -71.2290], [42.4604, -71.3489],
];

export const BRITISH_RETREAT = [
  [42.4604, -71.3489], [42.4400, -71.2500], [42.4100, -71.1600],
  [42.3830, -71.0900], [42.3782, -71.0602],
];

export const MILITIA_CONVERGE = [
  [[42.5400, -71.4200], [42.5000, -71.3200], [42.4700, -71.2700], [42.4500, -71.2350]],
  [[42.3200, -71.3800], [42.3700, -71.3100], [42.4100, -71.2700], [42.4400, -71.2400]],
];

export const CHARLES_CROSSING = { from: [42.3690, -71.0700], to: [42.3800, -71.0930] };

export const NEW_ENGLAND_CONTROL = [[
  [43.30, -73.30], [43.10, -70.70], [42.20, -70.10],
  [41.30, -71.10], [41.60, -73.50], [42.60, -73.60],
]];

export const SIEGE_FRONT = [
  [42.4200, -71.1450], [42.3960, -71.1300], [42.3720, -71.1180],
  [42.3480, -71.1050], [42.3260, -71.0800],
];

/* Sized for the Boston frame, so the control wash demonstrates itself
   without tinting the entire viewport. */
export const BOSTON_CONTROL = [[
  [42.5000, -71.3600], [42.4900, -71.1400], [42.4200, -71.0900],
  [42.3500, -71.1300], [42.3400, -71.3000], [42.4200, -71.3800],
]];
