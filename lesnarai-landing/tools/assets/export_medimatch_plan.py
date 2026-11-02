#!/usr/bin/env python3
"""Export MediMatch's transfer plan for the site's road figures.

    # MediMatch running locally on its synthetic mock data (server on :4000, USE_MOCK_DB=true)
    python3 tools/assets/export_medimatch_plan.py [http://localhost:4000]

Writes tools/assets/medimatch-plan.json (build-time data; tools/ is never deployed):
  transfers  every transfer in the plan: origin and destination county, item, road km, minutes,
             and the key of its stored road geometry in MediMatch's server/data/road-routes.json
  meta       when and from where it was exported, plus the router metadata of the stored routes
Facilities are named only by county. The inventory behind each transfer is synthetic, so the
site never pairs a real hospital's name with a need it does not have.
"""
import json, sys, urllib.request
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
    transfers.append({"id": r["id"], "from": r["from"]["county"], "to": r["to"]["county"],
                      "item": r["item"], "km": r["distance_km"], "min": r["eta_min"], "route": k})
transfers.sort(key=lambda t: -t["km"])

out = {"meta": {"exported": date.today().isoformat(), "source": f"{base}/api/redistribution/plan?roads=1",
                "data": "MediMatch mock database: synthetic inventory, public facility locations",
                "routes": stored["meta"]},
       "transfers": transfers}
(TOOLS / "medimatch-plan.json").write_text(json.dumps(out, indent=1))
inter = [t for t in transfers if t["from"] != t["to"]]
print(f"{len(transfers)} transfers on {len({t['route'] for t in transfers})} stored routes; "
      f"{len(inter)} between counties, {len(transfers) - len(inter)} within a county")
