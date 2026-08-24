/* ============================================================
   wayout.js — the control that never leaves.

   WHY THIS EXISTS

   While a chapter plays, `.app.is-immersive` folds the topbar and the tab bar
   away. That is the right instinct — you are watching a story, not an
   application, and the frame was taking about a quarter of a phone screen —
   but it folded away the ONLY route to three things at once:

     · back to the subject list      (which was the wordmark, and a title
                                      being a button is not something anyone
                                      guesses)
     · the language toggle           (a small unlabelled chip in the topbar)
     · the library                   (a tab, and the tab bar was gone)

   So a reader hearing the word "Nebbiolo" could not go and look it up, and a
   reader who opened the wrong subject could not get out without knowing that
   the title was secretly a link.

   THE FIX

   One button that survives immersive mode, opening a sheet with all three.
   Not a fourth navigation pattern: it is the same three destinations that
   already exist, gathered into the one place that is always on screen.

   Deliberately NOT a hover affordance and deliberately labelled with words
   rather than icons alone — this is the escape hatch, and an escape hatch you
   have to decode is not one.
   ============================================================ */

import { state, set } from './store.js';
import { t } from './i18n.js';
import { backToSubjects } from './chooser.js';

let host = null;
let sheet = null;
let canSwitch = false;
let hasLibrary = false;

export function mountWayOut(container, opts = {}) {
  canSwitch = Boolean(opts.canSwitch);
  hasLibrary = Boolean(opts.hasLibrary);
  unmountWayOut();

  host = document.createElement('div');
  host.className = 'wayout';
  host.innerHTML = `
    <button class="wayout__btn" type="button" aria-haspopup="dialog"
            aria-expanded="false" aria-label="${esc(t('menu'))}">
      <span aria-hidden="true">≡</span>
    </button>
    <div class="wayout__sheet" role="dialog" aria-modal="false" hidden></div>`;
  container.appendChild(host);
  sheet = host.querySelector('.wayout__sheet');

  host.querySelector('.wayout__btn').addEventListener('click', toggle);
  host.addEventListener('click', (e) => {
    const act = e.target.closest('[data-way]')?.dataset.way;
    if (!act) return;
    close();
    if (act === 'subjects') backToSubjects();
    if (act === 'lang') set({ lang: state.lang === 'no' ? 'en' : 'no' });
    if (act === 'library') set({ view: 'library' });
  });
  // Escape closes it, and a tap anywhere else does too — but the listener is
  // on the document rather than on a backdrop, because a backdrop over the
  // story would swallow the "tap to continue" gesture on a held beat.
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onOutside, true);
  return host;
}

export function unmountWayOut() {
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('click', onOutside, true);
  host?.remove();
  host = sheet = null;
}

function render() {
  const other = state.lang === 'no' ? 'English' : 'Norsk';
  sheet.innerHTML = `
    ${canSwitch ? row('subjects', t('waySubjects')) : ''}
    ${hasLibrary ? row('library', t('wayLibrary')) : ''}
    ${row('lang', `${t('wayLanguage')} · ${esc(other)}`)}`;
}

function row(act, label) {
  return `<button class="wayout__row" type="button" data-way="${act}">${esc(label)}</button>`;
}

function toggle() {
  if (!sheet) return;
  if (sheet.hidden) {
    render();
    sheet.hidden = false;
    host.querySelector('.wayout__btn').setAttribute('aria-expanded', 'true');
  } else {
    close();
  }
}

function close() {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  host.querySelector('.wayout__btn')?.setAttribute('aria-expanded', 'false');
}

function onKey(e) { if (e.key === 'Escape') close(); }
function onOutside(e) { if (host && !host.contains(e.target)) close(); }

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
