"""Build the v5 homepage prototype's derived assets from the systems' own repos.

Nothing here is invented. Every figure is read from, or drawn from, a file in
one of the source repositories, and the provenance is written next to it in
media/PROVENANCE.md.

Sources (clone them anywhere and point the env vars at them):
  MEDIMATCH   lesnargitonga/MediMatch
  SENTINEL    lesnargitonga/LesnarAI          (Operation Sentinel)
  V4          lesnargitonga/geneat @ experience/lesnarai-v4-home
  FONTS       any directory holding @fontsource-variable/mona-sans
Run:  python3 tools/build_assets.py
"""
import json
import math
import os
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent.parent
MEDIA = HERE / "media"
FONTS = HERE / "fonts"
MEDIMATCH = Path(os.environ.get("MEDIMATCH", "/home/user/src/MediMatch"))
SENTINEL = Path(os.environ.get("SENTINEL", "/home/user/src/LesnarAI"))
V4 = Path(os.environ.get("V4", "/home/user/v4/experience-lab/lesnarai-site-v1"))
FONTSRC = Path(os.environ.get("FONTSRC", "/tmp/claude-0/-home-user-geneat/397d8e34-8d73-54ca-af3e-35f8758b9959/scratchpad/type/node_modules/@fontsource-variable/mona-sans/files"))

MEDIA.mkdir(exist_ok=True)
FONTS.mkdir(exist_ok=True)
provenance = []


def haversine(a, b):
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ---------------------------------------------------------------- MediMatch map
def medimatch_map():
    kenya_src = (MEDIMATCH / "client/src/data/kenya.ts").read_text()
    outline = json.loads(re.search(r"=\s*(\[\[.*?\]\])\s*;", kenya_src, re.S).group(1))
    db = (MEDIMATCH / "server/src/mock/db.ts").read_text()
    fac = {}
    for m in re.finditer(r"\{ id: (\d+),\s+name: '([^']+)',.*?county: '([^']+)',\s+lat:\s+(-?[\d.]+), lon: (-?[\d.]+),.*?hub: (true|false) \}", db):
        fid = int(m.group(1))
        if 2 <= fid <= 17:  # the sixteen national facilities; 19+ are the Nairobi deep-dive
            fac[fid] = dict(name=m.group(2), county=m.group(3), lat=float(m.group(4)), lon=float(m.group(5)), hub=m.group(6) == "true")
    assert len(fac) == 16, len(fac)

    # One run's transfers, as listed in the interface's own panels
    # (docs/screenshots/conference-command-routed.png). The panel names the
    # destination; the origin hub is the one whose straight-line distance
    # matches the kilometres the panel reports, checked below.
    transfers = [
        (2, 9, "120 insulin", 810, True),
        (7, 16, "60 IV fluids", 127, False),
        (4, 17, "100 surgical masks", 105, False),
        (5, 15, "150 amoxicillin", 60, False),
        (3, 13, "3 vaccine cold-chain carriers", 82, False),
        (7, 12, "300 IV fluids", 301, False),
        (3, 8, "80 surgical kits", 292, False),
        (6, 11, "2 portable ventilators", 362, False),
        (2, 14, "120 antimalarials", 107, False),
    ]
    for a, b, _, km, _ in transfers:
        d = haversine((fac[a]["lat"], fac[a]["lon"]), (fac[b]["lat"], fac[b]["lon"]))
        assert abs(d - km) <= 6, (fac[a]["name"], fac[b]["name"], round(d), km)

    lon0, lon1, lat0, lat1 = 33.7, 42.1, -4.9, 5.2
    k = math.cos(math.radians(0.2))
    W = 760
    H = round(W * (lat1 - lat0) / ((lon1 - lon0) * k))
    X = lambda lon: (lon - lon0) / (lon1 - lon0) * W
    Y = lambda lat: (lat1 - lat) / (lat1 - lat0) * H
    d = "M" + " L".join(f"{X(lo):.1f} {Y(la):.1f}" for lo, la in outline) + "Z"
    parts = [f'<svg class="mm-map" viewBox="0 0 {W} {H}" role="img" aria-labelledby="mm-map-t">',
             '<title id="mm-map-t">Map of Kenya with the sixteen MediMatch facilities and nine transfers from one demonstration run, the longest from Nairobi to Mandera.</title>',
             f'<path class="mm-land" d="{d}"/>']
    # longest last so it finishes the sequence
    for i, (a, b, what, km, urgent) in enumerate(sorted(transfers, key=lambda t: t[3])):
        x1, y1, x2, y2 = X(fac[a]["lon"]), Y(fac[a]["lat"]), X(fac[b]["lon"]), Y(fac[b]["lat"])
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        bend = min(0.22 * L, 60)
        cx, cy = mx - dy / L * bend, my + dx / L * bend
        # approximate quadratic length for dash animation
        seg = 0
        px, py = x1, y1
        for s in range(1, 21):
            t = s / 20
            qx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2
            qy = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2
            seg += math.hypot(qx - px, qy - py)
            px, py = qx, qy
        cls = "mm-route mm-route--urgent" if urgent else "mm-route"
        parts.append(f'<path class="{cls}" style="--len:{seg:.0f};--i:{i}" d="M{x1:.1f} {y1:.1f} Q{cx:.1f} {cy:.1f} {x2:.1f} {y2:.1f}"><title>{fac[a]["name"]} to {fac[b]["name"]}: {what}, {km} km</title></path>')
    for fid, f in fac.items():
        cls = "mm-hub" if f["hub"] else "mm-need"
        r = 8 if f["hub"] else 6.5
        parts.append(f'<circle class="{cls}" cx="{X(f["lon"]):.1f}" cy="{Y(f["lat"]):.1f}" r="{r}"><title>{f["name"]}, {f["county"]}</title></circle>')
    for label, fid, dx, dy, anchor in [("Nairobi", 2, -10, 18, "end"), ("Mandera", 9, -10, -10, "end")]:
        f = fac[fid]
        parts.append(f'<text class="mm-label" x="{X(f["lon"]) + dx:.1f}" y="{Y(f["lat"]) + dy:.1f}" text-anchor="{anchor}">{label}</text>')
    parts.append("</svg>")
    (MEDIA / "medimatch-map.svg").write_text("\n".join(parts))
    provenance.append("medimatch-map.svg: outline from MediMatch client/src/data/kenya.ts (Natural Earth 50m, public domain); "
                      "facility names and coordinates from server/src/mock/db.ts ids 2-17; transfers from the supply panel in "
                      "docs/screenshots/conference-command-routed.png, origins matched by straight-line distance within 6 km.")
    return len(fac), transfers


# ---------------------------------------------------------- Operation Sentinel
def sentinel():
    wps = json.loads((SENTINEL / "training/px4_waypoints.json").read_text())["waypoints"]
    lat0, lon0 = wps[0]["lat"], wps[0]["lon"]
    pts = [((w["lon"] - lon0) * 111320 * math.cos(math.radians(lat0)), (w["lat"] - lat0) * 110574) for w in wps]
    minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts)
    miny = min(p[1] for p in pts); maxy = max(p[1] for p in pts)
    pad = 40
    S = 2.4  # px per metre
    W = (maxx - minx) * S + pad * 2 + 60
    H = (maxy - miny) * S + pad * 2 + 30
    P = lambda p: (pad + (p[0] - minx) * S, pad + (maxy - p[1]) * S)
    xy = [P(p) for p in pts] + [P(pts[0])]
    L = sum(math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]) for i in range(len(xy) - 1))
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in xy)
    total_m = sum(math.hypot(pts[(i + 1) % 4][0] - pts[i][0], pts[(i + 1) % 4][1] - pts[i][1]) for i in range(4))
    out = [f'<svg class="st-mission" viewBox="0 0 {W:.0f} {H:.0f}" role="img" aria-labelledby="st-m-t">',
           f'<title id="st-m-t">The four-waypoint training mission from px4_waypoints.json, a loop of about {total_m:.0f} metres.</title>',
           f'<path class="st-path" style="--len:{L:.0f}" d="{d}"/>']
    for i, (x, y) in enumerate(xy[:-1]):
        out.append(f'<circle class="st-wp" cx="{x:.1f}" cy="{y:.1f}" r="4"/><text class="st-wpl" x="{x + 9:.1f}" y="{y - 8:.1f}">W{i + 1}</text>')
    bx, by = pad, H - 12
    out.append(f'<path class="st-scale" d="M{bx} {by - 5} V{by} H{bx + 50 * S} V{by - 5}"/><text class="st-wpl" x="{bx + 50 * S + 8:.0f}" y="{by:.0f}">50 m</text>')
    out.append("</svg>")
    (MEDIA / "sentinel-mission.svg").write_text("\n".join(out))

    src = (SENTINEL / "training/px4_teacher_collect_gz.py").read_text().split("\n")
    i0 = next(i for i, l in enumerate(src) if l.strip().startswith("header = ["))
    groups, cur = [], None
    for l in src[i0 + 1:]:
        s = l.strip()
        if s == "]":
            break
        c = re.match(r"#\s*(?:─+\s*)?([^─]+?)\s*(?:─+)?$", s)
        if c and not s.startswith('"'):
            name = c.group(1).strip()
            if name and "columns" not in name:
                cur = [name, []]
                groups.append(cur)
            elif "original" in name:
                cur = ["core", []]
                groups.append(cur)
            continue
        for col in re.findall(r'"([a-z0-9_]+)"', s):
            if cur is None:
                cur = ["core", []]
                groups.append(cur)
            cur[1].append(col)
    total = sum(len(g[1]) for g in groups)
    (MEDIA / "sentinel-columns.json").write_text(json.dumps({"total": total, "groups": groups, "waypoint_loop_m": round(total_m)}, indent=1))
    provenance.append(f"sentinel-mission.svg: LesnarAI training/px4_waypoints.json, local metres from W1. "
                      f"sentinel-columns.json: the CSV header in training/px4_teacher_collect_gz.py, {total} columns.")
    return total, round(total_m)


# ------------------------------------------------------------------- images
def img(src, name, widths, q=78):
    im = Image.open(src).convert("RGB")
    for w in widths:
        r = im if im.size[0] == w else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        r.save(MEDIA / f"{name}-{w}.webp", "WEBP", quality=q, method=6)
        r.save(MEDIA / f"{name}-{w}.jpg", "JPEG", quality=q, optimize=True, progressive=True)
    return im.size


def images():
    img(MEDIMATCH / "docs/screenshots/conference-command-routed.png", "medimatch-routed", [1440, 760])
    img(MEDIMATCH / "docs/screenshots/conference-command-mobile.png", "medimatch-mobile", [390])
    img(V4 / "media/bizmtaani-surface-full.jpg", "bizmtaani", [1440, 760])
    img(V4 / "media/carepro-surface-full.jpg", "carepro", [1440, 760])
    img(V4 / "media/jamii-surface-full.jpg", "jamii", [760])
    img(V4 / "media/geneat-surface-full.jpg", "geneat", [760])
    img(V4 / "media/hazina-surface-full.jpg", "hazina", [760])
    for n in ["01-discover", "04-basket", "05-track"]:
        img(V4 / f"media/biz/m-{n}.webp", f"biz-m-{n}", [390])
    provenance.append("medimatch-*: MediMatch docs/screenshots (the interface itself). bizmtaani, carepro, jamii, geneat, hazina, "
                      "biz-m-*: captures already published on the v4 site (geneat experience/lesnarai-v4-home media/).")


# -------------------------------------------------------------------- video
def video():
    """Old screen recordings from geneat ccf4d69, used only to test the reel idea."""
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    geneat = Path(os.environ.get("GENEAT", "/home/user/geneat"))
    (MEDIA / "reel").mkdir(exist_ok=True)
    for n in ["bizmtaani", "carepro", "jamii", "geneat", "hazina"]:
        raw = subprocess.run(["git", "-C", str(geneat), "show", f"ccf4d69:experience-lab/lesnarai-site-v1/media/live/{n}.mp4"], capture_output=True, check=True).stdout
        tmp = MEDIA / "reel" / f"{n}.src.mp4"
        tmp.write_bytes(raw)
        # Stream copy: a re-encode of an already-compressed recording came out larger.
        subprocess.run([ff, "-loglevel", "error", "-y", "-i", str(tmp), "-an", "-c:v", "copy", "-movflags", "+faststart",
                        str(MEDIA / "reel" / f"{n}.mp4")], check=True)
        # First frames are a blank page load; the poster is taken once the page has painted.
        jpg = MEDIA / "reel" / f"{n}-poster.jpg"
        subprocess.run([ff, "-loglevel", "error", "-y", "-ss", "2.5", "-i", str(tmp), "-frames:v", "1", "-q:v", "2", str(jpg)], check=True)
        Image.open(jpg).convert("RGB").save(MEDIA / "reel" / f"{n}-poster.webp", "WEBP", quality=72, method=6)
        jpg.unlink()
        tmp.unlink()
    provenance.append("reel/*.mp4: 1000x624 screen recordings from geneat commit ccf4d69, removed from v3 in 396f5ac for weight. "
                      "Audio stripped, video stream copied. Prototype material only: re-record before any release.")


# --------------------------------------------------------------------- font
def font():
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools import subset
    f = TTFont(FONTSRC / "mona-sans-latin-standard-normal.woff2")
    f = instantiateVariableFont(f, {"wght": (400, 700), "wdth": (100, 125)})
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "lnum", "case"]
    opts.name_IDs = ["*"]
    s = subset.Subsetter(opts)
    s.populate(unicodes=list(range(0x20, 0x7F)) + [0xA0, 0xA9, 0xB7, 0xD7, 0x2019, 0x201C, 0x201D, 0x2192, 0x2212, 0x2026, 0x2009, 0x202F])
    s.subset(f)
    f.flavor = "woff2"
    f.save(FONTS / "mona-sans.woff2")
    provenance.append("fonts/mona-sans.woff2: Mona Sans (SIL OFL 1.1) from @fontsource-variable/mona-sans, "
                      "limited to wght 400-700 and wdth 100-125, Basic Latin plus the few symbols the page uses.")


if __name__ == "__main__":
    n, transfers = medimatch_map()
    cols, loop = sentinel()
    images()
    video()
    font()
    (MEDIA / "PROVENANCE.md").write_text("# Where every asset came from\n\n" + "\n\n".join(f"- {p}" for p in provenance) + "\n")
    print(f"facilities={n} transfers={len(transfers)} sentinel_columns={cols} loop_m={loop}")
    for p in sorted(HERE.rglob("*")):
        if p.is_file() and "tools" not in p.parts:
            print(f"{p.stat().st_size:>8}  {p.relative_to(HERE)}")
