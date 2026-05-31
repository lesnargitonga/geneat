# Hazina Nomads Portal

Standalone customer site for [Hazina Nomads](https://hazina.lesnarai.co.ke).  
Product & launch doc: [docs/HAZINA_NOMADS.md](../docs/HAZINA_NOMADS.md)

## Run locally (recommended)

**Dev mode** — from repo root (stops ports 3000–3002, clears stale `.next`, starts on **3001**):

```bash
make dev-hazina
# or: ./scripts/dev-hazina.sh
```

**Production preview** — stable styling (preferred if the page looks like unstyled HTML):

```bash
make preview-hazina
# → http://localhost:3004
```

Faster dev restart without wiping the Next cache:

```bash
./scripts/dev-hazina.sh --no-clean
```

Detached dev server (logs in `hazina-portal/.dev-hazina.log`):

```bash
./scripts/dev-hazina.sh --background
```

Chat widget + API status badges need the backend — in another terminal:

```bash
make dev   # FastAPI on :8000
```

### Page looks like plain HTML?

Usually a **stale server** or **CSS hash mismatch**. Stop all `next dev` / `next start` processes, then:

```bash
make preview-hazina
```

Hard refresh: **Ctrl+Shift+R**. Full troubleshooting: [HAZINA_NOMADS.md §9.6](../docs/HAZINA_NOMADS.md#96-troubleshooting--portal-looks-like-unstyled-html).

## Manual (this directory only)

```bash
npm install
npm run dev          # http://localhost:3001
npm run dev:clean    # repo dev-hazina.sh wrapper
npm run preview      # build + next start on :3003
npm run build
npm run lint
npm run typecheck
npm run start
```

Verify image refs:

```bash
python ../scripts/check_asset_images.py
```

Gen-Eat (USIU café demo) lives in [`gen-eat-portal/`](../gen-eat-portal/) — separate app, separate domain.
