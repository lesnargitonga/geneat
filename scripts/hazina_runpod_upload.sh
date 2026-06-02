#!/usr/bin/env bash
# Upload tarball and start training on a Runpod GPU pod.
#
# Prereqs:
#   1. bash scripts/hazina_runpod_pack.sh
#   2. Download pod SSH private key from Runpod → Connect → SSH
#   3. export RUNPOD_SSH_KEY=~/.ssh/runpod_yawning_maroon_buzzard
#   4. export HF_TOKEN=hf_...   (for meta-llama base model)
#
# Usage:
#   export RUNPOD_HOST=213.173.102.179 RUNPOD_PORT=37808
#   bash scripts/hazina_runpod_upload.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${RUNPOD_HOST:?Set RUNPOD_HOST}"
PORT="${RUNPOD_PORT:?Set RUNPOD_PORT}"
SSH_KEY="${RUNPOD_SSH_KEY:-}"
SSH_OPTS=(-p "$PORT" -o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")

TAR="$ROOT/training/hazina/hazina-finetune-runpod.tar.gz"
[[ -f "$TAR" ]] || bash "$ROOT/scripts/hazina_runpod_pack.sh"

echo "→ Uploading $TAR to root@$HOST:$PORT:/workspace/"
scp "${SSH_OPTS[@]}" "$TAR" "root@$HOST:/workspace/"

REMOTE=$(cat <<'EOS'
set -euo pipefail
cd /workspace
mkdir -p hazina
mv -f hazina-finetune-runpod.tar.gz hazina/ 2>/dev/null || true
cd hazina
tar -xzf hazina-finetune-runpod.tar.gz
bash scripts/hazina_runpod_train.sh 2>&1 | tee /workspace/hazina-train.log
EOS
)

echo "→ Starting remote training (logs: /workspace/hazina-train.log)"
if [[ -n "${HF_TOKEN:-}" ]]; then
  ssh "${SSH_OPTS[@]}" "root@$HOST" "export HF_TOKEN='${HF_TOKEN}'; $REMOTE"
else
  echo "WARNING: HF_TOKEN not set — Llama 3.1 download may fail on the pod." >&2
  ssh "${SSH_OPTS[@]}" "root@$HOST" "$REMOTE"
fi

echo "Done. Download gguf-ollama/ from the pod when training finishes."
