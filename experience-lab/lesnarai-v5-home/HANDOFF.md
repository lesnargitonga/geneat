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

## 2. One real Operation Sentinel run (done 28 and 29 September 2026)

Result: four sealed online runs, each on its own LesnarAI branch
`evidence/sitl-run-<run_id>`, committed by the owner from the Precision.

| Run | Bridge | Outcome | What it showed |
|---|---|---|---|
| `px4_teacher_20260928_194728_d1` | `main` (`906a465`) | timeout | Took off to 10 m and hovered at home for ten minutes: offboard never engaged (MAVSDK `NO_SETPOINT_SET`), and the bridge navigated anyway. Fixed in `6a40f0f`. |
| `px4_teacher_20260928_203728_d1` | `6a40f0f` | timeout | Flew the first 25 m leg, then the simulated lidar held it 11 m short of waypoint 2. It had read `Wall_1`, a 1 m x 38 m box, as a 19 m disc. Fixed in `bcf9e52`. |
| `px4_teacher_20260928_205942_d1` | `bcf9e52` | completed | The whole box: 608 samples, 126 s, about 98 m, all four waypoints. |
| `px4_teacher_20260929_082014_d1` | `main` (`3ba2677`) | completed | The whole box again, from a stock checkout of the merged `main` with `obstacles.sdf` unchanged: 608 samples, 126 s, about 99 m, peak 9.6 m, landed. This is the run the page draws. |

The first three used a copy of `obstacles.sdf` that gained the NavSat and Magnetometer
systems and the spherical coordinates PX4 expects; `mission.json` in each run records
exactly what was added. The fourth needed none: `main`'s `obstacles.sdf` already has
them.

Since then, all of it is in LesnarAI's `main` (`3ba2677`), through four pull requests
on lesnargitonga/LesnarAI: PR 1 the console's real link state, PR 2 both bridge fixes,
PR 3 the world and the Linux stack (the committed `obstacles.sdf` is byte for byte the
world run 3 flew, `GZ_IP` defaults to loopback, the scripts are executable, and
`/mnt/j` is optional), and PR 4 a CI that passes on every job. The confirmation
flight from a stock checkout of `main` is the fourth run above. Nothing is left to
do here: the April detections chart, whose detector read the old lidar, was dropped
from the homepage rather than re-run.

### A flight from `main`

The aimodel dev containers hold Redis and Postgres on the ports the stack needs, so
they are stopped for the run and started again after it. Nothing else is touched.

```bash
cd ~/workspace/LesnarAI && git checkout main && git pull --ff-only
docker stop aimodel-redis-1 aimodel-postgres-1
cd ~/Documents/"ai model"
git fetch origin claude/production-timings-stale-claims-2eg7vc
git show origin/claude/production-timings-stale-claims-2eg7vc:experience-lab/lesnarai-v5-home/tools/sentinel_run.sh > /tmp/sentinel_run.sh
bash /tmp/sentinel_run.sh
docker start aimodel-postgres-1 aimodel-redis-1
```

Without `SENTINEL_LESNAR_REF` it flies the checkout as it is. It should say
`obstacles.sdf already has what PX4 needs; flying it unchanged`, and `mission.json`
then records `"unchanged": true`. The `~/workspace/LesnarAI-run` worktree from the
earlier runs is no longer needed (`git -C ~/workspace/LesnarAI worktree remove
../LesnarAI-run`).

### Watching a flight

Run the same sequence from a terminal on the Precision's own screen, with
`SENTINEL_WATCH=1` in front of the run:

```bash
SENTINEL_WATCH=1 bash /tmp/sentinel_run.sh
```

The simulation runs headless exactly as in an unwatched run; a separate Gazebo window
(`gz sim -g`) joins it on the same transport as a viewer only, and the camera follows
the x500. The script waits for Enter before it sends the mission (or goes on its own
after five minutes), holds five seconds after landing, and closes the window when it
seals the run. Closing the window early does not affect the flight. Over SSH there is
no screen, so the script stops before starting anything. `mission.json` records
`"viewer_window": true`. With `PUSH=0` the run is committed locally and not pushed.

How the runs were made:


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

It starts the stack unless it is up, with the same steps and environment as
`scripts/start_stack_verified.sh` but without the React frontend and its smoke
test. At `906a465` the repo's `.sh` files were committed without the executable
bit, and that script runs `start_frontend_guarded.sh` directly, so it failed on a fresh
checkout. PR 3 fixed that in `main`; the run script keeps its own steps so it works on
either.
It then runs `/launch-all` (Gazebo headless, PX4 SITL, teacher bridge), waits for online
telemetry, then sends the console's own START TRAINING mission, built exactly as
`frontend/src/components/DroneList.js` builds it: a 25 m box at 10 m around the
drone, on the Redis `commands` channel in the format `backend/app.py` publishes.
It follows the teacher log until the mission completes or fails, lands, writes
`mission.json` and the run's teacher log into the run directory, and seals it
all with `/kill-all`. It stops whatever it started and nothing else, then commits
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

## 4. Operation Sentinel console (product fix, separate from the site; done 28 September 2026: branch `fix/console-real-state`, commit `5e54c29`, merged into LesnarAI's `main` through PR 1)

`frontend/src/components/DiagnosticTerminal.js` lines 48 to 54 print a fixed
boot sequence ("ENCRYPTION LAYER: AES-256-GCM ACTIVE", "SYSTEM STATUS:
OPTIMAL") on every load, whatever the real state. Either drive those lines
from real state or remove them. Until then the console stays off the website.

The fix replaces the boot text, the always-green Live_Stream label, the fixed
buffer and signal readouts and the "Secure Link" claim with what App already
measures (socket connection, health round trip, telemetry age). The Analytics
cards still carry a fixed Live_Stream label and were left alone. The console stays
off the website either way, for its visual style.

## After all four

Push, then tell the cloud session (or the owner) which branch and which run
ID. The homepage is rebuilt from those, and `tools/verify.py` must still pass.
