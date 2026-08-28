/* ============================================================
   i18n.js — every word of UI chrome lives here.
   Content strings live in data/*.json as { no, en } pairs.
   ============================================================ */

import { state } from './store.js';
import { formatDate as eraFormat, formatYear as eraYear } from '../core/era.js';

const STRINGS = {
  no: {
    // Fallbacks only. The real values come from the pack — see
    // setSubject() below. These show if a manifest fails to load.
    appTitle: 'Fortell', appTitleShort: 'Fortell',
    appYears: '', bootLine: 'Fortell',

    // The front door, when more than one subject ships. Deliberately not
    // from the pack: it is the screen you see BEFORE there is a pack.
    chooseSubject: 'Hva vil du høre om?',
    chooseSubjectFoot: 'Du kan bytte når som helst — trykk på navnet øverst.',
    partOne: 'del', partMany: 'deler',

    tabStory: 'Fortell',
    tabMap: 'Kart',
    tabTimeline: 'Tidslinje',
    tabPeople: 'Personer',
    tabLibrary: 'Bibliotek',
    menu: 'Meny',
    waySubjects: '← Alle emner',
    wayLibrary: 'Bibliotek',
    wayLanguage: 'Språk',

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
    libraryIntro: 'Alt dette emnet kan forklare. Trykk på et kort for å lese mer.',
    librarySearch: 'Søk',
    libraryByCourse: 'Rekkefølge',
    libraryByName: 'A–Å',
    librarySearchEmpty: 'Ingen treff.',
    timelineIntro: 'Alt som skjedde, i rekkefølge. Kapitlene følger episodene i serien.',

    langLabel: 'Bytt språk',
    themeLabel: 'Lyst eller mørkt',

    monthNames: ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
      'juli', 'august', 'september', 'oktober', 'november', 'desember'],
    dateJoin: (d, m, y) => `${d}. ${m} ${y}`,
    bcSuffix: 'f.Kr.', adSuffix: 'e.Kr.',
    kindPlace: 'Sted', kindTopic: 'Slik levde de', kindTerm: 'Ord',
    seeAlso: 'Se også', moreAbout: 'Mer om dette',
    tapToRead: 'Trykk for å lese mer',
  },

  en: {
    appTitle: 'Fortell', appTitleShort: 'Fortell',
    appYears: '', bootLine: 'Fortell',

    chooseSubject: 'What would you like to hear about?',
    chooseSubjectFoot: 'You can switch at any time — tap the name at the top.',
    partOne: 'part', partMany: 'parts',

    tabStory: 'Story',
    tabMap: 'Map',
    tabTimeline: 'Timeline',
    tabPeople: 'People',
    tabLibrary: 'Library',
    menu: 'Menu',
    waySubjects: '← All subjects',
    wayLibrary: 'Library',
    wayLanguage: 'Language',

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
    libraryIntro: 'Everything this subject can explain. Tap a card to read more.',
    librarySearch: 'Search',
    libraryByCourse: 'In order',
    libraryByName: 'A–Z',
    librarySearchEmpty: 'Nothing found.',
    timelineIntro: 'Everything that happened, in order. Chapters follow the series.',

    langLabel: 'Change language',
    themeLabel: 'Light or dark',

    monthNames: ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'],
    dateJoin: (d, m, y) => `${d} ${m} ${y}`,
    bcSuffix: 'BC', adSuffix: 'AD',
    kindPlace: 'Place', kindTopic: 'How they lived', kindTerm: 'Word',
    seeAlso: 'See also', moreAbout: 'More about this',
    tapToRead: 'Tap to read more',
  },
};

/** UI string in the current language. */
/* What this build is ABOUT.
 *
 * The dictionary carries the words of the interface — "Play", "Close",
 * "Read more" — which are the same whatever the subject is. The name of the
 * subject is not one of those, and having "Den amerikanske revolusjonen"
 * sitting in here is the same leak as a faction table in the engine: it makes
 * the shell know which pack it is showing.
 *
 * So the pack says. `work` and `years` are already in every pack.json because
 * the cover needed them; the topbar and the document title read the same two
 * fields now. */
let subject = null;

export function setSubject(manifest) { subject = manifest || null; }

function fromPack(key) {
  if (!subject) return null;
  const lang = state.lang;
  const pick = (f) => (typeof f === 'string' ? f : (f?.[lang] ?? f?.no ?? f?.en ?? null));
  if (key === 'appTitle' || key === 'bootLine') return pick(subject.work);
  if (key === 'appTitleShort') return pick(subject.shortName) || pick(subject.work);
  if (key === 'appYears') return pick(subject.years);
  return null;
}

export function t(key) {
  const own = fromPack(key);
  if (own) return own;
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
/**
 * A date as a reader would say it.
 *
 * The calendar is core/era.js — including whether there is a year zero, which
 * there is not — and the words are here. This used to split on '-' and hand
 * the pieces to a template, which works for 1775 and produces "-0044" for
 * 44 BC.
 */
export function formatDate(iso) {
  const dict = STRINGS[state.lang] || STRINGS.no;
  return eraFormat(iso, {
    months: dict.monthNames,
    join: dict.dateJoin,
    bc: dict.bcSuffix,
    ad: dict.adSuffix,
  });
}

/** A bare year, with an era suffix only where one is needed. */
export function formatYear(y) {
  const dict = STRINGS[state.lang] || STRINGS.no;
  return eraYear(y, { bc: dict.bcSuffix, ad: dict.adSuffix });
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
