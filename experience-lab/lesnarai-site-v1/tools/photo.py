#!/usr/bin/env python3
"""Photographic material gate for the LESNAR AI site.

Two jobs:

  audit   Walk every <img>/<source> on every page and prove four things about
          the file behind it: it exists, its declared box matches its real
          aspect ratio, it is not shipped far above the size it is drawn at,
          and its WebP twin has the same geometry as its JPEG. Any of those
          failing is either a layout shift, a distorted photograph or wasted
          bytes on a phone.

  derive  Turn one delivered camera master into the exact variants a slot
          needs, and print the <picture> block that receives them, so a
          photograph lands at the declared geometry instead of being
          hand-fitted afterwards.

Run from anywhere; paths resolve against the site root above this file.
"""
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "photo-spec.json")

# A photograph drawn at 480px wide does not need a 2000px master. Retina wants
# 2x; beyond that is bytes a phone pays for and never shows.
OVERSUPPLY = 2.6
# JPEG/WebP encoders round odd dimensions; a pixel of drift is not a defect.
ASPECT_TOL = 0.02

IMG_RE = re.compile(r"<img\b[^>]*>", re.I)
SRC_RE = re.compile(r"<source\b[^>]*>", re.I)
ATTR_RE = re.compile(r'(\w[\w-]*)\s*=\s*"([^"]*)"')
COVER_RE = re.compile(r"([^{}]+)\{[^{}]*object-fit\s*:\s*cover", re.I)
CLASS_RE = re.compile(r'class="([^"]*)"')


def cover_classes(html):
    """Class tokens whose rules set object-fit:cover on this page."""
    out = set()
    for sel in COVER_RE.findall(html):
        out.update(re.findall(r"\.([\w-]+)", sel))
    return out


def is_cover(html, at, classes):
    """True when the img at this offset sits under a cover-fitted selector.

    Walks back over the enclosing <picture>/<figure>/<div> open tags and reads
    their class tokens, which is where the fit is declared in this codebase.
    """
    for c in CLASS_RE.findall(html[max(0, at - 400):at]):
        if classes & set(c.split()):
            return True
    return False


def attrs(tag):
    return {k.lower(): v for k, v in ATTR_RE.findall(tag)}


def resolve(ref, page):
    """Map an href as written on a page to a file on disk."""
    ref = ref.split("?")[0].strip()
    if not ref or ref.startswith(("data:", "http:", "https:", "//")):
        return None
    if ref.startswith("/"):
        return os.path.join(ROOT, ref.lstrip("/"))
    return os.path.normpath(os.path.join(os.path.dirname(page), ref))


def pages():
    out = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "tools")]
        out += [os.path.join(base, f) for f in files if f.endswith(".html")]
    return sorted(out)


def size(path, cache={}):
    if path not in cache:
        try:
            with Image.open(path) as im:
                cache[path] = im.size
        except Exception:
            cache[path] = None
    return cache[path]


def audit():
    findings = []
    seen = 0
    # The width attribute is a ratio placeholder, not the size the image is
    # drawn at: several slots render far wider than they declare. Oversupply is
    # only meaningful against a measured render width, so use those where the
    # spec has them and say so plainly where it does not.
    try:
        rendered = json.load(open(SPEC, encoding="utf-8")).get("maxRender", {})
    except Exception:
        rendered = {}
    for page in pages():
        rel = os.path.relpath(page, ROOT)
        html = open(page, encoding="utf-8").read()

        covers = cover_classes(html)
        for m in IMG_RE.finditer(html):
            tag = m.group(0)
            a = attrs(tag)
            src = a.get("src")
            if not src:
                continue
            seen += 1
            path = resolve(src, page)
            if path is None:
                continue
            if not os.path.exists(path):
                findings.append((rel, src, "MISSING", "file does not exist"))
                continue

            dim = size(path)
            if dim is None:
                findings.append((rel, src, "UNREADABLE", "not decodable as an image"))
                continue
            iw, ih = dim

            dw, dh = a.get("width"), a.get("height")
            if not dw or not dh:
                findings.append((rel, src, "NO-BOX",
                                 "no width/height: reserves no space, shifts layout"))
            else:
                dw, dh = int(dw), int(dh)
                want, got = dw / dh, iw / ih
                if abs(want - got) / want > ASPECT_TOL and \
                        not is_cover(html, m.start(), covers):
                    findings.append((rel, src, "DISTORTED",
                                     f"declared {dw}x{dh} ({want:.3f}) vs real "
                                     f"{iw}x{ih} ({got:.3f}); height:auto will "
                                     f"relayout to the real ratio on decode"))
                stem = os.path.splitext(os.path.basename(path))[0]
                draw = rendered.get(stem)
                basis = "measured" if draw else "declared box, unmeasured"
                draw = draw or dw
                if iw > draw * OVERSUPPLY:
                    kb = os.path.getsize(path) // 1024
                    findings.append((rel, src, "OVERSIZE",
                                     f"{iw}px master drawn at {draw}px "
                                     f"({iw/draw:.1f}x, {kb}KB; {basis})"))

            # A <source> that hands the browser a different shape than the
            # <img> it falls back to shifts the page on format alone.
            for stag in SRC_RE.findall(html):
                sa = attrs(stag)
                ss = (sa.get("srcset") or "").split()
                if not ss:
                    continue
                spath = resolve(ss[0], page)
                if not spath or not os.path.exists(spath):
                    continue
                if os.path.splitext(os.path.basename(spath))[0] != \
                   os.path.splitext(os.path.basename(path))[0]:
                    continue
                sdim = size(spath)
                if sdim and sdim != dim:
                    findings.append((rel, ss[0], "TWIN-DRIFT",
                                     f"{sdim[0]}x{sdim[1]} vs img {iw}x{ih}"))

    print(f"  {seen} <img> across {len(pages())} pages")
    if not findings:
        print("  clean: every image resolves, fits its declared box, and is "
              "not oversupplied")
        return 0

    order = ["MISSING", "UNREADABLE", "DISTORTED", "NO-BOX", "TWIN-DRIFT", "OVERSIZE"]
    findings.sort(key=lambda f: (order.index(f[2]), f[0]))
    seen_line = set()
    for page, src, kind, why in findings:
        line = (page, src, kind, why)
        if line in seen_line:
            continue
        seen_line.add(line)
        print(f"  {kind:<11} {page:<34} {os.path.basename(src)}  {why}")
    return 1


def derive(slot_id, master):
    spec = json.load(open(SPEC, encoding="utf-8"))
    slot = next((s for s in spec["slots"] if s["id"] == slot_id), None)
    if slot is None:
        sys.exit(f"unknown slot '{slot_id}'. known: "
                 + ", ".join(s["id"] for s in spec["slots"]))
    if not os.path.exists(master):
        sys.exit(f"master not found: {master}")

    src = Image.open(master).convert("RGB")
    print(f"  master {src.width}x{src.height}  ->  {slot_id}")

    for v in slot["variants"]:
        w, h = v["w"], v["h"]
        if src.width < w or src.height < h:
            sys.exit(f"  master is {src.width}x{src.height}, too small for "
                     f"{w}x{h}. Reshoot or reframe; do not upscale.")

        # Cover-crop to the slot's aspect, anchored where the spec says the
        # subject sits, then resample once to the exact declared box.
        want = w / h
        cw, ch = src.width, int(round(src.width / want))
        if ch > src.height:
            ch, cw = src.height, int(round(src.height * want))
        ax, ay = v.get("anchor", [0.5, 0.5])
        x = int(round((src.width - cw) * ax))
        y = int(round((src.height - ch) * ay))
        im = src.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)

        for ext, opts in (("jpg", {"quality": 82, "optimize": True,
                                   "progressive": True}),
                          ("webp", {"quality": 80, "method": 6})):
            out = os.path.join(ROOT, "media", f"{v['name']}.{ext}")
            im.save(out, **opts)
            print(f"    {os.path.relpath(out, ROOT):<44} "
                  f"{w}x{h}  {os.path.getsize(out)//1024}KB")

    print("\n  paste into " + slot["page"] + ":\n")
    print(slot["markup"])
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "audit"
    if cmd == "audit":
        sys.exit(audit())
    elif cmd == "derive":
        if len(sys.argv) != 4:
            sys.exit("usage: photo.py derive <slot-id> <master-file>")
        sys.exit(derive(sys.argv[2], sys.argv[3]))
    else:
        sys.exit("usage: photo.py [audit | derive <slot-id> <master>]")
