#!/usr/bin/env bash
# Record one sealed Operation Sentinel run and push its evidence (HANDOFF.md step 2).
#
# Run on the Precision, from any directory:
#   bash sentinel_run.sh
#
# What it does, using only the LesnarAI repo's own tooling:
#   1. starts the stack, unless it is already up: the same steps and environment as
#      scripts/start_stack_verified.sh, without the React frontend and its smoke test
#   2. POST /launch-all: Gazebo Harmonic (headless), PX4 SITL x500, teacher bridge
#   3. waits for online telemetry (the 59-column schema, never --offline)
#   4. dispatches the console's own training mission, built exactly as
#      frontend/src/components/DroneList.js builds it (a 25 m box at 10 m), on the
#      Redis commands channel in the format backend/app.py publishes
#   5. follows the teacher log until the mission completes or fails, then lands
#   6. writes mission.json and the run's teacher log into the run directory, then
#      POST /kill-all so the orchestrator seals everything in MANIFEST.json
#   7. stops again whatever this script started, and nothing else
#   8. commits the sealed files to a new branch evidence/sitl-run-<run_id> from a
#      separate worktree (your checkout is not touched), scans them, and pushes
#
# A failed or aborted flight is still sealed and pushed, and says so. Nothing here
# deploys anything, touches production, force-pushes, or reads any credential.
set -uo pipefail

REPO="${LESNAR_REPO:-$HOME/workspace/LesnarAI}"
run_repo="$REPO"
user_gz_ip="${GZ_IP:-}"
ORCH="${ORCH_URL:-http://127.0.0.1:8765}"
MISSION_TIMEOUT_S="${MISSION_TIMEOUT_S:-600}"
PUSH="${PUSH:-1}"

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }
diag() {  # the last lines of every log the run writes, so one paste shows what failed
  local f
  local px4="${PX4_DIR:-$HOME/PX4-Autopilot}/build/px4_sitl_default/instance_0"
  for f in /tmp/lesnar-orchestrator.log "$run_repo/logs/gz_world.out" "$run_repo/logs/px4_0.out" "$run_repo/logs/px4_spawn.out" \
           "$px4/out.log" "$px4/err.log" "$run_repo/logs/teacher_live_0.out"; do
    [ -s "$f" ] || continue
    printf '\n-- last lines of %s\n' "$f"
    tail -n 15 "$f"
  done
}
publish() { docker compose exec -T redis redis-cli PUBLISH commands "$1" | tr -dc '0-9'; }
cmd_json() {  # cmd_json <drone> <action> [params-json]
  local params="${3:-}"
  [ -n "$params" ] || params='{}'
  python3 -c 'import json,sys; from datetime import datetime,timezone
print(json.dumps({"drone_id": sys.argv[1], "action": sys.argv[2], "params": json.loads(sys.argv[3]),
                  "timestamp": datetime.now(timezone.utc).isoformat()}))' "$1" "$2" "$params"
}
latest() {  # latest <csv>: "lat lon rel_alt rows" from the newest row with a position
  python3 - "$1" <<'PY'
import csv, math, sys
try:
    with open(sys.argv[1], newline="") as f:
        rows = list(csv.DictReader(f))
except OSError:
    sys.exit(1)
need = {"gps_num_sats", "battery_voltage_v", "roll_deg", "wind_speed_mps"}
if not rows or not need <= set(rows[0]):
    sys.exit(1)
for r in reversed(rows):
    try:
        la, lo, alt = float(r["lat"]), float(r["lon"]), float(r.get("rel_alt") or "nan")
    except (KeyError, TypeError, ValueError):
        continue
    if math.isfinite(la) and math.isfinite(lo) and (la, lo) != (0.0, 0.0):
        print(f"{la:.8f} {lo:.8f} {alt:.2f} {len(rows)}")
        sys.exit(0)
sys.exit(1)
PY
}

# When /launch-all reports that Gazebo never answered, look at it while it still runs,
# then try it alone three ways, so one paste shows the cause instead of a guess.
world_answers() {  # the orchestrator's own readiness call
  timeout 4 gz service -s /world/obstacles/control --reqtype gz.msgs.WorldControl \
    --reptype gz.msgs.Boolean --req 'pause: false' --timeout 3000 2>&1 | grep -q "data: true"
}
gz_probe() {
  say "Gazebo as the orchestrator left it"
  echo "   gz: $(command -v gz || echo 'not on PATH'); $(gz sim --versions 2>&1 | head -n 1)"
  echo "   DISPLAY='${DISPLAY:-}' WAYLAND_DISPLAY='${WAYLAND_DISPLAY:-}' GZ_IP='${GZ_IP:-}' GZ_PARTITION='${GZ_PARTITION:-}'"
  echo "   interfaces: $(ip -brief link 2>/dev/null | awk '{print $1}' | tr '\n' ' ')"
  echo "   GPU render nodes: $(ls /dev/dri 2>/dev/null | tr '\n' ' ')"
  echo "   gz processes (pid, seconds, %cpu, command):"
  ps -eo pid=,etimes=,pcpu=,args= | grep -E "[g]z sim|[g]z-sim|[r]uby.*gz" | cut -c1-150 | sed 's/^/     /'
  echo "   services visible to the gz client:"
  timeout 8 gz service -l 2>&1 | head -n 10 | sed 's/^/     /'
  echo "   the world control call, verbatim:"
  timeout 6 gz service -s /world/obstacles/control --reqtype gz.msgs.WorldControl --reptype gz.msgs.Boolean \
    --req 'pause: false' --timeout 4000 2>&1 | head -n 4 | sed 's/^/     /'
}
gz_trials() {
  local px4="${PX4_DIR:-$HOME/PX4-Autopilot}" name extra gzip log pid answered=""
  # The orchestrator's own kill stops the Gazebo it started (a no-op if already done).
  curl -sS --max-time 60 -X POST "$ORCH/kill-all" >/dev/null 2>&1; sleep 2
  for name in default gz_ip headless_rendering both; do
    [ "$name" = both ] && [ -n "$answered" ] && break   # only if no single change was enough
    extra="" gzip="${user_gz_ip:-}"
    case "$name" in gz_ip|both) gzip=127.0.0.1;; esac
    case "$name" in headless_rendering|both) extra=--headless-rendering;; esac
    log=/tmp/sentinel_gz_$name.log
    say "Gazebo alone, $name: 40 s with full logging (log in $log)"
    ( cd "$px4" && export GZ_SIM_RESOURCE_PATH="${GZ_SIM_RESOURCE_PATH:-}:$px4/Tools/simulation/gz/models" \
        && { [ -z "$gzip" ] || export GZ_IP="$gzip"; } \
        && exec timeout -k 5 40 stdbuf -oL -eL gz sim -v4 -r -s $extra "$run_repo/obstacles.sdf" ) >"$log" 2>&1 &
    pid=$!
    local ok=no t
    for t in $(seq 1 30); do
      sleep 1
      if ( [ -z "$gzip" ] || export GZ_IP="$gzip"; world_answers ); then ok="yes, after about ${t} s"; break; fi
    done
    echo "   world answered: $ok"
    [ "${ok%%,*}" = yes ] && answered="$answered $name"
    kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null   # timeout passes the signal on to gz
    grep -E "\[Err\]|\[Wrn\]|[Ee]rror|Unable|[Ff]ailed|[Ss]egmentation|core dumped|Loaded world|Serving" "$log" \
      | grep -v "^\s*$" | head -n 12 | cut -c1-200 | sed 's/^/     /'
    echo "     last line: $(tail -n 1 "$log" | cut -c1-200)"
  done
  say "Gazebo answered with:${answered:- none of the variants}"
  case " $answered " in
    *" gz_ip "*) echo "   Next, run: GZ_IP=127.0.0.1 bash /tmp/sentinel_run.sh";;
    *" headless_rendering "*) echo "   Next, run: SENTINEL_GZ_HEADLESS_RENDERING=1 bash /tmp/sentinel_run.sh";;
    *" both "*) echo "   Next, run: GZ_IP=127.0.0.1 SENTINEL_GZ_HEADLESS_RENDERING=1 bash /tmp/sentinel_run.sh";;
    *" default "*) echo "   Gazebo answered on its own here, so the orchestrator's launch differs; paste this output";;
    *) echo "   Paste this output";;
  esac
}

verify_manifest() {  # every file the manifest lists is on disk with the same SHA-256
  python3 - "$1" <<'PYM'
import hashlib, json, sys
from pathlib import Path
d = Path(sys.argv[1]); m = json.loads((d / "MANIFEST.json").read_text())
listed = {f["path"]: f["sha256"] for f in m["files"]}
for need in ("telemetry_live_0.csv", "mission.json", "RUN.json"):
    assert need in listed, f"{need} is not in the manifest"
for p, h in listed.items():
    assert hashlib.sha256((d / p).read_bytes()).hexdigest() == h, f"{p} hash differs"
print("manifest verified:", ", ".join(sorted(listed)))
PYM
}
flight_summary() {  # what the sealed files say happened, and PX4's own warnings
  say "Flight summary"
  python3 - "$run_dir" <<'PYF'
import csv, json, math, sys
from pathlib import Path
d = Path(sys.argv[1])
m = json.loads((d / "mission.json").read_text())
rows = list(csv.DictReader(open(d / "telemetry_live_0.csv", newline="")))
def num(r, k):
    try:
        return float(r.get(k) or "nan")
    except ValueError:
        return float("nan")
alts = [a for a in (num(r, "rel_alt") for r in rows) if math.isfinite(a)]
ts = [num(r, "timestamp") for r in rows]
hz = (len(ts) - 1) / (ts[-1] - ts[0]) if len(ts) > 1 and math.isfinite(ts[0]) and ts[-1] > ts[0] else 0
if alts and hz:
    above = sum(1 for a in alts if a >= 2)
    print(f"   outcome {m.get('outcome')}; peak rel_alt {max(alts):.1f} m; about {above / hz:.0f} s above 2 m")
else:
    print(f"   outcome {m.get('outcome')}; no altitude data")
phases = {}
for r in rows:
    phases[r.get("flight_phase")] = phases.get(r.get("flight_phase"), 0) + 1
print("   flight_phase counts:", dict(sorted(phases.items(), key=lambda kv: -kv[1])[:8]))
print("   teacher log after dispatch:")
for l in m.get("teacher_log_lines_since_dispatch", [])[:30]:
    print("     " + l[:180])
PYF
  local px4log="$run_repo/logs/px4_0.out"
  if [ -f "$px4log" ]; then
    echo "   PX4 warnings and errors (last 15, from $px4log):"
    grep -E "WARN|ERROR" "$px4log" | tail -n 15 | cut -c1-160 | sed 's/^/     /'
  fi
}
publish_evidence() {  # copy the sealed run to evidence/runs/<run_id> on its own branch, scan, commit, push
  # Facts for the commit message
  facts=$(python3 - "$csv" <<'PY'
import csv, hashlib, math, sys
from datetime import datetime
path = sys.argv[1]
rows = []
for r in csv.DictReader(open(path, newline="")):
    try:
        la, lo = float(r["lat"]), float(r["lon"])
    except (KeyError, TypeError, ValueError):
        continue
    if math.isfinite(la) and math.isfinite(lo) and (la, lo) != (0.0, 0.0):
        rows.append((r, la, lo))
def ts(v):
    try: return float(v)
    except ValueError: return datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp()
dur = ts(rows[-1][0]["timestamp"]) - ts(rows[0][0]["timestamp"]) if len(rows) > 1 else 0
la0 = rows[0][1]; k = 111319.0
pts = [((lo - rows[0][2]) * k * math.cos(math.radians(la0)), (la - la0) * k) for _, la, lo in rows]
flown = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
print(f"{len(rows)} samples with a position, {dur:.0f} s, {flown:.0f} m flown, "
      f"csv sha256 {hashlib.sha256(open(path, 'rb').read()).hexdigest()}")
PY
  )
  say "$facts"

  # 8. Evidence branch from a separate worktree
  git fetch -q origin || die "git fetch failed; the sealed run is at $run_dir"
  base=$(git symbolic-ref -q --short refs/remotes/origin/HEAD || echo origin/main)
  branch="evidence/sitl-run-$run_id"
  wt="$(dirname "$(pwd -P)")/LesnarAI-evidence-$run_id"
  if [ -d "$wt" ]; then
    [ "$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)" = "$branch" ] || die "$wt exists but is not on $branch"
    say "Reusing the worktree left at $wt"
  elif git show-ref --verify -q "refs/heads/$branch"; then
    git worktree add -q "$wt" "$branch" || die "could not check out $branch into $wt"
  else
    git worktree add -q "$wt" -b "$branch" "$base" || die "could not create worktree $wt"
  fi
  dest="$wt/evidence/runs/$run_id"
  mkdir -p "$dest"
  find "$run_dir" -maxdepth 1 -type f -exec cp -p {} "$dest/" \;
  big=$(find "$dest" -type f -size +50M)
  [ -z "$big" ] || die "over 50 MB, not committed: $big (worktree left at $wt)"
  say "Scanning the evidence for anything that should not be public"
  if grep -rIniE "password|passwd|secret|api[_-]?key|bearer|token|BEGIN [A-Z ]*PRIVATE KEY|hf_[A-Za-z0-9]{20,}" "$dest" \
     || grep -rInE "\b(10\.[0-9]+|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]+\.[0-9]+\b" "$dest"; then
    die "the lines above need a look before anything is pushed; nothing committed (worktree left at $wt)"
  fi
  (cd "$dest" && du -sh -- *) | sed 's/^/   /'
  # LesnarAI ignores runs/, *.csv and *.log to keep training data out of the repo.
  # This one sealed run is evidence, so only its own folder is added past that rule.
  git -C "$wt" add -f -- "evidence/runs/$run_id"
  if git -C "$wt" diff --cached --quiet; then
    say "Nothing new to commit on $branch (already committed)"
  else
  git -C "$wt" commit -q -F - <<EOF || die "commit failed (worktree at $wt)"
evidence(sentinel): sealed PX4 SITL run $run_id, mission $outcome

One Operation Sentinel run: PX4 SITL x500 in Gazebo Harmonic (headless),
driven by the MAVSDK teacher bridge in its default bridge mode, launched
and sealed by the runtime orchestrator (/launch-all, /kill-all).

Bridge: ${SENTINEL_BRIDGE_REF:-the checkout} at ${SENTINEL_BRIDGE_COMMIT:-unknown}.
Mission: the console's START TRAINING box (DroneList.js), 25 m at 10 m,
dispatched on the Redis commands channel at $dispatched_at.
Outcome: $outcome. Landed below 0.5 m: $landed.
Telemetry: $facts.

Files are copied byte for byte from the run directory. MANIFEST.json holds
their SHA-256 hashes; teacher_live_0.log and mission.json were written into
the run before sealing, so they are covered too. world_used.sdf is the world
Gazebo ran; the manifest does not hash .sdf files, so its SHA-256 and the
exact additions to obstacles.sdf are recorded in mission.json.

Added with git add -f: the repo ignores runs/, *.csv and *.log to keep
training data out, and this folder is one sealed evidence run.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01771GfNqwcPG482z5oPN31U
EOF
  fi
  if [ "$PUSH" = 1 ]; then
    pushed=no
    for wait in 0 2 4 8 16; do
      sleep "$wait"
      git -C "$wt" push -q -u origin "$branch" && { pushed=yes; break; }
    done
    [ "$pushed" = yes ] || die "push failed; commit is on $branch in $wt"
    git worktree remove "$wt"
  fi

  say "Done. Tell the cloud chat:"
  echo "   branch $branch, commit $(git rev-parse --short "$branch"), run $run_id, mission $outcome, landed $landed"
  echo "   $facts"
}

cd "$REPO" 2>/dev/null || die "no LesnarAI checkout at $REPO (set LESNAR_REPO)"
case "$(pwd -P)" in /mnt/*) die "run against the Linux checkout, not $(pwd -P)";; esac
for t in curl docker git python3; do command -v "$t" >/dev/null || die "$t is not installed"; done
say "LesnarAI at $(pwd -P), $(git log -1 --format='%h %s')"
[ -n "$(git var GIT_COMMITTER_IDENT 2>/dev/null)" ] \
  || die "git has no name and email here, so the evidence could not be committed. Set them with: git config --global user.name \"...\" and git config --global user.email \"...\""

# Publish an already sealed run without flying again:
#   SENTINEL_PUBLISH_RUN=<run directory> bash sentinel_run.sh
if [ -n "${SENTINEL_PUBLISH_RUN:-}" ]; then
  run_dir=$(cd "$SENTINEL_PUBLISH_RUN" 2>/dev/null && pwd -P) || die "no run directory at $SENTINEL_PUBLISH_RUN"
  run_id=$(basename "$run_dir"); csv="$run_dir/telemetry_live_0.csv"
  [ -f "$run_dir/MANIFEST.json" ] && [ -f "$run_dir/mission.json" ] || die "$run_dir is not a sealed run with a mission.json"
  verify_manifest "$run_dir" || die "MANIFEST.json does not match the files on disk"
  read -r outcome landed dispatched_at < <(python3 -c 'import json,sys; m=json.load(open(sys.argv[1]))
print(m["outcome"], "yes" if m.get("landed_below_0_5_m") else "no", m["dispatched_at_utc"])' "$run_dir/mission.json")
  say "Publishing the sealed run $run_id (mission $outcome)"
  flight_summary
  publish_evidence
  exit 0
fi

# 1. Stack. The repo's .sh files are committed without the executable bit, and
# start_stack_verified.sh runs start_frontend_guarded.sh directly, so this does the
# same steps with the same environment itself. The frontend plays no part in a run.
# SENTINEL_LESNAR_REF=<branch or commit> flies that version of the orchestrator and the
# teacher bridge (both run on the host) from a worktree beside the checkout, which is not
# touched. Containers still come from the checkout: COMPOSE_FILE points compose there,
# including the orchestrator's own "docker compose up", so it keeps the checkout's .env,
# build context and project name. The worktree needs no .env and gets none.
run_repo="$REPO" bridge_ref=""
if [ -n "${SENTINEL_LESNAR_REF:-}" ]; then
  curl -fsS --max-time 3 "$ORCH/health" >/dev/null 2>&1 \
    && die "the orchestrator is already running from $REPO; stop the stack (bash scripts/stop_stack.sh) before flying $SENTINEL_LESNAR_REF"
  git fetch -q origin "$SENTINEL_LESNAR_REF" || die "could not fetch $SENTINEL_LESNAR_REF from origin"
  run_repo="$(dirname "$(pwd -P)")/LesnarAI-run"
  if [ -d "$run_repo" ]; then
    [ -z "$(git -C "$run_repo" status --porcelain --untracked-files=no)" ] || die "$run_repo has local changes; not touching it"
    git -C "$run_repo" checkout -q --detach FETCH_HEAD || die "could not check out $SENTINEL_LESNAR_REF in $run_repo"
  else
    git worktree add -q --detach "$run_repo" FETCH_HEAD || die "could not create the worktree $run_repo"
  fi
  export COMPOSE_FILE="$REPO/docker-compose.yml"
  bridge_ref="$SENTINEL_LESNAR_REF"
  say "Flying LesnarAI $bridge_ref ($(git -C "$run_repo" log -1 --format='%h %s')) from $run_repo; containers still come from $REPO"
fi
export SENTINEL_BRIDGE_REF="$bridge_ref" SENTINEL_BRIDGE_COMMIT="$(git -C "$run_repo" rev-parse HEAD)"
was_running=0 pre_up=0 orch_pid=""
redis_up() { [ "$(docker compose exec -T redis redis-cli ping 2>/dev/null | tr -d '\r')" = PONG ]; }
if curl -fsS --max-time 3 "$ORCH/health" >/dev/null 2>&1; then
  was_running=1
  say "Stack already running; /launch-all will restart the simulator inside it"
  say "(it keeps the environment it was started with; if Gazebo reports GZ_SIM_RESOURCE_PATH unbound, stop the stack and run this again)"
  redis_up || die "the orchestrator is up but Redis does not answer"
else
  pre_up=$(docker compose ps -q --status running 2>/dev/null | wc -l)
  export LESNAR_DATA_ROOT="${LESNAR_DATA_ROOT:-$HOME/LesnarData}"
  export LESNAR_GZ_HEADLESS="${LESNAR_GZ_HEADLESS:-1}"
  export LESNAR_GZ_VERBOSITY="${LESNAR_GZ_VERBOSITY:-2}"
  export LESNAR_ORCH_MODEL_CACHE_MAX_AGE_S="${LESNAR_ORCH_MODEL_CACHE_MAX_AGE_S:-120}"
  export LESNAR_TEACHER_BRIDGE_ONLY="${LESNAR_TEACHER_BRIDGE_ONLY:-1}"
  # start_gz_world.sh and spawn_px4_drones.sh run under set -u and append to these,
  # as does PX4's gz_env.sh, so an unset one kills Gazebo or PX4 before either starts.
  # Empty keeps whatever the scripts add; the orchestrator passes it to both.
  export GZ_SIM_RESOURCE_PATH="${GZ_SIM_RESOURCE_PATH:-}"
  export GZ_SIM_SYSTEM_PLUGIN_PATH="${GZ_SIM_SYSTEM_PLUGIN_PATH:-}"
  if [ "${SENTINEL_GZ_HEADLESS_RENDERING:-0}" = 1 ]; then
    # For this run only: a gz ahead of the real one on PATH that adds
    # --headless-rendering (EGL, no display needed) to "gz sim" and changes nothing else.
    real_gz=$(command -v gz) || die "gz is not on PATH"
    shim=$(mktemp -d /tmp/sentinel_gz_shim.XXXXXX)
    printf '#!/usr/bin/env bash\nif [ "$1" = sim ]; then shift; exec "%s" sim --headless-rendering "$@"; fi\nexec "%s" "$@"\n' \
      "$real_gz" "$real_gz" > "$shim/gz"
    chmod +x "$shim/gz"
    export PATH="$shim:$PATH"
    say "Gazebo will start with --headless-rendering (wrapper in $shim)"
  fi
  # Measured on the Precision: with its ~20 interfaces (Docker bridges, veths, Wi-Fi)
  # gz-transport discovery never reached the world; pinned to loopback it answered
  # in about a second. Everything here runs on one machine, so loopback is enough.
  export GZ_IP="${GZ_IP:-127.0.0.1}"
  say "Gazebo transport pinned to GZ_IP=$GZ_IP"
  # The single-drone launch runs "make px4_sitl gz_x500" and the orchestrator waits
  # only 90 s for the drone to appear, so a first-time PX4 build is done beforehand.
  px4_dir="${PX4_DIR:-$HOME/PX4-Autopilot}"
  if [ -d "$px4_dir" ] && [ ! -x "$px4_dir/build/px4_sitl_default/bin/px4" ]; then
    say "PX4 SITL is not built yet; building it once (this can take 10 to 20 minutes, log in /tmp/sentinel_px4_build.log)"
    ( cd "$px4_dir" && make px4_sitl_default ) >/tmp/sentinel_px4_build.log 2>&1 \
      || { tail -n 25 /tmp/sentinel_px4_build.log; die "the PX4 SITL build failed (last lines above)"; }
  fi
  # PX4's own launch sources gz_env.sh (model, world and gz plugin paths); the
  # single-drone path here does not, which is why MotorFailurePlugin failed to load.
  if [ -f "$px4_dir/build/px4_sitl_default/rootfs/gz_env.sh" ]; then
    set +u; . "$px4_dir/build/px4_sitl_default/rootfs/gz_env.sh"; set -u
    say "Using PX4's gz_env.sh ($(git -C "$px4_dir" describe --tags --always 2>/dev/null || echo 'PX4 version unknown'))"
  fi
  # obstacles.sdf predates PX4 taking GPS and compass from Gazebo. PX4 supplies its
  # world systems through server.config, which Gazebo uses only for a world that
  # declares none; obstacles.sdf declares seven, so it never got NavSat or the
  # Magnetometer, and it has no spherical_coordinates. PX4 therefore never gets a
  # position or a heading. For this run only, a copy gains the Gazebo systems PX4's
  # server.config and default.sdf load and obstacles.sdf lacks, plus PX4's default
  # coordinates. The repo's file is not touched, and mission.json records all of it.
  px4_world="$px4_dir/Tools/simulation/gz/worlds/default.sdf"
  px4_config="${GZ_SIM_SERVER_CONFIG_PATH:-$px4_dir/src/modules/simulation/gz_bridge/server.config}"
  if [ -f "$px4_world" ] || [ -f "$px4_config" ]; then
    wdir=$(mktemp -d /tmp/sentinel_world.XXXXXX)
    python3 - "$run_repo/obstacles.sdf" "$px4_world" "$px4_config" "$wdir/obstacles.sdf" "$px4_dir" > "$wdir/world_info.json" <<'PYW' \
      || die "could not prepare the world copy"
import hashlib, json, re, subprocess, sys
import xml.etree.ElementTree as ET
import os
src, ref, cfg, out, px4 = sys.argv[1:6]
norm = lambda f: re.sub(r"^lib|\.so$", "", f or "")
text = open(src, encoding="utf-8").read()
w = ET.parse(src).getroot().find("world")
rw = ET.parse(ref).getroot().find("world") if os.path.isfile(ref) else None
cands = list(rw.findall("plugin")) if rw is not None else []
if os.path.isfile(cfg):
    for p in ET.parse(cfg).getroot().iter("plugin"):
        if p.get("entity_type") == "world":
            for a in ("entity_name", "entity_type"):
                p.attrib.pop(a, None)
            cands.append(p)
have = {norm(p.get("filename")) for p in w.findall("plugin")}
added, skipped = [], []
for p in cands:
    f = norm(p.get("filename"))
    if f in have:
        continue
    have.add(f)
    # PX4's own camera and optical-flow systems serve sensors the x500 does not carry
    (added if f.startswith("gz-sim-") else skipped).append(p)
snips = []
for p in added:
    p.tail = None
    snips.append("    " + ET.tostring(p, encoding="unicode").strip())
sc = None
if w.find("spherical_coordinates") is None and rw is not None and rw.find("spherical_coordinates") is not None:
    e = rw.find("spherical_coordinates"); e.tail = None
    sc = "    " + ET.tostring(e, encoding="unicode").strip()
if snips:
    m = re.search(r"^[ \t]*<plugin[^>]*gz-sim-sensors-system", text, re.M) or re.search(r"^[ \t]*</world>", text, re.M)
    text = text[:m.start()] + "\n".join(snips) + "\n" + text[m.start():]
if sc:
    m = re.search(r"</physics>[ \t]*\n", text)
    text = text[:m.end()] + sc + "\n" + text[m.end():]
open(out, "w", encoding="utf-8").write(text)
sha = lambda path: hashlib.sha256(open(path, "rb").read()).hexdigest()
ver = subprocess.run(["git", "-C", px4, "describe", "--tags", "--always"], capture_output=True, text=True).stdout.strip()
print(json.dumps({
    "source": "obstacles.sdf", "source_sha256": sha(src),
    "references": {n: sha(f) for n, f in (("PX4-Autopilot/Tools/simulation/gz/worlds/default.sdf", ref),
                                           ("PX4-Autopilot/src/modules/simulation/gz_bridge/server.config", cfg))
                   if os.path.isfile(f)},
    "px4_version": ver or None,
    "added_plugins": [p.get("filename") for p in added],
    "skipped_px4_custom_plugins": [p.get("filename") for p in skipped],
    "added_spherical_coordinates": sc is not None,
    "added_xml": snips + ([sc] if sc else []),
    "used_file": "world_used.sdf", "used_sha256": sha(out),
}))
PYW
    export LESNAR_GZ_WORLD_SDF="$wdir/obstacles.sdf" SENTINEL_WORLD_INFO="$wdir/world_info.json"
    say "World copy for this run adds: $(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(", ".join(d["added_plugins"] + (["spherical_coordinates"] if d["added_spherical_coordinates"] else [])) or "nothing")' "$wdir/world_info.json")"
  else
    say "No PX4 default.sdf or server.config found; using obstacles.sdf as it is"
  fi
  mkdir -p "$LESNAR_DATA_ROOT"
  say "Starting backend, Redis and TimescaleDB (data root $LESNAR_DATA_ROOT); a first build can take several minutes"
  # Nothing is running, so clear the project's containers and network first: ones left
  # from an earlier session can point at a Docker network that no longer exists.
  # down keeps named volumes (Postgres data is in lesnar_postgres); Redis keeps nothing.
  # adminer is included because /launch-all brings it up too.
  compose_up() {
    docker compose up -d --build backend redis timescaledb adminer 2>&1 | tee /tmp/sentinel_compose.log
    return "${PIPESTATUS[0]}"
  }
  docker compose down --remove-orphans >/dev/null 2>&1
  # The stack publishes these ports, and the teacher bridge on the host talks to
  # Redis at 127.0.0.1:6379, so this project's Redis must own that port. Anything
  # else holding one is named, and left alone: stopping it is the owner's call.
  held=""
  for port in 5432 6379 8080 5000; do
    c=$(docker ps --filter "publish=$port" --format '{{.Names}} (image {{.Image}}, project {{.Label "com.docker.compose.project"}})' 2>/dev/null | head -n 1)
    if [ -n "$c" ]; then
      held="$held\n   port $port: container $c\n      stop it with: docker stop ${c%% *}   (and afterwards: docker start ${c%% *})"
    elif (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      who=$(ss -Hltnp "sport = :$port" 2>/dev/null | grep -o 'users:(("[^"]*"' | head -n 1 | cut -d'"' -f2)
      held="$held\n   port $port: a process on the host${who:+ ($who)}"
      [ "$port" = 6379 ] && held="$held\n      if it is the system Redis: sudo systemctl stop redis-server   (afterwards: sudo systemctl start redis-server)"
    fi
  done
  [ -z "$held" ] || die "$(printf "these ports are in use by something outside this stack:$held")
Stop them, then run this again. Nothing was started."
  if ! compose_up; then
    net=$(grep -oE 'on network [A-Za-z0-9_.-]+' /tmp/sentinel_compose.log | head -n 1 | awk '{print $3}')
    [ -n "$net" ] || die "docker compose up failed (output above)"
    say "Removing the stale Docker network $net and retrying once"
    docker compose down --remove-orphans >/dev/null 2>&1
    docker network rm "$net" >/dev/null 2>&1
    compose_up || die "docker compose up failed twice (output above). Restart Docker with: sudo systemctl restart docker, then run this again"
  fi
  for _ in $(seq 1 30); do redis_up && break; sleep 2; done
  redis_up || die "Redis did not answer after a minute"
  say "Starting the runtime orchestrator"
  nohup python3 "$run_repo/scripts/runtime_orchestrator.py" >/tmp/lesnar-orchestrator.log 2>&1 &
  orch_pid=$!
  for _ in $(seq 1 20); do curl -fsS --max-time 2 "$ORCH/health" >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS --max-time 2 "$ORCH/health" >/dev/null 2>&1 || { diag; die "the runtime orchestrator did not start"; }
fi
stop_if_ours() {  # stop only what this script started
  [ "$was_running" = 1 ] && return 0
  say "Stopping what this script started"
  curl -sS --max-time 120 -X POST "$ORCH/kill-all" >/dev/null 2>&1   # a sealed run is not sealed again
  [ -n "$orch_pid" ] && kill "$orch_pid" 2>/dev/null
  [ "$pre_up" = 0 ] && docker compose down >/dev/null 2>&1
  return 0
}

# 2. Launch
log="$run_repo/logs/teacher_live_0.out"
off0=$(stat -c %s "$log" 2>/dev/null || echo 0)
say "Launching Gazebo, PX4 SITL x500 and the teacher bridge"
resp=$(curl -sS --max-time 900 -X POST "$ORCH/launch-all" -H 'Content-Type: application/json' \
  -d '{"drone_count": 1, "gz_headless": true}') || { diag; stop_if_ours; die "POST /launch-all failed"; }
run_dir=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run_dir"])' <<<"$resp" 2>/dev/null) || {
  diag
  case "$resp" in *"Gazebo world did not become responsive"*) gz_probe; stop_if_ours; gz_trials;; *) stop_if_ours;; esac
  die "/launch-all returned no run_dir: $resp"
}
run_id=$(basename "$run_dir")
drone=$(python3 -c 'import json,sys; m=(json.load(sys.stdin).get("status") or {}).get("drone_models") or []; print(m[0] if m else "x500_0")' <<<"$resp")
csv="$run_dir/telemetry_live_0.csv"
[ "$(stat -c %s "$log" 2>/dev/null || echo 0)" -ge "$off0" ] || off0=0   # log was rotated at launch
say "Run $run_id, drone $drone"
seal_and_die() {
  diag
  curl -sS --max-time 120 -X POST "$ORCH/kill-all" >/dev/null 2>&1
  stop_if_ours
  die "$1 (run sealed, not pushed: $run_dir)"
}

# 3. Online telemetry with a position, then let the estimate settle
say "Waiting for online telemetry"
pos=""
for _ in $(seq 1 120); do pos=$(latest "$csv") && break; pos=""; sleep 2; done
if [ -z "$pos" ]; then
  python3 - "$csv" <<'PYT'
import csv, sys
try:
    rows = list(csv.DictReader(open(sys.argv[1], newline="")))
except OSError:
    rows = []
last = rows[-1] if rows else {}
print(f"\n   telemetry rows: {len(rows)}; last lat/lon: {last.get('lat')}, {last.get('lon')}; "
      f"gps_fix_type {last.get('gps_fix_type')}, gps_num_sats {last.get('gps_num_sats')}")
PYT
  seal_and_die "no online telemetry with a position after 4 minutes"
fi
sleep 15
pos=$(latest "$csv") || seal_and_die "telemetry stopped"
read -r lat0 lon0 _ rows0 <<<"$pos"
say "Home fix $lat0, $lon0 after $rows0 samples"

# 4. The console's training mission (DroneList.js): 25 m box at 10 m around the drone
wps=$(python3 -c 'import json,math,sys
la,lo=float(sys.argv[1]),float(sys.argv[2]); m=25.0; alt=10.0
dla=m/111319.0; dlo=m/(111319.0*max(0.2,math.cos(math.radians(la))))
print(json.dumps([[la+dla,lo,alt],[la+dla,lo+dlo,alt],[la,lo+dlo,alt],[la,lo,alt]]))' "$lat0" "$lon0")
payload=$(cmd_json "$drone" mission_start "{\"waypoints\": $wps, \"mission_type\": \"TRAINING\"}")
off=$(stat -c %s "$log" 2>/dev/null || echo 0)
subs=$(publish "$payload")
dispatched_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
[ "${subs:-0}" -ge 1 ] || seal_and_die "mission_start reached no subscriber on the commands channel"
say "Mission dispatched at $dispatched_at to $subs subscriber(s)"

# 5. Follow the teacher log from the dispatch onwards
outcome=timeout
end=$((SECONDS + MISSION_TIMEOUT_S))
while [ "$SECONDS" -lt "$end" ]; do
  new=$(tail -c +"$((off + 1))" "$log" 2>/dev/null)
  if grep -q "External mission completed" <<<"$new"; then outcome=completed; break; fi
  if grep -qE "External mission (aborted|stopped)|Mission start ignored|Traceback" <<<"$new"; then outcome=failed; break; fi
  curl -fsS --max-time 10 "$ORCH/status" 2>/dev/null | grep -q '"teacher_running": *true' || { outcome=teacher_exited; break; }
  sleep 3
done
say "Mission outcome: $outcome"
land_subs=$(publish "$(cmd_json "$drone" land)")
landed=no
for _ in $(seq 1 45); do
  read -r _ _ alt _ <<<"$(latest "$csv" || echo "0 0 nan 0")"
  python3 -c 'import sys; a=float(sys.argv[1]); sys.exit(0 if a==a and a<0.5 else 1)' "$alt" && { landed=yes; break; }
  sleep 2
done
say "Land command to $land_subs subscriber(s); landed: $landed"

# 6. Record the dispatch and the run's teacher log inside the run, then seal
tail -c +"$((off0 + 1))" "$log" > "$run_dir/teacher_live_0.log" 2>/dev/null
[ -z "${LESNAR_GZ_WORLD_SDF:-}" ] || cp -p "$LESNAR_GZ_WORLD_SDF" "$run_dir/world_used.sdf"
python3 - "$run_dir/mission.json" "$payload" "$subs" "$dispatched_at" "$outcome" "$landed" "$off" "$log" <<'PY'
import json, os, re, sys
out, payload, subs, at, outcome, landed, off, log = sys.argv[1:9]
with open(log, "rb") as f:
    f.seek(int(off))
    text = f.read().decode("utf-8", "replace")
keep = re.compile(r"mission|takeoff|land|arm|offboard|!!|Traceback|Error", re.I)
lines = [l for l in text.splitlines() if keep.search(l)][:300]
json.dump({
    "dispatched_at_utc": at,
    "payload": json.loads(payload),
    "subscribers": int(subs),
    "method": ("Published directly on the Redis 'commands' channel in the format backend/app.py "
               "_publish_command uses, not through the backend API. The waypoints are the console's "
               "START TRAINING mission as frontend/src/components/DroneList.js builds it: a 25 m box "
               "at 10 m around the drone's position at dispatch."),
    "outcome": outcome,
    "landed_below_0_5_m": landed == "yes",
    "bridge": {"ref": os.environ.get("SENTINEL_BRIDGE_REF") or None,
               "commit": os.environ.get("SENTINEL_BRIDGE_COMMIT") or None},
    "gazebo_launch": {"GZ_IP": os.environ.get("GZ_IP") or None,
                      "headless_rendering": os.environ.get("SENTINEL_GZ_HEADLESS_RENDERING") == "1"},
    "world": (json.load(open(os.environ["SENTINEL_WORLD_INFO"])) if os.environ.get("SENTINEL_WORLD_INFO")
              else {"source": "obstacles.sdf", "unchanged": True}),
    "teacher_log_lines_since_dispatch": lines,
}, open(out, "w"), indent=2)
PY
say "Sealing with /kill-all"
curl -sS --max-time 120 -X POST "$ORCH/kill-all" >/dev/null || die "POST /kill-all failed; run at $run_dir"
[ -f "$run_dir/MANIFEST.json" ] || die "no MANIFEST.json in $run_dir"
verify_manifest "$run_dir" || die "MANIFEST.json does not match the files on disk"
stop_if_ours
if pgrep -f "px4_teacher_collect_gz.py" >/dev/null; then
  say "Note: a teacher process is still running; stop it with: bash scripts/stop_stack.sh"
fi

flight_summary
publish_evidence
