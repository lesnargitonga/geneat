#!/usr/bin/env bash
# Pull trained GGUF bundle from Runpod to local machine.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${RUNPOD_HOST:?Set RUNPOD_HOST}"
PORT="${RUNPOD_PORT:?Set RUNPOD_PORT}"
SSH_KEY="${RUNPOD_SSH_KEY:-}"
SSH_OPTS=(-P "$PORT" -o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")

DEST="$ROOT/training/hazina/out/lora-hazina"
mkdir -p "$DEST"

echo "→ Downloading gguf-ollama/ from pod…"
scp -r "${SSH_OPTS[@]}" "root@$HOST:/workspace/hazina/training/hazina/out/lora-hazina/gguf-ollama" "$DEST/"

echo "→ Downloading train log…"
scp "${SSH_OPTS[@]}" "root@$HOST:/workspace/hazina-train.log" "$ROOT/training/hazina/out/" 2>/dev/null || true

echo "Local: $DEST/gguf-ollama"
echo "Next: bash scripts/hazina_export_ollama.sh $DEST/gguf-ollama"
