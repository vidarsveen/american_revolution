/* ============================================================
   depth.js — reading more, while the narrator is talking.

   The narrated mode could show you a person's face for four seconds and then
   take it away. If you wanted to know who Joseph Warren actually was you had
   to stop the chapter, find the other tab, and search. That is the wrong
   trade for a school app: the moment you are curious about somebody is the
   moment they are on screen.

   So: anything the story puts up is tappable while it is up — a pin, a
   region's name, a marked word in the caption — and tapping it pauses and
   opens the shared panel from core/dossier.js.

   ------------------------------------------------------------
   WHY THIS CANNOT BREAK RULE 1
   ------------------------------------------------------------

   The picture is a function of time. This module never writes stage state:

     * Opening a card calls player.pause() and nothing else. pause() captures
       the position; it does not rebuild, reset or seek. The picture stays
       exactly where it was, mid-animation and all.
     * The card mounts to .story__depth, a SIBLING of .story__stage, so
       resetStage() cannot reach it.
     * Seeking with a card open wipes the stage and leaves the card. That is
       correct — the card is not on the stage.
     * There is no cue that opens a card, and there must never be one. It
       would replay on every seek and forty cards would open at once.

   The one thing that is genuinely stateful is `wasPlaying`: closing a card
   resumes ONLY if this module was the thing that paused. Pause first, then
   tap, then close, and the chapter must still be paused — otherwise the app
   starts talking at someone who deliberately stopped it.
   ============================================================ */

import { createDossier } from '../core/dossier.js';
import { getStoryMap } from './scenes/map.js';
import { packUrl } from '../core/paths.js';

/** Where the rail earns its place. Below this it is a sheet over the map. */
const RAIL_FROM = '(min-width: 1024px)';
const COACH_KEY = 'fortell:coached';

let dossier = null;
let chapter = null;
let people = new Map();
/* A getter, not the player itself. Depth mounts BEFORE the player is
   constructed — the panel has to exist by the first beat — so capturing the
   value here would capture null and every pause would silently do nothing. */
let getPlayer = () => null;
let host = null;
let wasPlaying = false;
let mql = null;
let onMode = null;

/**
 * @param storyRoot  the .story element
 * @param opts       { chapter, people, player, t, tx, lang, onReframe }
 */
export function mountDepth(storyRoot, opts) {
  chapter = opts.chapter;
  getPlayer = () => opts.player;
  people = new Map((opts.people || []).map((p) => [p.id, p]));

  host = document.createElement('div');
  host.className = 'story__depth';
  storyRoot.appendChild(host);

  mql = window.matchMedia(RAIL_FROM);
  const modeNow = () => (mql.matches ? 'rail' : 'sheet');

  dossier = createDossier(host, {
    mode: modeNow(),
    t: opts.t,
    tx: opts.tx,
    lang: opts.lang,
    portraitBase: packUrl(chapter.pack, portraitDir()),
    formatDate: (d) => String(d ?? ''),
    formatNumber: (n) => String(n ?? ''),
    resolve,
    onOpen: () => {
      // Remember whether WE stopped it. See the header.
      wasPlaying = Boolean(getPlayer()?.playing);
      getPlayer()?.pause();
      storyRoot.classList.add('has-depth');
      opts.onReframe?.();
    },
    onClose: () => {
      storyRoot.classList.remove('has-depth');
      opts.onReframe?.();
      if (wasPlaying) getPlayer()?.play();
      wasPlaying = false;
    },
  });

  // The panel changes shape with the viewport, but must not lose its place.
  onMode = () => {
    const open = dossier.current();
    dossier.setMode(modeNow());
    if (open) dossier.open(open);
    opts.onReframe?.();
  };
  mql.addEventListener('change', onMode);

  wireTaps(storyRoot);
  // `current` so a language change can put the same card back, in the new
  // language, instead of leaving a stale one open across the reload.
  return { open, close: () => dossier.close(), isOpen: () => dossier.isOpen(),
           current: () => dossier.current(), coach };
}

export function unmountDepth() {
  mql?.removeEventListener('change', onMode);
  dossier?.destroy();
  dossier = null;
  host?.remove();
  host = null;
  chapter = null;
  getPlayer = () => null;
  wasPlaying = false;
}

export function open(ref) { return dossier?.open(ref) ?? false; }
export function depthIsOpen() { return Boolean(dossier?.isOpen()); }

function portraitDir() {
  return chapter?.packInfo?.pools?.portraits || 'portraits/';
}

/* ------------------------------------------------------------
   What a reference points at
   ------------------------------------------------------------ */

/**
 * Every pool the story can open, in one place.
 *
 * All of them are already in memory — script.js fetches them with the chapter
 * — so this is a lookup and never a promise. That is deliberate: a resolve
 * that awaited would put an await on the path of a user gesture, and the
 * panel would open empty and then fill.
 */
function resolve(ref) {
  if (!ref || !chapter) return null;
  const { kind, id } = ref;

  if (kind === 'person') return people.get(id) || null;
  if (kind === 'term') return chapter.terms?.[id] || null;
  if (kind === 'topic') return chapter.topics?.[id] || null;

  if (kind === 'place') {
    // A place is geometry in the chapter and prose in the pack, joined here.
    // The chapter carries coords and a zoom because the camera needs them;
    // the reading lives in the pack so two chapters can share one Boston.
    const geo = chapter.places?.[id];
    const note = chapter.placeNotes?.[id];
    if (!geo && !note) return null;
    return { ...(note || {}), name: note?.name || geo?.name || id, coords: geo?.coords };
  }
  return null;
}

/* ------------------------------------------------------------
   Taps
   ------------------------------------------------------------ */

function wireTaps(storyRoot) {
  // The map dispatches atlas:tap on its host and knows nothing about cards.
  storyRoot.addEventListener('atlas:tap', (e) => {
    const { kind, id } = e.detail || {};
    if (kind && id) openOrShrug(kind, id);
  });

  // A marked word in the caption. Delegated on the story root, because the
  // caption rebuilds its spans on every beat change and per-node listeners
  // would be re-attached seventy-seven times a chapter.
  storyRoot.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-tap]');
    if (!el || !storyRoot.contains(el)) return;
    const [kind, ...rest] = el.dataset.tap.split(':');
    e.preventDefault();
    e.stopPropagation();
    openOrShrug(kind, rest.join(':'));
  });

  storyRoot.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('.captions [data-tap]');
    if (!el) return;
    e.preventDefault();
    el.click();
  });
}

/** Open it, or say nothing loudly. A dead reference must not stop the story. */
function openOrShrug(kind, id) {
  if (!dossier) return;
  if (!dossier.open({ kind, id })) {
    console.warn(`[depth] nothing written about ${kind}:${id} yet`);
  }
}

/* ------------------------------------------------------------
   Discoverability
   ------------------------------------------------------------ */

/**
 * Point at the first tappable word, once, ever.
 *
 * Nobody taps a thing they do not know is a thing. The dotted underline is
 * the standing grammar; this is the one-time introduction to it.
 *
 * Returns early when `instant`, and takes itself away on a timer — the same
 * discipline as caption.note, and for the same reason: a seek replays the
 * beat and a coach mark that reappeared on every scrub would be a bug rather
 * than a hint.
 */
export function coach(instant = false) {
  if (instant || !host) return;
  try {
    if (localStorage.getItem(COACH_KEY) === '1') return;
  } catch { /* private mode: show it, once per session, and move on */ }

  const word = document.querySelector('.captions .w-term');
  if (!word) return;

  try { localStorage.setItem(COACH_KEY, '1'); } catch { /* nothing to do */ }

  const pill = document.createElement('div');
  pill.className = 'coach';
  pill.textContent = coach.label || '';
  // Fixed, and measured off the word itself. Appending it next to the word
  // and positioning absolutely put it wherever the caption's own layout
  // decided — which was on top of the sentence it was pointing at, because
  // the caption line is not a positioned ancestor.
  document.body.appendChild(pill);
  /* Anchored to the CAPTION, not to the word inside it.
     The pill sits at translate(-50%, -140%) of whatever it is measured
     against. Measured against the word, a term on any line but the first put
     the pill on the line ABOVE it — on top of the sentence it exists to point
     at. Measured across every placement the two narrated packs make: 9 of 13
     and 5 of 8 landed on caption words. It got worse rather than better when
     the caption grew from three lines to four, which is how it surfaced.
     The word still decides the horizontal; only the vertical is the caption's.

     And clamped to the frame: a term near either edge hung 13-16 px off it. */
  const place = () => {
    const r = word.getBoundingClientRect();
    if (!r.width) return;
    const box = (word.closest('.captions') || word).getBoundingClientRect();
    const half = pill.getBoundingClientRect().width / 2 || 0;
    const x = r.left + r.width / 2;
    pill.style.left = `${Math.max(half + 8, Math.min(x, innerWidth - half - 8))}px`;
    pill.style.top = `${box.top}px`;
  };
  place();
  requestAnimationFrame(() => { place(); pill.classList.add('is-on'); });

  /* And re-placed while it is up, because the thing under it moves.
     The caption box is anchored to its BOTTOM edge, so a beat that wraps to
     one more line grows UPWARD — into the pill, which had been positioned
     once against the old top. Measured over every term the two narrated packs
     mark: placing against the caption instead of the word fixed 9 of 13, and
     the remaining ones were all this. A ResizeObserver rather than a frame
     loop: rule 2 says frames make things smooth and are not a contract, and a
     backgrounded tab that comes back must not find the pill somewhere else. */
  const watch = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => place()) : null;
  const cap = word.closest('.captions');
  if (watch && cap) watch.observe(cap);

  setTimeout(() => {
    watch?.disconnect();
    pill.classList.remove('is-on');
    setTimeout(() => pill.remove(), 400);
  }, 4200);
}

/**
 * What is tappable in this scene — for the transport's "more about this" chip.
 *
 * A pure function of the compiled scene, so it is the same list however you
 * arrived at the scene, and it works for someone who missed the moment or who
 * is not using a pointer at all.
 */
export function scenePoints(scene) {
  if (!scene) return [];
  const seen = new Set();
  const out = [];
  for (const beat of scene.beats || []) {
    for (const term of beat.terms || []) {
      const key = `${term.kind}:${term.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = resolve(term);
      if (r) out.push({ kind: term.kind, id: term.id, record: r });
    }
  }
  return out;
}

/** The map instance, for anything that needs to know the stage is there. */
export function depthMap() { return getStoryMap(); }
