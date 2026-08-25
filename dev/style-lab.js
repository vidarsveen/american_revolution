/* ============================================================
   style-lab.js — the bench for the per-pack tuning file.

   ONE QUESTION:

     Does every number the app draws with come from this file, and does
     changing one change the app and nothing else?

   The sliders are the smaller half. A page that only puts knobs on a running
   chapter is a gallery, and CLAUDE.md's lab rule says a gallery will rot: the
   thing worth having in six months is the AUDIT, which walks every key in
   engine/style.js's TRACE table and asks, of each one:

     A. Is this number traceable to the file at all?
        For a key the app already draws with, that means reading the computed
        custom property off :root and comparing. For a key a module still owns
        as a literal, it means grepping that literal out of the source and
        comparing — so a value that DRIFTS APART fails today, before the wiring
        lands. An unwired key that nothing checks is worse than no key; that is
        the whole DECK_RESERVE_PX story, three values and two of them wrong.

     B. Does changing it change the app, and nothing else?
        Each key is perturbed on its own and the whole measurable surface is
        re-read. A key that moves nothing is not wired. A key that moves
        something it has no business moving is a leak — and this is exactly the
        shape of the caption box and the stats deck both anchoring to the same
        edge, which was invisible for months.

     C. What does type.scale actually cost?
        The one genuinely new control. Measured, not asserted: the caption box
        at 390 wide, and how many map labels survive declutter().

     D. Can a tuning file break a chapter?
        Rule 3's shape. Garbage in, defaults out, chapter runs.

   A regex in TRACE that stops matching is reported as "form endret", never as
   a pass. tools/check-script.py's check_camera_lands() reads map/index.js's
   constants the same way and for the same reason.
   ============================================================ */

import {
  loadStyle, applyStyle, mergeStyle, loadDefaults, checkStyleTokens,
  TRACE, styleSpec, styleVars, toNumber,
} from '../engine/style.js';
import { loadChapter } from '../engine/script.js';
import { allChapters, useRegistry, loadPack } from '../engine/pack.js';
import { mountCaptions, renderCaption } from '../engine/captions.js';

/* The stage is OPTIONAL here, and that is not defensiveness.

   engine/scenes/* became engine/surfaces/* while this bench was being written.
   Sections A, A2 and D are about the numbers and must answer with no stage at
   all — a bench that cannot run during a refactor is a bench that gets deleted
   during one. Sections B and C need a mounted chapter and say so when they
   cannot have it. */
let mountStage = null;
let resetStage = null;
let getStoryMap = () => null;
try {
  ({ mountStage, resetStage } = await import('../engine/stage.js'));
  for (const p of ['../engine/surfaces/map.js', '../engine/scenes/map.js']) {
    try { ({ getStoryMap } = await import(p)); break; } catch { /* next */ }
  }
} catch (err) {
  console.warn('[style-lab] no stage —', err.message);
}

const el = {};
let CHAPTERS = [];
let spec = null;
let chapter = null;
let people = [];
let packDefaults = null;      // the documented set, before this pack's file
let packStyle = null;         // …and after it
let live = null;              // …and after the sliders

const $ = (s) => document.querySelector(s);
const status = (s) => { el.status.textContent = s; };
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

/* Every step in the type scale, in the order the direction lists them. Read
   as resolved pixels through a probe element, because that is the number a
   reader actually gets — `calc(clamp(…) * var(--type-scale))` says nothing. */
const FS = ['--fs-3xs', '--fs-2xs', '--fs-xs', '--fs-sm', '--fs-base',
            '--fs-md', '--fs-lg', '--fs-xl', '--fs-2xl'];

/* ------------------------------------------------------------
   Reporting
   ------------------------------------------------------------ */
let failures = 0;
function out(html) { el.out.insertAdjacentHTML('beforeend', html); }
function verdict(ok, text) {
  if (!ok) failures += 1;
  return `<span class="${ok === true ? 'good' : ok === null ? 'meh' : 'bad'}">${text}</span>`;
}
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

/* ------------------------------------------------------------
   The measurable surface
   ------------------------------------------------------------ */

/**
 * Everything a change is allowed to move, read in one pass.
 *
 * Custom properties AND the pixels they resolve to. The distinction matters:
 * --fs-md is a calc() over a clamp(), so the property's text never changes
 * when --type-scale does, and a probe that compared property strings would
 * report the one control this file adds as doing nothing at all.
 */
function probe() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const v = {};
  for (const [path, { prop, unit }] of Object.entries(styleVars())) {
    v[prop] = toNumber(cs.getPropertyValue(prop).trim(), unit);
  }
  const p = document.createElement('div');
  p.style.cssText = 'position:absolute;visibility:hidden;left:-9999px';
  document.body.appendChild(p);
  for (const step of FS) {
    p.style.fontSize = `var(${step})`;
    v[`${step}(px)`] = parseFloat(getComputedStyle(p).fontSize);
  }
  p.remove();
  const storyCs = getComputedStyle($('.story'));
  v['--caption-h'] = toNumber(storyCs.getPropertyValue('--caption-h').trim(), 'px');
  return v;
}

function diff(a, b) {
  const moved = [];
  for (const k of Object.keys(a)) {
    const x = a[k]; const y = b[k];
    if (x === null && y === null) continue;
    if (x === null || y === null || Math.abs(x - y) > 0.01) moved.push(k);
  }
  return moved;
}

/* ------------------------------------------------------------
   A. Traceability
   ------------------------------------------------------------ */

const sourceCache = new Map();
async function readFile(file) {
  if (!sourceCache.has(file)) {
    sourceCache.set(file, fetch(file, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''));
  }
  return sourceCache.get(file);
}

/**
 * An owner may name several candidate paths, and the first that exists wins.
 *
 * Not laziness about renames: engine/scenes/* became engine/surfaces/* while
 * this bench was being written, and a check that goes blind the moment a file
 * moves is a check that reports a stale number as fine. Naming both means the
 * comparison survives the move and the row still says WHICH file answered.
 */
async function source(fileOrList) {
  for (const f of [].concat(fileOrList)) {
    const text = await readFile(f);
    if (text) return { file: f, text };
  }
  return { file: [].concat(fileOrList).join(' / '), text: '' };
}

function valueAt(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

/** The owner's literal, as the same kind of thing the file holds. */
function captured(m, owner, want) {
  if (owner.text) return m[1];
  if (Array.isArray(want)) return [Number(m[1]), Number(m[2])].map((n) => n * (owner.scale || 1));
  return Number(m[1]) * (owner.scale || 1);
}

function same(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
  }
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  return a === b;
}

async function auditTrace() {
  out('<h2>A · Sporing</h2>');
  out('<p>For every key: does the number in the file still agree with whoever '
    + 'owns it? <code>KILDE</code> means the app reads it through the custom '
    + 'property. <code>SPEIL</code> means a module still holds its own literal '
    + 'and the two agree — a mirror, not a source, and it is only better than '
    + 'nothing because this row fails when they part.</p>');

  const rows = [];
  for (const entry of TRACE) {
    const want = valueAt(live, entry.path);
    const cells = [];

    // The live half: does the browser resolve the property to the file's value?
    if (entry.status === 'css') {
      const { prop, unit } = styleVars()[entry.path] || {};
      const got = toNumber(getComputedStyle(document.documentElement)
        .getPropertyValue(prop).trim(), unit);
      cells.push(got !== null && Math.abs(got - want) < 1e-6
        ? verdict(true, `KILDE ${prop}`)
        : verdict(false, `AVVIK ${prop} = ${got}, fila sier ${want}`));
    } else if (entry.status === 'js') {
      /* A camera duration and a label gap never reach a stylesheet, so there
         is no computed property to read and the honest check is the other
         one: does the module ASK this file? The owner rows below match on
         `styleValue('<path>', …)` at the call site, so the day someone puts
         the literal back the regex stops matching and this key goes red.
         Publishing a custom property nobody reads would have made this row
         green without any of that being true. */
      cells.push(verdict(true, 'KILDE styleValue() — se anropsstedet under'));
    } else {
      cells.push(verdict(null, 'UVIRET — ingen CSS-egenskap'));
    }

    /* The source half: every module that still holds the number itself.

       Compared against the DEFAULTS, not against this pack's merged value. A
       pack that tunes plate.push to 0.24 is doing the thing this file exists
       for; the module's literal is still 0.16 and that is correct. What the
       mirror is for is the other case — the documented default and the module
       default parting company, which is how DECK_RESERVE_PX ended up with
       three values and two of them wrong. */
    const base = valueAt(packDefaults, entry.path);
    for (const owner of entry.owners || []) {
      const { file, text } = await source(owner.file);
      if (!text) { cells.push(verdict(false, `${file} kunne ikke leses`)); continue; }
      const m = owner.re.exec(text);
      if (!m) {
        cells.push(verdict(false,
          `FORM ENDRET i ${file} — <code>${esc(String(owner.re))}</code> `
          + 'treffer ikke lenger. Denne sjekken er blind til den rettes.'));
        continue;
      }
      const got = captured(m, owner, base);
      const kind = owner.pending || entry.status === 'pending' ? 'SPEIL' : 'FALLBACK';
      const tuned = JSON.stringify(base) !== JSON.stringify(want)
        ? ` <small>(pakken stiller den til ${JSON.stringify(want)})</small>` : '';
      cells.push(same(got, base)
        ? verdict(true, `${kind} ${file} = ${JSON.stringify(got)}${tuned}`)
        : verdict(false, `AVVIK ${file} = ${JSON.stringify(got)}, `
          + `standardsettet sier ${JSON.stringify(base)}`));
    }

    rows.push(`<tr><td><code>${entry.path}</code></td>`
      + `<td><code>${esc(JSON.stringify(want))}</code></td>`
      + `<td>${cells.join('<br>')}</td></tr>`);
  }
  out(`<table><tr><th>nøkkel</th><th>fila</th><th>hvem eier tallet</th></tr>${rows.join('')}</table>`);

  const pending = TRACE.filter((t) => t.status === 'pending').map((t) => t.path);
  if (pending.length) {
    out(`<p class="warn"><b>${pending.length} of ${TRACE.length} keys are not yet read `
      + 'from this file.</b> They are mirrored, so drift fails here — but the module still '
      + `decides. <code>${pending.join('</code>, <code>')}</code></p>`);
  } else {
    out(`<p class="note"><b>All ${TRACE.length} keys are read from this file</b> — `
      + `${TRACE.filter((t) => t.status === 'css').length} through a custom property, `
      + `${TRACE.filter((t) => t.status === 'js').length} through <code>styleValue()</code>. `
      + 'Every literal still in a module is a FALLBACK, and every one of them is '
      + 'compared against the documented defaults above.</p>');
  }
}

/* ------------------------------------------------------------
   A2. The three copies of the default set
   ------------------------------------------------------------ */
async function auditDrift() {
  out('<h2>A2 · Standardsettet, tre steder</h2>');
  out('<p>engine/style.js\'s built-in fallback, engine/defaults/style.json, and '
    + 'css/tokens.css carry the same six durations. Rule 3 needs the fallback and '
    + 'the chooser needs the stylesheet, so the copies are the price — but they '
    + 'are checked, not trusted.</p>');
  const found = await checkStyleTokens();
  if (!found.length) { out(`<p>${verdict(true, 'Alle tre er enige.')}</p>`); return; }
  for (const f of found) {
    out(`<p class="${f.level === 'fail' ? 'fail' : 'warn'}">`
      + `${verdict(f.level !== 'fail', f.path)} — ${esc(f.msg)}</p>`);
  }
}

/* ------------------------------------------------------------
   B. Isolation
   ------------------------------------------------------------ */

/* What each key is ALLOWED to move. Anything else moving is the finding. */
function expectedFor(path) {
  const { prop } = styleVars()[path] || {};
  if (path === 'type.scale') {
    // The whole scale, and the caption box with it — a caption that did not
    // change height when the type did would mean the box is not sized by the
    // text, which is a different bug wearing the same clothes.
    return ['--type-scale', ...FS.map((s) => `${s}(px)`), '--caption-h'];
  }
  return prop ? [prop] : [];
}

async function auditIsolation() {
  out('<h2>B · Isolasjon</h2>');
  out('<p>One key at a time, perturbed and put back. The right-hand column is '
    + 'what moved that should not have, or did not move that should have.</p>');

  const rows = [];
  for (const path of Object.keys(styleVars())) {
    const before = probe();
    const want = valueAt(live, path);
    // A distinctive factor, so a coincidence cannot look like a pass: 1.37 of
    // 900 is 1233, which is not any other number in the scale.
    const perturbed = mergeStyle(live, blank(path, path === 'type.scale' ? 1.15 : want * 1.37));
    applyStyle(perturbed);
    await settle(80);
    await captionSettle();
    const after = probe();
    applyStyle(live);
    await settle(40);
    await captionSettle();

    const moved = diff(before, after);
    const want2 = expectedFor(path);
    const missing = want2.filter((k) => !moved.includes(k));
    const extra = moved.filter((k) => !want2.includes(k));
    const ok = !missing.length && !extra.length;
    rows.push(`<tr><td><code>${path}</code></td>`
      + `<td>${moved.length ? `<code>${moved.join('</code> <code>')}</code>` : '—'}</td>`
      + `<td>${ok ? verdict(true, 'isolert')
        : verdict(false, [missing.length ? `beveget seg ikke: ${missing.join(', ')}` : '',
                          extra.length ? `beveget seg også: ${extra.join(', ')}` : '']
          .filter(Boolean).join(' · '))}</td></tr>`);
  }
  out(`<table><tr><th>nøkkel</th><th>flyttet</th><th>dom</th></tr>${rows.join('')}</table>`);
}

/** A style object carrying one path and nothing else. */
function blank(path, value) {
  const [a, b] = path.split('.');
  return { [a]: { [b]: value } };
}

/* ------------------------------------------------------------
   C. What type.scale costs
   ------------------------------------------------------------ */

async function captionSettle() {
  // --caption-h is published by a ResizeObserver, which delivers on its own
  // schedule. Two frames plus a beat, and never a fixed guess at how long a
  // reflow takes.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await settle(40);
}

function longestBeat() {
  let best = null;
  for (const s of chapter?.scenes || []) {
    for (const b of s.beats || []) {
      if (!best || (b.text || '').length > (best.text || '').length) best = b;
    }
  }
  return best;
}

function countLabels() {
  const nodes = [...document.querySelectorAll('.atlas-place, .atlas-pin')];
  const shown = nodes.filter((n) => getComputedStyle(n).visibility !== 'hidden');
  return { drawn: nodes.length, shown: shown.length };
}

async function auditTypeScale() {
  out('<h2>C · Hva type.scale koster</h2>');
  if (!mountStage) { out('<p class="warn">No stage — engine/stage.js did not import.</p>'); return; }

  const beat = longestBeat();
  const rows = [];
  for (const scale of [0.9, 1.0, 1.15]) {
    applyStyle(mergeStyle(live, blank('type.scale', scale)));
    /* REMOUNT, do not just re-render.

       map/index.js caches a label's measured box against `metricsGen`, which
       is bumped once, by document.fonts.ready. Nothing bumps it when the type
       scale moves — so a live change restyles every label and leaves declutter
       colliding yesterday's boxes. Measuring without a remount would have
       reported the type scale as free. It is not; see the report. */
    await remount();
    if (beat) renderCaption(beat, 0);
    await captionSettle();
    const p = probe();
    const l = countLabels();
    rows.push({ scale, md: p['--fs-md(px)'], sm: p['--fs-sm(px)'],
                cap: p['--caption-h'], ...l });
  }
  applyStyle(live);
  await remount();
  if (beat) renderCaption(beat, 0);
  await captionSettle();

  const base = rows.find((r) => r.scale === 1) || rows[1];
  out(`<table><tr><th>scale</th><th>--fs-md</th><th>--fs-sm</th>`
    + `<th>caption-h</th><th>etiketter</th></tr>`
    + rows.map((r) => `<tr><td><b>${r.scale.toFixed(2)}</b></td>`
      + `<td>${r.md?.toFixed(1)} px</td><td>${r.sm?.toFixed(1)} px</td>`
      + `<td>${r.cap === null ? '—' : `${r.cap.toFixed(0)} px`}`
      + `${r.cap !== null && base.cap ? ` <small>(${r.cap > base.cap ? '+' : ''}${(r.cap - base.cap).toFixed(0)})</small>` : ''}</td>`
      + `<td>${r.shown} av ${r.drawn}`
      + `${base.shown ? ` <small>(${r.shown > base.shown ? '+' : ''}${r.shown - base.shown})</small>` : ''}</td></tr>`).join('')
    + '</table>');
  out('<p class="note">The caption is the number that decides whether this control '
    + 'is worth having: the box is 40 % of a 390x844 phone together with the '
    + 'transport and the fact card, and the type scale is the only thing that '
    + 'moves it. The label column is the cost on the other side — a bigger name '
    + 'is a name that collides.</p>');
  /* AND THE NUMBERS ABOVE ARE THIS WINDOW'S, NOT A PHONE'S.

     --fs-md is clamp(1.1875rem, 5.4vw, 1.5rem) and `vw` is the WINDOW, not the
     390 px column the stage sits in. On a desktop the clamp is pinned to its
     1.5rem ceiling, so the caption reads 24 px at scale 1.0 where a phone gets
     21.1 — and the whole reason --fs-md is viewport-relative is that a subtitle
     is a share of the SCREEN. Narrow the window to 390 to compare with
     BACKLOG.md's numbers, or drive this page headless at that size. */
  out('<p class="warn"><b>A live type-scale change does not re-declutter the map.</b> '
    + '<code>map/index.js</code> caches each label\'s measured box against '
    + '<code>metricsGen</code>, and the only thing that bumps it is '
    + '<code>document.fonts.ready</code>. So moving the slider restyles every '
    + 'label and leaves <code>declutter()</code> colliding the old boxes — the '
    + 'rows above are honest only because this bench remounts the stage between '
    + 'them. The map module wants a <code>remeasureLabels()</code> hook before '
    + '<code>type.scale</code> can be tuned live rather than measured.</p>');
  if (Math.abs(innerWidth - 390) > 2) {
    out(`<p class="warn">Window is ${innerWidth} px wide. <code>--fs-md</code> `
      + 'is <code>5.4vw</code> in the middle of its clamp, so the caption '
      + 'numbers above are this window\'s and not a phone\'s. Narrow to 390 to '
      + 'compare against the measurements in BACKLOG.md.</p>');
  }
}

/* ------------------------------------------------------------
   D. A tuning file must not be able to break a chapter
   ------------------------------------------------------------ */
async function auditRobustness() {
  out('<h2>D · Kan fila velte et kapittel?</h2>');
  const d = packDefaults;
  const cases = [
    ['ingen fil', null],
    ['en tom fil', {}],
    ['en liste i stedet for et objekt', [1, 2, 3]],
    ['tekst der et tall skal være', { motion: { enter: 'ganske raskt' } }],
    ['null', { motion: { enter: null } }],
    ['NaN gjennom JSON', { type: { scale: 'x' } }],
    ['et tall langt utenfor skalaen', { type: { scale: 40 } }],
    ['en seksjon som ikke finnes', { farge: { rød: 1 } }],
    ['en nøkkel som ikke finnes', { motion: { swoosh: 400 } }],
    ['et par som går baklengs', { camera: { clamp: [9, 1] } }],
    ['et par med ett tall', { plate: { focus: [0.5] } }],
    ['en enum som ikke finnes', { plate: { motion: 'swoop' } }],
  ];
  const rows = [];
  for (const [name, raw] of cases) {
    let got; let threw = null;
    try { got = mergeStyle(d, raw, '(test)'); } catch (err) { threw = err.message; }
    // The bar is not "it survived": every key must still be a legal value, and
    // type.scale 40 must be clamped rather than passed through to a calc().
    const legal = !threw && Object.entries(styleSpec()).every(([p, s]) => {
      const v = valueAt(got, p);
      if (s.kind === 'enum') return s.of.includes(v);
      if (s.kind === 'pair') return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)
        && v.every((n) => n >= s.min && n <= s.max);
      return Number.isFinite(v) && v >= s.min && v <= s.max;
    });
    rows.push(`<tr><td>${name}</td><td>${threw
      ? verdict(false, `kastet: ${esc(threw)}`)
      : verdict(legal, legal ? 'alle verdier lovlige' : 'slapp gjennom noe ulovlig')}</td>`
      + `<td><code>type.scale = ${JSON.stringify(valueAt(got, 'type.scale'))}, `
      + `motion.enter = ${JSON.stringify(valueAt(got, 'motion.enter'))}</code></td></tr>`);
  }
  out(`<table><tr><th>fila sier</th><th>dom</th><th>etterpå</th></tr>${rows.join('')}</table>`);
}

/* ------------------------------------------------------------
   The sliders
   ------------------------------------------------------------ */

function buildKnobs() {
  const s = styleSpec();
  el.knobs.innerHTML = '';
  for (const [path, sp] of Object.entries(s)) {
    const row = document.createElement('div');
    row.className = 'knob';
    const wired = !!styleVars()[path];
    if (!wired) row.classList.add('is-off');
    const v = valueAt(live, path);
    const label = `<label title="${wired ? 'published as a custom property'
      : 'not read from this file yet — see the audit'}">${path}${wired ? '' : ' ·'}</label>`;

    if (sp.kind === 'enum') {
      row.innerHTML = `${label}<select>${sp.of.map((o) =>
        `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select><output></output>`;
      row.querySelector('select').addEventListener('change', (e) => {
        live = mergeStyle(live, blank(path, e.target.value));
        applyStyle(live);
      });
    } else if (sp.kind === 'pair') {
      row.innerHTML = `${label}<span style="display:flex;gap:6px">`
        + `<input type="number" step="0.05" value="${v[0]}" style="width:100%">`
        + `<input type="number" step="0.05" value="${v[1]}" style="width:100%">`
        + `</span><output></output>`;
      const [a, b] = row.querySelectorAll('input');
      const push = () => {
        live = mergeStyle(live, blank(path, [Number(a.value), Number(b.value)]));
        applyStyle(live);
      };
      a.addEventListener('input', push); b.addEventListener('input', push);
    } else {
      const step = sp.max > 100 ? 20 : sp.max > 10 ? 0.1 : 0.01;
      row.innerHTML = `${label}<input type="range" min="${sp.min}" max="${sp.max}" `
        + `step="${step}" value="${v}"><output>${v}</output>`;
      const inp = row.querySelector('input');
      const o = row.querySelector('output');
      inp.addEventListener('input', () => {
        o.textContent = inp.value;
        live = mergeStyle(live, blank(path, Number(inp.value)));
        applyStyle(live);
      });
    }
    el.knobs.appendChild(row);
  }
}

/** Only what differs from the documented defaults. A pack file stays small. */
function styleJson() {
  const out2 = {
    $doc: 'This pack\'s tuning. Merged OVER engine/defaults/style.json key by key, '
      + 'and a cue argument still wins over both.',
  };
  for (const path of Object.keys(styleSpec())) {
    const a = valueAt(packDefaults, path);
    const b = valueAt(live, path);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const [x, y] = path.split('.');
    (out2[x] ||= {})[y] = b;
  }
  return `${JSON.stringify(out2, null, 2)}\n`;
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

async function remount() {
  if (!mountStage) return;
  try {
    resetStage?.();
    el.stage.innerHTML = '';
    mountStage(el.stage, chapter, people, chapter.narrationLang || 'no');
    const map = getStoryMap?.();
    // "Network idle" is not "the ground is drawn" — the basemap level is
    // fetched from inside the first draw. Wait on the map, not on a timer.
    if (map?.ready) { await map.ready(); }
    await settle(150);
  } catch (err) {
    console.warn('[style-lab] mountStage failed —', err.message);
  }
}

async function load(i) {
  spec = CHAPTERS[i];
  status('laster…');
  failures = 0;
  el.out.innerHTML = '';

  const packInfo = await loadPack(spec.pack);
  const peopleRel = packInfo?.pools?.people;
  people = peopleRel
    ? await fetch(`./content/${spec.pack}/${peopleRel}`)
        .then((r) => (r.ok ? r.json() : [])).catch(() => [])
    : [];

  packDefaults = await loadDefaults();
  packStyle = await loadStyle(spec.pack);
  live = JSON.parse(JSON.stringify(packStyle));
  applyStyle(live, document.documentElement, spec.pack);

  chapter = await loadChapter(spec.pack, spec.id, 'no');
  mountCaptions($('.story__caption-slot'));
  /* The LONGEST beat, and it stays up for the whole session.

     --caption-h is the number the type scale is really about — the caption box
     is the biggest single piece of furniture on a 390x844 phone — and it only
     exists while a caption is rendered. Measuring the isolation pass with an
     empty caption slot reported type.scale as moving nothing, which was the
     bench being wrong rather than the control. The worst case is the useful
     one: BACKLOG.md's 127 median / 211 worst are what these numbers compare to. */
  const beat = longestBeat();
  if (beat) renderCaption(beat, 0);
  await remount();
  await captionSettle();

  buildKnobs();
  const own = JSON.stringify(packStyle) !== JSON.stringify(packDefaults);
  el.chapter.innerHTML = `${spec.pack} · ${spec.id} · `
    + `style.json ${own ? 'overrides the defaults' : 'is the defaults'}`;
  status('klar');
}

async function runAll() {
  el.out.innerHTML = '';
  failures = 0;
  status('reviderer…');
  const t0 = performance.now();
  await auditTrace();
  await auditDrift();
  await auditIsolation();
  await auditTypeScale();
  await auditRobustness();
  const ms = Math.round(performance.now() - t0);
  out(`<p class="${failures ? 'fail' : 'note'}"><b>${failures
    ? `${failures} funn` : 'Ingen funn'}</b> — ${ms} ms.</p>`);
  status(failures ? `${failures} funn` : 'grønn');
  // For tools/check-style.py, when someone writes it: one place to read.
  window.__styleLab = { failures, pack: spec?.pack, chapter: spec?.id };
}

async function boot() {
  el.stage = $('#stage');
  el.out = $('#out');
  el.status = $('#status');
  el.chapter = $('#chapter');
  el.knobs = $('#knobs');

  // Everything on disk, not just what ships — a pack taken out of the build
  // still has to stay correct. Same reason dev/engine-lab.js does it.
  useRegistry('./content/packs.dev.json');
  CHAPTERS = await allChapters();
  const pick = $('#pick');
  CHAPTERS.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${c.pack} · ${c.id}`;
    pick.appendChild(opt);
  });
  pick.addEventListener('change', () => load(Number(pick.value)));
  $('#run').addEventListener('click', runAll);
  $('#reset').addEventListener('click', () => {
    live = JSON.parse(JSON.stringify(packStyle));
    applyStyle(live);
    buildKnobs();
  });
  $('#copy').addEventListener('click', async () => {
    const text = styleJson();
    try {
      await navigator.clipboard.writeText(text);
      status(`kopiert — content/${spec.pack}/style.json`);
    } catch {
      // A bench that silently fails to copy is a bench you distrust. Show it.
      out(`<h3>content/${spec.pack}/style.json</h3><pre>${esc(text)}</pre>`);
      status('clipboard blocked — printed below');
    }
  });

  await load(0);
}

boot();
