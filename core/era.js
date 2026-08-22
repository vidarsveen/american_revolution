/* ============================================================
   era.js — dates, including the ones before year one.

   ─────────────────────────────────────────────────────────────
   NO `Date`. NOT ANYWHERE IN THIS FILE. THIS IS NOT STYLE.
   ─────────────────────────────────────────────────────────────

   `new Date(Date.UTC(-44, 2, 15))` does not mean 15 March 44 BC. It does not
   even mean year −44: the two-digit-year rule maps 0–99 onto 1900–1999, so
   `Date.UTC(44, …)` is 1944, and negative years go somewhere else again. The
   whole class of bug is invisible in a date picker and obvious on a timeline
   that runs from 44 BC to AD 14. So dates here are a plain `{y, m, d}` and an
   ordering number, and neither is a Date.

   The ordering number is a proleptic Julian Day Number (Meeus). It is
   monotone across the BC/AD boundary and across the Julian/Gregorian split,
   which is all a scrubber needs — and unlike a millisecond count it does not
   pretend to know what time of day the Ides of March happened.

   ─────────────────────────────────────────────────────────────
   ONE DELIBERATE DEPARTURE FROM ISO 8601
   ─────────────────────────────────────────────────────────────

   `-0044` means **44 BC**.

   ISO 8601 would call that −0043, because it numbers a year zero and every
   BC year is therefore one lower than its historical name. That is correct
   and it is unusable: every source an author types from says "44 BC", and
   requiring a silent −1 on every date is an off-by-one that no reviewer will
   ever catch, in a file of four hundred dates.

   So: there is no year zero, `-0044` is 44 BC, and the conversion to the
   astronomical numbering that the JDN formula wants happens in exactly one
   place, `astroYear()` below.
   ============================================================ */

/** Wire format: 1775-04-19 | 1775-04 | 1775 | -0044-03-15 | -0044-03 | -0044 */
const DATE_RE = /^(-?)(\d{1,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;

/* ------------------------------------------------------------
   Parsing
   ------------------------------------------------------------ */

/**
 * A date string to { y, m, d, prec, jd }, or null.
 *
 * `prec` is how much was actually written — 'year', 'month' or 'day'. A
 * source that says "spring 42 BC" should say `-0042-04` with `approx: true`
 * beside it, not invent a day; the renderer prefers an authored
 * `dateDisplay` anyway.
 */
export function parseDate(input) {
  if (input == null) return null;
  if (typeof input === 'object') return input.jd != null ? input : null;
  const m = DATE_RE.exec(String(input).trim());
  if (!m) return null;

  const [, sign, ys, ms, ds] = m;
  const year = Number(ys) * (sign === '-' ? -1 : 1);
  if (year === 0) return null;          // there is no year zero; see the header

  const month = ms == null ? null : Number(ms);
  const day = ds == null ? null : Number(ds);
  if (month != null && (month < 1 || month > 12)) return null;
  if (day != null && (day < 1 || day > 31)) return null;

  const prec = day != null ? 'day' : month != null ? 'month' : 'year';
  const p = { y: year, m: month ?? 1, d: day ?? 1, prec };
  p.jd = toJD(p);
  return p;
}

/** "-0043/-0033" or "1763/1783" to { from, to }. */
export function parseRange(input) {
  if (!input) return null;
  const [a, b] = String(input).split('/');
  const from = parseDate(a);
  const to = parseDate(b ?? a);
  return from && to ? { from, to } : null;
}

/* ------------------------------------------------------------
   Ordering
   ------------------------------------------------------------ */

/**
 * Historical year to astronomical year: 44 BC is astronomical −43.
 *
 * The one place the no-year-zero decision is paid for. Everything else in
 * this file, and every date in every pack, uses the historical numbering a
 * human would write.
 */
const astroYear = (y) => (y < 0 ? y + 1 : y);

/** Which calendar the arithmetic follows. A pack sets it; see setEra(). */
let calendar = 'gregorian';

/**
 * Proleptic Julian Day Number (Meeus, Astronomical Algorithms ch. 7).
 *
 * Math.floor, not truncation: it has to round toward minus infinity for the
 * formula to hold on the far side of year one, and `| 0` or `Math.trunc`
 * quietly does not.
 */
export function toJD(p, cal = calendar) {
  let y = astroYear(p.y);
  let m = p.m ?? 1;
  const d = p.d ?? 1;
  if (m <= 2) { y -= 1; m += 12; }
  let b = 0;
  if (cal !== 'julian') {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }
  return Math.floor(365.25 * (y + 4716))
       + Math.floor(30.6001 * (m + 1))
       + d + b - 1524.5;
}

/** Back again, for a scrubber that has to say what year it is sitting on. */
export function fromJD(jd, cal = calendar) {
  const z = Math.floor(jd + 0.5);
  let a = z;
  if (cal !== 'julian') {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);

  const day = b - dd - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const astro = month > 2 ? c - 4716 : c - 4715;
  // …and back out of astronomical numbering into the one people write.
  const y = astro <= 0 ? astro - 1 : astro;
  return { y, m: month, d: day, prec: 'day' };
}

/* ------------------------------------------------------------
   The era a pack covers
   ------------------------------------------------------------ */

export const era = {
  start: null, end: null,
  jdStart: 0, jdEnd: 1, span: 1,
  calendar: 'gregorian',
  note: null,
};

/**
 * Adopt a pack's era. Replaces the START/END constants that used to sit in
 * js/store.js, where they said 1763 and 1783 out loud.
 */
export function setEra(spec) {
  calendar = spec?.calendar || 'gregorian';
  const from = parseDate(spec?.start) || parseDate('1000-01-01');
  const to = parseDate(spec?.end) || parseDate('2000-12-31');
  era.start = from;
  era.end = to;
  era.jdStart = from.jd;
  era.jdEnd = to.jd;
  era.span = Math.max(1, to.jd - from.jd);
  era.calendar = calendar;
  era.note = spec?.calendarNote || null;
  return era;
}

/** Scrubber fraction (0–1) to a Julian day, and back. */
export const fracToJD = (f) => era.jdStart + clamp01(f) * era.span;
export const jdToFrac = (jd) => clamp01((jd - era.jdStart) / era.span);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const yearOf = (jd) => fromJD(jd).y;

/* ------------------------------------------------------------
   Rendering
   ------------------------------------------------------------ */

/**
 * A date as a reader would say it.
 *
 * `L` carries the language's month names and its way of joining them, so this
 * module holds the calendar and js/i18n.js holds the words:
 *   { months: [...12], join: (d, month, year) => string, bc: 'f.Kr.', ad: 'e.Kr.' }
 */
export function formatDate(input, L) {
  const p = parseDate(input);
  if (!p || !L) return '';
  const year = formatYear(p.y, L);
  if (p.prec === 'year') return year;
  const month = L.months?.[p.m - 1] ?? String(p.m);
  if (p.prec === 'month') return `${month} ${year}`;
  return L.join ? L.join(p.d, month, year) : `${p.d} ${month} ${year}`;
}

/**
 * A year, with an era suffix only where one is needed.
 *
 * 1775 is not "1775 AD" to anyone. A year before year one always needs its
 * suffix, and a low positive year usually does — "14" alone is not a date.
 */
export function formatYear(y, L) {
  if (y < 0) return `${-y} ${L?.bc ?? 'BC'}`;
  if (y < 1000 && L?.ad) return `${y} ${L.ad}`;
  return String(y);
}

/**
 * A tick step that lands on round years.
 *
 * The scrubber used to draw a tick per year between two literals. Twenty
 * years wants one a year; seventeen centuries does not.
 */
export function niceStep(years, wanted = 8) {
  const raw = Math.max(1, years / Math.max(1, wanted));
  for (const step of [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]) {
    if (raw <= step) return step;
  }
  return 1000;
}

/**
 * The years to label across the era, counting through BC correctly.
 *
 * There is no year zero, so a step that would land on it lands on 1 BC and
 * AD 1 instead — which is also how a reader would read that stretch.
 */
export function tickYears(step = null) {
  const y0 = era.start?.y ?? 0;
  const y1 = era.end?.y ?? 0;
  const s = step || niceStep(Math.abs(y1 - y0) + 1);
  const out = [];
  let y = Math.ceil(y0 / s) * s;
  if (y === 0) y = 1;
  while (y <= y1) {
    if (y !== 0) out.push(y);
    y += s;
    if (y === 0) y = 1;
    if (out.length > 400) break;
  }
  if (!out.length || out[0] !== y0) out.unshift(y0);
  if (out[out.length - 1] !== y1) out.push(y1);
  return out;
}

/** The Julian day a year starts on — where a tick actually goes. */
export function jdOfYear(y) {
  return toJD({ y, m: 1, d: 1 });
}
