#!/usr/bin/env python3
"""Prepare the site's photographs from their tracked sources.

    python3 tools/assets/photos.py

Writes assets/photos/<name>.webp and .jpg (plus a phone width where a photograph is a full-bleed
background). Sources and licences are in experience-lab/source-media/photos/CREDITS.md. Metadata is
dropped on save, so no location data can reach the site.
"""
from pathlib import Path
from PIL import Image

SITE = Path(__file__).resolve().parents[2]
REPO = SITE.parent
OUT = SITE / "assets" / "photos"
V1 = REPO / "experience-lab/lesnarai-site-v1/media"
SRC = REPO / "experience-lab/source-media/photos"

# name: (source, crop box as fractions (l, t, r, b) or None, widths)
PHOTOS = {
    "workstation": (V1 / "hero-bench.jpg", None, (2000, 1400, 900)),
    "at-work": (V1 / "studio-close.jpg", None, (1800, 1400, 900)),
    "founder": (V1 / "studio-portrait.jpg", (0.0, 0.0, 0.86, 1.0), (900,)),
    "nairobi": (SRC / "nairobi-kenny-murgor-unsplash-vyagy6HJpVE.jpg", None, (2000, 1400, 900)),
}

def save(im, stem):
    im.save(OUT / f"{stem}.webp", quality=74, method=6)
    im.save(OUT / f"{stem}.jpg", quality=78, optimize=True, progressive=True)

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (src, crop, widths) in PHOTOS.items():
        im = Image.open(src).convert("RGB")
        if crop:
            l, t, r, b = crop
            im = im.crop((round(l * im.width), round(t * im.height), round(r * im.width), round(b * im.height)))
        for k, w in enumerate(widths):
            w = min(w, im.width)
            out = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            stem = name if k == 0 else f"{name}@{w}"
            save(out, stem)
            print(stem, out.size)
