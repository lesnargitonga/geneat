"""Render index.html from index.src.html: inline the generated SVGs and the flight
replay data, and write the flight sentences from the committed run's own records.
Run after tools/build_assets.py."""
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MEDIA = HERE / "media"
LOGS = "https://github.com/lesnargitonga/LesnarAI/tree/evidence/sitl-run-{rid}/evidence/runs/{rid}"

src = (HERE / "index.src.html").read_text()
total = json.loads((MEDIA / "sentinel-columns.json").read_text())["total"]
assert f"records {total} measurements" in src, "the measurement count must match the bridge's CSV header"
src = src.replace("<!--#include medimatch-map.svg-->", (MEDIA / "medimatch-map.svg").read_text())
src = src.replace("<!--#include sentinel-mission.svg-->", (MEDIA / "sentinel-mission.svg").read_text())
flight_json = (MEDIA / "flight.json").read_text() if (MEDIA / "flight.json").exists() else ""
assert "</" not in flight_json
src = src.replace("<!--#include flight-json-->", flight_json)

run = json.loads((MEDIA / "sentinel-run.json").read_text() or "null") if (MEDIA / "sentinel-run.json").exists() else None
# Without a committed run the page says there is no flight. With one, the wording is
# decided by what the run's own telemetry and sealed mission record show.
status = "No flight is on record, simulated or physical."
facts, history = "", ""
if run:
    rid = html.escape(str(run["run_id"]))
    if run.get("flew"):
        status = "Flown in simulation, in PX4 and Gazebo. No real aircraft has flown it yet."
    mins = run["duration_s"] / 60 if run.get("duration_s") else None
    dur = f"{mins:.0f} minutes" if mins and mins >= 2 else f"{run['duration_s']} seconds"
    OUTCOME = {"completed": "It completed the route", "failed": "It did not complete the route",
               "timeout": "It did not complete the route in the time allowed",
               "teacher_exited": "The bridge stopped before the route was complete"}
    landed = " and landed where it took off" if run.get("landed") and run.get("outcome") == "completed" else ""
    sealed = run.get("manifest_lists_csv_hash") and run.get("manifest_lists_mission_hash")
    facts = (f"The latest flight, on {run['date']}: a {run['side_m']}-metre square at {run['plan_alt_m']:g} metres. "
             f"{OUTCOME.get(run.get('outcome'), 'Its outcome was not recorded')}{landed}, flying about {run['flown_m']:,} metres "
             f"in {dur} and reaching {run['max_alt_m']:g} metres. "
             + (f"All {run['samples']:,} readings match the flight’s sealed manifest. " if sealed else f"{run['samples']:,} readings. ")
             + f'<a href="{LOGS.format(rid=rid)}" rel="noopener">Full flight log, {rid}, on GitHub <svg class="ext" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4"/></svg></a>')
    # The sealed runs before this one, and what stopped them (media/sentinel-history.json,
    # every sentence checked by tools/verify.py against the evidence and the fixes).
    hist_path = MEDIA / "sentinel-history.json"
    if hist_path.exists():
        hist = json.loads(hist_path.read_text())
        earlier = hist.get("earlier_runs", [])
        if earlier:
            count = {1: "The first test flight", 2: "The first two test flights", 3: "The first three test flights"}.get(len(earlier), f"The first {len(earlier)} test flights")
            # Said only when this run's own records show it flew the code the fixes are in:
            # the run script's ref and commit, the orchestrator's sealed commit, and the
            # repository's own world file.
            flew_it = (hist.get("fix_state") == "merged" and run.get("bridge_ref") == hist.get("merged_into")
                       and run.get("bridge_commit") and run.get("bridge_commit") == run.get("repo_git_rev")
                       and run.get("world_unchanged"))
            history = (f"{count} stopped short. " + " ".join(r["sentence"] for r in earlier) + " " + hist.get("fix_sentence", "")
                       + (f" This flight ran that code, at commit {run['bridge_commit'][:7]}." if flew_it else ""))
src = src.replace("<!--#include sentinel-status-->", status)
src = src.replace("<!--#include sentinel-facts-->", facts)
src = src.replace("<!--#include sentinel-history-->", history)
assert "<!--#include" not in src
(HERE / "index.html").write_text(src)
print("index.html", len(src), "bytes")
