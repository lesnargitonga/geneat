#!/usr/bin/env bash
# Bundle everything needed for a Runpod GPU fine-tune (no merged weights).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/training/hazina/hazina-finetune-runpod.tar.gz}"

cd "$ROOT"
tar -czf "$OUT" \
  requirements-finetune.txt \
  requirements-finetune-runpod.txt \
  scripts/hazina_generate_finetune_dataset.py \
  scripts/hazina_install_finetune_deps.sh \
  scripts/hazina_finetune_unsloth.py \
  scripts/hazina_export_ollama.sh \
  scripts/hazina_runpod_train.sh \
  scripts/hazina_smoke_finetuned.py \
  training/hazina/README.md \
  training/hazina/system_prompt.txt \
  training/hazina/golden.jsonl \
  training/hazina/out/train.jsonl \
  training/hazina/out/val.jsonl \
  training/hazina/out/dataset_meta.json

BYTES="$(wc -c < "$OUT" | tr -d ' ')"
echo "Created $OUT ($BYTES bytes)"
echo ""
echo "Upload to Runpod, then:"
echo "  mkdir -p /workspace/hazina && cd /workspace/hazina"
echo "  tar -xzf hazina-finetune-runpod.tar.gz"
echo "  bash scripts/hazina_runpod_train.sh"
