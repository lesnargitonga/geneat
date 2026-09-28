# Handoff: work that has to happen on the Precision

The cloud session that built this prototype cannot reach the Precision. These
steps are for a Claude Code session running on the Precision itself (start it
with `claude remote-control` in a terminal, so it also shows up in the Claude
Code app), or for doing by hand. They are in order of value.

Rules for all of it: no force-push, no history rewrite, no deploy, nothing
under production. Never commit `.env`, `deploy/render/*.local.env`, tokens,
Hugging Face keys or model weights.

## 1. Push the local website work that never reached GitHub (done 28 September 2026: `experience/lesnarai-v5-static` at `18a73f3`)

The later site work (Phase 9 corrections, the claims registry and evidence
contract, commits `b511535` and `18a73f3`) exists only on this machine.

```bash
cd <the local geneat clone>
git fetch origin
git branch --contains 18a73f3        # the branch that holds it
git status                           # must be clean before pushing
git push origin <that branch>
```

If the branch name already exists on GitHub with different history, stop and
push to a new name instead (for example `experience/lesnarai-v6-local`), then
say which. The renamed `.vercel.unlinked` link file is gitignored and stays
local; do not rename it back.

## 2. One real Operation Sentinel run

Online mode only: PX4 SITL flying the x500 in Gazebo Harmonic. An `--offline`
run (the pure Python simulator, 16 columns) cannot be used, and the build
refuses one. `tools/sentinel_run.sh` does the whole run with the LesnarAI repo's
own tooling. On the Precision, from the geneat checkout, without switching
branches:

```bash
cd ~/Documents/"ai model"
git fetch origin claude/production-timings-stale-claims-2eg7vc
git show origin/claude/production-timings-stale-claims-2eg7vc:experience-lab/lesnarai-v5-home/tools/sentinel_run.sh > /tmp/sentinel_run.sh
bash /tmp/sentinel_run.sh
```

It starts the stack with `scripts/start_stack_verified.sh` unless it is up, runs
`/launch-all` (Gazebo headless, PX4 SITL, teacher bridge), waits for online
telemetry, then sends the console's own START TRAINING mission, built exactly as
`frontend/src/components/DroneList.js` builds it: a 25 m box at 10 m around the
drone, on the Redis `commands` channel in the format `backend/app.py` publishes.
It follows the teacher log until the mission completes or fails, lands, writes
`mission.json` and the run's teacher log into the run directory, and seals it
all with `/kill-all`. It stops the stack again if it started it, then commits
the sealed files to a new branch `evidence/sitl-run-<run_id>` of the LesnarAI
repo from a separate worktree. It scans them and pushes. A failed flight is
still sealed and pushed, and says so. If the scan finds anything that looks
like a secret or a private IP, it stops before committing.

The earlier sequence here (`start_gz_world.sh`, `spawn_px4_drone.sh` and the
collector by hand) did not produce a manifest: only the orchestrator's
`/launch-all` and `/kill-all` create and seal a run directory. And the
orchestrator's teacher waits for commands, so without a dispatched mission the
drone never leaves the ground.

Then, from this directory:

```bash
E=<LesnarAI checkout>/evidence/runs/<run_id>
SENTINEL_TELEMETRY=$E/telemetry_live_0.csv SENTINEL_MANIFEST=$E/MANIFEST.json \
python3 tools/build_assets.py && python3 tools/inline.py && \
SENTINEL_TELEMETRY=$E/telemetry_live_0.csv SENTINEL_MANIFEST=$E/MANIFEST.json python3 tools/verify.py
```

The mission figure then draws the dispatched box from the run's sealed
`mission.json` and the recorded path over it. It never uses
`training/px4_waypoints.json`, which is in Nairobi and which no code flies. The
status line and the record caption change only if the telemetry shows the
aircraft climbing above 2 m. `verify.py` recomputes the telemetry and mission
hashes against the manifest.

## 3. Model Foundry material (the evaluation is already in the Phase 9 registry; this step is only for more)

The Phase 9 record says no fine-tune has been produced; the Hazina dataset in
`training/hazina/` was prepared but not trained. The page shows the llama.cpp
against Ollama evaluation from `~/precision-main-setup/reports/`. If further
evaluation runs exist there, commit their small, non-secret reports (markdown,
JSON or CSV), never weights or tokens. Anything that shows a model failing is
exactly what the section wants.

## 4. Operation Sentinel console (product fix, separate from the site; done 28 September 2026: branch `fix/console-real-state` in `lesnargitonga/lesnarai`, commit `5e54c29`, not merged)

`frontend/src/components/DiagnosticTerminal.js` lines 48 to 54 print a fixed
boot sequence ("ENCRYPTION LAYER: AES-256-GCM ACTIVE", "SYSTEM STATUS:
OPTIMAL") on every load, whatever the real state. Either drive those lines
from real state or remove them. Until then the console stays off the website.

The fix replaces the boot text, the always-green Live_Stream label, the fixed
buffer and signal readouts and the "Secure Link" claim with what App already
measures (socket connection, health round trip, telemetry age). The Analytics
cards still carry a fixed Live_Stream label and were left alone. Review and
merge it; the console stays off the website either way, for its visual style.

## After all four

Push, then tell the cloud session (or the owner) which branch and which run
ID. The homepage is rebuilt from those, and `tools/verify.py` must still pass.
