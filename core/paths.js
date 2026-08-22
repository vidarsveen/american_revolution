/* ============================================================
   paths.js — where a pack's files are.

   One function per kind of asset, so moving any of them is one edit rather
   than a grep. Portraits are the reason this exists: they lived in a global
   assets/portraits/, which is fine while there is one subject and wrong the
   moment there are two — the Roman pack has its own Caesar and no interest
   in ours.

   Everything is relative. GitHub Pages serves this from a subdirectory, so an
   absolute path works locally and 404s in production.
   ============================================================ */

/** The root a pack's own files hang off. */
export function packBase(pack) {
  return `./content/${pack}`;
}

/** Any file inside a pack, by its pack-relative path. */
export function packUrl(pack, rel) {
  if (!rel) return null;
  return `${packBase(pack)}/${String(rel).replace(/^\.?\//, '')}`;
}

/** An image from the pack's media.json. */
export function mediaUrl(pack, file) {
  return file ? packUrl(pack, `media/${file}`) : null;
}

/**
 * A face. `dir` comes from pack.json's pools, so a pack can put them anywhere.
 *
 * Returns null when a person has no portrait, which is the caller's cue to
 * draw the placeholder. Do NOT ask this for a *base* by passing an empty
 * file: it answers null, and interpolating that gives src="nulloctavian.jpg" —
 * a broken image with nothing in the console. Use packUrl(pack, dir).
 */
export function portraitUrl(pack, file, dir = 'portraits/') {
  return file ? packUrl(pack, `${dir}${file}`) : null;
}

/** A chapter script, and the timing file that goes with it. */
export function chapterUrl(pack, chapterId) {
  return packUrl(pack, `${chapterId}.json`);
}

export function timingUrl(pack, chapterId, lang) {
  // Keyed by chapter as well as language: scene ids restart at s0 in every
  // chapter, so one file per pack had chapter two overwriting chapter one,
  // silently, because the wrong file still parses and still has an s0.
  return packUrl(pack, `timing.${chapterId}.${lang}.json`);
}
