# Hazina Nomads Portal

Standalone customer site for [Hazina Nomads](https://hazina.lesnarai.co.ke).  
Product & launch doc: [docs/HAZINA_NOMADS.md](../docs/HAZINA_NOMADS.md)

## Run locally (recommended)

From the **repo root** (stops anything on ports 3000–3002, clears stale `.next`, starts on **3001**):

```bash
./scripts/dev-hazina.sh
# or: make dev-hazina
```

Faster restart without wiping the Next cache:

```bash
./scripts/dev-hazina.sh --no-clean
```

Detached server (logs in `hazina-portal/.dev-hazina.log`):

```bash
./scripts/dev-hazina.sh --background
```

Chat widget needs the API — in another terminal: `make dev` (uvicorn on :8000).

## Manual (this directory only)

```bash
npm install
npm run dev    # http://localhost:3001
npm run build
npm run start
```

Gen-Eat (USIU café demo) lives in [`gen-eat-portal/`](../gen-eat-portal/) — separate app, separate domain.
