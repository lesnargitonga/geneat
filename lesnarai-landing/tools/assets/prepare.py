#!/usr/bin/env python3
"""Prepare the real artifacts the Field Record pages use, with provenance.

    python3 tools/assets/prepare.py

Every output is derived from a real source, recorded below. Captures are resized, never
retouched; crops only remove third-party or private UI at the edges. Each image is written
as WebP plus a JPEG fallback, and assets/manifest.json records size and source for each.
"""
import json, re
from pathlib import Path
from PIL import Image

SITE = Path(__file__).resolve().parents[2]
OUT = SITE / "assets" / "field"
TOOLS = Path(__file__).resolve().parent   # build-time data stays out of the deployed site
MM = Path("/home/lesnar/publish-stage/MediMatch-wt-truth")
CAP = Path("/home/lesnar/Productions/LESNAR-Episode-001/07-assets/captures")
SRC_MM = Path("/home/lesnar/Documents/ai model/experience-lab/source-media/medimatch")
TVE = Path("/home/lesnar/Documents/LesnarTV-private-evidence")

# name: (source, width, crop(im)->box or None, provenance)
FRAMES = {
    "sentinel":   (SITE / "media/sentinel-film-poster.jpg", 1200, None,
                   "Film 001 MC2 frame: a reconstruction of PX4's x500 in a sealed SITL run's world. Not flight evidence."),
    "medimatch":  (SRC_MM / "mm-route-1440@3x.png", 1400, None,
                   "MediMatch running locally, national view, Nairobi to Mandera transfer. Synthetic inventory."),
    "zygos":      (CAP / "zygos-demo/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)),
                   "Zygos demonstration build, 390 px at 3x, Oct 2026. Records are fictional; the app says so."),
    "bizmtaani":  (CAP / "bizmtaani/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)),
                   "BizMtaani live storefront, 12 Oct 2026, phone layout. Real merchant listing."),
    "carepro":    (CAP / "carepro-live/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)),
                   "CarePro public home page, Oct 2026. Public surface only; no patient or nurse screens."),
    "lesnartv":   (TVE / "emulator-20261027/v03-journeys/glass-v3-home.png", 1400, lambda im: (0, 0, im.width, int(im.height * 0.78)),
                   "LESNAR TV 0.3 Glass home in the Android TV emulator, fixture apps, 1920x1080, cropped above third-party tiles."),
    "lesnarplay": (TVE / "tcl-20261028/tcl-play-0.4.0-coop-wave1.png", 1400, None,
                   "LESNAR PLAY 0.4.0 on the real TCL television, co-op wave 1, adb capture, 28 Oct 2026."),
}

def frames(manifest):
    for name, (src, width, crop, prov) in FRAMES.items():
        im = Image.open(src).convert("RGB")
        if crop:
            im = im.crop(crop(im))
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(OUT / f"{name}.webp", quality=80, method=6)
        im.save(OUT / f"{name}.jpg", quality=80, optimize=True, progressive=True)
        manifest[name] = {"w": im.width, "h": im.height, "source": str(src).replace(str(Path.home()), "~"), "provenance": prov}

def kenya(manifest):
    ts = (MM / "client/src/data/kenya.ts").read_text()
    outline = json.loads(re.search(r"=\s*(\[\[.*?\]\])", ts, re.S).group(1))
    routes = json.loads((MM / "server/data/road-routes.json").read_text())["routes"]
    lon0, lon1, lat0, lat1 = 33.7, 42.2, -4.9, 5.2
    W = 860; H = round(W * (lat1 - lat0) / (lon1 - lon0), 1)
    px = lambda lon: (lon - lon0) / (lon1 - lon0) * W
    py = lambda lat: (lat1 - lat) / (lat1 - lat0) * H
    land = "M" + " L".join(f"{px(x):.1f},{py(y):.1f}" for x, y in outline) + " Z"
    roads = ["M" + " L".join(f"{px(lo):.1f},{py(la):.1f}" for la, lo in r["coords"][::2] + [r["coords"][-1]]) for r in routes.values()]
    places = {"nairobi": (36.817, -1.286), "embu": (37.457, -0.531), "mbeere": (37.640, -0.590), "mandera": (41.856, 3.937)}
    data = {"w": W, "h": H, "land": land, "roads": roads,
            "places": {k: [round(px(x), 1), round(py(y), 1)] for k, (x, y) in places.items()},
            "km": sorted((round(r["distance_km"]) for r in routes.values()), reverse=True)}
    (TOOLS / "kenya.json").write_text(json.dumps(data))
    manifest["kenya"] = {"source": "MediMatch kenya.ts (Natural Earth 50m, public domain) + road-routes.json (OSRM on OpenStreetMap, ODbL)",
                         "routes": len(roads)}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    frames(manifest); kenya(manifest)
    (TOOLS / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    for k, v in manifest.items():
        print(k, v.get("w", ""), v.get("h", ""))
