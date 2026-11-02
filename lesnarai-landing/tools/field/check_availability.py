#!/usr/bin/env python3
"""Record whether each public system answers right now.

    python3 tools/field/check_availability.py      # then python3 tools/field/build.py

Writes tools/field/availability.json. A system's stage (Live, Pilot…) says how far it got; this
file says whether it can be reached today, which is a different fact. build.py fills every
<span class="avail" data-avail="KEY"></span> on the site from it, so no page states availability
by hand. Re-run before every release. Addresses stay here, in build-time data, and are not printed
on the site.
"""
import json, ssl, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent / "availability.json"
SYSTEMS = {
    "bizmtaani": "https://bizmtaani.com/",
    "carepro": "https://carepro.co.ke/",
    "jamii": "https://jamii.lesnarai.co.ke/",
    "hazina": "https://hazina.lesnarai.co.ke/",
    "geneat": "https://geneat.lesnarai.co.ke/",
    "hospitality": "https://elixirs.lesnarai.co.ke/",   # client pilot, shown unnamed
    "redsky": "https://redsky.lesnarai.com/",           # Red Sky Security staging
}

def probe(url):
    req = urllib.request.Request(url, headers={"User-Agent": "LESNAR-AI-availability-check/1"})
    try:
        with urllib.request.urlopen(req, timeout=20, context=ssl.create_default_context()) as r:
            return {"up": 200 <= r.status < 400, "result": r.status}
    except urllib.error.HTTPError as e:
        return {"up": False, "result": e.code}
    except Exception as e:
        return {"up": False, "result": type(e).__name__}

if __name__ == "__main__":
    now = datetime.now(timezone(timedelta(hours=3)))
    data = {"checked": now.strftime("%Y-%m-%d %H:%M EAT"), "date": now.strftime("%-d %b %Y"),
            "systems": {k: probe(u) for k, u in SYSTEMS.items()}}
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    for k, v in data["systems"].items():
        print(f"{k:12} {'online ' if v['up'] else 'OFFLINE'} {v['result']}")
    print("checked", data["checked"])
