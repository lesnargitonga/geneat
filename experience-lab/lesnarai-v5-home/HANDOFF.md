# Handoff: work that has to happen on the Precision

The cloud session that built this prototype cannot reach the Precision. These
steps are for a Claude Code session running on the Precision itself (start it
with `claude remote-control` in a terminal, so it also shows up in the Claude
Code app), or for doing by hand. They are in order of value.

Rules for all of it: no force-push, no history rewrite, no deploy, nothing
under production. Never commit `.env`, `deploy/render/*.local.env`, tokens,
Hugging Face keys or model weights.

## 1. Push the local website work that never reached GitHub

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

Online mode only: PX4 SITL flying the x500 in Gazebo Harmonic. The homepage
says PX4 flew it, so an `--offline` run (the pure Python simulator, 16
columns) cannot be used, and the build refuses one.

```bash
cd ~/workspace/LesnarAI            # never from /mnt/...
./scripts/start_stack_verified.sh
./scripts/start_gz_world.sh
./scripts/spawn_px4_drone.sh
python3 training/px4_teacher_collect_gz.py --system udpin://0.0.0.0:14540 --hz 20 --alt 15 --duration 0
# let it complete the waypoint loop, then end the run with /kill-all so the
# MANIFEST.json is sealed
```

The run lands in `$LESNAR_DATA_ROOT/px4_teacher/runs/<run_id>/`. Commit its
telemetry CSV and `MANIFEST.json` to the LesnarAI repo, for example under
`evidence/runs/<run_id>/`, and push. If the CSV is large, commit it anyway
unless it is over about 50 MB; say its size either way.

Then, from this directory in the geneat repo:

```bash
SENTINEL=~/workspace/LesnarAI \
SENTINEL_TELEMETRY=~/workspace/LesnarAI/evidence/runs/<run_id>/<telemetry>.csv \
SENTINEL_MANIFEST=~/workspace/LesnarAI/evidence/runs/<run_id>/MANIFEST.json \
python3 tools/build_assets.py && python3 tools/inline.py && python3 tools/verify.py
```

The mission figure then draws the flown path over the dashed plan, and the
caption states the run ID, sample count, duration and metres flown, plus
whether the CSV's SHA-256 matches its manifest.

## 3. Model Foundry material

The Hazina fine-tune ran from `/home/lesnar/Documents/ai model` (the path in
`training/hazina/out/dataset_meta.json`). List what exists there and under
`training/hazina/out/lora-hazina/`: trainer state or loss logs, evaluation
outputs, any comparison between the model and the deterministic gate. Commit
only small, non-secret records (JSON or CSV summaries), never weights or
tokens. Anything that shows an experiment failing, or losing to the
deterministic path, is exactly what the section wants.

## 4. Operation Sentinel console (product fix, separate from the site)

`frontend/src/components/DiagnosticTerminal.js` lines 48 to 54 print a fixed
boot sequence ("ENCRYPTION LAYER: AES-256-GCM ACTIVE", "SYSTEM STATUS:
OPTIMAL") on every load, whatever the real state. Either drive those lines
from real state or remove them. Until then the console stays off the website.

## After all four

Push, then tell the cloud session (or the owner) which branch and which run
ID. The homepage is rebuilt from those, and `tools/verify.py` must still pass.
