#!/usr/bin/env bash
# GPU-safe fine-tune deps for Runpod (Unsloth + pinned transformers/trl).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi not found — deploy a GPU pod, not CPU." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

export PIP_PROGRESS_BAR=on
pip install -U pip wheel

echo "[$(date +%H:%M:%S)] → Purge conflicting packages…"
pip uninstall -y torch torchvision torchaudio triton xformers \
  transformers trl datasets peft accelerate bitsandbytes unsloth unsloth-zoo 2>/dev/null || true
SITE="$(python3 -c 'import site; print(site.getsitepackages()[0])')"
rm -rf "${SITE}"/torch "${SITE}"/torch-* "${SITE}"/transformers* "${SITE}"/trl* "${SITE}"/unsloth* 2>/dev/null || true

echo "[$(date +%H:%M:%S)] → CUDA PyTorch 2.5.1 (cu124) — may take 5–15 min, no output is normal…"
pip install --no-cache-dir --progress-bar on \
  torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
  --index-url https://download.pytorch.org/whl/cu124
python3 -c "import torch; print('torch OK', torch.__version__, 'cuda', torch.cuda.is_available())"

echo "[$(date +%H:%M:%S)] → transformers / trl / datasets (pinned for unsloth-zoo)…"
pip install --no-cache-dir --progress-bar on \
  "transformers>=4.51.3,<=5.5.0" \
  "trl>=0.18.2,<=0.24.0" \
  "datasets>=3.0.0" \
  "peft>=0.13.0" \
  "accelerate>=0.34.0" \
  "bitsandbytes>=0.44.0"

echo "[$(date +%H:%M:%S)] → Unsloth…"
pip install --no-cache-dir --progress-bar on unsloth unsloth-zoo

echo "[$(date +%H:%M:%S)] → Verifying…"
python3 <<'PY'
import torch
import transformers
import trl
print("torch", torch.__version__, "cuda", torch.cuda.is_available())
print("transformers", transformers.__version__)
print("trl", trl.__version__)
from unsloth import FastLanguageModel
print("Unsloth OK")
PY
