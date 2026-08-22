/* ============================================================
   sheet.js — Explore's binding to the shared dossier.

   The panel itself is core/dossier.js now, because the narrated mode needs
   the same one and a second copy would drift. What is left here is the part
   that is genuinely Explore's:

     * the card is a ROUTE. Selecting one writes store.selected, which the
       hash router turns into #/hendelse/lexington, so a card can be linked
       to and the back button closes it. The story mode has no such idea — a
       card there is a pause, not a place.
     * the event content SCHEMA. `britishForces`, `americanForces` and
       `outcome` are fields this pack's events happen to have, and turning
       them into rows is a translation from one subject's data into the
       generic shape the panel renders.
   ============================================================ */

import { state, set, subscribe } from './store.js';
import { t, tx, formatDate, formatNumber, KIND_LABEL } from './i18n.js';
import { createDossier } from '../core/dossier.js';

let dossier = null;
let events = new Map();
let people = new Map();

/* See setPortraitBase in js/people.js — same reason, same default. */
let portraitBase = './portraits/';

export function setPortraitBase(base) { portraitBase = base || './portraits/'; }

export function initSheet(allEvents, allPeople, handlers = {}) {
  events = new Map(allEvents.map((e) => [e.id, e]));
  people = new Map(allPeople.map((p) => [p.id, p]));

  dossier = createDossier(document.body, {
    mode: 'sheet',
    t,
    tx,
    formatDate,
    formatNumber,
    portraitBase,
    lang: () => state.lang,
    resolve,
    onShowOnMap: handlers.onShowOnMap || (() => {}),
    // Following a chip is a navigation, not just a re-render: it has to go
    // through the store so the URL and the back button keep up.
    onNavigate: (ref) => set({ selected: { type: ref.kind, id: ref.id } }),
    onClose: () => { if (state.selected) set({ selected: null }); },
  });

  subscribe((s, changed) => {
    if (changed.has('selected')) render();
    if (changed.has('lang') && s.selected) render();
  });

  render();
}

export function close() { set({ selected: null }); }

function render() {
  const sel = state.selected;
  if (!sel) { dossier.close(); return; }
  // A selection that names nothing is a dead link — clear it rather than
  // leaving the URL pointing at a card that cannot open.
  if (!dossier.open({ kind: sel.type, id: sel.id })) set({ selected: null });
}

/**
 * One record, in the shape the panel renders.
 *
 * The `stats` translation is the interesting part: an event carries
 * `numbers.britishForces` because that is what this war has, and the panel
 * knows only that a stat is a label, a value and optionally a side. A pack
 * about Rome would translate something else into the same three fields.
 */
function resolve(ref) {
  if (ref.kind === 'person') return people.get(ref.id) || null;
  if (ref.kind !== 'event') return null;

  const ev = events.get(ref.id);
  if (!ev) return null;

  const n = ev.numbers || {};
  const stats = [];
  if (n.britishForces) stats.push({ label: t('statBritish'), value: n.britishForces, side: 'british' });
  if (n.americanForces) stats.push({ label: t('statPatriot'), value: n.americanForces, side: 'patriot' });
  if (n.frenchForces) stats.push({ label: t('statFrench'), value: n.frenchForces, side: 'french' });
  if (n.outcome) {
    const key = { british: 'outBritish', patriot: 'outPatriot', draw: 'outDraw' }[n.outcome];
    if (key) stats.push({ label: t('statOutcome'), value: t(key) });
  }

  return { ...ev, stats, kindLabel: KIND_LABEL[ev.kind] || 'kindBattle' };
}
