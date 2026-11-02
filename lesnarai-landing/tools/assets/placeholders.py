#!/usr/bin/env python3
"""Labelled placeholder photographs, until the owner's real photographs arrive.

    python3 tools/assets/placeholders.py

Writes assets/photos/<name>.webp and .jpg at the final sizes, so a real photograph replaces a
placeholder by overwriting the same two files. Every placeholder says what it is on its face; none
pretends to be a photograph. The static gate lists any placeholder still referenced (PLACEHOLDERS).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random

SITE = Path(__file__).resolve().parents[2]
OUT = SITE / "assets" / "photos"
PLACEHOLDERS = {  # name: (width, height, what the real photograph will show)
    "workstation": (1600, 1200, "The founder at the workstation"),
    "founder": (900, 1125, "Lesnar Gitonga, founder"),
}

def make(name, w, h, label):
    rnd = random.Random(name)
    im = Image.new("RGB", (w, h), (28, 30, 33))
    d = ImageDraw.Draw(im)
    for _ in range(140):                                   # soft, clearly synthetic texture
        x, y, r = rnd.randrange(w), rnd.randrange(h), rnd.randrange(40, 260)
        c = rnd.randrange(34, 58)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(c, c + 2, c + 5))
    im = im.filter(ImageFilter.GaussianBlur(60))
    d = ImageDraw.Draw(im)
    step = 48
    for x in range(0, w, step): d.line((x, 0, x, h), fill=(48, 50, 54), width=1)
    for y in range(0, h, step): d.line((0, y, w, y), fill=(48, 50, 54), width=1)
    big = ImageFont.load_default(size=round(w / 18))
    d.rectangle((0, 0, w - 1, h - 1), outline=(212, 31, 26), width=6)
    d.text((48, h - 140), "PHOTOGRAPH TO COME", font=big, fill=(240, 240, 240))
    d.text((48, h - 64), label, font=ImageFont.load_default(size=30), fill=(190, 190, 190))
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f"{name}.webp", quality=70, method=6)
    im.save(OUT / f"{name}.jpg", quality=72, optimize=True, progressive=True)

if __name__ == "__main__":
    for n, (w, h, label) in PLACEHOLDERS.items():
        make(n, w, h, label)
        print("placeholder", n, w, h)
