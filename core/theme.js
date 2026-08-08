/* ============================================================
   theme.js — one answer to "are we dark right now?"

   The map surfaces each had their own copy reading document.documentElement.
   This one takes an element, so a lab page can put a light map and a dark
   map side by side and have each subtree answer for itself.

   (js/main.js keeps its own isDark(): it answers from state.theme, the
   stored preference, which is a different question from what the DOM says.)
   ============================================================ */

/** True when `el` sits inside a dark subtree. */
export function isDark(el = document.documentElement) {
  const scope = el?.closest?.('[data-theme]') || document.documentElement;
  const attr = scope.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Calls `fn` whenever the effective theme could have changed. Returns an unsubscribe. */
export function watchTheme(fn) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onMq = () => fn();
  mq.addEventListener('change', onMq);

  const obs = new MutationObserver(() => fn());
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return () => { mq.removeEventListener('change', onMq); obs.disconnect(); };
}

/** The one reduced-motion probe. `override` lets a lab page force either state. */
let motionOverride = null;
export function reducedMotion() {
  if (motionOverride !== null) return motionOverride;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function setReducedMotion(v) { motionOverride = v; }
