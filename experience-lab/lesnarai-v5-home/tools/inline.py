"""Render index.html from index.src.html by inlining the generated SVGs and the
telemetry schema. Run after tools/build_assets.py."""
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MEDIA = HERE / "media"

NAMES = {
    "core": "State and command", "attitude": "Attitude", "angular rates": "Angular rates",
    "body accelerations": "Body accelerations", "battery / power": "Battery and power",
    "wind / environment": "Wind and environment", "navigation": "Navigation", "GPS quality": "GPS quality",
    "obstacle / airspeed": "Obstacles and airspeed", "flags": "Flags",
}


def columns():
    d = json.loads((MEDIA / "sentinel-columns.json").read_text())
    out = ['<div class="st__cols">']
    for g, cols in d["groups"]:
        out.append(f'<div class="st__g"><h4>{html.escape(NAMES.get(g, g))}<span>{len(cols)}</span></h4><ul>')
        out += [f"<li>{c}</li>" for c in cols]
        out.append("</ul></div>")
    out.append("</div>")
    return "\n".join(out), d["total"]


src = (HERE / "index.src.html").read_text()
cols, total = columns()
assert f'<span class="st__n">{total}</span>' in src, "schema count in the heading must match the source file"
src = src.replace("<!--#include medimatch-map.svg-->", (MEDIA / "medimatch-map.svg").read_text())
src = src.replace("<!--#include sentinel-mission.svg-->", (MEDIA / "sentinel-mission.svg").read_text())
src = src.replace("<!--#include sentinel-columns-->", cols)
assert "<!--#include" not in src
(HERE / "index.html").write_text(src)
print("index.html", len(src), "bytes")
