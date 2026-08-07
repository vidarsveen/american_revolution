/* ============================================================
   story.js — the Fortell mode: pick a chapter, then play it.
   ============================================================ */

import { loadChapter } from './script.js';
import { mountStage } from './stage.js';
import { Player } from './player.js';
import { mountCaptions, renderCaption, clearCaption, setCaptionsOn } from './captions.js';
import { mountChrome } from './chrome.js';

const CHAPTERS = [
  { pack: 'american-revolution', id: 'chapter-1775-04-19' },
];

const STR = {
  no: {
    play: 'Spill av', pause: 'Pause', back: 'Forrige', forward: 'Neste',
    captions: 'Undertekst', transcript: 'Manus', close: 'Lukk', seek: 'Spol',
    start: 'Start', resume: 'Fortsett', replay: 'Spill igjen',
    tapToContinue: 'Trykk for å fortsette',
    noAudio: 'Lyden er ikke generert ennå. Kjør tools/narrate.py.',
    listen: 'Lytt', minutes: 'min', chapters: 'Kapitler', finished: 'Ferdig',
  },
  en: {
    play: 'Play', pause: 'Pause', back: 'Previous', forward: 'Next',
    captions: 'Captions', transcript: 'Transcript', close: 'Close', seek: 'Seek',
    start: 'Start', resume: 'Resume', replay: 'Play again',
    tapToContinue: 'Tap to continue',
    noAudio: 'Audio has not been generated yet. Run tools/narrate.py.',
    listen: 'Listen', minutes: 'min', chapters: 'Chapters', finished: 'Finished',
  },
};

let view = null;
let player = null;
let chrome = null;
let chapter = null;
let people = [];
let lang = 'no';
let started = false;
let stageApi = null;

export async function initStory(container, allPeople, language) {
  view = container;
  people = allPeople;
  lang = language;

  view.innerHTML = `
    <div class="story">
      <div class="story__stage"></div>
      <div class="story__caption-slot"></div>
      <div class="story__chrome"></div>
      <div class="story__cover"></div>
    </div>`;

  const cover = view.querySelector('.story__cover');
  try {
    chapter = await loadChapter(CHAPTERS[0].pack, CHAPTERS[0].id, lang);
  } catch (err) {
    console.error('[story] could not load the chapter', err);
    cover.innerHTML = `<div class="cover__card"><p>${t('noAudio')}</p></div>`;
    cover.classList.add('is-on');
    return;
  }

  const stage = view.querySelector('.story__stage');
  stageApi = mountStage(stage, chapter, people, lang);
  mountCaptions(view.querySelector('.story__caption-slot'));

  player = new Player(chapter, {
    onTick: (t2, scene, beat, word) => {
      chrome?.tick(t2, scene, player.sceneIndex);
      if (beat !== undefined) renderCaption(beat, word);
    },
    onScene: () => { clearCaption(); },
    onState: (s) => {
      chrome?.update(s);
      view.classList.toggle('is-waiting', Boolean(s.waitingForTap));
      if (s.finished) showCover('replay');
    },
  });

  chrome = mountChrome(view.querySelector('.story__chrome'), chapter, player, STR[lang] || STR.no);
  setCaptionsOn(true);

  showCover('start');
  wireCover(cover);
  wireKeys();
  return { player, chapter };
}

/* ------------------------------------------------------------
   Cover — audio cannot autoplay, so a chapter always opens here
   ------------------------------------------------------------ */

function showCover(mode) {
  const cover = view.querySelector('.story__cover');
  const mins = Math.round(chapter.duration / 60);
  const label = mode === 'replay' ? t('replay') : t('start');
  cover.innerHTML = `
    <div class="cover__card">
      <p class="cover__kicker">${esc(chapter.subtitle)}</p>
      <h2 class="cover__title">${esc(chapter.title)}</h2>
      <p class="cover__blurb">${esc(chapter.blurb)}</p>
      <button class="cover__go" type="button">
        <span class="cover__go-ico">▶</span>
        <span>${esc(label)}</span>
        <i>${mins} ${esc(t('minutes'))}</i>
      </button>
      ${chapter.hasAudio ? '' : `<p class="cover__warn">${esc(t('noAudio'))}</p>`}
    </div>`;
  cover.classList.add('is-on');
}

function wireCover(cover) {
  cover.addEventListener('click', (e) => {
    if (!e.target.closest('.cover__go')) return;
    cover.classList.remove('is-on');
    started = true;
    player.goToScene(0, { autoplay: true });
  });

  // A pause cue holds the picture until the viewer taps anywhere.
  view.addEventListener('click', (e) => {
    if (!player?.waitingForTap) return;
    if (e.target.closest('.transport') || e.target.closest('.transcript')) return;
    player.play();
  });
}

function wireKeys() {
  document.addEventListener('keydown', (e) => {
    if (!started || !player) return;
    if (view.closest('.view')?.classList.contains('is-active') === false) return;
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); player.skipBeat(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); player.skipBeat(1); }
  });
}

/* ------------------------------------------------------------ */

export function storyPause() { player?.pause(); }

export function storyInvalidate() {
  // Leaflet measures on show; a hidden container measures as zero.
  stageApi?.invalidate();
}

export function storyRefreshTheme() {
  stageApi?.refreshTheme();
}

export function hasStory() { return Boolean(player); }

/** The live player, for debugging and for driving the app in tests. */
export function getPlayer() { return player; }
export function getChapter() { return chapter; }

function t(key) { return (STR[lang] || STR.no)[key] || key; }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
