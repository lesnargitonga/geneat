#!/usr/bin/env python3
"""Fill Field Record data markers in every page from one source of truth.

    python3 tools/sentinel/build_figures.py --repo ~/workspace/LesnarAI   # Sentinel figures
    python3 tools/assets/prepare.py                                        # map + captures
    python3 tools/field/build.py                                           # this

Markers (<!-- gen:NAME --> ... <!-- /gen:NAME -->), usable on any page:
  sentinel-speed, sentinel-detections, sentinel-plan
      copied from /work/sentinel/, which owns the sealed-run figures
  medimatch-km      road km of the transfers that cross a county line, as channel bars
  medimatch-routes  every transfer's road km as a ranked table-chart (the table is the chart)
  medimatch-map     MediMatch's own map: every road route between counties, Nairobi to Mandera picked out
  medimatch-nairobi Nairobi County at street scale, where 43 of the transfers stay
  kenya-map         Kenya outline, all stored road routes, and the places our systems run
Also, on every page: <span class="avail" data-avail="KEY"></span> is filled from availability.json.
Idempotent: re-running on unchanged inputs changes nothing.
"""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

SITE = Path(__file__).resolve().parents[2]
KENYA = json.loads((SITE / "tools/assets/kenya.json").read_text())
SENTINEL = (SITE / "work/sentinel/index.html").read_text()
PLAN = json.loads((SITE / "tools/assets/medimatch-plan.json").read_text())
MM_ROUTES = Path("/home/lesnar/publish-stage/MediMatch-wt-truth/server/data/road-routes.json")
TRANSFERS = PLAN["transfers"]                                   # sorted, longest first
INTER = [t for t in TRANSFERS if t["from"] != t["to"]]
LOCAL = [t for t in TRANSFERS if t["from"] == t["to"]]

def block(html, name):
    m = re.search(rf"<!-- gen:{name} -->\n?(.*?)\n?<!-- /gen:{name} -->", html, re.S)
    if not m:
        sys.exit(f"work/sentinel/index.html has no gen:{name} block; run build_figures.py first")
    return m.group(1).strip()

def km_bars():
    top = INTER[0]["km"]
    bars = "".join(f'<i style="--h:{t["km"] / top:.3f}" title="{t["from"]} to {t["to"]}: {t["km"]:,} km"></i>' for t in INTER)
    return (f'<div class="bars" role="img" aria-label="Road distance of the {len(INTER)} MediMatch transfers that cross a county line, '
            f'longest {top:,} km (Nairobi to Mandera), shortest {INTER[-1]["km"]} km">{bars}</div>')

def item_name(t):
    return t["item"].split(" (")[0].lower().replace("iv ", "IV ")

def km_routes():
    top = INTER[0]["km"]
    lo, hi = min(t["km"] for t in LOCAL), max(t["km"] for t in LOCAL)
    med = sorted(t["km"] for t in LOCAL)[len(LOCAL) // 2]
    rows = []
    for t in INTER:
        rows.append(f'<tr{" class=\"kmtab__pick\"" if t is INTER[0] else ""}><th scope="row">{t["from"]} → {t["to"]}<span>{item_name(t)}</span></th>'
                    f'<td class="kmtab__bar"><i style="--v:{t["km"] / top:.4f}"></i></td>'
                    f'<td class="kmtab__v">{t["km"]:,}<small> km</small></td></tr>')
    rows.append(f'<tr class="kmtab__local"><th scope="row">Within Nairobi County<span>{len(LOCAL)} transfers, median {med} km</span></th>'
                f'<td class="kmtab__bar"><i style="--v:{hi / top:.4f}"></i></td>'
                f'<td class="kmtab__v">{lo}–{hi}<small> km</small></td></tr>')
    return ('<table class="kmtab"><caption class="sr">Road distance of each MediMatch transfer, longest first. '
            f'{len(INTER)} cross a county line; the other {len(LOCAL)} stay inside Nairobi County.</caption>'
            '<thead class="sr"><tr><th scope="col">Transfer</th><th scope="col">Bar</th><th scope="col">Road distance</th></tr></thead><tbody>'
            + "".join(rows) + "</tbody></table>")

def mm_map():
    stored = json.loads(MM_ROUTES.read_text())["routes"]
    lon0, lon1, lat0, lat1 = 33.7, 42.2, -4.9, 5.2                # the projection prepare.py uses for kenya.json
    W, H = KENYA["w"], KENYA["h"]
    px = lambda lon: (lon - lon0) / (lon1 - lon0) * W
    py = lambda lat: (lat1 - lat) / (lat1 - lat0) * H
    path = lambda pts, fx, fy: "M" + " L".join(f"{fx(lo):.1f},{fy(la):.1f}" for la, lo in pts)
    thin = lambda c: c[::2] + [c[-1]]
    pick = INTER[0]
    seen = set(); inter_paths = []
    for t in INTER:
        if t["route"] in seen or t is pick: continue
        seen.add(t["route"]); inter_paths.append(path(thin(stored[t["route"]]["coords"]), px, py))
    pick_path = path(thin(stored[pick["route"]]["coords"]), px, py)
    ends = {}
    for t in INTER:
        c = stored[t["route"]]["coords"][-1]
        ends.setdefault(t["to"], (px(c[1]), py(c[0])))
    labels = []
    mx, my = ends[pick["to"]]
    for name, (x, y) in ends.items():
        anchor, dx = ("end", -8) if x > W * .72 else ("start", 8)
        ty = y - 12 if name == pick["to"] else y + 4             # the picked end carries its distance below
        labels.append(f'<circle class="end" cx="{x:.1f}" cy="{y:.1f}" r="4"/><text class="ps" x="{x + dx:.1f}" y="{ty:.1f}" text-anchor="{anchor}">{name.upper()}</text>')
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="mmmap-t mmmap-d">',
           '<title id="mmmap-t">MediMatch transfers on Kenyan roads</title>',
           f'<desc id="mmmap-d">{len(TRANSFERS)} transfers on stored road routes. {len(INTER)} cross a county line, the longest Nairobi to Mandera at '
           f'{pick["km"]:,} km. The inset shows Nairobi County, where the other {len(LOCAL)} transfers run, 1 to 26 km each.</desc>',
           f'<path class="land" d="{KENYA["land"]}"/>',
           '<g class="roads">' + "".join(f'<path d="{d}"/>' for d in inter_paths) + "</g>",
           f'<g class="roads roads--pick"><path d="{pick_path}"/></g>',
           '<g class="ends">' + "".join(labels) + "</g>",
           f'<text class="pl" x="{mx - 8:.1f}" y="{my + 24:.1f}" text-anchor="end">{pick["km"]:,} KM BY ROAD</text>',
           "</svg>"]
    return "\n".join(out)

def mm_nairobi():
    """Nairobi County at street scale: the 43 transfers that never leave it."""
    stored = json.loads(MM_ROUTES.read_text())["routes"]
    pts = [p for t in LOCAL for p in stored[t["route"]]["coords"]]
    la0, la1 = min(p[0] for p in pts) - .015, max(p[0] for p in pts) + .015
    lo0, lo1 = min(p[1] for p in pts) - .015, max(p[1] for p in pts) + .015
    W = 600; s = W / (lo1 - lo0); H = round((la1 - la0) * s, 1)
    x = lambda lon: (lon - lo0) * s
    y = lambda lat: (la1 - lat) * s
    seen = set(); paths = []; ends = []
    for t in LOCAL:
        if t["route"] in seen: continue
        seen.add(t["route"]); c = stored[t["route"]]["coords"]
        paths.append("M" + " L".join(f"{x(lo):.1f},{y(la):.1f}" for la, lo in c))
        ends.append(c[-1])
    hubs = {tuple(stored[t["route"]]["coords"][0]) for t in LOCAL}
    km = sorted(t["km"] for t in LOCAL)
    return "\n".join([f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="mmnai-t mmnai-d">',
        '<title id="mmnai-t">Nairobi County: transfers inside the county</title>',
        f'<desc id="mmnai-d">{len(LOCAL)} transfers from Nairobi hubs to facilities in the county, on {len(paths)} stored road routes, '
        f'{km[0]} to {km[-1]} km each, median {km[len(km) // 2]} km.</desc>',
        '<g class="roads roads--local">' + "".join(f'<path d="{d}"/>' for d in paths) + "</g>",
        '<g class="ends">' + "".join(f'<circle class="end" cx="{x(lo):.1f}" cy="{y(la):.1f}" r="3"/>' for la, lo in ends) + "</g>",
        "".join(f'<rect class="hub" x="{x(lo) - 5:.1f}" y="{y(la) - 5:.1f}" width="10" height="10"/>' for la, lo in sorted(hubs)),
        "</svg>"])

AVAIL = json.loads((SITE / "tools/field/availability.json").read_text())

def fill_avail(html):
    """<span class="avail" data-avail="KEY">…</span>: an outage note from check_availability.py. A system that
    answered is not annotated; one that did not says so, beside the claims that would otherwise imply it runs."""
    noted = set()          # once per page, at the first mention: a note, not an outage board
    def one(m):
        key = m.group(1)
        sysd = AVAIL["systems"].get(key)
        if sysd is None:
            sys.exit(f"no availability record for {key}; add it to check_availability.py")
        if sysd["up"] or key in noted:     # say nothing when it answers: maturity speaks for itself
            return f'<span class="avail" data-avail="{key}" hidden></span>'
        noted.add(key)
        return f'<span class="avail avail--down" data-avail="{key}">Offline when last checked, {AVAIL["date"]}</span>'
    return re.sub(r'<span class="avail[^"]*" data-avail="([a-z]+)"(?: hidden)?>[^<]*</span>', one, html)

MARKS_MAP = [  # key, label, sub, dx, dy, anchor
    ("embu", "EMBU", "BizMtaani · live", 120, -60, "start"),
    ("mbeere", "MBEERE NORTH", "Jamii · pilot in preparation", 150, 30, "start"),
    ("nairobi", "NAIROBI", "CarePro · controlled beta", -96, 52, "end"),
    ("mandera", "MANDERA", "MediMatch · modelled route", -40, 60, "end"),
]

def kenya_map():
    P = KENYA["places"]
    out = [f'<svg viewBox="0 0 {KENYA["w"]} {KENYA["h"]}" role="img" aria-labelledby="map-t">',
           '<title id="map-t">Kenya, the stored road routes MediMatch uses, and the places our systems run: '
           'BizMtaani in Embu, Jamii Projects Hub in Mbeere North, CarePro in Nairobi, and a modelled MediMatch route to Mandera.</title>',
           f'<path class="land" d="{KENYA["land"]}"/>',
           '<g class="roads">' + "".join(f'<path d="{d}"/>' for d in KENYA["roads"]) + "</g>"]
    for key, label, sub, dx, dy, anchor in MARKS_MAP:
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
    "medimatch-routes": km_routes,
    "medimatch-map": mm_map,
    "medimatch-nairobi": mm_nairobi,
    "kenya-map": kenya_map,
}

def fill_counts(html):
    """<!-- gen:count -->N<!-- /gen:count --> in a Work stage group: the rows that group really holds."""
    def group(m):
        body = m.group(0)
        n = len(re.findall(r'class="gaz__row"', body))
        return re.sub(r'<!-- gen:count -->\d+<!-- /gen:count -->', f'<!-- gen:count -->{n}<!-- /gen:count -->', body, count=1)
    return re.sub(r'<div class="stage-group">.*?(?=<div class="stage-group">|</section>)', group, html, flags=re.S)

def fill(path: Path) -> bool:
    html = path.read_text()
    new = fill_counts(fill_avail(html))
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
