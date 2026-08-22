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
      <figcaption class="plate__cap"></figcaption>
    </figure>`;
  container.appendChild(root);
  figEl = root.querySelector('.plate__fig');
  imgEl = root.querySelector('.plate__img');
  capEl = root.querySelector('.plate__cap');
  showing = null;
}

export function resetPlate() {
  showing = null;
  if (!root) return;
  root.classList.remove('is-on');
  imgEl.style.transition = 'none';
  imgEl.style.transform = '';
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

  const spec = MOTION[cue.motion] || MOTION.in;
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
  }
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
}

/* ------------------------------------------------------------ */

/**
 * Where the picture came from.
 *
 * Always rendered, never optional. A public-domain engraving still has an
 * artist and a date worth knowing, and a CC-BY photograph without its
 * attribution is a licence breach — media.json carries both because
 * tools/fetch-media.py captured them at download time.
 */
function creditFor(m) {
  const bits = [pick(m.title)];
  if (m.artist) bits.push(esc(m.artist));
  if (m.year) bits.push(esc(String(m.year)));
  if (m.licence) bits.push(esc(m.licence));
  return bits.filter(Boolean).map(esc).join(' · ');
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
