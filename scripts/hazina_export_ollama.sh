#!/usr/bin/env bash
# Register Hazina fine-tune in Ollama using Unsloth's training-time Modelfile (chat template locked).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="${1:-$ROOT/training/hazina/out/lora-hazina/gguf-ollama}"
MODEL_NAME="${HAZINA_OLLAMA_MODEL:-hazina-concierge}"

# Accept gguf-ollama dir or legacy merged-16bit parent.
if [[ -d "$INPUT/gguf-ollama" ]]; then
  GGUF_DIR="$INPUT/gguf-ollama"
elif [[ -f "$INPUT/Modelfile" ]] || ls "$INPUT"/*.gguf >/dev/null 2>&1; then
  GGUF_DIR="$INPUT"
else
  GGUF_DIR="$ROOT/training/hazina/out/lora-hazina/gguf-ollama"
fi

if [[ ! -d "$GGUF_DIR" ]]; then
  echo "Missing $GGUF_DIR — run hazina_finetune_unsloth.py on a GPU host first." >&2
  echo "Training writes GGUF + Modelfile to training/hazina/out/lora-hazina/gguf-ollama/" >&2
  exit 1
fi

MODEFILE="$GGUF_DIR/Modelfile"
if [[ ! -f "$MODEFILE" ]]; then
  echo "No Modelfile in $GGUF_DIR." >&2
  echo "Re-run training export (do NOT hand-write a generic Modelfile — chat template must match)." >&2
  exit 1
fi

if ! ls "$GGUF_DIR"/*.gguf >/dev/null 2>&1; then
  echo "No .gguf weights in $GGUF_DIR — re-run hazina_finetune_unsloth.py export." >&2
  exit 1
fi

echo "Using Unsloth Modelfile (TEMPLATE + stop tokens from training):"
head -n 20 "$MODEFILE"
echo "…"

cd "$GGUF_DIR"
ollama create "$MODEL_NAME" -f Modelfile
echo ""
echo "Created Ollama model: $MODEL_NAME"
echo "Smoke test:"
echo "  python scripts/hazina_smoke_finetuned.py --model $MODEL_NAME --compare llama3.1 --matrix-only"
echo ""
echo "API .env:"
echo "  LLM_PROVIDER=local"
echo "  LOCAL_LLM_MODEL=llama3.1"
echo "  HAZINA_LLM_MODEL=$MODEL_NAME"
