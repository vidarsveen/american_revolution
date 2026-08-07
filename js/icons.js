/* ============================================================
   icons.js — inline SVG. No icon font, no sprite request.
   Everything uses currentColor so it inherits the theme.
   ============================================================ */

const s = (body, opts = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${opts}>${body}</svg>`;

const f = (body) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

/* ---------- Navigation ------------------------------------- */
export const icoMap = s(
  '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z"/><path d="M9 4v13"/><path d="M15 6.5v13"/>'
);

export const icoTimeline = s(
  '<path d="M6 3v18"/><circle cx="6" cy="7.5" r="2"/><circle cx="6" cy="16.5" r="2"/>' +
  '<path d="M11 7.5h9"/><path d="M11 16.5h6"/>'
);

export const icoPeople = s(
  '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.7 5.7 0 0 1 11 0"/>' +
  '<path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.6A5.7 5.7 0 0 1 20.5 20"/>'
);

/* ---------- Controls --------------------------------------- */
export const icoPlay  = f('<path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l11-6.8c.6-.4.6-1.4 0-1.8l-11-6.8c-.7-.4-1.6.1-1.6.9Z"/>');
export const icoPause = f('<rect x="6" y="4.5" width="4" height="15" rx="1.4"/><rect x="14" y="4.5" width="4" height="15" rx="1.4"/>');
export const icoClose = s('<path d="M6 6l12 12M18 6L6 18"/>');
export const icoCaret = s('<path d="m6 9 6 6 6-6"/>');
export const icoTarget = s('<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>');
export const icoPin = s('<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>');
export const icoExternal = s('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1.6 1.6 0 0 1-1.6 1.6H5A1.6 1.6 0 0 1 3.4 19V7.6A1.6 1.6 0 0 1 5 6h5"/>');
export const icoBook = s('<path d="M4 5.2A1.6 1.6 0 0 1 5.6 3.6H10a2.6 2.6 0 0 1 2 1 2.6 2.6 0 0 1 2-1h4.4A1.6 1.6 0 0 1 20 5.2v12.4a1.6 1.6 0 0 1-1.6 1.6H14a2 2 0 0 0-2 1.4 2 2 0 0 0-2-1.4H5.6A1.6 1.6 0 0 1 4 17.6Z"/><path d="M12 6.6v13.4"/>');
export const icoSun = s('<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>');
export const icoMoon = s('<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>');

/* ---------- Marker glyphs (small — keep them simple) -------- */
export const glyphBattle = s(
  '<path d="M4.5 4.5 14 14"/><path d="M19.5 4.5 10 14"/>' +
  '<path d="m7.4 16.6-3 3"/><path d="m16.6 16.6 3 3"/>',
  'stroke-width="2.2"'
);

export const glyphPolitics = s(
  '<path d="M7 3.5h7.5L18 7v13.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"/>' +
  '<path d="M13.8 3.7V7.2H17.8"/><path d="M8.8 12h6"/><path d="M8.8 16h4"/>',
  'stroke-width="2"'
);

export const glyphTurning = f(
  '<path d="M12 2.6 14.7 9h6.8l-5.4 4.2 2 6.7L12 16l-6.1 3.9 2-6.7L2.5 9h6.8Z"/>'
);

export const glyphPeople = s(
  '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>',
  'stroke-width="2.2"'
);

export const glyphNaval = s(
  '<circle cx="12" cy="4.6" r="2.1"/><path d="M12 6.7v13.6"/><path d="M7.6 10h8.8"/>' +
  '<path d="M4.4 14.4a7.9 7.9 0 0 0 15.2 0"/>',
  'stroke-width="2"'
);

export const GLYPH = {
  battle: glyphBattle,
  politics: glyphPolitics,
  'turning-point': glyphTurning,
  people: glyphPeople,
  naval: glyphNaval,
};

export const icoPersonPlaceholder = s(
  '<circle cx="12" cy="8.6" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
);
