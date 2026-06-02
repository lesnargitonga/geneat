#!/usr/bin/env bash
# One-shot QLoRA train + merged export on a CUDA host (Runpod / local GPU).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi not found — this script needs a CUDA GPU." >&2
  exit 1
fi
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

PYTHON="${PYTHON:-python3}"
if [[ ! -d .venv ]]; then
  "$PYTHON" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -U pip
pip install -r requirements-finetune.txt

EPOCHS="${EPOCHS:-2}"
"$PYTHON" scripts/hazina_finetune_unsloth.py \
  --train training/hazina/out/train.jsonl \
  --output training/hazina/out/lora-hazina \
  --epochs "$EPOCHS"

echo ""
echo "Training complete. Download training/hazina/out/lora-hazina/merged-16bit from the pod."
echo "On your API machine (with Ollama):"
echo "  bash scripts/hazina_export_ollama.sh training/hazina/out/lora-hazina/merged-16bit"
echo "  export LLM_PROVIDER=local LOCAL_LLM_MODEL=llama3.1 HAZINA_LLM_MODEL=hazina-concierge"
