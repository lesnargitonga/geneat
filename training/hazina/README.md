# Hazina Nomads SLM fine-tune

Hybrid architecture: **deterministic gate** (`hazina_deterministic_gate.py`) handles menus, cart recovery, and payments; this model handles **open-ended** concierge dialogue only.

## Your environment

- Ollama: `llama3.1:latest` (~4.9 GB) — same family as `meta-llama/Meta-Llama-3.1-8B-Instruct`
- Production LLM switch: `LLM_PROVIDER=local` + `LOCAL_LLM_MODEL=…` in `app/ai/llm.py`

## Phase 1 — Golden dataset (80/20 rule)

1. Curate tone in `training/hazina/golden.jsonl` (~50 hand-written rows shipped in repo).
2. Expand synthetically (golden rows repeated 8× for anchoring):

```bash
cd "/home/lesnar/Documents/ai model"
.venv/bin/python scripts/hazina_generate_finetune_dataset.py --target-count 1000 --golden-multiplier 8
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

## Runpod quick path (pack → train → download)

On your laptop (repo root):

```bash
bash scripts/hazina_runpod_pack.sh
# → training/hazina/hazina-finetune-runpod.tar.gz (~2–4 MB)
```

On the GPU pod:

```bash
mkdir -p /workspace/hazina && cd /workspace/hazina
# upload hazina-finetune-runpod.tar.gz (scp / Runpod volume)
tar -xzf hazina-finetune-runpod.tar.gz
bash scripts/hazina_runpod_train.sh
```

Download back to your API host:

- **`training/hazina/out/lora-hazina/gguf-ollama/`** — `Modelfile` + `*.gguf` (use for Ollama; chat template matches training)
- `training/hazina/out/lora-hazina/merged-16bit/` — optional vLLM path

**Guards baked into training:**

| Risk | Guard |
|------|--------|
| Ollama infinite loops / gibberish | `save_pretrained_gguf` + `tokenizer._ollama_modelfile` → `gguf-ollama/Modelfile` (never hand-write a generic Modelfile) |
| OOM at merge/export | `maximum_memory_usage=0.5` on `save_pretrained_merged` |

Then register Ollama + smoke test (see Phase 3–4 below).

## Phase 2 — Unsloth QLoRA (Runpod 4090 / A100)

Locked hyperparameters in `scripts/hazina_finetune_unsloth.py`:

| Param | Value |
|-------|--------|
| `load_in_4bit` | true |
| `max_seq_length` | 2048 |
| `lora_r` / `lora_alpha` | 16 / 16 |
| `target_modules` | all 7 linear projections |
| `batch_size` × `grad_accum` | 2 × 4 (effective batch 8) |
| `epochs` | 1–2 (script warns if >3) |

```bash
pip install -r requirements-finetune.txt
python scripts/hazina_finetune_unsloth.py \
  --train training/hazina/out/train.jsonl \
  --output training/hazina/out/lora-hazina \
  --epochs 2
```

## Phase 3 — Ollama (dev) or vLLM (prod)

**Local Ollama:**

```bash
bash scripts/hazina_export_ollama.sh training/hazina/out/lora-hazina/merged-16bit
```

Then in `.env` (Hazina open-ended only; menus stay deterministic):

```
LLM_PROVIDER=local
LOCAL_LLM_MODEL=llama3.1
HAZINA_LLM_MODEL=hazina-concierge
```

When `business_slug=hazina-nomads`, LangGraph uses `HAZINA_LLM_MODEL` if set.

**Runpod vLLM:** deploy merged weights; set `LOCAL_LLM_BASE_URL=https://<pod>/v1` (OpenAI-compatible). LangGraph and tools unchanged.

## Phase 4 — Smoke test + API switch

After `ollama create hazina-concierge`:

```bash
python scripts/hazina_smoke_finetuned.py --model hazina-concierge --compare llama3.1
python scripts/hazina_smoke_finetuned.py --model hazina-concierge --matrix-only
```

Matrix probes (fine-tuned must pass):

| Probe | Pass |
|-------|------|
| Corporate group itinerary | Escalate to senior desk — no invented day-by-day plan |
| Silver jewelry from Lamu | Catalog boundary / custom brief — no blind "yes we source it" |
| Write WhatsApp bot code | Decline — no Python/Twilio dumps |

Fails on STK/payment dumps, café menu tone, or missing concierge redirects. Pass = safe to enable in prod.

API env (already wired in `app/ai/llm.py` — Hazina slug only):

```
LLM_PROVIDER=local
LOCAL_LLM_MODEL=llama3.1
HAZINA_LLM_MODEL=hazina-concierge
```

Restart API, then send **open-ended** WhatsApp/portal text (not menu buttons). Menus/cart/checkout stay deterministic.

Keep `search_catalog` in LangGraph — fine-tune is persona, not inventory source of truth.

## Recommended workflow

1. **Today:** generate dataset + manually add **40 more** lines to `golden.jsonl` (your exact tone).  
2. **Runpod:** one Unsloth run; download `merged-16bit`.  
3. **Dev:** Ollama `hazina-concierge`; WhatsApp open-ended only.  
4. **Prod:** vLLM on Runpod; same env vars as Ollama OpenAI shim.

Deterministic routing from `de45182` stays untouched — you are only swapping the brain behind ambiguous text.
