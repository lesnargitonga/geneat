#!/usr/bin/env bash
# One-shot QLoRA train + merged export on a CUDA host (Runpod / local GPU).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi not found — this script needs a CUDA GPU." >&2
  exit 1
fi
if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "WARNING: HF_TOKEN is empty — set RunPod env HF_TOKEN={{ RUNPOD_SECRET_hazina }} or export HF_TOKEN." >&2
fi
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

PYTHON="${PYTHON:-python3}"
if [[ ! -d .venv ]]; then
  "$PYTHON" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -U pip
bash scripts/hazina_install_finetune_deps.sh

EPOCHS="${EPOCHS:-2}"
EXTRA_ARGS=()
if [[ "${SKIP_MERGE:-false}" == "true" ]]; then
  EXTRA_ARGS+=(--skip-merge)
fi
"$PYTHON" scripts/hazina_finetune_unsloth.py \
  --train training/hazina/out/train.jsonl \
  --output training/hazina/out/lora-hazina \
  --epochs "$EPOCHS" \
  "${EXTRA_ARGS[@]}"

echo ""
echo "Training complete. Download from the pod:"
echo "  training/hazina/out/lora-hazina/              (LoRA adapter + tokenizer — always saved first)"
echo "  training/hazina/out/lora-hazina/gguf-ollama/   (Modelfile + *.gguf — use for Ollama)"
echo "  training/hazina/out/lora-hazina/merged-16bit/  (optional — vLLM)"
echo ""
echo "On your API machine (with Ollama):"
echo "  bash scripts/hazina_export_ollama.sh training/hazina/out/lora-hazina/gguf-ollama"
echo "  python scripts/hazina_smoke_finetuned.py --model hazina-concierge --compare llama3.1 --matrix-only"
echo "  export LLM_PROVIDER=local LOCAL_LLM_MODEL=llama3.1 HAZINA_LLM_MODEL=hazina-concierge"
