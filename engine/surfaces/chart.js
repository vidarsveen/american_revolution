/* ============================================================
   surfaces/chart.js — a measured shape, drawn from a pack's own numbers.

   WHY THIS EXISTS

   `compare.show` is two or three numbers as one picture, and it is already
   half of this: parts, values, sides, growing on its `over`. What it cannot
   do is compare two THINGS across the same set of axes — every number has to
   be written into the cue, so "Barolo and Barbaresco are the same grape and
   different wines" would mean ten hand-copied numbers in a script, drifting
   away from the entries that already state them in prose.

   So a chart resolves against the pack's own entry pools, exactly the way
   `fact.show` does. An entry may carry a `profile`:

       "barolo": { "name": …, "hook": …,
                   "profile": { "syre": 0.85, "tannin": 0.95, "fylde": 0.75,
                                "frukt": 0.5,  "sodme": 0.0 } }

   and the pack names those axes ONCE, beside the kind that owns them:

       "entries": {
         "wine": { "from": "wines",
                   "profile": { "axes": [
                     { "id": "syre",   "label": { "no": "Syre", "en": "Acid" } },
                     … ] } } }

   THE FRAMEWORK MUST NOT LEARN WHAT TANNIN IS

   Nothing in this file knows an axis name, how many there are, or what order
   they go in. It reads a declared list of ids and labels and draws it. A
   finance course declaring `{ risk, liquidity, horizon }` gets the same
   picture from the same code.

   The axes are declared per KIND rather than per entry on purpose: two
   entries are only comparable if they carry the same axes in the same order,
   and a per-entry list cannot promise that — twelve entries would be twelve
   chances for `sodme` to become `soedme` in one of them. One declaration
   makes it structural. An entry whose profile is missing a declared axis
   simply has no bar on that row, which is honestly different from zero.

   WHY BARS AND NOT A RADAR

   A radar was the obvious drawing and is the wrong one, for two reasons the
   content itself supplies:

   · **Zero collapses to the centre.** `sodme` is 0.00 for every dry wine, and
     a spike pulled into the middle of a web reads as a rendering fault rather
     than as a fact. Here a zero keeps its label, keeps its full track, and
     draws a dot at the origin (`min-width`, one step) — measured, and none.
     Every subject with a "none of this" axis gets the same answer.
   · **The primary case is two profiles at once, and they are CLOSE.** Barolo
     and Barbaresco are the same grape eighteen kilometres apart; that is the
     whole sentence. Two near-identical polygons at 390 px wide are mush, and
     two bars in one track differ visibly at 0.05. Axis by axis is also the
     only reading that answers "which is more tannic", which is the question.

   It is also the grammar `compare.show` already established, so the stage
   does not grow a second visual language for the same idea.

   RULE 1

   The picture is a pure function of (entries, cue). There is no `over`
   argument at all: the bars grow over `--t-enter`, from the stylesheet, and
   `.is-instant` turns that off — so a seek draws the finished bars and there
   is no authored duration that can drift off the motion scale. Nothing is
   accumulated between cues: `chart.show` rebuilds the whole card from the
   cue, so two shows in a row is the second one, not both.
   ============================================================ */

let root = null;
let entries = null;
let packInfo = null;
let lang = 'no';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountChart(container, chapter, language) {
  entries = chapter?.entries || null;
  packInfo = chapter?.packInfo || null;
  lang = language || chapter?.narrationLang || 'no';
  root = document.createElement('div');
  root.className = 'stage-chart';
  container.appendChild(root);
}

export function resetChart() {
  if (!root) return;
  root.classList.remove('is-on');
  root.innerHTML = '';
}

export function unmountChart() {
  root?.remove();
  root = null;
  entries = null;
  packInfo = null;
}

/* ------------------------------------------------------------
   Resolving what the cue points at
   ------------------------------------------------------------ */

/** "wine:barolo" -> the entry, or null. Same index fact.show reads. */
function entryAt(ref) {
  const [kind, ...rest] = String(ref || '').split(':');
  const id = rest.join(':');
  if (!kind || !id) return null;
  // No spread: core/entries.js already stamps `kind` on the entry, and
  // `{...e}` would evaluate any getter a pack's pool grew later and freeze it.
  return entries?.get(kind, id) || null;
}

/**
 * The axes to draw, in order, with their labels.
 *
 * Declared by the pack beside the kind. Falls back to the keys the first
 * entry happens to carry, which is right for a pack that has not declared
 * anything yet and is NOT good enough for a comparison — so the fallback
 * keeps the key as its own label rather than inventing a prettier one, and
 * the missing declaration is visible on screen.
 */
function axesFor(kind, entry, wanted) {
  const declaredAxes = packInfo?.entries?.[kind]?.profile?.axes;
  let list = Array.isArray(declaredAxes) && declaredAxes.length
    ? declaredAxes.map((a) => ({ id: a.id, label: a.label ?? a.id }))
    : Object.keys(entry?.profile || {}).map((id) => ({ id, label: id }));
  if (Array.isArray(wanted) && wanted.length) {
    const want = new Set(wanted);
    // The cue's order wins when it names a subset: "acid against tannin" is
    // an argument about two axes and should not be read in pack order.
    list = wanted.map((id) => list.find((a) => a.id === id) || { id, label: id })
      .filter((a) => want.has(a.id));
  }
  return list;
}

/* The two colours a comparison gets, and why they are ROLES and not sides.

   Barolo and Barbaresco both declare `red` in the wine pack, because they are
   both red wine — so colouring the series by faction draws the two things
   being contrasted in exactly the same colour. A series colour is a statement
   about WHICH ONE, not about what it is, so it takes the palette's look-here
   role first and its neighbour second. A cue may still override with `side`
   when the sides really are the subject. */
const SERIES_TONES = ['gold', 'sage', 'blue', 'red'];

/**
 * The CSS value for a series' colour.
 *
 * `--f-tone-gold` is published on :root by applyPaletteVars() and re-published
 * on every theme change, which is why a node must carry a var() REFERENCE and
 * never a resolved hex. But it is published by the HOST, and a bench or a
 * probe that mounts the stage without doing so used to get `--ink-faint` for
 * every series — two wines drawn in one colour, which is precisely the fault
 * these roles exist to avoid, and it looked like a design choice rather than a
 * missing variable. So a tone falls back through its own design token, which
 * css/tokens.css always defines and which flips with the theme by itself.
 */
function sideVar(side) {
  const safe = String(side).replace(/[^a-z0-9]+/gi, '-');
  const tone = /^tone-(\w+)$/.exec(safe);
  return tone
    ? `var(--f-${safe}, var(--tone-${tone[1]}, var(--${tone[1]}, var(--ink-faint))))`
    : `var(--f-${safe}, var(--ink-faint))`;
}

/* ------------------------------------------------------------
   Drawing
   ------------------------------------------------------------ */

export function showChart(cue, instant) {
  if (!root) return;
  const refs = [cue.ref, cue.against].filter(Boolean);
  const series = refs.map((ref, i) => {
    const e = entryAt(ref);
    if (!e || !e.profile) return null;
    const side = (i === 0 ? cue.side : cue.againstSide)
      || `tone-${SERIES_TONES[i % SERIES_TONES.length]}`;
    return { entry: e, side };
  }).filter(Boolean);
  if (!series.length) return;

  const axes = axesFor(series[0].entry.kind, series[0].entry, cue.axes);
  if (!axes.length) return;

  // `profile` measures against a fixed ceiling of 1: the track IS the scale,
  // so 0.85 acid means the same thing in every chart the pack ever draws.
  // `bar` measures against the largest value on screen, which is the only
  // honest scale for a magnitude with no natural ceiling.
  const values = axes.flatMap((a) => series.map((s) => num(s.entry.profile[a.id])));
  const ceiling = cue.kind === 'bar'
    ? Math.max(...values.filter((v) => v != null), 0) || 1
    : 1;

  const keys = series.map((s) => `
    <span class="chart__key" style="--side: ${esc(sideVar(s.side))}">
      ${esc(pick(s.entry.name))}</span>`).join('');

  const rows = axes.map((axis) => {
    const bars = series.map((s) => {
      const v = num(s.entry.profile[axis.id]);
      // A declared axis this entry does not carry is not zero — it is
      // unmeasured, and drawing it as a floor dot would be a claim.
      if (v == null) return '<span class="chart__bar chart__bar--none"></span>';
      const pct = Math.max(0, Math.min(1, v / ceiling)) * 100;
      // The width is NOT written here — see setWidths(). A bar inserted at
      // its final width never animates at all, because a transition needs a
      // previous computed value and a freshly created element has none.
      return `<span class="chart__bar" data-w="${pct.toFixed(1)}"
                    style="--side: ${esc(sideVar(s.side))}"></span>`;
    }).join('');
    return `
      <div class="chart__row">
        <span class="chart__axis">${esc(pick(axis.label))}</span>
        <span class="chart__track">${bars}</span>
      </div>`;
  }).join('');

  const label = `${series.map((s) => pick(s.entry.name)).join(' / ')}: `
    + axes.map((a) => pick(a.label)).join(', ');

  show(root, `
    <figure class="chart" role="img" aria-label="${esc(label)}">
      <figcaption class="chart__keys">${keys}</figcaption>
      ${rows}
      ${cue.note ? `<p class="chart__note">${esc(pick(cue.note))}</p>` : ''}
    </figure>`, instant);
  setWidths();
}

/**
 * Put every bar at its measured width, synchronously.
 *
 * Rule 2: this is the picture, so it must not wait for a frame. `show()` has
 * already forced one layout with the bars at their stylesheet width of zero,
 * which is what gives the transition a value to grow FROM; setting the width
 * now is the end state whether or not the browser ever paints again. Under
 * `instant` the container carries `is-instant`, which turns the transition
 * off, so the finished bars appear at once — the seek picture.
 */
function setWidths() {
  for (const bar of root.querySelectorAll('.chart__bar[data-w]')) {
    bar.style.width = `${bar.dataset.w}%`;
  }
}

export function hideChart() { root?.classList.remove('is-on'); }

/**
 * Show, with the arrival suppressed when the picture is being rebuilt.
 *
 * The same three lines overlays.js uses, written out here rather than shared:
 * a surface has to be loadable on its own, and importing a helper out of
 * another surface would put `overlays.js` back on every pack's critical path
 * — which is the whole cost this refactor exists to remove.
 */
function show(el, html, instant) {
  if (!el) return;
  el.innerHTML = html;
  if (instant || reduced()) {
    el.classList.add('is-instant', 'is-on');
    // Cosmetic only, so it is allowed to depend on a frame: it decides
    // whether the NEXT arrival animates, not whether this one is drawn.
    requestAnimationFrame(() => el.classList.remove('is-instant'));
  } else {
    el.classList.remove('is-on');
    void el.offsetWidth;            // restart the entry transition
    el.classList.add('is-on');
  }
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pick(field) {
  if (field == null) return '';
  if (typeof field === 'string' || typeof field === 'number') return String(field);
  return field[lang] ?? field.no ?? field.en ?? '';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ------------------------------------------------------------
   The surface
   ------------------------------------------------------------ */

export default {
  id: 'chart',
  // Over a plate (20) and under the overlay decks (30): a chart is the
  // subject of the frame while it is up, and a caption must still read over
  // it. It is a BAND with the same bounds as .ov-deck--mid, so it clears the
  // caption on its own — two surfaces anchored to one edge is a defect this
  // repo has already paid for twice.
  layer: 25,
  verbs: {
    'chart.show': (c, i) => showChart(c, i),
    'chart.hide': ()     => hideChart(),
  },
  mount(container, ch, ctx = {}) { mountChart(container, ch, ctx.lang); return null; },
  reset() { resetChart(); },
  unmount() { unmountChart(); },
};
