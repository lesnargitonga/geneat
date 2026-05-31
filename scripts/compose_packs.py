#!/usr/bin/env python3
"""Compose Hazina pack images using existing treasure assets.

Creates a composed hero image for each pack by placing selected treasure
thumbnails onto a Hazina gift-box template and overlaying a tasteful
Hazina wordmark. Saves outputs under `hazina-portal/public/treasures/generated/`.

Usage:
  python scripts/compose_packs.py --out-dir hazina-portal/public/treasures/generated --pack all
  python scripts/compose_packs.py --pack highland-treasure --out-dir ...
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import List

from PIL import Image, ImageDraw, ImageFilter, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TREASURES_DIR = PROJECT_ROOT / "hazina-portal" / "public" / "treasures"
DEFAULT_OUT_DIR = TREASURES_DIR / "generated"
BOX_TEMPLATE = TREASURES_DIR / "curated-gift-box.png"


PACK_DEFINITIONS = {
    "highland-treasure": [
        "coffee-beans-variety.jpg",
        "raw-honey-jars.jpg",
        "antelope-wood-carving.jpg",
        "beaded-bracelet.jpg",
    ],
    "nomad-leather-set": [
        "leather-passport-open.jpg",
        "leather-passport-closed.jpg",
    ],
    "safari-romance-box": [
        "maasai-earrings.jpg",
        "raw-honey-jars.jpg",
        "premium-wood-clubs.jpg",
    ],
}


def find_font(size: int = 48):
    # Try common fonts; fall back to default bitmap font
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    ]
    for path in candidates:
        try:
            p = Path(path)
            if p.exists():
                return ImageFont.truetype(str(p), size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def rounded_thumbnail(image: Image.Image, size: int, radius: int = 24) -> Image.Image:
    image = image.convert("RGBA")
    image.thumbnail((size, size), Image.LANCZOS)
    thumb = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - image.width) // 2
    y = (size - image.height) // 2
    thumb.paste(image, (x, y))
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=255)
    thumb.putalpha(mask)
    return thumb


def drop_shadow(image: Image.Image, offset=(10, 10), background_color=(0, 0, 0, 0), shadow_color=(0, 0, 0, 180), iterations=6):
    total_width = image.width + abs(offset[0]) + iterations * 2
    total_height = image.height + abs(offset[1]) + iterations * 2
    back = Image.new("RGBA", (total_width, total_height), background_color)
    shadow = Image.new("RGBA", (image.width, image.height), shadow_color)
    sx = iterations
    sy = iterations
    back.paste(shadow, (sx + offset[0], sy + offset[1]))
    for _ in range(iterations):
        back = back.filter(ImageFilter.GaussianBlur(radius=2))
    back.paste(image, (sx, sy), image)
    bbox = back.getbbox() or (0, 0, back.width, back.height)
    return back.crop(bbox)


def compose_pack(pack_slug: str, items: List[str], out_path: Path, wordmark: str = "Hazina"):
    if not BOX_TEMPLATE.exists():
        raise FileNotFoundError(f"Box template not found: {BOX_TEMPLATE}")
    box = Image.open(BOX_TEMPLATE).convert("RGBA")
    canvas = box.copy()
    w, h = canvas.size

    area_width = int(w * 0.7)
    thumb_size = max(160, min(360, area_width // max(1, len(items))))
    spacing = int(thumb_size * 0.12)
    total_width = thumb_size * len(items) + spacing * (len(items) - 1)
    start_x = w // 2 - total_width // 2
    start_y = int(h * 0.45)

    for idx, filename in enumerate(items):
        src = TREASURES_DIR / filename
        if not src.exists():
            print(f"  • missing asset, skipping: {filename}")
            continue
        try:
            img = Image.open(src).convert("RGBA")
        except Exception as exc:
            print(f"  • failed to open {filename}: {exc}")
            continue
        thumb = rounded_thumbnail(img, thumb_size, radius=int(thumb_size * 0.08))
        thumb_with_shadow = drop_shadow(thumb, offset=(12, 12), iterations=4)
        x = start_x + idx * (thumb_size + spacing)
        y = start_y + (idx % 2) * int(thumb_size * 0.05)
        shadow_w, shadow_h = thumb_with_shadow.size
        paste_x = x - (shadow_w - thumb_size) // 2
        paste_y = y - (shadow_h - thumb_size) // 2
        canvas.paste(thumb_with_shadow, (paste_x, paste_y), thumb_with_shadow)

    draw = ImageDraw.Draw(canvas)
    font = find_font(size=max(36, w // 24))
    text = wordmark
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = w // 2 - text_w // 2
    text_y = int(h * 0.06)
    draw.text((text_x + 2, text_y + 2), text, font=font, fill=(0, 0, 0, 120))
    draw.text((text_x, text_y), text, font=font, fill=(255, 235, 180, 255))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas = canvas.convert("RGB")
    canvas.save(out_path, quality=90, optimize=True)
    print(f"Saved: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Compose Hazina pack images from treasure assets")
    parser.add_argument("--pack", dest="pack", help="pack slug to generate (or 'all')", default="all")
    parser.add_argument("--out-dir", dest="out_dir", default=str(DEFAULT_OUT_DIR))
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    if args.pack == "all":
        packs = list(PACK_DEFINITIONS.keys())
    else:
        packs = [args.pack]

    for pack in packs:
        items = PACK_DEFINITIONS.get(pack)
        if not items:
            print(f"Unknown pack '{pack}', skipping.")
            continue
        out_file = out_dir / f"{pack}-hero.jpg"
        print(f"Composing pack '{pack}' with items: {items}")
        try:
            compose_pack(pack, items, out_file)
        except Exception as exc:
            print(f"Failed to compose {pack}: {exc}")


if __name__ == "__main__":
    main()
