/* ============================================================
   story.js — the Fortell mode: pick a chapter, then play it.
   ============================================================ */

import { loadChapter } from './script.js';
import { checkVerbManifest, mountStage } from './stage.js';
import { Player } from './player.js';
import { mountCaptions, renderCaption, clearCaption, setCaptionsOn, storedCaptionsOn } from './captions.js';
import { mountChrome } from './chrome.js';
import { soundScene, unlockSound, setSilentSound, startSoundClock,
         stopSoundClock, pauseSound, resumeSound, stopSound } from './scenes/sound.js';

// In order. The cover lists them when there is more than one, and a chapter
// that fails to load is dropped from the list rather than taking the mode
// down with it.
const CHAPTERS = [
  { pack: 'american-revolution', id: 'chapter-1775-04-19' },
  { pack: 'american-revolution', id: 'chapter-1775-06-17' },
];

const STR = {
  no: {
    play: 'Spill av', pause: 'Pause', back: 'Forrige', forward: 'Neste',
    captions: 'Undertekst', transcript: 'Manus', close: 'Lukk', seek: 'Spol',
    controls: 'Kontroller', hideControls: 'Skjul kontroller',
    start: 'Start', resume: 'Fortsett', replay: 'Spill igjen',
    tapToContinue: 'Trykk for å fortsette',
    noAudio: 'Lyden er ikke generert ennå. Kjør tools/narrate.py.',
    onlyIn: 'Denne fortellingen finnes foreløpig bare på norsk.',
    listen: 'Lytt', minutes: 'min', chapters: 'Kapitler', finished: 'Ferdig',
    episodes: 'Episoder',
  },
  en: {
    play: 'Play', pause: 'Pause', back: 'Previous', forward: 'Next',
    captions: 'Captions', transcript: 'Transcript', close: 'Close', seek: 'Seek',
    controls: 'Controls', hideControls: 'Hide controls',
    start: 'Start', resume: 'Resume', replay: 'Play again',
    tapToContinue: 'Tap to continue',
    noAudio: 'Audio has not been generated yet. Run tools/narrate.py.',
    onlyIn: 'This chapter is only narrated in Norwegian so far.',
    listen: 'Listen', minutes: 'min', chapters: 'Chapters', finished: 'Finished',
    episodes: 'Episodes',
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
let current = 0;

export async function initStory(container, allPeople, language) {
  // Dev-time only: a drift between the handler table and the manifest
  // is invisible until a cue silently does nothing, so say it out loud.
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    checkVerbManifest();
  }

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

  wireCover(view.querySelector('.story__cover'));
  wireKeys();
  return openChapter(0);
}

/**
 * Load a chapter and build the whole mode around it.
 *
 * Called again every time the viewer picks a different chapter, so it has to
 * leave nothing of the last one behind. Everything mounted here appends to a
 * host rather than replacing it — the map, the captions, the transport, and
 * the two panels the transport puts on the story root — so teardown empties
 * the hosts explicitly. A half-cleaned switch shows up as two transports and
 * a map drawing under a map, which is not subtle but is easy to ship.
 */
async function openChapter(index) {
  teardown();
  current = index;

  const cover = view.querySelector('.story__cover');
  try {
    chapter = await loadChapter(CHAPTERS[index].pack, CHAPTERS[index].id, lang);
  } catch (err) {
    console.error('[story] could not load the chapter', err);
    cover.innerHTML = `<div class="cover__card"><p>${t('noAudio')}</p></div>`;
    cover.classList.add('is-on');
    return null;
  }

  const stage = view.querySelector('.story__stage');
  stageApi = mountStage(stage, chapter, people, chapter.narrationLang);
  mountCaptions(view.querySelector('.story__caption-slot'));

  player = new Player(chapter, {
    onTick: (t2, scene, beat, word) => {
      chrome?.tick(t2, scene, player.sceneIndex);
      if (beat !== undefined) renderCaption(beat, word);
    },
    onScene: (scene) => {
      clearCaption();
      // The ducking schedule is a property of the scene, and it has to be in
      // place before the first word — not discovered as the voice arrives.
      soundScene(scene, { silent: player.silent });
    },
    onState: (s) => {
      chrome?.update(s);
      view.classList.toggle('is-waiting', Boolean(s.waitingForTap));
      // While the narration is running, the app frame is not the point. The
      // title bar and tab bar were taking about a quarter of a phone screen.
      document.querySelector('.app')?.classList.toggle('is-immersive', s.playing);
      // A chapter running on the timer has no voice to duck under, and music
      // over silent captions is worse than silence.
      setSilentSound(player.silent);
      // Stopping the clock only stops the ducker. Music and ambience are
      // looping sources that carry on by themselves, which is how a paused
      // chapter — and a chapter left behind by switching to Explore — went on
      // playing a bed under a screen that had stopped telling a story.
      if (s.playing) {
        resumeSound();
        startSoundClock(() => player.now());
      } else {
        stopSoundClock();
        pauseSound();
      }
      // The end is not a pause. The cover is back and there is no narration
      // left for a bed to sit under, so this one is a real stop.
      if (s.finished) { stopSound(); showCover('replay'); }
    },
  });

  chrome = mountChrome(
    view.querySelector('.story__chrome'),
    view.querySelector('.story'),
    chapter, player, STR[lang] || STR.no);
  setCaptionsOn(storedCaptionsOn());

  TITLES[chapter.id] = chapter.title;
  showCover('start');
  learnTitles();
  return { player, chapter };
}

/**
 * Fill in the names of the chapters we have not opened.
 *
 * Deliberately after the cover is already up and deliberately not awaited: a
 * list of chapter names is not worth making anyone wait for, and the fetch is
 * a cache hit for anything the service worker has precached. The cover is
 * only redrawn if it is still the thing on screen — coming back to it later
 * would otherwise wipe a "replay" cover and put "start" back.
 */
function learnTitles() {
  const missing = CHAPTERS.filter((c) => !TITLES[c.id]);
  if (!missing.length) return;
  Promise.all(missing.map((c) => fetch(`./content/${c.pack}/${c.id}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j) TITLES[c.id] = pickLang(j.title); })
    .catch(() => {})))
    .then(() => {
      const cover = view?.querySelector('.story__cover');
      if (cover?.classList.contains('is-on') && !started) showCover('start');
    });
}

function pickLang(field) {
  if (!field) return '';
  return typeof field === 'string' ? field : (field[lang] ?? field.no ?? field.en ?? '');
}

/** Undo everything openChapter() built, in the reverse order it built it. */
function teardown() {
  if (!player) return;
  stopSoundClock();
  stopSound();
  player.destroy();
  player = null;
  chrome = null;
  stageApi = null;
  started = false;
  document.querySelector('.app')?.classList.remove('is-immersive');
  view.classList.remove('is-waiting');
  const story = view.querySelector('.story');
  // The transport mounts into its own host; the episode list and the
  // transcript are siblings of it on the story root, which is why emptying
  // the host alone was not enough.
  for (const sel of ['.story__stage', '.story__caption-slot', '.story__chrome']) {
    view.querySelector(sel).replaceChildren();
  }
  // The episode list carries .transcript too — it is the same sheet.
  for (const el of story.querySelectorAll(':scope > .transcript')) el.remove();
}

/* ------------------------------------------------------------
   Cover — audio cannot autoplay, so a chapter always opens here
   ------------------------------------------------------------ */

function showCover(mode) {
  const cover = view.querySelector('.story__cover');
  const mins = Math.round(chapter.duration / 60);
  const label = mode === 'replay' ? t('replay') : t('start');
  // What you are about to watch is the American Revolution; 19 April 1775 is
  // which part of it. Leading with the date named a day to someone who has not
  // been told yet why that day matters.
  const when = [chapter.title, chapter.subtitle].filter(Boolean).join(' · ');
  cover.innerHTML = `
    <div class="cover__card">
      <p class="cover__kicker">${esc(when)}</p>
      <h2 class="cover__title">${esc(chapter.work)}</h2>
      <p class="cover__blurb">${esc(chapter.blurb)}</p>
      <button class="cover__go" type="button">
        <span class="cover__go-ico">▶</span>
        <span>${esc(label)}</span>
        <i>${mins} ${esc(t('minutes'))}</i>
      </button>
      ${chapter.hasAudio ? '' : `<p class="cover__warn">${esc(t('noAudio'))}</p>`}
      ${chapter.dubbed ? `<p class="cover__note">${esc(t('onlyIn'))}</p>` : ''}
      ${chapterList()}
    </div>`;
  cover.classList.add('is-on');
}

/**
 * The other chapters, under the play button.
 *
 * Titles come from the loaded chapter for the one we have, and from the id
 * for the ones we have not fetched yet — the cover must not stall on a
 * network round-trip per chapter just to draw a row of buttons. `TITLES`
 * holds whatever we have learned so far, so the list fills in as chapters
 * are opened and is complete on the second visit.
 */
function chapterList() {
  if (CHAPTERS.length < 2) return '';
  const rows = CHAPTERS.map((c, i) => `
    <li><button class="cover__chapter${i === current ? ' is-current' : ''}"
                type="button" data-chapter="${i}"
                ${i === current ? 'aria-current="true"' : ''}>
      <b>${i + 1}</b><span>${esc(TITLES[c.id] || c.id)}</span>
    </button></li>`).join('');
  return `<div class="cover__chapters">
      <p class="cover__chapters-label">${esc(t('chapters'))}</p>
      <ol>${rows}</ol>
    </div>`;
}

/** Chapter id -> the title in the reader's language, once we have seen it. */
const TITLES = {};

function wireCover(cover) {
  cover.addEventListener('click', (e) => {
    // Picking a different chapter rebuilds the mode around it and leaves the
    // cover up: the tap that starts playing has to be the one on the play
    // button, because that is the gesture the audio context is unlocked by.
    const pick = e.target.closest('[data-chapter]');
    if (pick) {
      const i = Number(pick.dataset.chapter);
      if (i !== current) openChapter(i);
      return;
    }
    if (!e.target.closest('.cover__go')) return;
    cover.classList.remove('is-on');
    started = true;
    // The only real user gesture the chapter is guaranteed to get. A browser
    // will not build an audio context without one, and Safari only counts it
    // once something has been scheduled on the context — which unlock() does.
    // Deliberately not awaited: sound is an enhancement and must never stand
    // between the tap and the story starting.
    unlockSound();
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
    // Plain arrows step a sentence; with shift they step a whole episode.
    else if (e.code === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); player.skipScene(-1); }
    else if (e.code === 'ArrowRight' && e.shiftKey) { e.preventDefault(); player.skipScene(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); player.skipBeat(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); player.skipBeat(1); }
    else if (e.code === 'KeyE') { e.preventDefault(); chrome?.openEpisodes(); }
    else if (e.code === 'Escape') { chrome?.closeEpisodes(); }
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
