#!/usr/bin/env python3
"""Check portal product/treasure image references against files.

Outputs a report of:
 - treasures and gift boxes with `image: null`
 - `sourceImage` entries whose files are missing
 - suggestions for close filename matches found in the treasures folder
"""
from __future__ import annotations

import difflib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TREASURES_DIR = ROOT / "hazina-portal" / "public" / "treasures"
TREASURES_TS = ROOT / "hazina-portal" / "lib" / "treasures.ts"
PRODUCTS_TS = ROOT / "hazina-portal" / "lib" / "products.ts"


def list_files():
    files = [p.name for p in TREASURES_DIR.glob("**/*") if p.is_file()]
    return files


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def find_close(name: str, files: list[str]) -> list[str]:
    name_norm = normalize(name)
    choices = {normalize(f): f for f in files}
    if name_norm in choices:
        return [choices[name_norm]]
    # fallback to difflib
    candidates = difflib.get_close_matches(name, files, n=3, cutoff=0.5)
    if candidates:
        return candidates
    # try normalized matches
    norm_candidates = [f for key, f in choices.items() if name_norm in key or key in name_norm]
    return norm_candidates[:3]


def parse_ts_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    items = []
    for i, ln in enumerate(lines):
        if "id:" in ln and '"' in ln:
            m = re.search(r'id:\s*"([^"]+)"', ln)
            if not m:
                continue
            item = {"id": m.group(1), "name": None, "image": None, "sourceImage": None, "line": i + 1}
            # scan next 30 lines for name, image, sourceImage
            for j in range(i + 1, min(len(lines), i + 40)):
                l = lines[j]
                if "name:" in l and '"' in l and item.get("name") is None:
                    nm = re.search(r'name:\s*"([^"]+)"', l)
                    if nm:
                        item["name"] = nm.group(1)
                if "image:" in l and item.get("image") is None:
                    if "null" in l:
                        item["image"] = None
                    else:
                        im = re.search(r'image:\s*"([^"]+)"', l)
                        if im:
                            item["image"] = im.group(1)
                if "sourceImage" in l and item.get("sourceImage") is None:
                    si = re.search(r'sourceImage:\s*"([^"]+)"', l)
                    if si:
                        item["sourceImage"] = si.group(1)
                if "}," in l or l.strip().endswith("},"):
                    break
            items.append(item)
    return items


def main():
    files = list_files()
    print(f"Found {len(files)} treasure files in {TREASURES_DIR}")

    treasures = parse_ts_file(TREASURES_TS)
    products = parse_ts_file(PRODUCTS_TS)

    missing_images = [t for t in treasures if t.get("image") is None]
    missing_box_images = [p for p in products if p.get("image") is None]

    print("\nTreasures with missing 'image' fields:")
    for t in missing_images:
        print(f" - {t['id']} ({t.get('name')}) [line {t['line']}] -> sourceImage={t.get('sourceImage')}")
        if t.get("sourceImage"):
            suggestions = find_close(t['sourceImage'], files)
            if suggestions:
                print(f"    suggestions: {suggestions}")
            else:
                print("    no close matches found in public/treasures/")

    print("\nGift boxes with missing 'image' fields:")
    for p in missing_box_images:
        print(f" - {p['id']} ({p.get('name')}) [line {p['line']}] -> sourceImage={p.get('sourceImage')}")
        # look for generated hero first
        gold = f"{p['id']}-hero.jpg"
        if gold in files or f"generated/{gold}" in files:
            print(f"    generated suggestion: /treasures/generated/{gold}")
        else:
            print("    no generated hero image found; consider running composer")

    # Check sourceImage validity across all items
    print("\nSourceImage files missing or mismatched:")
    for collection in (treasures + products):
        src = collection.get("sourceImage")
        if not src:
            continue
        # normalize and check
        suggestions = find_close(src, files)
        if not suggestions:
            print(f" - {collection['id']}: sourceImage='{src}' — no match in public/treasures/")
        elif suggestions and suggestions[0] != src:
            print(f" - {collection['id']}: sourceImage='{src}' — closest match: {suggestions}")


if __name__ == "__main__":
    main()
