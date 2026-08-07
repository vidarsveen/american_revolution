/* ============================================================
   i18n.js — every word of UI chrome lives here.
   Content strings live in data/*.json as { no, en } pairs.
   ============================================================ */

import { state } from './store.js';

const STRINGS = {
  no: {
    appTitle: 'Den amerikanske revolusjonen',
    appTitleShort: 'Revolusjonen',
    appYears: '1763–1783',
    bootLine: 'Den amerikanske revolusjonen',

    tabStory: 'Fortell',
    tabMap: 'Kart',
    tabTimeline: 'Tidslinje',
    tabPeople: 'Personer',

    play: 'Ta meg gjennom krigen',
    pause: 'Pause',
    eventsSoFar: 'hendelser hittil',
    eventSoFar: 'hendelse hittil',
    recenter: 'Sentrer kartet',
    scrubberLabel: 'Dra for å flytte deg i tid',

    filterAll: 'Alt',
    filterBattle: 'Slag',
    filterPolitics: 'Politikk',
    filterTurning: 'Vendepunkt',
    filterPeople: 'Mennesker',

    kindBattle: 'Slag',
    kindPolitics: 'Politikk',
    kindTurning: 'Vendepunkt',
    kindPeople: 'Mennesker',

    sideBritish: 'Britene',
    sidePatriot: 'Patriotene',
    sideFrench: 'Franskmennene',
    sideNeutral: 'Andre',

    why: 'Hvorfor det betyr noe',
    fact: 'Visste du at',
    peopleHere: 'Hvem var med',
    partOf: 'Var med på',
    readMore: 'Les mer',
    wikiCredit: 'Kilde: Wikipedia (CC BY-SA)',
    wikiOpen: 'Åpne artikkelen',
    wikiInEnglish: 'på engelsk',
    wikiNone: 'Fant ingen artikkel å hente.',
    showOnMap: 'Vis på kartet',
    close: 'Lukk',

    statBritish: 'Britiske styrker',
    statPatriot: 'Amerikanske styrker',
    statFrench: 'Franske styrker',
    statOutcome: 'Utfall',
    outBritish: 'Britisk seier',
    outPatriot: 'Amerikansk seier',
    outDraw: 'Uavgjort',

    peopleIntro: 'Menneskene bak historien — på begge sider. Trykk på et portrett.',
    timelineIntro: 'Alt som skjedde, i rekkefølge. Kapitlene følger episodene i serien.',

    langLabel: 'Bytt språk',
    themeLabel: 'Lyst eller mørkt',

    monthNames: ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
      'juli', 'august', 'september', 'oktober', 'november', 'desember'],
    dateJoin: (d, m, y) => `${d}. ${m} ${y}`,
  },

  en: {
    appTitle: 'The American Revolution',
    appTitleShort: 'The Revolution',
    appYears: '1763–1783',
    bootLine: 'The American Revolution',

    tabStory: 'Story',
    tabMap: 'Map',
    tabTimeline: 'Timeline',
    tabPeople: 'People',

    play: 'Take me through the war',
    pause: 'Pause',
    eventsSoFar: 'events so far',
    eventSoFar: 'event so far',
    recenter: 'Recentre the map',
    scrubberLabel: 'Drag to move through time',

    filterAll: 'All',
    filterBattle: 'Battles',
    filterPolitics: 'Politics',
    filterTurning: 'Turning points',
    filterPeople: 'People',

    kindBattle: 'Battle',
    kindPolitics: 'Politics',
    kindTurning: 'Turning point',
    kindPeople: 'People',

    sideBritish: 'The British',
    sidePatriot: 'The Patriots',
    sideFrench: 'The French',
    sideNeutral: 'Others',

    why: 'Why it matters',
    fact: 'Did you know',
    peopleHere: 'Who was there',
    partOf: 'Was part of',
    readMore: 'Read more',
    wikiCredit: 'Source: Wikipedia (CC BY-SA)',
    wikiOpen: 'Open the article',
    wikiInEnglish: 'in English',
    wikiNone: 'No article found.',
    showOnMap: 'Show on the map',
    close: 'Close',

    statBritish: 'British forces',
    statPatriot: 'American forces',
    statFrench: 'French forces',
    statOutcome: 'Outcome',
    outBritish: 'British victory',
    outPatriot: 'American victory',
    outDraw: 'Inconclusive',

    peopleIntro: 'The people behind the story — on both sides. Tap a portrait.',
    timelineIntro: 'Everything that happened, in order. Chapters follow the series.',

    langLabel: 'Change language',
    themeLabel: 'Light or dark',

    monthNames: ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'],
    dateJoin: (d, m, y) => `${d} ${m} ${y}`,
  },
};

/** UI string in the current language. */
export function t(key) {
  const dict = STRINGS[state.lang] || STRINGS.no;
  const v = dict[key];
  return v === undefined ? (STRINGS.no[key] ?? key) : v;
}

/** Pick the right side of a { no, en } content field.
 *  Falls back to Norwegian, then to an empty string. */
export function tx(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[state.lang] ?? field.no ?? field.en ?? '';
}

/** 'YYYY-MM-DD' → '19. april 1775' / '19 April 1775'. */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dict = STRINGS[state.lang] || STRINGS.no;
  if (!m) return String(y);
  const month = dict.monthNames[m - 1];
  if (!d) return `${month} ${y}`;
  return dict.dateJoin(d, month, y);
}

/** 6200 → '6 200' (no) / '6,200' (en) */
export function formatNumber(n) {
  if (n == null) return '';
  return new Intl.NumberFormat(state.lang === 'no' ? 'nb-NO' : 'en-GB').format(n);
}

export const KIND_LABEL = {
  battle: 'kindBattle',
  politics: 'kindPolitics',
  'turning-point': 'kindTurning',
  people: 'kindPeople',
};

export const SIDE_LABEL = {
  british: 'sideBritish',
  patriot: 'sidePatriot',
  french: 'sideFrench',
  neutral: 'sideNeutral',
};
