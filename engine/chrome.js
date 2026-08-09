/* ============================================================
   chrome.js — the transport.

   On a phone the controls must not be the main event. Collapsed, this is a
   play button and a hairline of progress; it opens when you ask for it and
   folds itself away again once the narration is running.

   Nothing here knows what the chapter is about.
   ============================================================ */

import { transcriptHtml, setCaptionsOn, captionsOn } from './captions.js';

const ICON = {
  play:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l11-6.8c.6-.4.6-1.4 0-1.8l-11-6.8c-.7-.4-1.6.1-1.6.9Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.4"/><rect x="14" y="4.5" width="4" height="15" rx="1.4"/></svg>',
  back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 6 5 12l6 6"/><path d="M19 6l-6 6 6 6"/></svg>',
  fwd:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 6l6 6-6 6"/><path d="M5 6l6 6-6 6"/></svg>',
  cc:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10 10.5a2.4 2.4 0 1 0 0 3"/><path d="M16.5 10.5a2.4 2.4 0 1 0 0 3"/></svg>',
  text:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 6.5h14M5 11h14M5 15.5h9"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg>',
  // Deliberately a stack of numbered rows rather than a hamburger: the thing
  // it opens is a list of parts, and a hamburger reads as "app settings".
  list:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 5.5v2.6M3.3 5.9 4 5.3M3.3 17.6h1.6M3.3 11.2h1.4L3.3 12.8h1.4"/></svg>',
};

/** How long the opened controls stay up while the narration is running. */
const AUTO_FOLD_MS = 3600;

/**
 * @param {HTMLElement} host  where the bar lives (bottom of the stage)
 * @param {HTMLElement} root  the story root. The transcript mounts here rather
 *                            than inside the bar — mounting it in the bar is
 *                            what left it stacked behind the controls.
 */
export function mountChrome(host, root, chapter, player, strings) {
  const el = document.createElement('div');
  el.className = 'transport is-min';
  el.innerHTML = `
    <div class="transport__full"><div class="transport__full-in">
      <div class="transport__meta">
        <b class="transport__scene"></b>
        <span class="transport__clock"></span>
      </div>
      <div class="transport__rail" role="group"></div>
      <div class="transport__row">
        <button class="tp-btn tp-btn--ghost" data-act="back" aria-label="${strings.back}">${ICON.back}</button>
        <button class="tp-btn tp-btn--ghost" data-act="fwd" aria-label="${strings.forward}">${ICON.fwd}</button>
        <span class="transport__spacer"></span>
        <button class="tp-btn tp-btn--icon" data-act="text" aria-label="${strings.transcript}">${ICON.text}</button>
        <button class="tp-btn tp-btn--icon" data-act="fold" aria-label="${strings.hideControls}">${ICON.down}</button>
      </div>
    </div></div>

    <div class="transport__min">
      <button class="tp-btn tp-btn--main" data-act="toggle" aria-label="${strings.play}">
        <span class="ico-play">${ICON.play}</span><span class="ico-pause">${ICON.pause}</span>
      </button>
      <button class="transport__seek" data-act="expand" aria-label="${strings.controls}">
        <span class="transport__seek-track"></span>
        <span class="transport__seek-fill"></span>
      </button>
      <span class="transport__time">0:00</span>
      <button class="tp-btn tp-btn--icon tp-btn--cc" data-act="cc"
              aria-label="${strings.captions}" aria-pressed="true">${ICON.cc}</button>
      <button class="tp-btn tp-btn--icon" data-act="episodes"
              aria-label="${strings.episodes}">${ICON.list}</button>
    </div>
    <input class="transport__range" type="range" min="0" max="1000" value="0" step="1"
           aria-label="${strings.seek}">
  `;
  host.appendChild(el);

  const rail = el.querySelector('.transport__rail');
  chapter.scenes.forEach((scene, i) => {
    const b = document.createElement('button');
    b.className = 'rail-seg';
    b.type = 'button';
    b.dataset.scene = String(i);
    b.style.flexGrow = String(Math.max(0.5, scene.dur));
    b.title = scene.title;
    b.setAttribute('aria-label', `${i + 1}. ${scene.title}`);
    b.innerHTML = `<span class="rail-seg__fill"></span>`;
    rail.appendChild(b);
  });

  /* The episode list.

     A chapter is eight short films with titles, and until now the only way to
     reach one was an unlabelled rail inside the transport that folds itself
     away after three and a half seconds. You could not see where you were,
     what was coming, or how long any of it took — so in practice the chapter
     had no navigation at all.

     Same sheet mechanics as the transcript, and mounted on the story root for
     the same reason: it has to cover the bar it was opened from. */
  const episodes = document.createElement('div');
  episodes.className = 'transcript episodes';
  episodes.innerHTML = `
    <div class="transcript__bar">
      <b>${strings.episodes}</b>
      <button class="tp-btn tp-btn--icon" data-act="close-eps" aria-label="${strings.close}">${ICON.close}</button>
    </div>
    <div class="transcript__body scroll-y">
      <ol class="eplist">${chapter.scenes.map((sc, i) => `
        <li><button class="epitem" type="button" data-scene="${i}">
          <span class="epitem__no">${i + 1}</span>
          <span class="epitem__text">
            <b>${escHtml(sc.title)}</b>
            ${sc.clock ? `<i>${escHtml(sc.clock)}</i>` : ''}
          </span>
          <span class="epitem__dur">${clockText(sc.dur)}</span>
        </button></li>`).join('')}
      </ol>
    </div>`;
  root.appendChild(episodes);

  const openEpisodes = () => {
    // Mark before showing, not on a timer: opening the list to a stale "you
    // are here" is worse than not marking it at all.
    markEpisodes(player.sceneIndex);
    episodes.classList.add('is-open');
  };
  const closeEpisodes = () => episodes.classList.remove('is-open');

  function markEpisodes(current) {
    for (const b of episodes.querySelectorAll('.epitem')) {
      const i = Number(b.dataset.scene);
      b.classList.toggle('is-current', i === current);
      b.classList.toggle('is-done', i < current);
      b.setAttribute('aria-current', i === current ? 'true' : 'false');
    }
  }

  episodes.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=close-eps]')) { closeEpisodes(); return; }
    const item = e.target.closest('.epitem');
    if (!item) return;
    closeEpisodes();
    player.goToScene(Number(item.dataset.scene), { autoplay: true });
  });

  const sheet = document.createElement('div');
  sheet.className = 'transcript';
  sheet.innerHTML = `
    <div class="transcript__bar">
      <b>${strings.transcript}</b>
      <button class="tp-btn tp-btn--icon" data-act="close-text" aria-label="${strings.close}">${ICON.close}</button>
    </div>
    <div class="transcript__body scroll-y">${transcriptHtml(chapter)}</div>`;
  root.appendChild(sheet);

  const seekEl = el.querySelector('.transport__range');
  const fillEl = el.querySelector('.transport__seek-fill');
  const sceneEl = el.querySelector('.transport__scene');
  const clockEl = el.querySelector('.transport__clock');
  const timeEl = el.querySelector('.transport__time');
  let scrubbing = false;
  let foldTimer = 0;

  // Measured after the fold transition, and never left to animation frames
  // alone — a backgrounded tab stops delivering them and the overlays would
  // keep clearing a height the bar no longer has.
  const publishHeight = () => {
    const write = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) root.style.setProperty('--transport-h', `${Math.round(h)}px`);
    };
    write();
    requestAnimationFrame(write);
    setTimeout(write, 60);
    setTimeout(write, 320);   // after the collapse settles
  };
  const scheduleFold = () => {
    clearTimeout(foldTimer);
    if (player.playing) foldTimer = setTimeout(fold, AUTO_FOLD_MS);
  };
  function expand() { el.classList.remove('is-min'); publishHeight(); scheduleFold(); }
  function fold() { el.classList.add('is-min'); clearTimeout(foldTimer); publishHeight(); }

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') { player.toggle(); scheduleFold(); return; }
    if (act === 'back') { player.skipBeat(-1); scheduleFold(); return; }
    if (act === 'fwd') { player.skipBeat(1); scheduleFold(); return; }
    if (act === 'fold') { fold(); return; }
    if (act === 'expand') { expand(); return; }
    if (act === 'text') { sheet.classList.add('is-open'); return; }
    if (act === 'episodes') { openEpisodes(); return; }
    if (act === 'cc') {
      const next = !captionsOn();
      setCaptionsOn(next);
      for (const b of el.querySelectorAll('[data-act=cc]')) {
        b.setAttribute('aria-pressed', String(next));
      }
      try { localStorage.setItem('revolusjonen:captions', next ? '1' : '0'); } catch { /* private mode */ }
      return;   // do not fold: turning captions off is not "done fiddling"
    }
    const seg = e.target.closest('.rail-seg');
    if (seg) {
      player.goToScene(Number(seg.dataset.scene), { autoplay: player.playing });
      scheduleFold();
    }
  });

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=close-text]')) { sheet.classList.remove('is-open'); return; }
    const beat = e.target.closest('.transcript__beat');
    if (beat) {
      const idx = chapter.scenes.findIndex((s) => s.id === beat.dataset.scene);
      sheet.classList.remove('is-open');
      player.goToScene(idx, { autoplay: true, at: Number(beat.dataset.at) });
    }
  });

  /* The scrub bar.

     The slider is transparent and sits over the thin progress line, so the
     thing you see is the thing you drag. Two things it has to get right:

     1. A drag fires `input` on every pixel, and every seek wipes the stage and
        replays the scene's cues. Doing that sixty times a second is wasted
        work and hammers the audio element, which is what makes a scrub feel
        like it is fighting back. The bar and the clock follow your finger
        immediately; the actual seek is committed at most every 130 ms, and
        always once more when you let go.

     2. A tap is not a drag. The control this slider covers is the one that
        opens the transport, and while the slider sat on top of it there was
        no way left to open the transport at all. So a press that does not
        move and does not change the value is treated as what it looks like:
        a tap on the bar, which expands. */
  const SEEK_COMMIT_MS = 130;
  let pendingSeek = null;
  let lastCommit = 0;
  let commitTimer = 0;
  let pressValue = null;
  let pressX = 0;
  let moved = false;

  const commitSeek = () => {
    clearTimeout(commitTimer);
    commitTimer = 0;
    if (pendingSeek == null) return;
    lastCommit = performance.now();
    player.seek(pendingSeek);
    pendingSeek = null;
  };

  seekEl.addEventListener('pointerdown', (ev) => {
    scrubbing = true;
    moved = false;
    pressValue = seekEl.value;
    pressX = ev.clientX;
    clearTimeout(foldTimer);
  });
  seekEl.addEventListener('pointermove', (ev) => {
    if (scrubbing && Math.abs(ev.clientX - pressX) > 6) moved = true;
  });
  seekEl.addEventListener('input', () => {
    const scene = player.scene;
    if (!scene) return;
    // The picture of where you are updates now; the seek follows.
    fillEl.style.width = `${seekEl.value / 10}%`;
    pendingSeek = (seekEl.value / 1000) * scene.dur;
    timeEl.textContent = clockText(pendingSeek);
    const since = performance.now() - lastCommit;
    if (since >= SEEK_COMMIT_MS) commitSeek();
    else if (!commitTimer) commitTimer = setTimeout(commitSeek, SEEK_COMMIT_MS - since);
  });

  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    commitSeek();
    // A press that neither moved nor changed anything was a tap on the bar,
    // and the bar's other job is to open the controls.
    if (!moved && seekEl.value === pressValue) expand();
    else scheduleFold();
  };
  seekEl.addEventListener('pointerup', endScrub);
  seekEl.addEventListener('pointercancel', endScrub);
  // Keyboard and assistive input never send pointer events at all.
  seekEl.addEventListener('change', () => { if (!scrubbing) commitSeek(); });

  addEventListener('resize', publishHeight);
  publishHeight();

  return {
    el,
    sheet,
    episodes,
    expand,
    fold,
    openEpisodes,
    closeEpisodes,
    update(state) {
      markEpisodes(state.sceneIndex);
      el.classList.toggle('is-playing', state.playing);
      el.classList.toggle('is-waiting', Boolean(state.waitingForTap));
      el.querySelector('[data-act=toggle]')
        .setAttribute('aria-label', state.playing ? strings.pause : strings.play);
      if (state.scene) {
        sceneEl.textContent = state.scene.title;
        clockEl.textContent = state.scene.clock || '';
      }
      for (const seg of rail.children) {
        const i = Number(seg.dataset.scene);
        seg.classList.toggle('is-done', i < state.sceneIndex);
        seg.classList.toggle('is-current', i === state.sceneIndex);
        if (i !== state.sceneIndex) {
          seg.querySelector('.rail-seg__fill').style.width = i < state.sceneIndex ? '100%' : '0%';
        }
      }
      // Pausing is usually the prelude to fiddling with something, so leave
      // the controls up until playback resumes.
      if (state.playing) scheduleFold(); else clearTimeout(foldTimer);
      publishHeight();
    },
    tick(t, scene, i) {
      if (!scene) return;
      const pct = scene.dur ? Math.min(1, t / scene.dur) : 0;
      if (!scrubbing) {
        seekEl.value = String(Math.round(pct * 1000));
        fillEl.style.width = `${pct * 100}%`;
      }
      const seg = rail.children[i];
      if (seg) seg.querySelector('.rail-seg__fill').style.width = `${pct * 100}%`;
      timeEl.textContent = clockText(t);
      sceneEl.textContent = scene.title;
      clockEl.textContent = scene.clock || '';
    },
  };
}

function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function clockText(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
