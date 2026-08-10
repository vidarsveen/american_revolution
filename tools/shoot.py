#!/usr/bin/env python3
"""
Look at the app the way a phone sees it.

    python tools/shoot.py                       # contact sheet, Norwegian, light
    python tools/shoot.py --chapter bunkerhill  # the other narrated chapter
    python tools/shoot.py --theme dark --lang en
    python tools/shoot.py --only s3 s5          # just those scenes
    python tools/shoot.py --strip fold          # frames across one transition
    python tools/shoot.py --list                # what moments exist

Writes PNGs to shots/<run>/ and composites a labelled contact sheet at
shots/<run>/contact.png, which is the thing to actually open and look at.

Why this exists: driving the app through an occluded browser tab gave zero
animation frames, throttled timers and screenshots that timed out, so layout
had to be inferred from getBoundingClientRect() numbers. Two instructions were
missed that way. Headless Chromium renders properly, runs animations and takes
real screenshots, so the UI can be judged by looking at it.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import socket
import socketserver
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'shots')
CHAPTERS = {
    'lexington': 'american-revolution/chapter-1775-04-19',
    'bunkerhill': 'american-revolution/chapter-1775-06-17',
}

# Each moment is (key, beat id, seconds into that beat, caption). Chosen to
# cover every kind of thing the stage can put on screen.
#
# No scene index: it used to sit here beside the beat id and the two drifted
# apart the day scene 0 was added, so half the sheet was labelled with the
# wrong moment — and a sheet with a plausible picture under every caption
# looks fine. The beat id already knows which scene it belongs to.
MOMENTS = {
 'lexington': [
    ('cover',     None,      0.0,  'Cover'),
    ('s1-open',   's1.b1',   3.0,  'S1 opening, night'),
    ('s1-gage',   's1.b3',   3.5,  'S1 portrait: Gage'),
    ('s1-marg',   's1.b6',   6.5,  'S1 portrait: Margaret'),
    ('s1-route',  's1.b9',   3.0,  'S1 the march out'),
    ('s2-lantern','s2.b1',   6.0,  'S2 two lanterns'),
    ('s2-revere', 's2.b3',   6.0,  'S2 portrait + ride'),
    ('s2-taken',  's2.b8',   7.0,  'S2 Revere taken'),
    ('s3-dawn',   's3.b1',   2.0,  'S3 dawn'),
    ('s3-parker', 's3.b3',   5.0,  'S3 portrait: Parker'),
    ('s3-77',     's3.b4',   4.0,  'S3 77 vs 700'),
    ('s3-plate',  's3.b10',  4.0,  'S3 Doolittle plate I'),
    ('s3-dead',   's3.b11',  4.5,  'S3 8 dead / 1 wounded'),
    ('s4-concord','s4.b2',   3.0,  'S4 searching Concord'),
    ('s4-bridge', 's4.b9',   3.0,  'S4 the bridge'),
    ('s5-road',   's5.b1',   3.0,  'S5 the road back'),
    ('s5-towns',  's5.b4',   9.6,  'S5 towns converging'),
    ('s5-losses', 's5.b12',  6.0,  'S5 the butcher bill'),
    ('s6-siege',  's6.b3',   3.0,  'S6 15 000 around Boston'),
    ('s7-quote',  's7.b2',   6.0,  'S7 the Percy quote'),
 ],
 'bunkerhill': [
    ('cover',     None,      0.0,  'Cover'),
    ('s0-siege',  's0.b5',   4.0,  'S0 the arc around Boston'),
    ('s0-three',  's0.b7',   5.0,  'S0 three generals arrive'),
    ('s1-hills',  's1.b3',   5.0,  'S1 the two hills'),
    ('s2-march',  's2.b4',   5.0,  'S2 out over the neck at night'),
    ('s2-redoubt','s2.b10',  6.0,  'S2 the redoubt at first light'),
    ('s3-guns',   's3.b3',   4.0,  'S3 the batteries open'),
    ('s3-willard','s3.b8',   3.0,  'S3 will he fight?'),
    ('s4-clinton','s4.b2',   6.0,  'S4 the plan not taken'),
    ('s4-landing','s4.b5',   4.0,  'S4 1500 ashore'),
    ('s4-line',   's4.b8',   6.0,  'S4 breastwork and rail fence'),
    ('s4-wall',   's4.b11',  4.0,  "S4 Stark's stone wall"),
    ('s4-burning','s4.b13',  4.0,  'S4 Charlestown burning'),
    ('s5-whites', 's5.b5',   4.0,  'S5 the whites of their eyes'),
    ('s5-flank',  's5.b7',   5.0,  'S5 along the beach'),
    ('s5-assault','s5.b11',  6.0,  'S5 up at the redoubt'),
    ('s5-retreat','s5.b16',  6.0,  'S5 out across the neck'),
    ('s6-warren', 's6.b7',   5.0,  'S6 Warren'),
    ('s7-price',  's7.b2',   6.0,  'S7 the butcher bill'),
    ('s7-three',  's7.b10',  5.0,  'S7 three colonies'),
 ],
}

# Named transitions for --strip
STRIPS = {
    'fold':     'open the controls, then let them fold',
    'portrait': 'a portrait arriving',
    'route':    'a march drawing itself',
    'converge': 'lines coming in from the towns',
}


# ----------------------------------------------------------------------------
# A server, so the script needs nothing running beforehand
# ----------------------------------------------------------------------------

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


Handler.extensions_map.update({
    '.geojson': 'application/json',
    '.webmanifest': 'application/manifest+json',
})


def serve(directory):
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    httpd = socketserver.ThreadingTCPServer(
        ('127.0.0.1', port), functools.partial(Handler, directory=directory))
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{port}/'


# ----------------------------------------------------------------------------
# Driving the app
# ----------------------------------------------------------------------------

BOOTED = "() => !!document.querySelector('#story-map') && !document.querySelector('.boot')"

GOTO = """
async ([beatId, offset, sceneHint]) => {
  const S = await import('./engine/story.js');
  const p = S.getPlayer(), ch = S.getChapter();
  if (!p) return 'no player';
  let at = offset, si = sceneHint ?? 0;
  if (beatId) {
    let found = false;
    ch.scenes.forEach((s, i) => s.beats.forEach((b) => {
      if (b.id === beatId) { at = b.start + offset; si = i; found = true; }
    }));
    if (!found) return `no beat ${beatId}`;
  }
  await p.goToScene(si, { autoplay: false, at });
  S.storyInvalidate();
  return 'ok';
}
"""

OPEN_CHAPTER = """
async (index) => {
  const rows = document.querySelectorAll('.cover__chapter');
  if (index === 0 || !rows.length) return rows.length;
  rows[index].click();
  return rows.length;
}
"""


def open_page(pw, url, lang, theme, tall):
    device = dict(pw.devices['iPhone 14 Pro'])
    if tall:
        # The device profile assumes browser chrome. Added to the home screen
        # there is none, which is how this is meant to be used.
        device['viewport'] = {'width': 393, 'height': 852}
    browser = pw.chromium.launch()
    ctx = browser.new_context(**device, locale='nb-NO' if lang == 'no' else 'en-GB')
    ctx.add_init_script(
        "localStorage.setItem('revolusjonen:prefs', JSON.stringify(%s));"
        % ('{"lang":"%s","theme":"%s"}' % (lang, theme))
    )
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text[:160]}')
            if m.type in ('error', 'warning') else None)
    page.on('requestfailed', lambda r: errors.append(f'failed: {r.url[-70:]}'))
    page.goto(url, wait_until='networkidle')
    page.wait_for_function(BOOTED, timeout=20000)
    page.wait_for_timeout(1200)          # let tiles settle
    return browser, page, errors


def dismiss_cover(page):
    page.evaluate("() => document.querySelector('.story__cover')?.classList.remove('is-on')")


# ----------------------------------------------------------------------------
# Contact sheet
# ----------------------------------------------------------------------------

def contact_sheet(paths_and_labels, out, cols=5, cell_w=300):
    from PIL import Image, ImageDraw, ImageFont

    try:
        font = ImageFont.truetype('seguisb.ttf', 15)
        small = ImageFont.truetype('segoeui.ttf', 13)
    except OSError:
        font = small = ImageFont.load_default()

    shots = [(Image.open(p), lab) for p, lab in paths_and_labels]
    if not shots:
        return
    ratio = shots[0][0].height / shots[0][0].width
    cell_h = int(cell_w * ratio)
    bar, pad = 30, 14
    rows = (len(shots) + cols - 1) // cols
    W = cols * (cell_w + pad) + pad
    H = rows * (cell_h + bar + pad) + pad

    sheet = Image.new('RGB', (W, H), (26, 26, 30))
    draw = ImageDraw.Draw(sheet)
    for i, (im, label) in enumerate(shots):
        r, c = divmod(i, cols)
        x = pad + c * (cell_w + pad)
        y = pad + r * (cell_h + bar + pad)
        sheet.paste(im.resize((cell_w, cell_h), Image.LANCZOS), (x, y))
        draw.rectangle([x, y + cell_h, x + cell_w, y + cell_h + bar], fill=(38, 38, 44))
        draw.text((x + 8, y + cell_h + 7), label, font=small, fill=(226, 222, 214))
    sheet.save(out)
    return sheet.size


# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--chapter', default='lexington', choices=sorted(MOMENTS),
                    help='which narrated chapter to walk through')
    ap.add_argument('--lang', default='no', choices=['no', 'en'])
    ap.add_argument('--theme', default='light', choices=['light', 'dark'])
    ap.add_argument('--only', nargs='*', metavar='KEY',
                    help='moment keys or scene ids, e.g. --only s3 s5-towns')
    ap.add_argument('--strip', choices=sorted(STRIPS), help='frames across one transition')
    ap.add_argument('--frames', type=int, default=6, help='frames for --strip')
    ap.add_argument('--browser-chrome', action='store_true',
                    help='shorter viewport, as if inside Safari')
    ap.add_argument('--out', default=None, help='output folder name under shots/')
    ap.add_argument('--list', action='store_true')
    args = ap.parse_args()

    if args.list:
        for chapter, moments in MOMENTS.items():
            print(f'{chapter}:')
            for k, bid, off, cap in moments:
                print(f'  {k:12} {bid or "-":9} +{off:<5} {cap}')
        print('\nstrips:')
        for k, v in STRIPS.items():
            print(f'  {k:12} {v}')
        return 0

    from playwright.sync_api import sync_playwright

    run = args.out or (f'{args.chapter}-{args.lang}-{args.theme}'
                       + ('-' + args.strip if args.strip else ''))
    outdir = os.path.join(SHOTS, run)
    os.makedirs(outdir, exist_ok=True)

    httpd, url = serve(ROOT)
    print(f'serving {url}   ->  shots/{run}/')

    made = []
    t0 = time.time()
    with sync_playwright() as pw:
        browser, page, errors = open_page(pw, url, args.lang, args.theme,
                                          not args.browser_chrome)
        vp = page.evaluate('[innerWidth, innerHeight, devicePixelRatio]')
        print(f'viewport {vp[0]}x{vp[1]} @{vp[2]}x')

        if args.strip:
            made = shoot_strip(page, args.strip, args.frames, outdir)
        else:
            made = shoot_moments(page, args.chapter, args.only, outdir)

        browser.close()
    httpd.shutdown()

    sheet = os.path.join(outdir, 'contact.png')
    size = contact_sheet(made, sheet, cols=4 if args.strip else 5)
    print(f'\n{len(made)} frames in {time.time()-t0:.0f}s')
    print(f'contact sheet: {os.path.relpath(sheet, ROOT)}  {size}')

    real = [e for e in errors if 'favicon' not in e]
    if real:
        print(f'\nconsole/network ({len(real)}):')
        for e in real[:12]:
            print('  ', e)
    return 0


def shoot_moments(page, chapter, only, outdir):
    made = []
    wanted = MOMENTS[chapter]
    if only:
        wanted = [m for m in wanted
                  if m[0] in only or any(m[0].startswith(o + '-') or m[0] == o for o in only)]
    # The cover lists the chapters in the order engine/story.js declares them,
    # which is the order of this table.
    pick = list(MOMENTS).index(chapter)
    if pick:
        page.evaluate(OPEN_CHAPTER, pick)
        page.wait_for_timeout(2500)
    for i, (key, bid, off, cap) in enumerate(wanted):
        if key == 'cover':
            page.reload(wait_until='networkidle')
            page.wait_for_function(BOOTED, timeout=20000)
            page.wait_for_timeout(1400)
            # A reload puts the cover back on the first chapter, and every
            # GOTO after it then addressed the wrong script. Beat ids that
            # exist in both chapters made that look like it had worked.
            if pick:
                page.evaluate(OPEN_CHAPTER, pick)
                page.wait_for_timeout(2500)
        else:
            dismiss_cover(page)
            res = page.evaluate(GOTO, [bid, off, None])
            if res != 'ok':
                print(f'  ! {key}: {res}')
            page.wait_for_timeout(1900)      # let flyTo and the card transitions land
        path = os.path.join(outdir, f'{i:02d}-{key}.png')
        page.screenshot(path=path)
        made.append((path, f'{i:02d}  {cap}'))
        print(f'  {key}')
    return made


def shoot_strip(page, name, frames, outdir):
    """Capture a transition as a filmstrip, for judging motion."""
    dismiss_cover(page)
    made = []
    if name == 'fold':
        page.evaluate(GOTO, ['s3.b3', 5.0, None])
        page.wait_for_timeout(1800)
        page.tap('.transport__seek')          # a real tap opens the controls
        step = 90
    elif name == 'portrait':
        page.evaluate(GOTO, ['s3.b3', 0.2, None])
        page.wait_for_timeout(1500)
        page.evaluate(GOTO, ['s3.b3', 5.0, None])
        step = 110
    elif name == 'route':
        page.evaluate(GOTO, ['s1.b8', 0.5, None])
        page.wait_for_timeout(1500)
        page.evaluate(GOTO, ['s1.b9', 0.2, None])
        step = 700
    else:  # converge
        page.evaluate(GOTO, ['s5.b4', 8.0, None])
        page.wait_for_timeout(1500)
        page.evaluate(GOTO, ['s5.b4', 9.6, None])
        step = 600
    for f in range(frames):
        path = os.path.join(outdir, f'{f:02d}.png')
        page.screenshot(path=path)
        made.append((path, f'+{f*step}ms'))
        page.wait_for_timeout(step)
    return made


if __name__ == '__main__':
    sys.exit(main())
