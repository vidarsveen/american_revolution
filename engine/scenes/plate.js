/* ============================================================
   scenes/plate.js — the picture as the whole stage.

   WHY THIS EXISTS

   The map was the only stage there was. Every moment of every chapter had to
   be expressed as somewhere on a map, and the moments that are not —
   Caesar killed in a room, a will read out in a senate, the Forum as a place
   you should SEE rather than see a dot for — got a small inset card over a
   map that was still the subject of the screen.

   A plate takes the whole frame. The map keeps running underneath and is
   never unmounted: it costs nothing while covered, because paintGround only
   re-bakes when the camera moves, and a camera under a plate does not move.
   Unmounting and remounting it per scene would also re-trigger the "a map
   created while hidden measures zero" hazard that mountMap fires four
   setTimeouts to paper over.

   THE DRIFT

   A still photograph holds attention for about two seconds. The same
   photograph with the camera slowly pushing into it holds it for twelve.
   That is the whole trick of the history documentary, and it is why the
   default `over` here is fourteen seconds — long enough that you cannot see
   the motion happening, only that the picture is alive. Motion you can see
   is motion that distracts.

   RULE 1

   A plate IS stage state: it is a thing that is on the screen at a time, and
   it must be a pure function of when. So:

     * `instant` skips the drift entirely and lands on the END framing —
       the same as a march that draws itself whole when you seek, rather than
       replaying fourteen seconds of push every time you touch the scrubber.
     * reset() takes it down. A plate does not survive a scene change, which
       is correct and is the same discipline as everything else on the stage:
       a scene re-establishes what it inherits.
   ============================================================ */

import { mediaUrl } from '../../core/paths.js';

let root = null;
let figEl = null;
let imgEl = null;
let capEl = null;
let badgeEl = null;
let chapter = null;
let lang = 'no';
let showing = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountPlate(container, ch, language) {
  chapter = ch;
  lang = language;
  root = document.createElement('div');
  root.className = 'stage-plate';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <figure class="plate__fig">
      <img class="plate__img" alt="" decoding="async">
      <span class="plate__dim"></span>
      <span class="plate__badge" aria-hidden="true"></span>
      <figcaption class="plate__cap"></figcaption>
    </figure>`;
  container.appendChild(root);
  figEl = root.querySelector('.plate__fig');
  imgEl = root.querySelector('.plate__img');
  capEl = root.querySelector('.plate__cap');
  badgeEl = root.querySelector('.plate__badge');
  showing = null;
}

export function resetPlate() {
  showing = null;
  if (!root) return;
  root.classList.remove('is-on');
  imgEl.style.transition = 'none';
  imgEl.style.transform = '';
  // Everything this module set, put back. The class and the src used to
  // survive a reset -- invisible, because the plate is hidden either way, but
  // it meant the stage after a seek was not the stage after playing there,
  // and that is the difference rule 1 exists to forbid. The engine lab said
  // so the first time it was allowed to look at plates at all.
  //
  // removeAttribute, not src = '': an empty src resolves to the page URL and
  // sends the browser off to fetch the document as an image.
  root.classList.remove('is-contain');
  imgEl.removeAttribute('src');
  imgEl.alt = '';
  if (capEl) capEl.innerHTML = '';
  if (badgeEl) { badgeEl.textContent = ''; badgeEl.hidden = true; }
}

/* The framings the drift runs between, as [scale, x%, y%].

   Small numbers on purpose. A push from 1.0 to 1.16 over fourteen seconds is
   about half a pixel a frame — present, and invisible while it happens. */
const MOTION = {
  in:    { from: 1.0,  to: 1.16, dx: 0,   dy: 0 },
  out:   { from: 1.16, to: 1.0,  dx: 0,   dy: 0 },
  left:  { from: 1.12, to: 1.12, dx: 3.5, dy: 0 },
  right: { from: 1.12, to: 1.12, dx: -3.5, dy: 0 },
  still: { from: 1.0,  to: 1.0,  dx: 0,   dy: 0 },
};

export function showPlate(cue, instant) {
  const m = (chapter?.media || {})[cue.id];
  if (!m || !root) return;

  /* A letterboxed plate does not drift.

     `contain` is chosen when the whole frame IS the information -- a map, a
     coin, an inscription, a manuscript page. The push is scale 1.16, so on a
     contained picture the camera zooms straight past the edges it was
     letterboxed to protect: the Tacitus page lost its bottom four lines to
     the drift that exists to stop a still looking dead.

     A document is something you READ. Holding it still is not a compromise
     here, it is the correct shot. */
  const fit = cue.fit || m.fit || 'cover';
  const spec = fit === 'contain' ? MOTION.still : (MOTION[cue.motion] || MOTION.in);
  const [fx, fy] = Array.isArray(cue.focus) ? cue.focus : [0.5, 0.42];
  const over = cue.over ?? 14;

  // Re-showing the same plate must not restart the drift — a beat that keeps
  // the picture up while adding a quote would otherwise snap back to the
  // opening framing mid-sentence.
  const same = showing === cue.id;
  showing = cue.id;

  if (!same) {
    imgEl.src = mediaUrl(chapter.pack, m.file);
    imgEl.alt = pick(m.title) || '';
    capEl.innerHTML = creditFor(m);
    const mark = badgeFor(m);
    badgeEl.textContent = mark;
    badgeEl.hidden = !mark;
  }
  // A wide stage crops a tall picture, and for a map or a coin the crop is
  // the whole point of the picture. media.json carries a fit worked out from
  // the image's own shape; a cue may override it. Measured before it was
  // fixed: the 1205x1800 plan of Boston was showing 38% of itself.
  root.classList.toggle('is-contain', fit === 'contain');
  // Aim the zoom at what matters. A face is rarely in the middle of a frame.
  imgEl.style.transformOrigin = `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`;
  root.style.setProperty('--plate-dim', String(cue.dim ?? 0));

  const start = `scale(${spec.from}) translate(${spec.dx}%, ${spec.dy}%)`;
  const end = `scale(${spec.to}) translate(${-spec.dx}%, ${-spec.dy}%)`;

  if (instant || reduced()) {
    // Land on the END framing with no animation. Replaying fourteen seconds
    // of push on every scrub is exactly the thing rule 1 forbids.
    imgEl.style.transition = 'none';
    imgEl.style.transform = end;
    root.classList.add('is-instant');
    root.classList.add('is-on');
    requestAnimationFrame(() => root.classList.remove('is-instant'));
    return;
  }

  root.classList.remove('is-instant');
  if (!same) {
    imgEl.style.transition = 'none';
    imgEl.style.transform = start;
    void imgEl.offsetWidth;              // commit the start framing
  }
  imgEl.style.transition = `transform ${over}s linear`;
  imgEl.style.transform = end;
  root.classList.add('is-on');
}

export function hidePlate(cue) {
  if (!root) return;
  showing = null;
  const over = cue?.over ?? 0.9;
  root.style.setProperty('--plate-out', `${over}s`);
  root.classList.remove('is-on');
  // Clear the badge too. Leaving it set is invisible — the whole plate is at
  // opacity 0 — but it is stale stage state, and the next picture would carry
  // the previous one's mark through the cross-dissolve before showPlate()
  // gets to it. "Invisible rather than missing" is how the stats deck hid
  // behind the caption box for months.
  if (badgeEl) { badgeEl.textContent = ''; badgeEl.hidden = true; }
}

/* ------------------------------------------------------------ */

/**
 * Where the picture came from.
 *
 * Always rendered, never optional. A public-domain engraving still has an
 * artist and a date worth knowing, and a CC-BY photograph without its
 * attribution is a licence breach — media.json carries both because
 * tools/fetch-media.py captured them at download time.
 *
 * artist/year/licence used to be esc()'d on the way into the array AND again
 * by the map() below, so an artist called O'Brien rendered as O&amp;#39;Brien.
 * Escape once, at the end.
 */
function creditFor(m) {
  const bits = [pick(m.title)];
  if (m.artist) bits.push(m.artist);
  if (m.year) bits.push(String(m.year));
  if (m.licence) bits.push(m.licence);
  return bits.filter(Boolean).map(esc).join(' · ');
}

/* The words on the badge. Deliberately in the reader's own language and
   deliberately short: a mark nobody can read is not a disclosure. */
const MADE_LABEL = {
  no: { drawn: 'Tegnet', generated: 'Generert bilde' },
  en: { drawn: 'Drawn', generated: 'Generated image' },
};

/**
 * The mark on a picture that is not a record.
 *
 * ON the picture, not in the caption and not in a dossier: a disclosure
 * nobody opens has not disclosed anything. An `archive` entry gets nothing —
 * a real photograph should not be labelled as if it were in doubt.
 *
 * This is derived from the media entry and nothing else, which is what makes
 * it safe under rule 1: showPlate() is replayed on every seek, and a badge
 * that is a pure function of `m` lands identically every time. Anything that
 * counted, toggled or animated here would be the musket problem again.
 */
function badgeFor(m) {
  if (m.kind !== 'made') return '';
  const words = MADE_LABEL[lang] || MADE_LABEL.en;
  return esc(m.method === 'svg' ? words.drawn : words.generated);
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
