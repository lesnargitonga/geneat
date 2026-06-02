#!/usr/bin/env python3
"""QLoRA fine-tune Hazina persona on Llama 3.1 8B with Unsloth (Runpod / local GPU).

Prerequisites:
  pip install -r requirements-finetune.txt
  python scripts/hazina_generate_finetune_dataset.py --target-count 800

Usage (local or Runpod):
  python scripts/hazina_finetune_unsloth.py \\
    --train training/hazina/out/train.jsonl \\
    --output training/hazina/out/lora-hazina

Export to Ollama after training (on GPU host or after download):
  bash scripts/hazina_export_ollama.sh training/hazina/out/lora-hazina/gguf-ollama
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _format_row(row: dict) -> dict:
    """Unsloth chat template: single text field or messages list."""
    messages = row.get("messages") or []
    return {"messages": messages}


def _write_ollama_modelfile(tokenizer, gguf_dir: Path) -> Path:
    """Persist Unsloth's chat-template-aligned Modelfile next to the GGUF export."""
    gguf_dir.mkdir(parents=True, exist_ok=True)
    modelfile = gguf_dir / "Modelfile"
    template = (getattr(tokenizer, "_ollama_modelfile", None) or "").strip()
    if not template:
        print(
            "WARNING: tokenizer._ollama_modelfile is empty — Ollama may loop or repeat. "
            "Ensure training used tokenizer.apply_chat_template on every row.",
            file=sys.stderr,
        )
        return modelfile

    ggufs = sorted(gguf_dir.glob("*.gguf"))
    if ggufs and "FROM " not in template.splitlines()[0]:
        # Unsloth sometimes emits TEMPLATE/PARAMETER only; anchor the quantised weights.
        body = f"FROM ./{ggufs[0].name}\n{template}"
    else:
        body = template

    modelfile.write_text(body.rstrip() + "\n", encoding="utf-8")
    print(f"Ollama Modelfile (chat template locked) → {modelfile}")
    return modelfile


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-model",
        default="unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit",
        help="HF model id (matches Ollama llama3.1 family)",
    )
    parser.add_argument(
        "--train",
        type=Path,
        default=ROOT / "training/hazina/out/train.jsonl",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "training/hazina/out/lora-hazina",
    )
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--grad-accum", type=int, default=4)
    parser.add_argument("--warmup-steps", type=int, default=10)
    parser.add_argument(
        "--merge-memory",
        type=float,
        default=0.5,
        help="Cap peak RAM during merged_16bit save (prevents Runpod OOM at 99%%)",
    )
    parser.add_argument(
        "--gguf-quant",
        default="q4_k_m",
        help="GGUF quant for Ollama (q4_k_m recommended)",
    )
    parser.add_argument(
        "--skip-gguf",
        action="store_true",
        help="Only write merged-16bit (vLLM); skip GGUF + Modelfile export",
    )
    args = parser.parse_args()

    if args.epochs > 3:
        print("Warning: epochs > 3 risks overfitting on concierge tone — capping at 3.", file=sys.stderr)
        args.epochs = 3

    if not args.train.is_file():
        print(f"Missing {args.train} — run hazina_generate_finetune_dataset.py first.", file=sys.stderr)
        return 1

    try:
        from datasets import Dataset
        from unsloth import FastLanguageModel
        from trl import SFTTrainer
        from transformers import TrainingArguments
    except ImportError as e:
        print(
            "Install fine-tune deps: pip install -r requirements-finetune.txt\n"
            f"Import error: {e}",
            file=sys.stderr,
        )
        return 1

    rows = [_format_row(r) for r in _load_jsonl(args.train)]
    dataset = Dataset.from_list(rows)

    # QLoRA: 4-bit base + rank-16 adapters on all linear layers (Unsloth defaults).
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    def _formatting_prompts(examples):
        texts = []
        for messages in examples["messages"]:
            texts.append(
                tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=False,
                )
            )
        return {"text": texts}

    dataset = dataset.map(_formatting_prompts, batched=True)

    args.output.mkdir(parents=True, exist_ok=True)
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        args=TrainingArguments(
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=args.grad_accum,
            warmup_steps=args.warmup_steps,
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            fp16=False,
            bf16=True,
            logging_steps=10,
            output_dir=str(args.output),
            optim="adamw_8bit",
            seed=42,
            save_strategy="epoch",
        ),
    )
    train_config = {
        "base_model": args.base_model,
        "max_seq_length": args.max_seq_length,
        "load_in_4bit": True,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "target_modules": [
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        "per_device_train_batch_size": args.batch_size,
        "gradient_accumulation_steps": args.grad_accum,
        "num_train_epochs": args.epochs,
        "learning_rate": args.lr,
        "merge_memory_cap": args.merge_memory,
        "gguf_quant": args.gguf_quant,
        "train_rows": len(rows),
    }
    (args.output / "train_config.json").write_text(
        json.dumps(train_config, indent=2),
        encoding="utf-8",
    )
    trainer.train()
    model.save_pretrained(str(args.output))
    tokenizer.save_pretrained(str(args.output))

    merged = args.output / "merged-16bit"
    model.save_pretrained_merged(
        str(merged),
        tokenizer,
        save_method="merged_16bit",
        maximum_memory_usage=args.merge_memory,
    )
    print(f"LoRA saved → {args.output}")
    print(f"Merged weights → {merged}")

    if not args.skip_gguf:
        gguf_dir = args.output / "gguf-ollama"
        print(f"Exporting GGUF ({args.gguf_quant}) for Ollama → {gguf_dir}")
        model.save_pretrained_gguf(str(gguf_dir), tokenizer, quantization_method=args.gguf_quant)
        _write_ollama_modelfile(tokenizer, gguf_dir)
        print("Next: bash scripts/hazina_export_ollama.sh", gguf_dir)
    else:
        print("Skipped GGUF export (--skip-gguf). Use merged-16bit for vLLM only.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
