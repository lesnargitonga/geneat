#!/usr/bin/env bash
# Hazina demo-safe runner — REAL BACKEND.
#
# Boots the real FastAPI app (app.main:app) with its real LangGraph AI graph,
# real services, real Postgres + Redis, and a REAL local LLM (Ollama) — so the
# portal exercises genuine infrastructure, not a reimplementation.
#
# The only mocked boundaries are the external edges that must never fire in a
# demo: WhatsApp (whatsapp_provider=mock) and payments (payment_simulator). No
# real provider keys are loaded: the process runs from a neutral CWD so this
# repo's .env is never read, and every secret falls back to empty.
#
# Prereqs already running on this machine: Postgres (:5432) + Redis (:6379)
# containers, and Ollama (:11434) with llama3.1 + nomic-embed-text.
#
# Then run the portal:
#   cd hazina-portal
#   BACKEND_URL=http://127.0.0.1:8000 NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npx next dev -p 3004
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${HAZINA_DEMO_PORT:-8000}"
NEUTRAL="$(mktemp -d)"   # neutral CWD => the repo .env (real keys) is NOT auto-loaded

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  sleep 1
fi

echo ">> Hazina REAL backend (mock WhatsApp + payment simulator, local LLM) on http://127.0.0.1:${PORT}"
cd "$NEUTRAL"
exec env -i PATH="/usr/bin:/bin" HOME="$HOME" \
  PYTHONPATH="$APP" PYTHONDONTWRITEBYTECODE=1 \
  APP_ENV=dev \
  WHATSAPP_PROVIDER=mock \
  PAYMENT_SIMULATOR=true PAYMENT_SIMULATOR_AUTOCONFIRM=true \
  LLM_PROVIDER=local USE_LOCAL_LLM=true LOCAL_LLM_MODEL="${LOCAL_LLM_MODEL:-llama3.1:latest}" \
  LOCAL_LLM_BASE_URL="${LOCAL_LLM_BASE_URL:-http://localhost:11434/v1}" LLM_FALLBACK_PROVIDERS=local \
  EMBED_PROVIDER=local \
  DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://omni:omni@localhost:5432/omni}" \
  DATABASE_URL_SYNC="${DATABASE_URL_SYNC:-postgresql+psycopg://omni:omni@localhost:5432/omni}" \
  REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}" \
  ADMIN_API_TOKEN="" SECRET_KEY="demo-secret" \
  "$APP/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port "$PORT" --workers 1 --log-level warning
