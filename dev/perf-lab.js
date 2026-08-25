/* ============================================================
   perf-lab.js — drives the bench.

   ONE question, and it is falsifiable: during a six-level flight, what is the
   longest single frame and how many times was the ground re-baked?

   dev/map-lab.js's panTest() holds the zoom fixed at 10.4 and drags. That is a
   real question about blank tiles and it has never once touched this path —
   every cost measured here comes from the zoom CHANGING, which is what makes
   the offscreen ground buffer stale.

   It instruments the real module (map.bench.profile) rather than a copy, and
   it loads a real pack's levels and detail file, because the whole complaint
   lives at Boston-harbour zoom where atlantic-10m and the pack's detail.json
   are both on screen at once. A bench on world-110m would measure nothing.
   ============================================================ */

import { createMap } from '../map/index.js';
import { registerLevels } from '../map/basemap.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------
   A real pack, or this measures the wrong map
   ------------------------------------------------------------ */

const packs = await fetch('../content/packs.json').then((r) => r.json());
const manifests = Object.fromEntries(await Promise.all(packs.map(async (id) =>
  [id, await fetch(`../content/${id}/pack.json`).then((r) => r.json())])));

/* Which pack to measure MATTERS, and getting it wrong is silent.
   The first run of this bench took packs[0] the way dev/map-lab.js does, got
   the Roman pack, flew to Boston — which is outside the Mediterranean
   extract — and measured world-50m: 0.1 ms a bake and nothing to fix. The
   default here is therefore the first pack that ships its OWN close-in
   geometry, because that is the only configuration where the complaint
   exists. ?pack=<id> picks another. */
const packId = new URLSearchParams(location.search).get('pack')
  || packs.find((id) => manifests[id]?.map?.detail)
  || packs[0];
const manifest = manifests[packId];
const conf = manifest.map || {};
if (conf.basemap?.levels) registerLevels(conf.basemap.levels);

const map = createMap($('#map'), {
  center: conf.home || [40, -74],
  zoom: conf.zoom?.default ?? 10.5,
  minZoom: conf.zoom?.min ?? 2,
  maxZoom: conf.zoom?.max ?? 15,
  geoBase: '../assets/geo',
  detail: conf.detail
    ? { ...conf.detail, url: `../content/${packId}/${conf.detail.url}` }
    : null,
  credit: conf.credit || 'Natural Earth',
});
map.setBorders(conf.borders || {});
window.map = map;

/* The two ends of the flight, in the pack's own geography rather than in
   Boston's: `IN` is where its detail file is worth loading and `OUT` is 6.4
   zoom levels back and a few degrees away, so the move is a zoom AND a
   translation — a pure zoom keeps the buffer covering the viewport for free
   and would flatter the result. */
const HOME = conf.home || [40, -74];
const inZoom = Math.min(conf.zoom?.max ?? 15, (conf.detail?.minZoom ?? 9.5) + 2.1);
const outZoom = Math.max(conf.zoom?.min ?? 2, inZoom - 6.4);
const IN = { to: HOME, zoom: inZoom };
const OUT = { to: [HOME[0] + 2.0, HOME[1] - 5.0], zoom: outZoom };
$('.panel p.sub').insertAdjacentHTML('beforeend',
  `<br><b>${packId}</b> — ${outZoom.toFixed(1)} → ${inZoom.toFixed(1)}, ` +
  `${conf.detail ? 'med' : 'uten'} egen detaljgeometri.`);

/* ------------------------------------------------------------
   Measuring
   ------------------------------------------------------------ */

/**
 * Watch the frame clock from outside the module as well as inside it.
 *
 * map.bench.profile() times the work the module does per frame. This times the
 * GAP between frames, which is what a viewer actually sees: a bake that blocks
 * for 118 ms shows up here as one 118 ms hole whoever's task it happened in.
 * Two numbers rather than one, because a fix that only moves the work into
 * another task would flatter the first and not the second.
 */
function frameClock() {
  let stop = false, last = performance.now(), max = 0, n = 0, over32 = 0;
  const tick = () => {
    if (stop) return;
    const t = performance.now();
    const gap = t - last;
    last = t;
    n += 1;
    if (n > 1) {                      // the first gap includes the setup call
      if (gap > max) max = gap;
      if (gap > 32) over32 += 1;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { stop = true; return { maxGapMs: max, gapsOver32: over32, frames: n }; };
}

/** Resolve once the camera has held still for a beat. */
async function settled(quietMs = 300, limit = 9000) {
  const t0 = performance.now();
  let last = '', still = 0;
  while (performance.now() - t0 < limit) {
    const c = map.camera();
    const key = `${c.lat.toFixed(6)},${c.lon.toFixed(6)},${c.zoom.toFixed(4)}`;
    still = key === last ? still + 50 : 0;
    last = key;
    if (still >= quietMs) return;
    await wait(50);
  }
}

/**
 * Resolve once the ground is baked at the zoom the camera is actually at.
 *
 * Not a delay. For 400 ms after a move the bake is the quantised one, and a
 * grab on a timer catches whichever of the two the timer happened to land
 * on — which is a real difference in the pixels and nothing to do with what
 * the pixel test is asking about.
 */
async function groundSettled(limit = 6000) {
  const t0 = performance.now();
  while (performance.now() - t0 < limit) {
    if (map.bench.groundSettled()) { await wait(60); return; }
    await wait(40);
  }
  console.warn('[perf-lab] the ground never settled');
}

/** Everything fetched and baked, so a measurement is about drawing, not network. */
async function warm() {
  await map.setView(IN.to[0], IN.to[1], IN.zoom);
  for (let i = 0; i < 60 && !map.ready(); i++) await wait(100);
  await wait(1400);                    // the detail file, and its first bake
  await map.setView(OUT.to[0], OUT.to[1], OUT.zoom);
  await wait(400);
}

function report(rows) {
  const cells = (r) => `<td>${r.longestFrameMs.toFixed(1)}</td><td>${r.maxGapMs.toFixed(1)}</td>` +
    `<td>${r.maxSliceMs.toFixed(1)}</td><td>${r.bakes} (${r.bakesSync})</td>` +
    `<td>${fmtK(r.points)}</td>`;
  $('#out').innerHTML =
    '<table class="res"><thead><tr><th>Måling</th><th>lengste bilde</th>' +
    '<th>lengste hull</th><th>lengste bakestykke</th><th>bakinger (i bildet)</th>' +
    '<th>punkter/bak</th></tr></thead><tbody>' +
    rows.map((r) => `<tr><td>${r.name}</td>${cells(r)}</tr>`).join('') +
    '</tbody></table>' +
    `<div style="margin-top:6px">Synkrone bakinger: ${rows.map((r) => r.why).join(' · ')}</div>` +
    (rows.some((r) => r.note) ? `<div style="margin-top:6px">${rows.map((r) => r.note).filter(Boolean).join('<br>')}</div>` : '');
}

const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

/**
 * Run one measurement.
 *
 * `body` moves the camera; everything else is bookkeeping. Both clocks are
 * started after the camera is already where the move begins, so neither
 * counts the set-up.
 */
async function measure(name, body) {
  await settled();
  await wait(120);
  map.bench.profile(true);
  const stopClock = frameClock();
  await body();
  const gaps = stopClock();
  const p = map.bench.profile(false);
  return {
    name,
    longestFrameMs: p.maxDrawMs,
    maxGapMs: gaps.maxGapMs,
    gapsOver32: gaps.gapsOver32,
    framesOver32: p.over32,
    frames: p.frames,
    bakes: p.bakes,
    bakesSync: p.bakesSync,
    bakeMs: p.bakeMs,
    maxBakeMs: p.maxBakeMs,
    // The one that decides whether the movement is continuous: the longest a
    // single task of baking held the thread.
    maxSliceMs: p.maxSliceMs,
    slices: p.slices,
    why: `dekning ${p.syncCover} (z ${p.syncAt.join(', ')}), bakke ${p.syncReady}, annet ${p.syncOther}`,
    points: p.bakes ? p.points / p.bakes : 0,
    features: p.bakes ? p.features / p.bakes : 0,
    culled: p.bakes ? p.culled / p.bakes : 0,
  };
}

/* ------------------------------------------------------------
   The three moves
   ------------------------------------------------------------ */

const RUNS = {
  /** The one the question is about: 6.4 zoom levels, in one flight. */
  async flight() {
    await map.setView(OUT.to[0], OUT.to[1], OUT.zoom);
    await wait(500);
    return measure(`Flyvning ${outZoom.toFixed(1)} → ${inZoom.toFixed(1)}`, async () => {
      await map.flyTo({ ...IN, over: 2.8 });
      await wait(600);                 // let the settling bake land in the count
    });
  },

  /** Twelve discrete notches, the gesture that used to cost a bake each. */
  async wheel() {
    await map.setView(HOME[0], HOME[1], inZoom - 2.6);
    await wait(500);
    const host = map.el();
    const r = () => host.getBoundingClientRect();
    const res = await measure('Hjul, 12 hakk', async () => {
      for (let i = 0; i < 12; i++) {
        const b = r();
        host.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -100, deltaMode: 0, bubbles: true, cancelable: true,
          clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
        }));
        await wait(90);
      }
      await wait(700);
    });
    res.note = await wheelParity(host);
    return res;
  },

  /** A pinch is a zoom that changes every frame and never settles until it does. */
  async pinch() {
    await map.setView(HOME[0], HOME[1], inZoom - 2.4);
    await wait(500);
    return measure(`Klype ${(inZoom - 2.4).toFixed(1)} → ${(inZoom + 0.6).toFixed(1)}`, async () => {
      const t0 = performance.now();
      const DUR = 1600, from = inZoom - 2.4, to = inZoom + 0.6;
      for (;;) {
        const t = (performance.now() - t0) / DUR;
        if (t >= 1) break;
        map.setView(HOME[0], HOME[1], from + (to - from) * t);
        await new Promise(requestAnimationFrame);
      }
      map.setView(HOME[0], HOME[1], to);
      await wait(700);
    });
  },

  /**
   * What one bake costs, culled against whole.
   *
   * Separate from the three moves above because it is the only number that
   * isolates the culling: same camera, same buffer, same everything, twice.
   * If turning culling off does not make this worse, the culling is not doing
   * anything and every other number here is measuring something else.
   */
  async cost() {
    const at = [
      ['Utsyn', OUT.to, outZoom],
      ['Nært', HOME, inZoom],
    ];
    const lines = [];
    for (const [label, to, z] of at) {
      await map.setView(to[0], to[1], z);
      await wait(500);
      map.bench.setCulling(false);
      await wait(200);
      const whole = [];
      for (let i = 0; i < 5; i++) whole.push(map.bench.bakeCost().ms);
      map.bench.setCulling(true);
      await wait(200);
      const culled = [];
      for (let i = 0; i < 5; i++) culled.push(map.bench.bakeCost().ms);
      const mid = (a) => a.sort((p, q) => p - q)[a.length >> 1];
      lines.push(`${label} z${z.toFixed(1)}: hel bake ${mid(whole).toFixed(1)} ms, ` +
        `kulla ${mid(culled).toFixed(1)} ms — ${(mid(whole) / mid(culled)).toFixed(2)}× raskere`);
    }
    $('#out').innerHTML = lines.join('<br>');
    return lines;
  },

  async all() {
    const rows = [];
    await warm();
    rows.push(await RUNS.flight());
    rows.push(await RUNS.wheel());
    rows.push(await RUNS.pinch());
    return rows;
  },

  /**
   * Does culling draw the same ground?
   *
   * The point of the question: a bake that skips a feature it should have
   * drawn loses land or loses water, and the only honest place to ask is the
   * pixels. Two bakes at the same camera, one culled and one whole, and the
   * culled one must not have lost any GROUND — see diffOf for why "identical
   * bytes" is the wrong bar and what replaced it.
   */
  async pixels() {
    const views = [
      ['Utsyn', OUT.to, outZoom],
      ['Midtveis', [(OUT.to[0] + HOME[0]) / 2, (OUT.to[1] + HOME[1]) / 2],
       (outZoom + inZoom) / 2],
      ['Nært', HOME, inZoom],
      ['Nærmest', HOME, Math.min(conf.zoom?.max ?? 15, inZoom + 1.6)],
    ];
    const grab = () => {
      const c = map.canvas;
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const shot = async (cull, inset) => {
      map.bench.setCulling(cull, inset);
      await groundSettled();
      return grab();
    };

    /**
     * Tell a lost feature from a shifted edge.
     *
     * Byte equality is the wrong bar, and finding that out cost an hour: the
     * culled and the whole bake differ by about 2,700 scattered pixels, every
     * one of them ON a coastline or a river that both bakes drew. Two
     * different Path2D objects covering the same ground do not have to
     * antialias it the same way, and half a shade along one edge pixel is not
     * a defect.
     *
     * A LOST feature is not like that. It is a solid patch, so its differing
     * pixels have differing neighbours. Erode the difference — keep only
     * pixels whose eight neighbours ALL differ — and a line disappears while
     * a missing island survives whole. Eight and not four: a lake shore is
     * stroked at 1.8 device pixels, and a two-pixel line has a surviving core
     * under a four-neighbour test. That left sixteen pixels standing on Lake
     * Champlain's edge and looked like a defect for half an hour; they were
     * the shore, drawn in both bakes, antialiased differently.
     *
     * That is the number that has to be zero, and `falsify` below is the
     * proof that it can move.
     */
    const diffOf = (a, b, w, h) => {
      const mask = new Uint8Array(w * h);
      let raw = 0;
      for (let i = 0, p = 0; i < a.length; i += 4, p += 1) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] ||
            a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) { mask[p] = 1; raw += 1; }
      }
      let solid = 0;
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const p = y * w + x;
          if (mask[p] && mask[p - 1] && mask[p + 1] && mask[p - w] && mask[p + w]
              && mask[p - w - 1] && mask[p - w + 1]
              && mask[p + w - 1] && mask[p + w + 1]) solid += 1;
        }
      }
      return { raw: raw / (w * h) * 100, solid };
    };

    const c = map.canvas;
    const [w, h] = [c.width, c.height];
    const lines = [];
    let worst = 0;
    for (const [label, at, z] of views) {
      await map.setView(at[0], at[1], z);
      const whole = await shot(false, 0);
      const culled = await shot(true, 0);
      const d = diffOf(whole, culled, w, h);
      worst = Math.max(worst, d.solid);
      lines.push(`${label} z${z.toFixed(1)}: ${d.solid} px tapt ` +
        `(kantstøy ${d.raw.toFixed(3)} %)`);
    }
    map.bench.setCulling(true, 0);
    $('#out').innerHTML = (worst === 0
      ? '<b class="ok">Ingen flate tapt</b> — kulling tegner samme bakke.<br>'
      : `<b class="bad">${worst} piksler tapt</b> — kulling fjerner noe som er i bildet.<br>`) +
      lines.join('<br>');
    return { worstCullPx: worst, lines };
  },
};

/**
 * Put the OTHER bug back: bake inside the frame, whole, the way it was.
 *
 * The flight is run twice, with nothing different but where the bake happens.
 * If the frame clock cannot tell the two apart then it is not measuring the
 * thing the whole change was for, and every number it has reported is
 * decoration.
 */
RUNS.falsifyFrames = async function falsifyFrames() {
  await warm();
  map.bench.setDefer(false);
  map.bench.setQuantise(0);
  const before = await RUNS.flight();
  map.bench.setDefer(true);
  map.bench.setQuantise(0.5);
  const after = await RUNS.flight();
  before.name = 'Bakt i bildet (gammelt)';
  after.name = 'Bakt ved siden av (nytt)';
  report([before, after]);
  /* Counted in frames that stopped, not in the longest one. The longest is
     still the same in both, because one bake in a six-level flight cannot be
     deferred at all — the buffer stops covering the frame and the edges would
     be blank — and that single 80 ms hole sits in either column. What the
     change actually bought is how MANY times the picture stops: seven, or
     one. A pass that only looked at the worst frame would call this no
     improvement, which is why it does not. */
  const good = before.framesOver32 >= 5
    && after.framesOver32 * 3 <= before.framesOver32;
  $('#out').insertAdjacentHTML('beforeend', good
    ? `<div style="margin-top:6px"><b class="ok">Klokka ser det</b> — ` +
      `${before.framesOver32} stoppede bilder ble ${after.framesOver32}.</div>`
    : `<div style="margin-top:6px"><b class="bad">Klokka ser det ikke</b> — ` +
      `${before.framesOver32} mot ${after.framesOver32}.</div>`);
  return { before, after, good };
};

/**
 * Put the bug back, and watch the pixel test fail.
 *
 * A bench nobody has seen fail is a bench nobody knows works. This one culls
 * 240 CSS pixels further in than it should, which drops features that are
 * plainly on screen, and the eroded difference must go from zero to
 * thousands. If it does not, the pixel test above is measuring nothing and
 * every "identical" it has ever reported was worthless — which is exactly
 * what happened to check-plate.py, passing cleanly on the bug it was written
 * for.
 */
RUNS.falsify = async function falsify() {
  const grab = () => {
    const c = map.canvas;
    return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  };
  const c = map.canvas;
  const [w, h] = [c.width, c.height];
  const solidOf = (a, b) => {
    const mask = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < a.length; i += 4, p += 1) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) mask[p] = 1;
    }
    let solid = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const p = y * w + x;
        if (mask[p] && mask[p - 1] && mask[p + 1] && mask[p - w] && mask[p + w]
            && mask[p - w - 1] && mask[p - w + 1]
            && mask[p + w - 1] && mask[p + w + 1]) solid += 1;
      }
    }
    return solid;
  };

  await map.setView(HOME[0], HOME[1], inZoom);
  map.bench.setCulling(false);
  await groundSettled();
  const whole = grab();

  map.bench.setCulling(true, 0);
  await groundSettled();
  const honest = solidOf(whole, grab());

  map.bench.setCulling(true, 240);
  await groundSettled();
  const overCulled = solidOf(whole, grab());

  map.bench.setCulling(true, 0);
  await groundSettled();

  const good = honest === 0 && overCulled > 1000;
  $('#out').innerHTML = (good
    ? '<b class="ok">Målingen virker</b> — '
    : '<b class="bad">Målingen ser det ikke</b> — ') +
    `ærlig kulling ${honest} px tapt, 240 px for mye: ${overCulled} px tapt.`;
  return { honest, overCulled, good };
};

/**
 * Chrome sends deltaMode 0 and Firefox deltaMode 1 for the same flick of the
 * same wheel. Reported here rather than asserted, because the honest bar is
 * "the two are within a factor of two of each other", not a fixed number.
 */
async function wheelParity(host) {
  const zoomOf = () => map.camera().zoom;
  const notch = async (deltaY, deltaMode) => {
    await map.setView(HOME[0], HOME[1], inZoom - 2.6);
    await wait(260);
    const before = zoomOf();
    const b = host.getBoundingClientRect();
    host.dispatchEvent(new WheelEvent('wheel', {
      deltaY, deltaMode, bubbles: true, cancelable: true,
      clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
    }));
    await settled(200, 2000);
    return zoomOf() - before;
  };
  const px = await notch(-100, 0);
  const line = await notch(-3, 1);
  const ratio = line ? Math.abs(px / line) : Infinity;
  return `Ett hakk: piksel-modus ${px.toFixed(3)} nivå, linje-modus ${line.toFixed(3)} nivå ` +
    `— forhold ${ratio.toFixed(2)}×.`;
}

/* ------------------------------------------------------------
   Wiring
   ------------------------------------------------------------ */

let busy = false;

async function run(name) {
  if (busy) return null;
  busy = true;
  $('#out').textContent = 'Måler…';
  try {
    const res = name === 'all' ? await RUNS.all() : await RUNS[name]();
    // `cost` and `pixels` write their own output; the three moves share a table.
    if (Array.isArray(res) && res[0]?.name) report(res);
    else if (res && res.name) report([res]);
    return res;
  } finally {
    busy = false;
  }
}

/** So a headless driver can ask the same questions the buttons ask. */
window.perfRun = run;
window.perfSetCulling = (on) => map.bench.setCulling(on);
window.perfSetQuantise = (v) => map.bench.setQuantise(v);
window.perfWarm = warm;

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.run) return void run(b.dataset.run);
  if (b.dataset.frame) {
    $('#frame').className = `frame ${b.dataset.frame === 'full' ? '' : b.dataset.frame}`;
    for (const x of document.querySelectorAll('#frameBtns button')) x.classList.remove('on');
    b.classList.add('on');
    setTimeout(() => map.invalidate(), 260);
  }
  if (b.dataset.bug) {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    if (b.dataset.bug === 'cull') map.bench.setCulling(on);
    else map.bench.setQuantise(on ? 0.5 : 0);
  }
});

/* HUD */
(function tick() {
  const c = map.camera();
  $('#hudZoom').textContent = `z ${c.zoom.toFixed(2)}`;
  $('#hudPos').textContent = `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`;
  const p = map.bench.profile();
  $('#hudBake').textContent = `${p.bakes} bakinger`;
  requestAnimationFrame(tick);
}());
