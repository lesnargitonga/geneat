#!/usr/bin/env bash
# GPU-safe fine-tune deps for Runpod (fixes Unsloth "no torch accelerator" when cuda: True).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi not found — deploy a GPU pod, not CPU." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -U pip wheel

echo "→ Removing broken torch / unsloth installs…"
pip uninstall -y torch torchvision torchaudio triton xformers unsloth unsloth-zoo 2>/dev/null || true
SITE="$(python3 -c 'import site; print(site.getsitepackages()[0])')"
rm -rf "${SITE}"/torch "${SITE}"/torch-* "${SITE}"/unsloth* 2>/dev/null || true

echo "→ Installing CUDA PyTorch (cu124, clean, no cache)…"
pip install --no-cache-dir torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
  --index-url https://download.pytorch.org/whl/cu124

echo "→ Installing Unsloth (pulls matching zoo + bitsandbytes)…"
pip install -U "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git" 2>/dev/null \
  || pip install -U unsloth

echo "→ Remaining training libs…"
pip install -U datasets transformers trl peft accelerate bitsandbytes

echo "→ Verifying GPU + Unsloth import…"
python3 <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.cuda.is_available())
if hasattr(torch, "accelerator"):
    print("torch.accelerator.is_available()", torch.accelerator.is_available())
from unsloth import FastLanguageModel
print("Unsloth OK")
PY
