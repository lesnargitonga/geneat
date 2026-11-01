#!/usr/bin/env python3
"""Fill Field Record data markers in every page from one source of truth.

    python3 tools/sentinel/build_figures.py --repo ~/workspace/LesnarAI   # Sentinel figures
    python3 tools/assets/prepare.py                                        # map + captures
    python3 tools/field/build.py                                           # this

Markers (<!-- gen:NAME --> ... <!-- /gen:NAME -->), usable on any page:
  sentinel-speed, sentinel-detections, sentinel-plan
      copied from /work/sentinel/, which owns the sealed-run figures
  medimatch-km   road distance of every MediMatch transfer, as bars
  kenya-map      Kenya outline, all stored road routes, and the places our systems run
Idempotent: re-running on unchanged inputs changes nothing.
"""
import json, re, sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
KENYA = json.loads((SITE / "tools/assets/kenya.json").read_text())
SENTINEL = (SITE / "work/sentinel/index.html").read_text()

def block(html, name):
    m = re.search(rf"<!-- gen:{name} -->\n?(.*?)\n?<!-- /gen:{name} -->", html, re.S)
    if not m:
        sys.exit(f"work/sentinel/index.html has no gen:{name} block; run build_figures.py first")
    return m.group(1).strip()

def km_bars():
    top = KENYA["km"][0]
    bars = "".join(f'<i style="--h:{k / top:.3f}"></i>' for k in KENYA["km"])
    return (f'<div class="bars" role="img" aria-label="Road distance of each of {len(KENYA["km"])} MediMatch transfers, '
            f'longest {top} km, shortest {KENYA["km"][-1]} km">{bars}</div>')

MARKS = [  # key, label, sub, dx, dy, anchor
    ("embu", "EMBU", "BizMtaani · live", 120, -60, "start"),
    ("mbeere", "MBEERE NORTH", "Jamii · pilot in preparation", 150, 30, "start"),
    ("nairobi", "NAIROBI", "CarePro · controlled beta", -150, 40, "end"),
    ("mandera", "MANDERA", "MediMatch · modelled route", -40, 60, "end"),
]

def kenya_map():
    P = KENYA["places"]
    out = [f'<svg viewBox="0 0 {KENYA["w"]} {KENYA["h"]}" role="img" aria-labelledby="map-t">',
           '<title id="map-t">Kenya, the stored road routes MediMatch uses, and the places our systems run: '
           'BizMtaani in Embu, Jamii Projects Hub in Mbeere North, CarePro in Nairobi, and a modelled MediMatch route to Mandera.</title>',
           f'<path class="land" d="{KENYA["land"]}"/>',
           '<g class="roads">' + "".join(f'<path d="{d}"/>' for d in KENYA["roads"]) + "</g>"]
    for key, label, sub, dx, dy, anchor in MARKS:
        x, y = P[key]; tx = x + dx + (6 if anchor == "start" else -6)
        out.append(f'<g class="mk"><rect x="{x - 5}" y="{y - 5}" width="10" height="10"/>'
                   f'<line x1="{x}" y1="{y}" x2="{x + dx}" y2="{y + dy}"/>'
                   f'<text class="pl" x="{tx}" y="{y + dy - 4}" text-anchor="{anchor}">{label}</text>'
                   f'<text class="ps" x="{tx}" y="{y + dy + 13}" text-anchor="{anchor}">{sub}</text></g>')
    out.append("</svg>")
    return "\n".join(out)

FILL = {
    "sentinel-speed": lambda: block(SENTINEL, "speed"),
    "sentinel-detections": lambda: block(SENTINEL, "detections"),
    "sentinel-plan": lambda: block(SENTINEL, "plan"),
    "medimatch-km": km_bars,
    "kenya-map": kenya_map,
}

def fill(path: Path) -> bool:
    html = path.read_text()
    new = html
    for name, make in FILL.items():
        pat = re.compile(rf"(<!-- gen:{name} -->)(.*?)(<!-- /gen:{name} -->)", re.S)
        if pat.search(new):
            # SVG ids must stay unique per page: suffix them by marker name
            body = make()
            if name.startswith("sentinel-") and path.parent.name != "sentinel":
                body = re.sub(r'id="([a-z]+-[a-z])"', rf'id="\1-{name[9:]}"', body)
                body = re.sub(r'aria-labelledby="([a-z]+-[a-z]) ([a-z]+-[a-z])"', rf'aria-labelledby="\1-{name[9:]} \2-{name[9:]}"', body)
            new = pat.sub(lambda m: f"{m.group(1)}\n{body}\n{m.group(3)}", new)
    if new != html:
        path.write_text(new)
        return True
    return False

if __name__ == "__main__":
    changed = [p for p in sorted(SITE.rglob("*.html")) if "node_modules" not in p.parts and "tools" not in p.parts and fill(p)]
    print("filled:", ", ".join(str(p.relative_to(SITE)) for p in changed) or "nothing changed")
