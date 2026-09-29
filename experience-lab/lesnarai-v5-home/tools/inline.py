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
src = src.replace("<!--#include sentinel-record.svg-->", (MEDIA / "sentinel-record.svg").read_text())
run = json.loads((MEDIA / "sentinel-run.json").read_text()) if (MEDIA / "sentinel-run.json").exists() else None
# Without a committed run the page says there is no flight. With one, the wording is
# decided by what the run's own telemetry and sealed mission record show.
flight = "No flight is on record, simulated or physical."
note = ("These are the perception pipeline’s own output in simulation. No flight log exists, simulated or physical, "
        "so none of this is a record of flight, and a run that recorded nothing is not a clean flight.")
cap = "The training mission: four waypoints, a loop of about 465 metres."
if run:
    OUTCOME = {
        "completed": "The bridge reported the mission complete.",
        "failed": "The mission did not complete.",
        "timeout": "The mission did not complete in the time allowed.",
        "teacher_exited": "The bridge stopped before the mission completed.",
    }
    mins = run["duration_s"] / 60 if run.get("duration_s") else None
    dur = f", {mins:.0f} minutes" if mins and mins >= 2 else (f", {run['duration_s']} seconds" if run.get("duration_s") else "")
    when = f" on {run['date']}" if run.get("date") else ""
    alt = f" at {run['plan_alt_m']:g} metres" if run.get("plan_alt_m") else ""
    climb = f", reaching {run['max_alt_m']:g} metres" if run.get("flew") else ", without leaving the ground"
    sealed = run.get("manifest_lists_csv_hash") and run.get("manifest_lists_mission_hash")
    cap = (f"<p>Planned: the console’s training mission, a {run['side_m']}-metre box{alt}, about {run['planned_m']} metres around. "
           f"{'Flown' if run.get('flew') else 'Recorded'} in simulation run {html.escape(str(run.get('run_id', run['csv'])))}{when}: {run['samples']:,} samples{dur}, "
           f"about {run['flown_m']:,} metres{climb}. {OUTCOME.get(run.get('outcome'), 'The mission outcome was not recorded.')}"
           + (" The telemetry and mission record match the run’s sealed manifest." if sealed else "") + "</p>")
    # The sealed runs before this one, and what stopped them (media/sentinel-history.json,
    # every sentence checked by tools/verify.py against the evidence and the fixes).
    hist_path = MEDIA / "sentinel-history.json"
    if hist_path.exists():
        hist = json.loads(hist_path.read_text())
        earlier = hist.get("earlier_runs", [])
        if earlier:
            count = {1: "One earlier sealed run", 2: "Two earlier sealed runs", 3: "Three earlier sealed runs"}.get(len(earlier), f"{len(earlier)} earlier sealed runs")
            # Said only when this run's own records show it flew the branch the fixes are in:
            # the run script's ref and commit, the orchestrator's sealed commit, and the
            # repository's own world file.
            flew_it = (hist.get("fix_state") == "merged" and run.get("bridge_ref") == hist.get("merged_into")
                       and run.get("bridge_commit") and run.get("bridge_commit") == run.get("repo_git_rev")
                       and run.get("world_unchanged"))
            cap += (f"<p>{count} stopped short. " + " ".join(r["sentence"] for r in earlier)
                    + " " + hist.get("fix_sentence", "")
                    + (f" This run flew that branch, at commit {run['bridge_commit'][:7]}." if flew_it else "") + "</p>")
    if run.get("flew"):
        flight = "A simulated flight is on record, and no physical one."
        note = ("These are the perception pipeline’s own output in simulation. None of these April runs has a flight log, "
                "so none of them is a record of flight, and a run that recorded nothing is not a clean flight. "
                "The detector behind them read a simulated lidar that, in the code of the time, modelled box obstacles as discs, "
                "so some of these detections may be of obstacles that were not there.")
src = src.replace("<!--#include sentinel-caption-->", cap)
src = src.replace("<!--#include sentinel-flight-->", flight)
src = src.replace("<!--#include sentinel-record-note-->", note)
assert "<!--#include" not in src
(HERE / "index.html").write_text(src)
print("index.html", len(src), "bytes")
