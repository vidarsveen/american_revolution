/* ============================================================
   story.js — the Fortell mode: pick a chapter, then play it.
   ============================================================ */

import { loadChapter } from './script.js';
import { allChapters, chaptersOf } from './pack.js';
import { mountDepth, unmountDepth, coach } from './depth.js';
import { mapScene, getStoryMap } from './scenes/map.js';
import { mountTransition, unmountTransition, LEAD_IN_MS } from './transition.js';
import { derivePalette, toneFactions, applyPaletteVars } from '../core/palette.js';
import { isDark } from '../core/theme.js';
import { checkVerbManifest, mountStage } from './stage.js';
import { Player } from './player.js';
import { mountCaptions, renderCaption, clearCaption, setCaptionsOn, storedCaptionsOn } from './captions.js';
import { mountChrome } from './chrome.js';
import { soundScene, unlockSound, setSilentSound, startSoundClock,
         stopSoundClock, pauseSound, resumeSound, stopSound } from './scenes/sound.js';

// Every narrated chapter of every pack, in order, filled in at boot from
// content/packs.json and each pack.json. It was a hardcoded array of two,
// which is the single reason the engine knew what subject it was about.
let CHAPTERS = [];

const STR = {
  no: {
    play: 'Spill av', pause: 'Pause', back: 'Forrige', forward: 'Neste',
    language: 'Bytt språk', langMark: '<b>NO</b><i>/EN</i>',
    captions: 'Undertekst', transcript: 'Manus', close: 'Lukk', seek: 'Spol',
    controls: 'Kontroller', hideControls: 'Skjul kontroller',
    start: 'Start', resume: 'Fortsett', replay: 'Spill igjen',
    tapToContinue: 'Trykk for å fortsette',
    noAudio: 'Denne fortellingen er ikke lest inn ennå. Teksten går av seg selv.',
    onlyIn: 'Denne fortellingen finnes foreløpig bare på norsk.',
    listen: 'Lytt', minutes: 'min', chapters: 'Kapitler', finished: 'Ferdig',
    episodes: 'Episoder',
    noChapters: 'Ingen kapitler funnet. Sjekk content/packs.json.',
    tapToRead: 'Trykk for å lese mer',
  },
  en: {
    play: 'Play', pause: 'Pause', back: 'Previous', forward: 'Next',
    language: 'Change language', langMark: '<i>NO/</i><b>EN</b>',
    captions: 'Captions', transcript: 'Transcript', close: 'Close', seek: 'Seek',
    controls: 'Controls', hideControls: 'Hide controls',
    start: 'Start', resume: 'Resume', replay: 'Play again',
    tapToContinue: 'Tap to continue',
    noAudio: 'This chapter has not been recorded yet. The text runs on its own.',
    onlyIn: 'This chapter is only narrated in Norwegian so far.',
    listen: 'Listen', minutes: 'min', chapters: 'Chapters', finished: 'Finished',
    episodes: 'Episodes',
    noChapters: 'No chapters found. Check content/packs.json.',
    tapToRead: 'Tap to read more',
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
let depth = null;
let transition = null;
let current = 0;

/** Set by the shell, so the story can ask for a language change rather
    than performing one behind the rest of the app's back. */
let onLangChange = null;
export function setLangHandler(fn) { onLangChange = fn; }

export async function initStory(container, allPeople, language, pack) {
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

  // Only this subject's chapters. allChapters() spans every pack that
  // ships, which is what the benches want and exactly what the episode
  // list must not do: the session has already chosen a subject, and
  // offering the other one's chapters here would put a Roman scene one
  // tap away from a map framed on Boston.
  CHAPTERS = pack ? await chaptersOf(pack) : await allChapters();
  if (!CHAPTERS.length) {
    view.querySelector('.story__cover').innerHTML =
      `<div class="cover__card"><p>${esc(t('noChapters'))}</p></div>`;
    view.querySelector('.story__cover').classList.add('is-on');
    return null;
  }

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

  // Publish this chapter's pack palette as --f-<side> before anything that
  // references it is rendered. js/main.js does the same at boot for the
  // default pack; a chapter from a second pack has different sides, and
  // without this its stat chips would quietly draw the first pack's colours.
  const el = document.documentElement;
  applyPaletteVars(el, {
    ...derivePalette(chapter.packInfo?.factions, { el, dark: isDark(el) }),
    ...toneFactions(el),
  });

  const stage = view.querySelector('.story__stage');
  // The chapter's OWN people, not whichever pack booted first.
  const cast = chapter.people?.length ? chapter.people : people;
  stageApi = mountStage(stage, chapter, cast, chapter.narrationLang);
  mountCaptions(view.querySelector('.story__caption-slot'));

  // Depth mounts before the player so the panel exists by the first beat.
  // A SIBLING of .story__stage, deliberately: resetStage() empties the stage
  // on every seek, and a card is not stage state.
  transition = mountTransition(view.querySelector('.story'));

  depth = mountDepth(view.querySelector('.story'), {
    chapter,
    people: cast,
    get player() { return player; },
    t,
    tx: pickLang,
    lang: () => lang,
    onReframe: () => stageApi?.reframe?.(),
  });
  coach.label = t('tapToRead');

  player = new Player(chapter, {
    onTick: (t2, scene, beat, word) => {
      chrome?.tick(t2, scene, player.sceneIndex);
      if (beat !== undefined) {
        renderCaption(beat, word);
        // Introduce the dotted underline the first time one is on screen,
        // once ever. coach() takes itself away and refuses to run when the
        // picture is being rebuilt, so scrubbing never re-fires it.
        if (beat?.terms?.length) coach();
      }
    },
    onScene: (scene, index, at = 0) => {
      clearCaption();
      // Before the rebuild, so a place that only exists from a later scene is
      // not on the map before the story gets there.
      mapScene(index);
      // Announce where we have arrived. Declines when this is not an opening
      // — a seek into the middle of a scene is you looking for something, not
      // the scene beginning — and when the chapter is not running.
      transition?.announce(scene, {
        at,
        playing: Boolean(player?.playing),
        first: index === 0,
      });
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

  // The pause the title card lives in.
  player.leadInMs = LEAD_IN_MS;

  chrome = mountChrome(
    view.querySelector('.story__chrome'),
    view.querySelector('.story'),
    chapter, player, STR[lang] || STR.no,
    // The transport's language button. It goes through onLangChange so the
    // Explore store, the URL and the stored preference all move together —
    // the story mode must not end up in a different language from the app.
    () => onLangChange?.(lang === 'no' ? 'en' : 'no'));
  setCaptionsOn(storedCaptionsOn());

  TITLES[chapter.id] = chapter.title;
  showCover('start');
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
/* Chapter titles come from pack.json, which is the point of having one.
   The cover used to fetch every unopened chapter — two files, about 200 KB of
   prose — after it was already on screen, purely to find out what they were
   called. Fine at two chapters and wrong at ten. */
function titleOf(c) {
  return TITLES[c.id] || pickLang(c.title) || c.id;
}

function pickLang(field) {
  if (!field) return '';
  return typeof field === 'string' ? field : (field[lang] ?? field.no ?? field.en ?? '');
}

/** Undo everything openChapter() built, in the reverse order it built it. */
function teardown() {
  if (!player) return;
  unmountDepth();
  depth = null;
  unmountTransition();
  transition = null;
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
      ${accuracyNote()}
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
/* What the map cannot show. Every basemap here is modern, and for a
   historical subject that is wrong in specific, teachable ways -- Ostia
   stood on the sea, Back Bay was water. The pack declares the caveat and
   this is what finally puts it on a screen. */
function accuracyNote() {
  const note = pickLang(chapter?.packInfo?.map?.accuracyNote);
  return note ? `<p class="cover__accuracy">${esc(note)}</p>` : '';
}

function chapterList() {
  if (CHAPTERS.length < 2) return '';
  const rows = CHAPTERS.map((c, i) => `
    <li><button class="cover__chapter${i === current ? ' is-current' : ''}"
                type="button" data-chapter="${i}"
                ${i === current ? 'aria-current="true"' : ''}>
      <b>${i + 1}</b><span>${esc(titleOf(c))}${c.subtitle ? `<i>${esc(pickLang(c.subtitle))}</i>` : ''}</span>
    </button></li>`).join('');
  return `<div class="cover__chapters">
      <p class="cover__chapters-label">${esc(t('chapters'))}</p>
      <ol>${rows}</ol>
    </div>`;
}

/** Chapter id -> the title of a chapter we have actually opened, which may
    be more current than the manifest if someone edited one and not the other. */
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
    started = true;
    // The only real user gesture the chapter is guaranteed to get. A browser
    // will not build an audio context without one, and Safari only counts it
    // once something has been scheduled on the context — which unlock() does.
    // Deliberately not awaited: sound is an enhancement and must never stand
    // between the tap and the story starting.
    unlockSound();
    // Let the opening shot LAND before anyone starts talking over it.
    //
    // This used to be goToScene(0, { autoplay: true }), which replays the
    // scene's cues -- including its map.flyTo -- and starts the narration in
    // the same turn. So the chapter opened with the camera visibly travelling
    // while the first sentence was already running, which reads as the story
    // starting before the picture is ready.
    //
    // Apply the cues, wait for the camera, then play. settled() resolves
    // immediately when nothing is moving, so a chapter that opens on a static
    // frame is not delayed at all.
    // Build the opening frame BEHIND the cover, then lift it, then talk.
    //
    // The order used to be: drop the cover, then goToScene(0, autoplay). So
    // the camera's jump to the opening position -- measured at zoom 10.5 to
    // 2.53 in a single frame on the Revolution -- happened in full view, and
    // the first sentence started over it. Rebuilding first means the map is
    // already where the story begins when the cover comes off, and settled()
    // covers the case where an opening shot actually animates.
    player.goToScene(0, { autoplay: false });
    const map = getStoryMap();
    Promise.resolve(map ? map.settled() : null).then(() => {
      cover.classList.remove('is-on');
      // A frame for the cover to start fading before the voice arrives, so
      // the two are not competing for the same instant.
      setTimeout(() => {
        if (started && !player.playing) player.play();
      }, 260);
    });
  });

  // A pause cue holds the picture until the viewer taps anywhere.
  view.addEventListener('click', (e) => {
    if (!player?.waitingForTap) return;
    if (e.target.closest('.transport') || e.target.closest('.transcript')) return;
    // …but not a tap that is asking to read something. Without this, tapping
    // a pin during a held beat both opens the card and starts the narration
    // talking over it — the two affordances fighting for the same gesture.
    if (e.target.closest('.dossier, .story__depth, [data-tap]')) return;
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

/**
 * Change the narration language, mid-chapter.
 *
 * The chapter has to be reloaded, not re-labelled: the audio, the word times
 * and every word-anchored cue are properties of the recording, and there is a
 * different recording per language. Switching the store's `lang` used to do
 * nothing at all here — the UI relabelled and the Norwegian voice carried on.
 *
 * Position is kept to the SCENE, not the second. The two recordings are
 * different lengths and a beat does not land at the same time in both, so
 * pretending to hold the exact moment would be a lie; the top of the scene
 * you were in is honest and predictable.
 */
/**
 * Change the language of the narration.
 *
 * This reloads the chapter, because audio, word timings and therefore every
 * cue time are properties of the RECORDING, not of the labels. Three things
 * have to survive that, and none of them used to:
 *
 *   - WHERE YOU WERE. It restarted the scene. On a fourteen-minute chapter
 *     that is the whole cost of the one feature a bilingual classroom
 *     actually uses. The two recordings are not the same length, so the
 *     position is carried as a FRACTION of the scene rather than as seconds.
 *
 *   - THE OPEN CARD. A person sheet left open across the reload kept its old
 *     markup and then emptied itself, leaving a blank dark panel over half a
 *     phone screen. It is closed first and reopened after, in the new
 *     language, which is also what a reader wants.
 *
 *   - EVERYTHING ELSE ON SCREEN. The reload has to actually finish before
 *     `lang` is believed anywhere, or the chrome relabels itself while the
 *     stage is still holding the previous language's quote card.
 */
export async function storySetLang(next) {
  if (!next || next === lang) return;
  lang = next;
  if (!player) return;

  const scene = player.sceneIndex >= 0 ? player.sceneIndex : 0;
  const dur = player.scene?.dur || 0;
  const frac = dur > 0 ? Math.min(1, Math.max(0, player.now() / dur)) : 0;
  const wasPlaying = player.playing;
  const wasStarted = started;

  const card = depth?.current?.() || null;
  depth?.close();

  await openChapter(current);
  if (!wasStarted) return;
  const cover = view.querySelector('.story__cover');
  cover?.classList.remove('is-on');
  started = true;

  const i = Math.min(scene, chapter.scenes.length - 1);
  const target = chapter.scenes[i];
  // Land at the same PLACE in the scene, not the same number of seconds:
  // the Norwegian recording of a scene is not the length of the English one.
  const at = target ? Math.max(0, Math.min(target.dur - 0.5, frac * target.dur)) : 0;
  player.goToScene(i, { autoplay: wasPlaying, at });
  if (card) depth?.open(card);
}

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
