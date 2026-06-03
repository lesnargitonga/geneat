#!/usr/bin/env bash
# Pull trained Hazina fine-tune artifacts from Runpod to local machine.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${RUNPOD_HOST:?Set RUNPOD_HOST}"
PORT="${RUNPOD_PORT:?Set RUNPOD_PORT}"
SSH_KEY="${RUNPOD_SSH_KEY:-}"
SSH_OPTS=(-P "$PORT" -o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")

DEST="$ROOT/training/hazina/out"
mkdir -p "$DEST"

echo "→ Downloading lora-hazina/ from pod…"
scp -r "${SSH_OPTS[@]}" "root@$HOST:/workspace/hazina/training/hazina/out/lora-hazina" "$DEST/"

echo "→ Downloading train log…"
scp "${SSH_OPTS[@]}" "root@$HOST:/workspace/hazina-train.log" "$ROOT/training/hazina/out/" 2>/dev/null || true

echo "Local: $DEST/lora-hazina"
if [[ -d "$DEST/lora-hazina/gguf-ollama" ]]; then
  echo "Next: bash scripts/hazina_export_ollama.sh $DEST/lora-hazina/gguf-ollama"
else
  echo "GGUF was not exported. LoRA adapter is available for later merge/export."
fi
