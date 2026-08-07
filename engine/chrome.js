/* ============================================================
   chrome.js — the transport: play, scene rail, scrub, captions, transcript.

   Deliberately slim. The old year rail took a quarter of the screen to show
   twenty years you rarely needed at once; this shows where you are in *this*
   chapter and nothing more.
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
};

export function mountChrome(container, chapter, player, strings) {
  const el = document.createElement('div');
  el.className = 'transport';
  el.innerHTML = `
    <div class="transport__rail" role="group"></div>
    <div class="transport__meta">
      <b class="transport__scene"></b>
      <span class="transport__clock"></span>
    </div>
    <div class="transport__row">
      <button class="tp-btn tp-btn--ghost" data-act="back" aria-label="${strings.back}">${ICON.back}</button>
      <button class="tp-btn tp-btn--main" data-act="toggle" aria-label="${strings.play}">
        <span class="ico-play">${ICON.play}</span><span class="ico-pause">${ICON.pause}</span>
      </button>
      <button class="tp-btn tp-btn--ghost" data-act="fwd" aria-label="${strings.forward}">${ICON.fwd}</button>
      <span class="transport__spacer"></span>
      <button class="tp-btn tp-btn--icon" data-act="cc" aria-label="${strings.captions}" aria-pressed="true">${ICON.cc}</button>
      <button class="tp-btn tp-btn--icon" data-act="text" aria-label="${strings.transcript}">${ICON.text}</button>
    </div>
    <div class="transport__seek">
      <div class="transport__seek-fill"></div>
      <input type="range" min="0" max="1000" value="0" aria-label="${strings.seek}">
    </div>
  `;
  container.appendChild(el);

  // Scene rail: one segment per scene, tap to jump
  const rail = el.querySelector('.transport__rail');
  chapter.scenes.forEach((scene, i) => {
    const b = document.createElement('button');
    b.className = 'rail-seg';
    b.type = 'button';
    b.dataset.scene = String(i);
    b.style.flexGrow = String(Math.max(0.4, scene.dur));
    b.title = scene.title;
    b.setAttribute('aria-label', `${i + 1}. ${scene.title}`);
    b.innerHTML = `<span class="rail-seg__fill"></span>`;
    rail.appendChild(b);
  });

  // Transcript sheet
  const sheet = document.createElement('div');
  sheet.className = 'transcript';
  sheet.innerHTML = `
    <div class="transcript__bar">
      <b>${strings.transcript}</b>
      <button class="tp-btn tp-btn--icon" data-act="close-text" aria-label="${strings.close}">${ICON.close}</button>
    </div>
    <div class="transcript__body scroll-y">${transcriptHtml(chapter)}</div>`;
  container.appendChild(sheet);

  const seekEl = el.querySelector('input[type=range]');
  const fillEl = el.querySelector('.transport__seek-fill');
  const sceneEl = el.querySelector('.transport__scene');
  const clockEl = el.querySelector('.transport__clock');
  let scrubbing = false;

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') player.toggle();
    else if (act === 'back') player.skipBeat(-1);
    else if (act === 'fwd') player.skipBeat(1);
    else if (act === 'cc') {
      const next = !captionsOn();
      setCaptionsOn(next);
      e.target.closest('[data-act]').setAttribute('aria-pressed', String(next));
    } else if (act === 'text') sheet.classList.add('is-open');

    const seg = e.target.closest('.rail-seg');
    if (seg) player.goToScene(Number(seg.dataset.scene), { autoplay: player.playing });
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

  seekEl.addEventListener('pointerdown', () => { scrubbing = true; });
  seekEl.addEventListener('input', () => {
    const scene = player.scene;
    if (!scene) return;
    const t = (seekEl.value / 1000) * scene.dur;
    fillEl.style.width = `${seekEl.value / 10}%`;
    player.seek(t);
  });
  const endScrub = () => { scrubbing = false; };
  seekEl.addEventListener('pointerup', endScrub);
  seekEl.addEventListener('pointercancel', endScrub);

  return {
    el,
    sheet,
    update(state) {
      el.classList.toggle('is-playing', state.playing);
      el.classList.toggle('is-waiting', Boolean(state.waitingForTap));
      const btn = el.querySelector('[data-act=toggle]');
      btn.setAttribute('aria-label', state.playing ? strings.pause : strings.play);
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
      sceneEl.textContent = scene.title;
      clockEl.textContent = scene.clock || '';
    },
  };
}
