#!/usr/bin/env bash
# Merge LoRA into GGUF and register a local Ollama model for Hazina open-ended turns.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MERGED="${1:-$ROOT/training/hazina/out/lora-hazina/merged-16bit}"
MODEL_NAME="${HAZINA_OLLAMA_MODEL:-hazina-concierge}"

if [[ ! -d "$MERGED" ]]; then
  echo "Missing merged weights at $MERGED — run hazina_finetune_unsloth.py first." >&2
  exit 1
fi

# Requires llama.cpp convert script or unsloth GGUF export on the training machine.
# Minimal path: point Ollama Modelfile at HF merged folder if ollama supports it.
MODEFILE="$ROOT/training/hazina/Modelfile"
cat > "$MODEFILE" <<EOF
FROM $MERGED
PARAMETER temperature 0.15
PARAMETER num_predict 512
SYSTEM $(tr '\n' ' ' < "$ROOT/training/hazina/system_prompt.txt")
EOF

ollama create "$MODEL_NAME" -f "$MODEFILE"
echo "Created Ollama model: $MODEL_NAME"
echo "Set in .env: LOCAL_LLM_MODEL=$MODEL_NAME  LLM_PROVIDER=local"
echo "Optional Hazina-only override (after API wiring): HAZINA_LLM_MODEL=$MODEL_NAME"
