/* ============================================================
   dossier.js — the "read more" panel, for both modes.

   This was js/sheet.js: a good component wearing Explore's clothes. It
   imported the Explore store for its state and the Explore dictionary for its
   labels, so the narrated mode — the half of the app people actually watch —
   had no way to show a person, a place or a word at all. Every bit of depth
   in this app lived behind the tabs nobody opens mid-story.

   So it takes its state, its words and its data through arguments now, and
   the two modes each bring their own:

     Explore   binds it to store.selected, so a card is a route you can share
     Fortell   opens it on a tap, pauses, and resumes when it closes

   TWO MODES, ONE INSTANCE. On a phone it is a bottom sheet you drag; at
   1024px and up it is a rail beside the map, because covering the map with
   the thing that explains the map is a phone compromise, not a design.

   ------------------------------------------------------------
   IT NEVER WRITES STAGE STATE.
   ------------------------------------------------------------

   It reads records and renders them. That is what keeps it outside the
   engine's first rule: seeking wipes the stage and replays the cues, and the
   card is not on the stage, so a seek with a card open leaves the card alone
   and rebuilds the picture behind it. Correct, and free.

   The corollary is that there is no `dossier.show` cue and there must never
   be one — it would be replayed on every seek and forty cards would try to
   open at once, which is the musket problem wearing a hat.
   ============================================================ */

import {
  icoClose, icoPin, icoBook, icoCaret, icoExternal, icoPersonPlaceholder,
} from './icons.js';
import { getSummary } from './wiki.js';

const PEEK = 40;   // % of sheet height hidden when peeking

/**
 * @param host   where to mount. document.body for the sheet; a panel for the rail.
 * @param opts   see the destructuring below — everything is injected.
 */
/* The card's own words.

   These used to come entirely from whoever mounted it, and the two callers do
   not have the same vocabulary: Explore injects the app's full dictionary,
   while the story injects the narration chrome's -- which has `close` and
   nothing else the card needs. So in story mode `L('fact')` and
   `L('readMore')` fell through to the default `(k) => k` and the interface
   rendered the literal strings "fact" and "readMore", in both languages.

   A component that has its own UI should own its own labels. An injected `t`
   still wins where it has an answer, so Explore's translations stay
   authoritative and nothing is duplicated in practice. */
const OWN = {
  no: {
    why: 'Hvorfor det betyr noe', fact: 'Visste du at', peopleHere: 'Hvem var med',
    partOf: 'Var med på', readMore: 'Les mer', close: 'Lukk',
    seeAlso: 'Se også', aside: 'Merk',
    showOnMap: 'Vis på kartet',
    wikiCredit: 'Kilde: Wikipedia (CC BY-SA)', wikiOpen: 'Åpne artikkelen',
    wikiInEnglish: 'på engelsk', wikiNone: 'Fant ingen artikkel å hente.',
  },
  en: {
    why: 'Why it matters', fact: 'Did you know', peopleHere: 'Who was there',
    partOf: 'Took part in', readMore: 'Read more', close: 'Close',
    seeAlso: 'See also', aside: 'Note',
    showOnMap: 'Show on the map',
    wikiCredit: 'Source: Wikipedia (CC BY-SA)', wikiOpen: 'Open the article',
    wikiInEnglish: 'in English', wikiNone: 'No article found.',
  },
};

export function createDossier(host, opts = {}) {
  const {
    t = (k) => k,
    tx = (v) => (typeof v === 'string' ? v : (v?.no ?? v?.en ?? '')),
    resolve = () => null,
    // Normalised below: a default only guards `undefined`, and a caller that
    // computes this from a pack can hand us null. Interpolating null gives
    // src="nulloctavian.jpg", which is a broken image and no error anywhere.
    portraitBase = './portraits/',
    formatDate = (d) => String(d ?? ''),
    formatNumber = (n) => String(n ?? ''),
    onNavigate = null,
    onOpen = () => {},
    onClose = () => {},
    onShowOnMap = null,
    // A getter, not a value: the reader can change language with a card open.
    lang = () => 'no',
  } = opts;

  const faces = portraitBase || './portraits/';

  /* An injected label if the host has one, our own if not. */
  const L = (k) => {
    const v = t(k);
    if (v && v !== k) return v;
    const l = typeof lang === 'function' ? lang() : lang;
    return (OWN[l] || OWN.no)[k] ?? k;
  };

  let mode = opts.mode || 'sheet';
  let current = null;
  let renderToken = 0;

  /* ---------- structure ---------- */

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.addEventListener('click', () => close());

  const panel = document.createElement('aside');
  panel.className = `sheet dossier dossier--${mode}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', mode === 'sheet' ? 'true' : 'false');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="sheet__grip" aria-hidden="true"></div>
    <button class="sheet__close" type="button">${icoClose}</button>
    <div class="sheet__scroll scroll-y"></div>
  `;

  host.append(backdrop, panel);
  const scroller = panel.querySelector('.sheet__scroll');
  const gripEl = panel.querySelector('.sheet__grip');
  const closeBtn = panel.querySelector('.sheet__close');
  closeBtn.addEventListener('click', () => close());
  closeBtn.setAttribute('aria-label', L('close'));

  scroller.addEventListener('click', onBodyClick);
  wireDrag();

  const onKey = (e) => { if (e.key === 'Escape' && current) close(); };
  document.addEventListener('keydown', onKey);

  /* ---------- open / close ---------- */

  function open(ref) {
    if (!ref || !ref.id) return false;
    const record = resolve(ref);
    if (!record) {
      console.warn(`[dossier] nothing to show for ${ref.kind}:${ref.id}`);
      return false;
    }
    const first = !current;
    current = ref;

    scroller.innerHTML = renderRecord(ref.kind, record);
    scroller.scrollTop = 0;
    wireWiki();

    document.body.classList.toggle('sheet-open', mode === 'sheet');
    backdrop.classList.toggle('is-on', mode === 'sheet');
    panel.setAttribute('aria-hidden', 'false');
    panel.style.removeProperty('transform');
    panel.classList.remove('is-full');
    panel.classList.add('is-open');
    panel.style.setProperty('--sheet-y', `${PEEK}%`);

    if (first) onOpen(ref);
    return true;
  }

  function close() {
    if (!current) return;
    current = null;
    document.body.classList.remove('sheet-open');
    backdrop.classList.remove('is-on');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-open', 'is-full');
    panel.style.removeProperty('transform');
    onClose();
  }

  /** Follow a link inside the card. The caller decides whether it is a route. */
  function navigate(ref) {
    if (onNavigate) onNavigate(ref);
    else open(ref);
  }

  /* ---------- rendering ---------- */

  function renderRecord(kind, r) {
    if (kind === 'person') return renderPerson(r);
    if (kind === 'event') return renderEvent(r);
    return renderArticle(kind, r);
  }

  function sideVar(side) {
    const safe = String(side || 'neutral').replace(/[^a-z0-9]+/gi, '-');
    return `--side: var(--f-${safe}, var(--ink-faint))`;
  }

  function renderEvent(ev) {
    return `
      <div class="sheet__kicker" style="${sideVar(ev.side)}">
        <span class="dot"></span>
        <span>${esc(t(ev.kindLabel || 'kindBattle'))}</span>
        <span aria-hidden="true">·</span>
        <span class="sheet__date">${esc(ev.dateDisplay ? tx(ev.dateDisplay) : formatDate(ev.date))}</span>
      </div>
      <h2 class="sheet__title">${esc(tx(ev.title))}</h2>
      <p class="sheet__hook">${esc(tx(ev.hook))}</p>
      ${statsHtml(ev)}
      <div class="sheet__body">${prose(tx(ev.body))}</div>
      ${calloutHtml('why', L('why'), tx(ev.why))}
      ${calloutHtml('fact', L('fact'), tx(ev.fact))}
      ${chipsFor(ev.people, 'person', L('peopleHere'))}
      ${wikiBlock(ev.wiki)}
      <div class="sheet__actions">
        ${ev.coords && onShowOnMap ? `<button class="btn btn--primary" data-map="${esc(ev.id)}">
          ${icoPin}<span>${esc(L('showOnMap'))}</span></button>` : ''}
      </div>`;
  }

  function renderPerson(p) {
    const img = p.portrait
      ? `<img class="sheet__portrait" src="${faces}${esc(p.portrait)}"
              alt="${esc(tx(p.name))}" decoding="async">`
      : `<div class="sheet__portrait sheet__portrait--none">${icoPersonPlaceholder}</div>`;
    // Some images are statues or stand-ins rather than likenesses. Say so.
    const note = p.portraitNote
      ? `<p class="sheet__portrait-note">${esc(tx(p.portraitNote))}</p>` : '';

    return `
      ${img}${note}
      <div class="sheet__kicker" style="${sideVar(p.side)}">
        <span class="dot"></span>
        <span>${esc(tx(p.role))}</span>
        ${p.lived ? `<span aria-hidden="true">·</span><span class="sheet__date">${esc(p.lived)}</span>` : ''}
      </div>
      <h2 class="sheet__title">${esc(tx(p.name))}</h2>
      <p class="sheet__hook">${esc(tx(p.hook))}</p>
      <div class="sheet__body">${prose(tx(p.body))}</div>
      ${calloutHtml('fact', L('fact'), tx(p.fact))}
      ${chipsFor(p.events, 'event', L('partOf'))}
      ${wikiBlock(p.wiki)}`;
  }

  /**
   * A place, a term or a way of life.
   *
   * One renderer for all three: they are the same shape — a name, a line that
   * makes you care, some prose, and a way onward — and inventing three
   * near-identical templates is how they drift apart.
   */
  function renderArticle(kind, r) {
    const label = t(kind === 'place' ? 'kindPlace'
      : kind === 'topic' ? 'kindTopic' : 'kindTerm');
    return `
      <div class="sheet__kicker sheet__kicker--quiet">
        <span class="dot"></span>
        <span>${esc(label)}</span>
        ${r.when ? `<span aria-hidden="true">·</span><span class="sheet__date">${esc(tx(r.when))}</span>` : ''}
      </div>
      <h2 class="sheet__title">${esc(tx(r.term || r.title || r.name))}</h2>
      ${r.short || r.hook ? `<p class="sheet__hook">${esc(tx(r.short || r.hook))}</p>` : ''}
      <div class="sheet__body">${prose(tx(r.body))}</div>
      ${calloutHtml('fact', L('fact'), tx(r.fact))}
      ${figuresHtml(r.figures)}
      ${seeAlsoHtml(r.seeAlso)}
      ${wikiBlock(r.wiki)}`;
  }

  /* ---------- pieces ---------- */

  function statsHtml(ev) {
    const rows = ev.stats || [];
    if (!rows.length) return '';
    return `<div class="stats">${rows.map((s) => `
      <div class="stat" ${s.side ? `style="${sideVar(s.side)}"` : ''}>
        <span class="stat__k">${esc(tx(s.label))}</span>
        <span class="stat__v">${esc(typeof s.value === 'number' ? formatNumber(s.value) : tx(s.value))}</span>
      </div>`).join('')}</div>`;
  }

  function figuresHtml(figures) {
    if (!figures || !figures.length) return '';
    return `<div class="stats">${figures.map((f) => `
      <div class="stat">
        <span class="stat__k">${esc(tx(f.label))}</span>
        <span class="stat__v">${esc(tx(f.value))}</span>
      </div>`).join('')}</div>`;
  }

  function calloutHtml(kind, label, text) {
    if (!text) return '';
    return `<div class="callout callout--${kind}">
      <span class="callout__k">${esc(label)}</span>${prose(text, true)}
    </div>`;
  }

  /** Chips that lead somewhere. `kind` is the pool the ids belong to. */
  function chipsFor(ids, kind, label) {
    if (!ids || !ids.length) return '';
    const items = ids
      .map((id) => ({ id, r: resolve({ kind, id }) }))
      .filter((x) => x.r);
    if (!items.length) return '';
    const chips = items.map(({ id, r }) => {
      if (kind === 'person') {
        const av = r.portrait
          ? `<img class="chip__av" src="${faces}${esc(r.portrait)}" alt="" loading="lazy" decoding="async">`
          : `<span class="chip__av chip__av--none">${icoPersonPlaceholder}</span>`;
        return `<button class="chip" type="button" data-ref="person:${esc(id)}">${av}<span>${esc(tx(r.name))}</span></button>`;
      }
      const name = tx(r.title || r.name || r.term);
      return `<button class="chip chip--plain" type="button" data-ref="${esc(kind)}:${esc(id)}">${esc(name)}</button>`;
    }).join('');
    return `<div class="chips__k">${esc(label)}</div><div class="chips">${chips}</div>`;
  }

  function seeAlsoHtml(refs) {
    if (!refs || !refs.length) return '';
    const chips = refs.map((r) => {
      const rec = resolve(r);
      if (!rec) return '';
      const name = tx(rec.term || rec.title || rec.name);
      return `<button class="chip chip--plain" type="button" data-ref="${esc(r.kind)}:${esc(r.id)}">${esc(name)}</button>`;
    }).filter(Boolean).join('');
    if (!chips) return '';
    return `<div class="chips__k">${esc(L('seeAlso'))}</div><div class="chips">${chips}</div>`;
  }

  function wikiBlock(titles) {
    if (!titles || (!titles.no && !titles.en)) return '';
    return `
      <div class="wiki" data-wiki="${esc(JSON.stringify(titles))}">
        <button class="wiki__toggle" type="button" aria-expanded="false">
          <span class="w-ico">${icoBook}</span>
          <span>${esc(L('readMore'))}</span>
          <span class="w-caret">${icoCaret}</span>
        </button>
        <div class="wiki__panel"><div class="wiki__inner"><div class="wiki__pad"></div></div></div>
      </div>`;
  }

  /** Escape, split blank-line-separated paragraphs, allow *emphasis*. */
  function prose(text, inline = false) {
    if (!text) return '';
    const paras = String(text).split(/\n\s*\n/).map((p) => {
      const safe = esc(p.trim()).replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return inline ? safe : `<p>${safe}</p>`;
    });
    return inline ? paras.join('<br>') : paras.join('');
  }

  /* ---------- interactions ---------- */

  function onBodyClick(e) {
    const ref = e.target.closest('[data-ref]');
    if (ref) {
      const [kind, ...rest] = ref.dataset.ref.split(':');
      navigate({ kind, id: rest.join(':') });
      return;
    }
    const toMap = e.target.closest('[data-map]');
    if (toMap && onShowOnMap) onShowOnMap(toMap.dataset.map);
  }

  function wireWiki() {
    const token = ++renderToken;
    const wiki = scroller.querySelector('.wiki');
    if (!wiki) return;
    const toggle = wiki.querySelector('.wiki__toggle');
    const pad = wiki.querySelector('.wiki__pad');
    let loaded = false;

    toggle.addEventListener('click', async () => {
      const isOpen = !wiki.classList.contains('is-open');
      wiki.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (!isOpen || loaded) return;
      loaded = true;

      pad.innerHTML = `<div class="wiki__skel"><span></span><span></span><span></span></div>`;

      let titles = null;
      try { titles = JSON.parse(wiki.dataset.wiki); } catch { /* malformed data attr */ }
      const data = await getSummary(titles, typeof lang === 'function' ? lang() : lang);

      if (token !== renderToken) return;   // the reader moved on while we waited

      if (!data) {
        pad.innerHTML = `<p class="wiki__extract">${esc(L('wikiNone'))}</p>`;
        return;
      }
      const thumb = data.thumb
        ? `<img class="wiki__thumb" src="${esc(data.thumb)}" alt="" loading="lazy" decoding="async">`
        : '';
      const flag = data.fallback
        ? `<span class="wiki__lang">${esc(L('wikiInEnglish'))}</span>` : '';
      pad.innerHTML = `
        ${thumb}
        <p class="wiki__extract">${esc(data.extract)}</p>
        <div class="wiki__foot">
          <span>${esc(L('wikiCredit'))} ${flag}</span>
          <a href="${esc(data.url)}" target="_blank" rel="noopener noreferrer">
            <span>${esc(L('wikiOpen'))}</span>${icoExternal}
          </a>
        </div>`;
    });
  }

  /* ---------- dragging: sheet mode only ---------- */

  function wireDrag() {
    let startY = 0, startTop = 0, dragging = false, lastY = 0, lastT = 0, velocity = 0;

    const height = () => panel.getBoundingClientRect().height;
    const currentTop = () => {
      const m = /translateY\(([-\d.]+)px\)/.exec(panel.style.transform || '');
      if (m) return Number(m[1]);
      return panel.classList.contains('is-full') ? 0 : height() * (PEEK / 100);
    };

    const begin = (e) => {
      // A rail does not drag. It is beside the map, not over it.
      if (!current || mode !== 'sheet') return;
      dragging = true;
      startY = lastY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      startTop = currentTop();
      panel.classList.add('is-dragging');
    };

    const move = (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      const dt = Math.max(1, e.timeStamp - lastT);
      velocity = (e.clientY - lastY) / dt;      // px per ms
      lastY = e.clientY; lastT = e.timeStamp;

      let top = startTop + dy;
      if (top < 0) top = top * 0.28;            // rubber-band at the top
      panel.style.transform = `translateY(${top}px)`;
      e.preventDefault();
    };

    const end = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      panel.style.removeProperty('transform');

      const h = height();
      const top = Math.max(0, startTop + (lastY - startY));
      const peekPx = h * (PEEK / 100);

      // A decisive flick beats position.
      if (velocity > 0.7) { if (top > peekPx * 0.75) close(); else toPeek(); return; }
      if (velocity < -0.7) { toFull(); return; }

      if (top > peekPx + h * 0.18) close();
      else if (top > peekPx * 0.5) toPeek();
      else toFull();
    };

    const toFull = () => panel.classList.add('is-full');
    const toPeek = () => panel.classList.remove('is-full');

    const attach = (el, guard) => {
      el.addEventListener('pointerdown', (e) => {
        if (guard && !guard(e)) return;
        begin(e);
        el.setPointerCapture?.(e.pointerId);
      });
      el.addEventListener('pointermove', move, { passive: false });
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };

    attach(gripEl);
    // Pull down by dragging the content, but only from the very top.
    attach(scroller, () => scroller.scrollTop <= 0);

    scroller.addEventListener('scroll', () => {
      if (mode === 'sheet' && scroller.scrollTop > 12
          && !panel.classList.contains('is-full')) {
        panel.classList.add('is-full');
      }
    }, { passive: true });
  }

  /* ---------- api ---------- */

  return {
    open,
    close,
    isOpen: () => Boolean(current),
    current: () => current,
    el: () => panel,
    /** Re-render whatever is showing — after a language change, say. */
    refresh() { if (current) open(current); },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      panel.className = `sheet dossier dossier--${mode}`
        + (current ? ' is-open' : '');
      panel.setAttribute('aria-modal', mode === 'sheet' ? 'true' : 'false');
      // A rail never dims the page behind it, and never locks body scroll.
      const asSheet = mode === 'sheet' && Boolean(current);
      document.body.classList.toggle('sheet-open', asSheet);
      backdrop.classList.toggle('is-on', asSheet);
    },
    mode: () => mode,
    destroy() {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      panel.remove();
    },
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
