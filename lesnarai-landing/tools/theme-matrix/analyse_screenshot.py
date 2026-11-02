#!/usr/bin/env python3
"""Measure a phone screenshot of /lab/theme-probe/ against the expected theme colours.

    python3 tools/theme-matrix/analyse_screenshot.py --expect light shot1.png [shot2.png ...]
    python3 tools/theme-matrix/analyse_screenshot.py --expect dark --json out.json shot.png

--expect is the theme that SHOULD be on screen: the site theme chosen in the switch,
or, for SYSTEM, the device's own light/dark setting.

How the cells are found: each grid sits between two flat squares of pure magenta,
cyan or green. Those hues are at 50% HSL lightness, so a browser that inverts
lightness to darken a page leaves them in place. Their centres give the scale and
offset of the screenshot (any device, zoom, scroll or status bar), and the cell
positions come from tools/theme-matrix/probe-layout.json, written by
theme-matrix.mjs. Sampling matches theme-matrix.mjs: median for fills, the glyph
colour farthest from the background for text, the mean for photographs.
"""
import argparse
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

LAYOUT = json.loads((Path(__file__).resolve().parent / "probe-layout.json").read_text())
HUES = {  # pixel tests for the fiducial colours, loose enough for JPEG and scaling
    "magenta": lambda r, g, b: (r > 190) & (b > 190) & (g < 80),
    "cyan": lambda r, g, b: (g > 190) & (b > 190) & (r < 80),
    "green": lambda r, g, b: (g > 190) & (r < 80) & (b < 80),
}


def components(mask, min_px):
    """Connected regions of a boolean mask (4-neighbour), as (cx, cy, w, h, n)."""
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y0, x0 in np.argwhere(mask):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        if len(pts) < min_px:
            continue
        ys, xs = zip(*pts)
        w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if 0.75 < w / h < 1.33 and len(pts) > 0.8 * w * h:  # a filled square
            out.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, w, h, len(pts)))
    return out


def locate(img, grid):
    """Find a grid's fiducial pair; return (origin x, origin y, scale) or None."""
    r, g, b = (img[..., i].astype(int) for i in range(3))
    found = {}
    for hue in {grid["fid_tl"], grid["fid_br"]}:
        found[hue] = components(HUES[hue](r, g, b), min_px=64)
    best = None
    for tl in found[grid["fid_tl"]]:
        for br in found[grid["fid_br"]]:
            sx = (br[0] - tl[0]) / grid["span"][0]
            sy = (br[1] - tl[1]) / grid["span"][1]
            if sx <= 0 or sy <= 0 or abs(sx / sy - 1) > 0.04:
                continue
            size = grid["fid_size"] * sx
            if not (0.75 * size < tl[2] < 1.25 * size and 0.75 * size < br[2] < 1.25 * size):
                continue
            err = abs(sx / sy - 1)
            if best is None or err < best[3]:
                best = (tl[0], tl[1], (sx + sy) / 2, err)
    return best and best[:3]


def sample(img, cx, cy, w, h, method):
    x0, x1 = int(round(cx - w / 2)), int(round(cx + w / 2))
    y0, y1 = int(round(cy - h / 2)), int(round(cy + h / 2))
    if w > 6 and h > 6:  # stay off anti-aliased edges, as theme-matrix.mjs does
        x0, x1, y0, y1 = x0 + 1, x1 - 1, y0 + 1, y1 - 1
    if x0 < 0 or y0 < 0 or x1 > img.shape[1] or y1 > img.shape[0] or x1 <= x0 or y1 <= y0:
        return None
    px = img[y0:y1, x0:x1, :3].reshape(-1, 3).astype(int)
    if method == "mean":
        return px.mean(axis=0)
    bg = np.median(px, axis=0)
    if method != "ink":
        return bg
    d = np.abs(px - bg).sum(axis=1)
    if d.max() < 24:
        return bg
    return np.median(px[d >= d.max() * 0.92], axis=0)


def hexof(c):
    return "#" + "".join(f"{int(round(v)):02X}" for v in c)


def analyse(path, expect):
    img = np.asarray(Image.open(path).convert("RGB"))
    report = []
    for grid in LAYOUT["grids"]:
        pos = locate(img, grid)
        if not pos:
            report.append({"grid": grid["id"], "found": False})
            continue
        ox, oy, s = pos
        cells = []
        for c in grid["cells"]:
            got = sample(img, ox + c["x"] * s, oy + c["y"] * s, c["w"] * s, c["h"] * s, c["method"])
            want = c.get(expect)
            delta = None if got is None or not want or c["method"] == "observe" else \
                int(round(max(abs(got[i] - int(want[1 + 2 * i:3 + 2 * i], 16)) for i in range(3))))
            ok = None if delta is None else delta <= LAYOUT["tolerance"][c["method"]]
            cells.append({"id": c["id"], "method": c["method"], "expect": None if c["method"] == "observe" else want,
                          "got": got is not None and hexof(got) or None, "delta": delta, "pass": ok})
        report.append({"grid": grid["id"], "found": True, "scale": round(s, 3), "cells": cells})
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--expect", choices=["light", "dark"], required=True)
    ap.add_argument("--json", help="also write the full report here")
    ap.add_argument("shots", nargs="+")
    a = ap.parse_args()
    full, failed = {}, 0
    for shot in a.shots:
        rep = analyse(shot, a.expect)
        full[shot] = rep
        print(f"\n{shot}  (expecting the {a.expect} theme)")
        for g in rep:
            if not g["found"]:
                print(f"  {g['grid']}: corner marks not found in this screenshot")
                continue
            print(f"  {g['grid']}: found, {g['scale']} device px per CSS px")
            for c in g["cells"]:
                verdict = "observed" if c["pass"] is None else ("PASS" if c["pass"] else "FAIL")
                failed += c["pass"] is False
                print(f"    {c['id']:14s} {verdict:8s} expected {c['expect'] or '—':8s} painted {c['got'] or 'off-screen'}"
                      + (f"  Δ{c['delta']}" if c["delta"] is not None else ""))
    if a.json:
        Path(a.json).write_text(json.dumps(full, indent=1) + "\n")
    found = sum(g["found"] for rep in full.values() for g in rep)
    print(f"\n{found} grid(s) measured, {failed} failing cell(s)")
    sys.exit(1 if failed or not found else 0)


if __name__ == "__main__":
    main()
