# Hazina Nomads — Demo-Safe Mode (REAL backend)

This runs the Hazina customer journey on the **real infrastructure** — the real
FastAPI app, the real LangGraph AI graph, real services, real Postgres + Redis —
with only the unavoidable external edges mocked. Nothing critical is exposed: no
real provider keys are loaded.

## What is real vs mocked

| Layer | Demo behaviour |
|---|---|
| Portal (Next.js, `hazina-portal/`) | **Real** |
| Backend | **Real** `app.main:app` (FastAPI) |
| AI conversation | **Real** LangGraph graph (`app/ai/graph.py`) + real services/tools |
| LLM + embeddings | **Real, local** via Ollama (`llama3.1`, `nomic-embed-text`) — **zero external API calls** |
| Database / queue | **Real** local Postgres (`:5432`) + Redis (`:6379`) |
| WhatsApp send | **Mocked** (`whatsapp_provider=mock`) — never calls Meta |
| Payments | **Simulated** (`payment_simulator=true`) — never calls IntaSend/Paystack/M-Pesa |
| Secrets | **None loaded** — backend runs from a neutral CWD so this repo's `.env` is never read; all keys default to empty |

## Run

```bash
cd "/home/lesnar/Documents/ai model"
./scripts/run_hazina_demo_safe.sh          # REAL backend on :8000

# portal, pointed at it:
cd hazina-portal
BACKEND_URL=http://127.0.0.1:8000 NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npx next dev -p 3004
```

Prereqs already up on this machine: Postgres + Redis containers, and Ollama with
`llama3.1` + `nomic-embed-text`.

## Demo journey (what to click in the Loom)

1. **Browse** — http://127.0.0.1:3004/collections. Catalog is backend-served:
   `/api/catalog` → `backend.source: HAZINA_COLLECTIONS+HAZINA_TREASURES`, 5
   collections / 33 treasures from the DB.
2. **Chat (real AI graph)** — open the chat widget, ask for gift boxes. The real
   graph replies with the live menu + interactive chips, then runs a real
   multi-turn checkout (name → delivery channel → address → date → payment).
3. **Order created** — completing checkout writes a real order and returns a
   **simulated** payment link + a tracking magic-link, e.g.
   `/orders/HN-ORD-XXXXXXXX?token=…`.
4. **Track** — open that link; the portal server-renders the real order
   (lines, payment status, fulfilment, 7-step timeline) from
   `/api/public/orders/{ref}`.

## Verify

```bash
curl -s http://127.0.0.1:8000/healthz                       # {"status":"ok"}
curl -s http://127.0.0.1:3004/api/health                    # ok:true
curl -s http://127.0.0.1:8000/catalog/businesses/hazina-nomads/hazina | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['collections']),'collections')"
```

## Safety

- No outbound WhatsApp / payment / network provider calls (mock + simulator).
- No real provider keys are loaded (neutral CWD; `.env` not read).
- `/admin/*` endpoints reject all requests (`ADMIN_API_TOKEN` empty) — don't demo them.
- Uses the local **dev** Postgres/Redis, not production (production is remote).

## Offline fallback

`demo/hazina_demo_backend_fallback.py` is a self-contained stand-in (mock
providers, in-memory, no DB/LLM needed) for when Postgres/Redis/Ollama aren't
available. It reproduces the same endpoint contract but does **not** run the real
graph. Prefer the real backend above; use the fallback only if the stack is down:

```bash
HAZINA_DEMO_PORT=8000 .venv/bin/python demo/hazina_demo_backend_fallback.py
```
