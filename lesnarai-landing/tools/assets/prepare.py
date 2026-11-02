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
SRC_MM = SITE.parent / "experience-lab/source-media/medimatch"
TVE = Path("/home/lesnar/Documents/LesnarTV-private-evidence")

# name: (source, width, crop(im)->box or None, provenance)
FRAMES = {
    "sentinel":   (SITE.parent / "experience-lab/source-media/sentinel/flight-2026-10-31/sentinel-flight-70s.jpg", 1080, None,
                   "Operation Sentinel in PX4 SITL + Gazebo, 31 Oct 2026: the corrected autonomy stack flying Run 2's mission between obstacles. Simulation, not flight evidence."),
    "mm-globe":   (SRC_MM / "roads-2026-11-01/mm-globe-flick.jpg", 1400, None,
                   "MediMatch intro, frame-exact capture 2026-11-01: the product's own hand flicks the globe."),
    "mm-kenya":   (SRC_MM / "roads-2026-11-01/mm-kenya-tap.jpg", 1400, None,
                   "MediMatch intro, same capture: the globe settles on Kenya and the tap lands."),
    "mm-roads":   (SRC_MM / "roads-2026-11-01/mm-roads-national.jpg", 1400, lambda im: (0, 0, im.width, round(im.height * 0.915)),
                   "MediMatch national command view, same capture: transfers on stored road routes. Synthetic inventory."),
    "mm-nairobi": (SRC_MM / "roads-2026-11-01/mm-roads-nairobi.jpg", 1400, None,
                   "MediMatch Nairobi County close-up, same capture, cropped above the panel's survey strip."),
    "zygos":      (CAP / "zygos-demo/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)),
                   "Zygos demonstration build, 390 px at 3x, Oct 2026. Records are fictional; the app says so."),
    "bizmtaani":  (CAP / "bizmtaani/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)),
                   "BizMtaani live storefront, 12 Oct 2026, phone layout. Real merchant listing."),
    "carepro":    (CAP / "carepro-live/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)),
                   "CarePro public home page, Oct 2026. Public surface only; no patient or nurse screens."),
    "lesnartv":   (TVE / "emulator-20261027/v03-journeys/glass-v3-home.png", 1400, lambda im: (0, 0, im.width, int(im.height * 0.70)),
                   "LESNAR TV 0.3 Glass home in the Android TV emulator, fixture apps, 1920x1080, cropped above third-party tiles."),
    "lesnarplay": (TVE / "tcl-20261028/tcl-play-0.4.0-coop-wave1.png", 1400, None,
                   "LESNAR PLAY 0.4.0 on the real TCL television, co-op wave 1, adb capture, 28 Oct 2026."),
    # ── case-page frames (Phase 2) ──
    "zygos-search":     (CAP / "zygos-demo/02-search-q-NovaCart.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "Zygos search for a fictional business, demonstration build, Oct 2026."),
    "zygos-claim":      (CAP / "zygos-demo-2/01-claims-ZC-2026-01000.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "Zygos claim record, demonstration build, fictional records."),
    "zygos-compare":    (CAP / "zygos-demo-2/02-compare-a-novacart-b-novacart-deals-ke.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "Zygos comparing two fictional businesses, demonstration build."),
    "zygos-method":     (CAP / "zygos-demo-2/03-methodology.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "Zygos methodology page, demonstration build."),
    "biz-villager":     (CAP / "bizmtaani-live/03-venues-villager.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "The Villager on BizMtaani, live, Oct 2026."),
    "biz-floor":        (CAP / "bizmtaani-demo/04-admin-floor.png", 600, lambda im: (0, 0, im.width, min(im.height, int(im.width * 1.9))), "BizMtaani merchant floor view, demonstration console, sample data."),
    "biz-daybook":      (CAP / "bizmtaani-demo/05-admin-daybook.png", 600, lambda im: (0, 0, im.width, min(im.height, int(im.width * 1.9))), "BizMtaani daybook, demonstration console, sample data."),
    "carepro-nurse":    (CAP / "carepro-live/02-register-role-NURSE.png", 600, lambda im: (0, 0, im.width, min(im.height, int(im.width * 1.9))), "CarePro public nurse registration page, Oct 2026."),
    "jamii-home":       (CAP / "jamii-live/01-home.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "Jamii Projects Hub public home page, Oct 2026."),
    "jamii-projects":   (CAP / "jamii-live/02-community-projects.png", 600, lambda im: (0, 0, im.width, int(im.width * 1.9)), "Jamii public community projects list, Oct 2026."),
    "geneat-flow":      (Path("/home/lesnar/Documents/ai model/project-assets/gen-eat-whatsapp-automation/01-whatsapp-flow.png"), 1400, None, "Gen-Eat portal, demonstration: stock café photo, synthetic till number."),
    "tv-ink":           (TVE / "emulator-20261027/v03-journeys/6-ink-home.png", 1400, lambda im: (0, 0, im.width, int(im.height * 0.70)), "LESNAR TV Ink theme, emulator, fixture apps, cropped above third-party tiles."),
    "tv-spaces":        (TVE / "emulator-20261027/v03-journeys/3-spaces-watch.png", 1400, lambda im: (0, 0, im.width, int(im.height * 0.70)), "LESNAR TV Spaces, emulator, fixture apps."),
    "play-phone":       (Path("/home/lesnar/Documents/Lesnar Play/artifacts/v2/phone-pad.png"), 844, None, "LESNAR PLAY phone controller, desktop-browser capture."),
    "play-lobby":       (Path("/home/lesnar/Documents/Lesnar Play/artifacts/v2/tv-crew-joined.png"), 1280, None, "LESNAR PLAY lobby with players joined, desktop-browser capture."),
}

def shown(src):
    """Repo-relative for sources inside this repository, home-relative otherwise."""
    try:
        return str(Path(src).relative_to(SITE.parent))
    except ValueError:
        return str(src).replace(str(Path.home()), "~")

def frames(manifest):
    for name, (src, width, crop, prov) in FRAMES.items():
        im = Image.open(src).convert("RGB")
        if crop:
            im = im.crop(crop(im))
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(OUT / f"{name}.webp", quality=80, method=6)
        im.save(OUT / f"{name}.jpg", quality=80, optimize=True, progressive=True)
        manifest[name] = {"w": im.width, "h": im.height, "source": shown(src), "provenance": prov}

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
        if isinstance(v, dict):
            print(k, v.get("w", ""), v.get("h", ""))
