/* ============================================================
   chooser.js — the front door, when there is more than one subject.

   Everything downstream of boot() is built around ONE pack: the map is
   created with its framing, the palette is published on :root, the era sets
   the timeline span, the portraits get a base URL. Switching that at runtime
   would mean tearing all of it down and standing it back up, which is the
   kind of long-lived state this repo has already been bitten by twice.

   So the choice happens BEFORE any of it. boot() awaits this, and by the time
   loadData() runs there is exactly one pack again — which means the whole app
   below this file is unchanged, and stays as simple as it was when there was
   only ever one subject.

   The chosen subject goes in the query string rather than the hash, because
   the hash already belongs to the router and writeHash() would overwrite it
   on the first view change. `?emne=` survives that, survives a reload, and is
   a link you can send someone. Offline it still resolves: the service
   worker's cache lookup passes ignoreSearch.
   ============================================================ */

import { listPacks, loadPack } from '../engine/pack.js';
import { mediaUrl } from '../core/paths.js';

const PARAM = 'emne';

/** The subject named in the URL, if it is one we actually ship. */
function fromUrl(ids) {
  const want = new URLSearchParams(location.search).get(PARAM);
  return want && ids.includes(want) ? want : null;
}

function pick(field, lang) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.no || field.en || '';
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Resolve which subject this session is about.
 *
 * Returns immediately when there is nothing to choose — one pack, or a URL
 * that already names one — so a single-subject build never sees this screen
 * and pays nothing for it.
 */
/* The build actually running on THIS device, asked of the service worker.

   Testing a fix on a phone used to mean reloading and hoping. GitHub Pages
   builds asynchronously and serves JavaScript with a ten-minute cache, so
   "I pushed" is three claims away from "the phone in my hand has it", and
   the only honest way to close the gap was a hard reload and a guess.

   The worker replying is the one serving this page, so its VERSION -- a hash
   of what it precached, not a number anybody remembered to bump -- is what is
   running here. Silent when there is no worker: on localhost that is normal,
   and a line saying "dev" on every reader's screen would be noise. */
function showBuild(el) {
  if (!el || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  const show = (v) => {
    el.textContent = ` · ${v}`;
    el.hidden = false;
  };
  const onMsg = (e) => {
    if (e.data?.type === 'version') {
      show(e.data.version);
      sw.removeEventListener('message', onMsg);
    }
  };
  sw.addEventListener('message', onMsg);
  // `ready` and not `controller`: on the very first visit the worker is
  // installing and controls nothing yet, so asking the controller gets null
  // and the line never appears — on exactly the visit most likely to be a
  // test of something just pushed.
  //
  // On localhost index.html unregisters every worker on purpose, so `ready`
  // NEVER settles there and this line never appears in dev. That is correct
  // and it is also why this can only be verified on the deployed site: a
  // probe that waits for it locally waits for ever.
  const give_up = setTimeout(() => sw.removeEventListener('message', onMsg), 8000);
  sw.ready
    .then((reg) => (reg.active || sw.controller)?.postMessage('version'))
    .catch(() => clearTimeout(give_up));
}

export async function chooseSubject(host, { lang = 'no', t = (k) => k } = {}) {
  const ids = await listPacks();
  if (ids.length <= 1) return ids[0] || null;

  const named = fromUrl(ids);
  if (named) return named;

  const packs = await Promise.all(ids.map(loadPack));
  const subjects = ids
    .map((id, i) => ({ id, m: packs[i] }))
    .filter((s) => s.m);
  if (subjects.length <= 1) return subjects[0]?.id || ids[0];

  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'chooser';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', t('chooseSubject'));

    el.innerHTML = `
      <div class="chooser__inner">
        <p class="chooser__kicker">${esc(t('appTitle'))}</p>
        <h1 class="chooser__title">${esc(t('chooseSubject'))}</h1>
        <ul class="chooser__grid">
          ${subjects.map((s) => card(s, lang, t)).join('')}
        </ul>
        <p class="chooser__foot">${esc(t('chooseSubjectFoot'))}
          <span class="chooser__build" hidden></span></p>
      </div>`;

    host.appendChild(el);
    showBuild(el.querySelector('.chooser__build'));

    const go = (id) => {
      // Remember the choice in the URL, so a reload lands back here rather
      // than asking again. replaceState, not a navigation: the app has not
      // started yet and there is nothing to reload.
      const url = `${location.pathname}?${PARAM}=${encodeURIComponent(id)}`;
      history.replaceState(null, '', url);
      el.classList.add('is-going');
      setTimeout(() => el.remove(), 420);
      resolve(id);
    };

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pack]');
      if (btn) go(btn.dataset.pack);
    });

    // The first card is the one a keyboard lands on.
    el.querySelector('[data-pack]')?.focus();
  });
}

function card({ id, m }, lang, t) {
  const n = (m.chapters || []).length;
  const art = m.poster ? mediaUrl(id, m.poster) : null;
  const parts = `${n} ${t(n === 1 ? 'partOne' : 'partMany')}`;
  return `
    <li class="chooser__cell">
      <button class="subject" type="button" data-pack="${esc(id)}">
        <span class="subject__art"${art ? ` style="background-image:url('${esc(art)}')"` : ''}></span>
        <span class="subject__body">
          <span class="subject__name">${esc(pick(m.work, lang))}</span>
          <span class="subject__years">${esc(pick(m.years, lang))}</span>
          <span class="subject__blurb">${esc(pick(m.description, lang))}</span>
          <span class="subject__parts">${esc(parts)}</span>
        </span>
      </button>
    </li>`;
}

/** Back to the front door. A reload, deliberately: see the header. */
export function backToSubjects() {
  location.replace(location.pathname);
}

/** Is there anything to choose between? Decides whether the way back exists. */
export async function hasSubjectChoice() {
  return (await listPacks()).length > 1;
}
