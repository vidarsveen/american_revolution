/* ============================================================
   tour.js — "Ta meg gjennom krigen".
   The app takes the wheel: time runs forward, the camera flies
   between the moments that mattered, a caption fades in.
   Any touch hands control straight back.
   ============================================================ */

import { state, set, parseDate, START } from './store.js';
import { tx, formatDate } from './i18n.js';
import { flyToEvent, getMap, mapHeight } from './map.js';

const HOLD_MS = 3600;     // how long a caption stays up
const TRAVEL_MS = 1500;   // time-tween between two stops

let captionEl = null;
let stops = [];
let token = 0;
let running = false;
let cameraIsOurs = false;

export function initTour(container, allEvents) {
  stops = allEvents
    .filter((e) => (e.importance || 2) >= 2 && e.coords)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));

  captionEl = document.createElement('div');
  captionEl.className = 'tour-caption';
  captionEl.innerHTML = `
    <div class="tour-caption__date"></div>
    <h2 class="tour-caption__title"></h2>
    <p class="tour-caption__hook"></p>`;
  container.appendChild(captionEl);

  // Touching the map is a request to stop being driven around. The tour's own
  // camera moves are flagged first so they do not cancel the tour itself.
  //
  // Listened for on the element rather than through the map, because the map
  // module has no event bus: the gestures ARE pointer and wheel events on its
  // host, so there is nothing for it to re-announce.
  const host = document.getElementById('map');
  if (host) {
    const interrupted = () => { if (running && !cameraIsOurs) stop(); };
    host.addEventListener('pointerdown', interrupted);
    host.addEventListener('wheel', interrupted, { passive: true });
  }

  // Switching away from the app should not leave a tour running behind you.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) stop();
  });
}

export function isRunning() { return running; }

export function toggle(force) {
  const want = force === undefined ? !running : Boolean(force);
  if (want) start(); else stop();
}

export function stop() {
  running = false;
  token += 1;
  set({ playing: false });
  hideCaption();
}

async function start() {
  if (running || !stops.length) return;
  running = true;
  const my = ++token;
  set({ playing: true });

  // If we are at (or past) the end, rewind so play always means something.
  const last = parseDate(stops[stops.length - 1].date);
  if (state.date >= last - 1) set({ date: START }, { silent: true });

  const remaining = stops.filter((s) => parseDate(s.date) > state.date);
  const queue = remaining.length ? remaining : stops;

  for (const stop_ of queue) {
    if (my !== token) return;

    const target = parseDate(stop_.date);
    await tweenDate(state.date, target, TRAVEL_MS, my);
    if (my !== token) return;

    // Aim a little above centre so the caption does not sit on the marker.
    cameraIsOurs = true;
    flyToEvent(stop_.id, { zoom: zoomFor(stop_), offsetY: -mapHeight() * 0.08 });
    setTimeout(() => { cameraIsOurs = false; }, 60);
    showCaption(stop_);

    await wait(HOLD_MS, my);
    if (my !== token) return;
  }

  if (my === token) {
    hideCaption();
    running = false;
    set({ playing: false });
  }
}

function zoomFor(ev) {
  return ev.importance === 3 ? 7.5 : 6.5;
}

/* ---------- Caption ---------------------------------------- */

function showCaption(ev) {
  captionEl.querySelector('.tour-caption__date').textContent =
    ev.dateDisplay ? tx(ev.dateDisplay) : formatDate(ev.date);
  captionEl.querySelector('.tour-caption__title').textContent = tx(ev.title);
  captionEl.querySelector('.tour-caption__hook').textContent = tx(ev.hook);
  captionEl.classList.add('is-on');
}

function hideCaption() {
  captionEl?.classList.remove('is-on');
}

/* ---------- Small async helpers ---------------------------- */

/** Sleep, but wake early if the tour has been cancelled. */
function wait(ms, my) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(id);
      clearInterval(check);
      resolve();
    };
    const id = setTimeout(finish, ms);
    const check = setInterval(() => { if (my !== token) finish(); }, 120);
  });
}

/**
 * Run the clock forward from `from` to `to`.
 *
 * Animated with requestAnimationFrame, but never *dependent* on it: a
 * backgrounded tab stops delivering frames, and without the timer below the
 * tour would sit frozen with the pause button showing until you reloaded.
 * The timer is the contract; rAF is only there to make it smooth.
 */
function tweenDate(from, to, ms, my) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || ms <= 0 || from === to) {
    set({ date: to }, { silent: true });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const t0 = performance.now();
    let done = false;

    const settle = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (my === token) set({ date: to }, { silent: true });
      resolve();
    };

    const step = (now) => {
      if (done) return;
      if (my !== token) { done = true; clearTimeout(guard); resolve(); return; }
      const p = Math.min(1, (now - t0) / ms);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // easeInOutQuad
      set({ date: from + (to - from) * eased }, { silent: true });
      if (p < 1) requestAnimationFrame(step);
      else settle();
    };

    // Fires if frames never arrive; snaps to the target and moves on.
    const guard = setTimeout(settle, ms + 200);
    requestAnimationFrame(step);
  });
}
