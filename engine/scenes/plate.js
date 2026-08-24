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
let ghostEl = null;
/* How fast the picture that is currently up is drifting, in scale per second,
   and where it is heading. The ghost needs it: an outgoing frame that FREEZES
   under a moving incoming one is what makes a dissolve look cheap -- the eye
   reads the stillness as a stall. Kept as a rate rather than a timer so it
   survives being recomputed at any moment. */
let drift = { rate: 0, dx: 0, dy: 0 };
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
      <img class="plate__ghost" alt="" aria-hidden="true" decoding="async">
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
  ghostEl = root.querySelector('.plate__ghost');
  showing = null;
}

/**
 * Take the plate down.
 *
 * `soft` fades it; the default cuts it. Both end in exactly the same state,
 * which is what keeps this out of rule 1's way -- the difference is only how
 * long the pixels take to get there.
 *
 * The distinction exists because one function was doing two jobs. A SEEK must
 * land clean and instantly: it is a jump and should look like one. A SCENE
 * CHANGE is not a jump, and cutting there was the "abrupt transitions"
 * complaint -- resetPlate removed `is-on` and cleared `src` in the same turn,
 * so the 0.9 s CSS fade ran on an <img> with no source. The picture vanished
 * on a frame and a blank rectangle faded out after it.
 */
export function resetPlate({ soft = false } = {}) {
  showing = null;
  if (!root) return;
  if (soft && root.classList.contains('is-on')) {
    root.style.setProperty('--plate-out', '0.9s');
    root.classList.remove('is-on');
    // Hold the picture until the fade has run, THEN clear. The token guards
    // against a second reset landing mid-fade and a stale timer wiping the
    // picture the newer scene has already put up.
    const token = (softToken += 1);
    setTimeout(() => { if (token === softToken) hardClear(); }, 950);
    return;
  }
  hardClear();
}

let softToken = 0;

function hardClear() {
  if (!root) return;
  root.classList.remove('is-on');
  imgEl.style.transition = 'none';
  imgEl.style.transform = '';
  imgEl.style.opacity = '';
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
  clearGhost();
  if (capEl) capEl.innerHTML = '';
  if (badgeEl) { badgeEl.textContent = ''; badgeEl.hidden = true; }
}

/* The framings the drift runs between, as [scale, x%, y%].

   Small numbers on purpose. A push from 1.0 to 1.16 over fourteen seconds is
   about half a pixel a frame — present, and invisible while it happens. */
/**
 * Carry the outgoing picture while the new one fades up over it.
 *
 * One <img> meant that replacing a plate was a HARD CUT: src was reassigned
 * and the next frame was a different picture. That is the whole reason
 * check-script forbade two plates in adjacent beats -- the rule was guarding
 * against a missing transition, not against sequences of pictures. A picture
 * story needs sequences, so the transition had to exist before the rule could
 * be relaxed.
 *
 * The ghost is decorative and ALWAYS ends at opacity 0, which is what keeps it
 * out of rule 1. It is never read by the stage signature, it is wiped under
 * `instant`, and nothing about which picture it holds can survive into the
 * next beat. A ghost that could persist would be exactly the accumulating
 * state the whole engine is built to forbid.
 */
function clearGhost() {
  if (!ghostEl) return;
  ghostEl.style.transition = 'none';
  ghostEl.style.opacity = '0';
  ghostEl.style.transform = '';
  ghostEl.removeAttribute('src');
}

/**
 * Where the outgoing picture would have got to, `over` seconds from now.
 *
 * The live transform is a MATRIX, not the `scale(...) translate(...)` that was
 * written -- getComputedStyle resolves it, and percentage translations are
 * already in pixels by the time we read it. So carrying the drift on means
 * scaling the matrix, not editing a string.
 *
 * Scaling the whole matrix by k is exactly right rather than approximately:
 * `scale(s) translate(t%)` composes to a matrix whose translation is s*t, so
 * taking s to s' takes the translation to (s'/s)*(s*t) -- which is what
 * multiplying every component by k does.
 */
function carriedOn(fromTransform, over) {
  if (!fromTransform || fromTransform === 'none') return null;
  let m;
  try { m = new DOMMatrixReadOnly(fromTransform); } catch { return null; }
  if (!m.a || !drift.rate) return null;
  const k = (m.a + drift.rate * over) / m.a;
  return `matrix(${m.a * k}, ${m.b * k}, ${m.c * k}, ${m.d * k}, ${m.e * k}, ${m.f * k})`;
}

function dissolveFrom(prevSrc, prevTransform, over, origin) {
  if (!ghostEl || !prevSrc) return;
  ghostEl.src = prevSrc;
  ghostEl.style.transition = 'none';
  ghostEl.style.transformOrigin = origin || '';
  ghostEl.style.transform = prevTransform || '';
  ghostEl.style.opacity = '1';
  void ghostEl.offsetWidth;
  // The outgoing picture keeps moving at the rate it already had. A dissolve
  // between a moving image and a frozen one reads as a stall, and it is the
  // difference between a transition and a swap.
  const on = carriedOn(prevTransform, over);
  ghostEl.style.transition = on
    ? `opacity ${over}s var(--ease-in-out, ease-in-out), transform ${over}s linear`
    : `opacity ${over}s var(--ease-in-out, ease-in-out)`;
  if (on) ghostEl.style.transform = on;
  ghostEl.style.opacity = '0';
}

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
  const base = fit === 'contain' ? MOTION.still : (MOTION[cue.motion] || MOTION.in);
  // `push` scales how far the camera travels. The default 0.16 is the number
  // that was hard-coded; a wide establishing shot wants more, a face wants
  // almost none. Scaling the SPAN rather than replacing it keeps every
  // existing cue drawing exactly as before.
  const k = Number.isFinite(cue.push) ? cue.push / 0.16 : 1;
  const spec = k === 1 ? base : {
    from: 1 + (base.from - 1) * k,
    to: 1 + (base.to - 1) * k,
    dx: base.dx * k, dy: base.dy * k,
  };
  const [fx, fy] = Array.isArray(cue.focus) ? cue.focus : [0.5, 0.42];
  const over = cue.over ?? 14;

  // Re-showing the same plate must not restart the drift — a beat that keeps
  // the picture up while adding a quote would otherwise snap back to the
  // opening framing mid-sentence.
  const same = showing === cue.id;
  showing = cue.id;

  const prevSrc = imgEl.getAttribute('src');
  // The LIVE transform, not the declared one: mid-drift the inline style still
  // says where the picture is going, and the ghost has to start where it
  // actually IS or the handover jumps by the whole remaining push.
  const prevTransform = getComputedStyle(imgEl).transform;
  const prevOrigin = getComputedStyle(imgEl).transformOrigin;
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
  // Recorded for the NEXT picture's ghost, so the outgoing frame carries on at
  // the speed it was going rather than freezing.
  drift = { rate: over > 0 ? (spec.to - spec.from) / over : 0, dx: spec.dx, dy: spec.dy };

  if (instant || reduced()) {
    // Land on the END framing with no animation. Replaying fourteen seconds
    // of push on every scrub is exactly the thing rule 1 forbids -- and the
    // dissolve is the same argument: a seek is a jump and should look like
    // one, so the ghost is wiped rather than faded.
    clearGhost();
    imgEl.style.transition = 'none';
    imgEl.style.opacity = '1';
    imgEl.style.transform = end;
    root.classList.add('is-instant');
    root.classList.add('is-on');
    requestAnimationFrame(() => root.classList.remove('is-instant'));
    return;
  }

  root.classList.remove('is-instant');
  if (!same) {
    // Replacing a picture that is already up: carry the old one under the new
    // one and fade between them. Replacing nothing (the plate was down) needs
    // no ghost -- the whole plate cross-dissolves from the map already.
    // --t-dissolve. One thing replacing another across the whole frame is
    // one event at one duration, whether it is a plate over a plate or a
    // plate over the map. 1.1 was close and arbitrary; 1.2 is the scale's.
    const over = cue.into ?? 1.2;

    /* IS THE OLD PICTURE STILL ON THE SCREEN -- not "does it still have the
       class that usually means it is".

       Three beats of the wine chapter write "replace this picture" as a
       `plate.hide` and a `plate.show` both at `start` of the same beat, and
       hidePlate() removes `is-on`. So this test was false at the exact moment
       it mattered most, the ghost was skipped, and the replacement became a
       HARD CUT: measured at s0.b3, druer-kasse at scale 1.100 and full
       opacity in one sample, dal-avstengt at scale 1.000 and full opacity in
       the next, with the ghost at 0 throughout. The picture visibly snapped
       back to its opening framing and swapped in one frame -- "at the end of
       that one it is basically rescaling, for a microsecond".

       The class was never the question. The question is whether a viewer can
       still see it, and only the computed style answers that: the fade-out
       may be a frame old or most of a second old, and either way the old
       picture is on screen and has to be carried. This is the same lesson as
       .ov-fact and the scene veil -- a probe that reads a class name is not
       looking at the screen. */
    const cs = getComputedStyle(root);
    const stillUp = cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01;
    if (prevSrc && stillUp) {
      dissolveFrom(prevSrc, prevTransform, over, prevOrigin);
      imgEl.style.transition = 'none';
      imgEl.style.opacity = '0';
      imgEl.style.transform = start;
      void imgEl.offsetWidth;
      imgEl.style.transition = `opacity ${over}s var(--ease-in-out, ease-in-out)`;
      imgEl.style.opacity = '1';
    } else {
      clearGhost();
      imgEl.style.opacity = '1';
      imgEl.style.transition = 'none';
      imgEl.style.transform = start;
      void imgEl.offsetWidth;              // commit the start framing
    }
  }
  const held = imgEl.style.transition;
  imgEl.style.transition = held && held.includes('opacity')
    ? `${held}, transform ${over}s linear`
    : `transform ${over}s linear`;
  imgEl.style.transform = end;
  root.classList.add('is-on');
}

export function hidePlate(cue) {
  if (!root) return;
  showing = null;
  const over = cue?.over ?? 1.2;   // --t-dissolve, as above
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
