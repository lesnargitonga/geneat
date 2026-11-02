#!/usr/bin/env python3
"""Export MediMatch's transfer plan for the site's road figures.

    # MediMatch running locally on its synthetic mock data (server on :4000, USE_MOCK_DB=true)
    python3 tools/assets/export_medimatch_plan.py [http://localhost:4000]

Writes tools/assets/medimatch-plan.json (build-time data; tools/ is never deployed):
  transfers  every transfer in the plan: origin and destination county, item, and the key of its
             stored road geometry; road km and minutes are read from that stored route
             (MediMatch's server/data/road-routes.json, the routing authority), never from the plan
  meta       when and from where it was exported, plus the router metadata of the stored routes
Facilities are named only by county. The inventory behind each transfer is synthetic, so the
site never pairs a real hospital's name with a need it does not have.
"""
import json, math, sys, urllib.request
from datetime import date
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
MM = Path("/home/lesnar/publish-stage/MediMatch-wt-truth")
base = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4000").rstrip("/")

plan = json.load(urllib.request.urlopen(f"{base}/api/redistribution/plan?roads=1", timeout=30))
stored = json.loads((MM / "server/data/road-routes.json").read_text())
if not plan["impact"].get("roads_used"):
    sys.exit("the plan did not use stored roads; refusing to export estimates")

def key(a, b):
    return f"{a['lat']:.5f},{a['lon']:.5f}>{b['lat']:.5f},{b['lon']:.5f}"

transfers = []
for r in plan["routes"]:
    k = key(r["from"], r["to"])
    if not r["routed"] or k not in stored["routes"]:
        sys.exit(f"transfer {r['id']} has no stored road route ({k})")
    route = stored["routes"][k]
    # Distances and times come from the stored routing data, the authority; the plan must agree with it.
    if round(route["distance_km"]) != round(r["distance_km"]):
        sys.exit(f"transfer {r['id']}: plan says {r['distance_km']} km, stored route says {route['distance_km']} km")
    transfers.append({"id": r["id"], "from": r["from"]["county"], "to": r["to"]["county"],
                      "item": r["item"], "km": round(route["distance_km"]), "min": round(route["duration_min"]), "route": k})
transfers.sort(key=lambda t: -t["km"])

# Towns a route passes, so copy can name the corridor the router chose (it optimises driving time,
# not distance). A town counts when the stored geometry comes within 3 km of it.
TOWNS = {"Thika": (-1.033, 37.069), "Murang'a": (-0.721, 37.153), "Nyeri": (-0.42, 36.947), "Isiolo": (0.354, 37.582),
         "Marsabit": (2.334, 37.99), "Moyale": (3.527, 39.056), "Garissa": (-0.453, 39.646), "Wajir": (1.747, 40.057),
         "Machakos": (-1.517, 37.263), "Mtito Andei": (-2.69, 38.167), "Voi": (-3.396, 38.556), "Mombasa": (-4.043, 39.668),
         "Nakuru": (-0.303, 36.08), "Eldoret": (0.514, 35.27), "Kitale": (1.015, 35.006), "Lodwar": (3.119, 35.597),
         "Kisumu": (-0.092, 34.768), "Narok": (-1.08, 35.871), "Kericho": (-0.369, 35.283)}
def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))
for t in transfers:
    if t["from"] == t["to"]:
        continue
    coords = stored["routes"][t["route"]]["coords"]
    passed = []
    for name, c in TOWNS.items():
        d = [(hav(c, p), i) for i, p in enumerate(coords)]
        dist, idx = min(d)
        if dist <= 3 and name not in (t["from"], t["to"]):
            passed.append((idx, name))
    t["via"] = [n for _, n in sorted(passed)]

out = {"meta": {"exported": date.today().isoformat(), "source": f"{base}/api/redistribution/plan?roads=1",
                "data": "MediMatch mock database: synthetic inventory, public facility locations",
                "routes": stored["meta"]},
       "transfers": transfers}
(TOOLS / "medimatch-plan.json").write_text(json.dumps(out, indent=1))
inter = [t for t in transfers if t["from"] != t["to"]]
print(f"{len(transfers)} transfers on {len({t['route'] for t in transfers})} stored routes; "
      f"{len(inter)} between counties, {len(transfers) - len(inter)} within a county")
