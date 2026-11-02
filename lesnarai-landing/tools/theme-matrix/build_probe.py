#!/usr/bin/env python3
"""Write the theme probe page, /lab/theme-probe/, from cells.json.

    python3 tools/theme-matrix/build_probe.py

The probe is a test instrument, not a site page: noindex, out of the sitemap,
inside the site's own shell (same head, bootstrap, CSP, header and theme switch)
so it renders exactly as the site does. Every cell is a fixed-size swatch at a
fixed position between two coloured fiducials, so a phone screenshot can be
measured by analyse_screenshot.py without knowing the device, zoom or scroll.
"""
import html
import json
import sys
from pathlib import Path

from PIL import Image, ImageStat

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[1]
sys.path.insert(0, str(SITE / "tools/field"))
from pages import shell  # noqa: E402  (the shared Field Record shell)

SPEC = json.loads((HERE / "cells.json").read_text())
OUT = SITE / "lab/theme-probe"
SW_W, SW_H = 64, 44  # swatch size in CSS px; probe.css uses the same numbers


def tile(name, rgb):
    """Flat raster tiles: whether a browser recolours raster images is itself a test."""
    Image.new("RGB", (SW_W, SW_H), rgb).save(OUT / name, optimize=True)


def mean_of(src):
    """Mean sRGB of an image as the browser shows it in a swatch (object-fit: cover)."""
    im = Image.open(SITE / src.lstrip("/")).convert("RGB")
    w, h = im.size
    target = SW_W / SW_H
    if w / h > target:
        cw = round(h * target); box = ((w - cw) // 2, 0, (w - cw) // 2 + cw, h)
    else:
        ch = round(w / target); box = (0, (h - ch) // 2, w, (h - ch) // 2 + ch)
    small = im.crop(box).resize((SW_W, SW_H), Image.LANCZOS)
    return "#" + "".join(f"{round(v):02X}" for v in ImageStat.Stat(small).mean)


S = '<span class="pc__s" data-sample></span>'
GLYPH = '<span class="pc__glyph pc__glyph--{c}" data-sample>HH</span>'
SWATCH = {
    "paper": S,
    "sheet": f'<div class="sheet pc__fill">{S}</div>',
    "ink": GLYPH.format(c="ink"),
    "ink-2": GLYPH.format(c="ink-2"),
    "ink-3": GLYPH.format(c="ink-3"),
    "signal": GLYPH.format(c="signal"),
    "link": '<a class="act pc__glyph" href="#g1-h"><span data-sample>HH</span></a>',
    "stage": '<span class="stage stage--live"><i data-sample></i></span>',
    "svg-land": f'<div class="map pc__fill"><svg viewBox="0 0 {SW_W} {SW_H}" width="{SW_W}" height="{SW_H}" aria-hidden="true">'
                f'<rect class="land" x="2" y="2" width="{SW_W - 4}" height="{SW_H - 4}"/></svg>{S}</div>',
    "svg-ink": f'<div class="pc__fill"><svg viewBox="0 0 {SW_W} {SW_H}" width="{SW_W}" height="{SW_H}" aria-hidden="true">'
               f'<rect class="plan__wall" x="0" y="0" width="{SW_W}" height="{SW_H}"/></svg>{S}</div>',
    "raster-white": f'<img class="pc__fill" src="/lab/theme-probe/white.png" width="{SW_W}" height="{SW_H}" alt="White raster tile">{S}',
    "raster-black": f'<img class="pc__fill" src="/lab/theme-probe/black.png" width="{SW_W}" height="{SW_H}" alt="Black raster tile">{S}',
    "input": f'<span class="fld"><input class="pc__fill" type="text" aria-label="Test text field"></span>{S}',
    "button": f'<span class="form__act"><button class="pc__fill" type="button">Go{S}</button></span>',
    # no visible label: the cell samples the disabled fill only, and a disabled label is
    # exempt from WCAG contrast but would still trip the runtime gate's probe
    "button-off": f'<span class="form__act"><button class="pc__fill" type="button" disabled aria-disabled="true" aria-label="Disabled button">{S}</button></span>',
    "scrim": f'<div class="pc__fill pc__scrim">{S}</div>',
    "focus": '<span class="pc__focus"><span class="pc__s pc__s--ring" data-sample></span></span>',
    "film": f'<div class="pc__fill pc__film">{S}</div>',
    "cand-raster": f'<div class="pc__fill pc__cand-raster">{S}</div>',
    "cand-gradient": f'<div class="pc__fill pc__cand-gradient">{S}</div>',
    "cand-text": f'<div class="pc__fill pc__cand-raster">{GLYPH.format(c="ink")}</div>',
    "caption": '<figure class="frame pc__fill pc__film"><figcaption><span class="pc__glyph" data-sample>HH</span></figcaption></figure>',
    "native-select": f'<select class="pc__native" aria-label="Native select"><option>Option</option></select>{S}',
    "native-check": '<input class="pc__check" type="checkbox" aria-label="Native checkbox"><span class="pc__s pc__s--check" data-sample></span>',
}


def cell(c):
    cid, method = c["id"], c["method"]
    if method == "mean":
        c["light"] = c["dark"] = mean_of(c["src"])
        sw = (f'<img class="pc__fill pc__photo" src="{c["src"]}" width="{SW_W}" height="{SW_H}" '
              f'alt="{html.escape(c["label"])} (test image)" data-sample>')
    else:
        sw = SWATCH[cid]
    expect = ("<span>observed only</span>" if method == "observe"
              else f'<span>L {c["light"]}</span><span>D {c["dark"]}</span>')
    data = f' data-light="{c["light"]}" data-dark="{c["dark"]}"' if method != "observe" else ""
    return (f'<div class="pc" data-cell="{cid}" data-method="{method}"{data}>'
            f'<div class="pc__sw">{sw}</div>'
            f'<div class="pc__t"><b>{html.escape(c["label"])}</b>{expect}</div></div>')


def grid(g):
    a, b = g["fiducials"]
    cells = "\n".join(cell(c) for c in g["cells"])
    return (f'<section class="pg-wrap w" aria-labelledby="{g["id"]}-h">\n'
            f'<h2 class="h2 pg-h" id="{g["id"]}-h">{g["id"].upper()} · {html.escape(g["title"])}</h2>\n'
            f'<div class="pg" id="{g["id"]}" data-grid="{g["id"]}" data-fid="{a},{b}">\n'
            f'<i class="fid fid--{a} fid--tl" aria-hidden="true"></i><i class="fid fid--{b} fid--br" aria-hidden="true"></i>\n'
            f'{cells}\n</div>\n</section>')


BODY = """<div class="w"><div class="case-open">
<p class="crumb">Lab · test instrument · not part of the site</p>
<h1 class="statement">Theme <em>probe</em></h1>
<p class="lede">Every square below has an exact expected colour for the light and the dark theme.
If a browser repaints this page on its own, the squares show it.</p>
<ol class="body pg-steps">
<li>Choose a theme with the switch at the top (System, Light or Dark).</li>
<li>Take one screenshot per grid, with both coloured corner marks on screen.</li>
<li>Send the screenshots with the browser's dark-mode setting noted. They are measured by
<code>tools/theme-matrix/analyse_screenshot.py</code>.</li>
</ol>
<dl class="pg-info" id="probe-info"><dt>Readout</dt><dd>Needs JavaScript.</dd></dl>
</div></div>
{grids}
<div class="w pg-notes body">
<p>G3's candidates are not in the site's CSS. They are measured here so a device test can
decide whether any is worth using: a raster tile as the page background, a gradient as the page
background, and text over the raster tile. Native controls are reported, never judged: their
colours come from the browser.</p>
</div>"""


def write():
    OUT.mkdir(parents=True, exist_ok=True)
    tile("white.png", (255, 255, 255))
    tile("black.png", (0, 0, 0))
    body = BODY.replace("{grids}", "\n".join(grid(g) for g in SPEC["grids"]))
    extra = ('\n<meta name="robots" content="noindex, nofollow">'
             '\n<link rel="stylesheet" href="/lab/theme-probe/probe.css">'
             '\n<script src="/lab/theme-probe/probe.js" defer></script>')
    page = shell("/lab/theme-probe/", "Theme probe",
                 "A test instrument for LESNAR AI's light and dark themes: fixed colour swatches, measured from screenshots, that show when a browser repaints the page.",
                 None, body, "sentinel", extra)
    (OUT / "index.html").write_text(page)
    print("wrote lab/theme-probe/index.html, white.png, black.png")


if __name__ == "__main__":
    write()
