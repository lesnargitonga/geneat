# Hazina Nomads SLM fine-tune

Hybrid architecture: **deterministic gate** (`hazina_deterministic_gate.py`) handles menus, cart recovery, and payments; this model handles **open-ended** concierge dialogue only.

## Your environment

- Ollama: `llama3.1:latest` (~4.9 GB) — same family as `meta-llama/Meta-Llama-3.1-8B-Instruct`
- Production LLM switch: `LLM_PROVIDER=local` + `LOCAL_LLM_MODEL=…` in `app/ai/llm.py`

## Phase 1 — Dataset (start here)

```bash
cd "/home/lesnar/Documents/ai model"
python3 scripts/hazina_generate_finetune_dataset.py --target-count 800
```

Outputs:

| File | Purpose |
|------|---------|
| `training/hazina/out/train.jsonl` | Training split |
| `training/hazina/out/val.jsonl` | Validation split |
| `training/hazina/golden.jsonl` | Hand-tuned tone anchors (edit freely) |
| `training/hazina/system_prompt.txt` | Canonical system prompt |

Curated categories generated automatically:

1. **Luxury persona** — off-topic / café confusion redirects  
2. **Catalog straitjacket** — every collection + sample treasures with `[Catalog context]`  
3. **Escalation** — corporate / bulk / negotiation  
4. **Logistics** — hotel, JKIA, DHL  
5. **Golden** — 10 high-quality pairs you should extend to ~50 over time  

Target **500–1000** rows: rerun with `--target-count 1000` after adding more lines to `golden.jsonl`.

## Phase 2 — Fine-tune (Runpod or local GPU)

On a machine with **24GB+ VRAM** (A100, 4090, or Runpod pod):

```bash
pip install -r requirements-finetune.txt
python3 scripts/hazina_finetune_unsloth.py \
  --train training/hazina/out/train.jsonl \
  --output training/hazina/out/lora-hazina \
  --epochs 2
```

Uses QLoRA on `unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit` (~2–4 hours on a single 4090).

## Phase 3 — Ollama (dev) or vLLM (prod)

**Local Ollama:**

```bash
bash scripts/hazina_export_ollama.sh training/hazina/out/lora-hazina/merged-16bit
```

Then in `.env`:

```
LLM_PROVIDER=local
LOCAL_LLM_MODEL=hazina-concierge
```

**Runpod vLLM:** deploy merged weights; set `LOCAL_LLM_BASE_URL=https://<pod>/v1` (OpenAI-compatible). LangGraph and tools unchanged.

## Phase 4 — API integration (after eval)

1. Run `val.jsonl` prompts through base vs fine-tuned model; reject leaks (STK dumps, café tone, invented SKUs).  
2. Add tenant-aware model selection in `get_chat_chain()` when `business_slug=hazina-nomads`.  
3. Keep `search_catalog` tool mandatory in graph — fine-tune is persona, not inventory source of truth.

## Recommended workflow

1. **Today:** generate dataset + manually add **40 more** lines to `golden.jsonl` (your exact tone).  
2. **Runpod:** one Unsloth run; download `merged-16bit`.  
3. **Dev:** Ollama `hazina-concierge`; WhatsApp open-ended only.  
4. **Prod:** vLLM on Runpod; same env vars as Ollama OpenAI shim.

Deterministic routing from `de45182` stays untouched — you are only swapping the brain behind ambiguous text.
