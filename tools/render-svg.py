#!/usr/bin/env python
"""Render an SVG in the repo to a PNG beside it.

Chromium, not a converter library: these illustrations are meant to be read by
a browser, so the browser's own renderer is the one whose opinion counts. A
gradient or a clip-path that works in cairosvg and not in Chrome would be a
green build and a broken picture.
"""
import argparse, pathlib
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("svg")
ap.add_argument("--out")
ap.add_argument("--width", type=int, default=1600)
ap.add_argument("--height", type=int, default=900)
ap.add_argument("--scale", type=float, default=1.0)
a = ap.parse_args()

src = pathlib.Path(a.svg).resolve()
out = pathlib.Path(a.out).resolve() if a.out else src.with_suffix(".png")
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": a.width, "height": a.height},
                    device_scale_factor=a.scale)
    pg.goto(src.as_uri())
    pg.screenshot(path=str(out))
    b.close()
print(f"{out}  ({out.stat().st_size // 1024} KB)")
