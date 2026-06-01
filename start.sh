#!/bin/bash
# OmniChannel AI Startup Script — robust startup (best-effort)
set -u
cd "$(dirname "$0")"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log(){ echo -e "${CYAN}=> $*${NC}"; }
info(){ echo -e "${GREEN}==> $*${NC}"; }
warn(){ echo -e "${YELLOW}!! $*${NC}"; }

wait_for_port(){
  local host="$1"; local port="$2"; local timeout="${3:-60}"; local start=$(date +%s)
  while true; do
    if command -v nc >/dev/null 2>&1; then
      nc -z "$host" "$port" >/dev/null 2>&1 && break
    else
      (echo > /dev/tcp/${host}/${port}) >/dev/null 2>&1 && break
    fi
    if (( $(date +%s) - start >= timeout )); then
      warn "Timeout waiting for ${host}:${port}"
      return 1
    fi
    sleep 1
  done
  info "${host}:${port} reachable"
  return 0
}

log "=== OmniChannel AI Startup (robust) ==="

# 1. Docker
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet docker; then
    log "Starting Docker (may require sudo)"
    if sudo systemctl start docker 2>/dev/null; then
      info "Docker started"
    else
      warn "Could not start Docker via systemctl; ensure Docker is installed and running."
    fi
  fi
elif command -v docker >/dev/null 2>&1; then
  info "Docker CLI present (not managing service)"
else
  warn "Docker not found; some services may not start."
fi

# 2. Postgres + Redis (compose, best-effort)
if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
  log "Starting Postgres & Redis via docker-compose (best-effort)"
  (docker compose up -d postgres redis 2>/dev/null || docker-compose up -d postgres redis 2>/dev/null) || warn "docker-compose up failed"
  wait_for_port localhost 5432 30 || warn "Postgres may be unavailable on localhost:5432"
  wait_for_port localhost 6379 30 || warn "Redis may be unavailable on localhost:6379"
else
  warn "docker-compose.yml not found; skipping DB/Redis startup"
fi

# 3. Ollama (local AI engine) — best-effort
if command -v ollama >/dev/null 2>&1; then
  if ! pgrep -x ollama >/dev/null 2>&1; then
    log "Starting Ollama (background)"
    nohup ollama serve > /tmp/ollama.log 2>&1 &
    sleep 2
  fi
  if ollama list 2>/dev/null | grep -q "llama3.1"; then
    info "Ollama models present"
  else
    warn "Ollama model 'llama3.1' not present; run: ollama pull llama3.1"
  fi
else
  warn "Ollama CLI not installed; skipping model prewarm"
fi

# 4. Python venv (create if missing)
if [ ! -d .venv ]; then
  if command -v python3 >/dev/null 2>&1; then
    log "Creating Python venv .venv and installing requirements (best-effort)"
    python3 -m venv .venv || warn "venv creation failed"
    . .venv/bin/activate
    if [ -f requirements.txt ]; then
      pip install -q -r requirements.txt || warn "pip install failed; continuing"
    fi
  else
    warn "python3 not found; please install Python 3.10+"
  fi
else
  . .venv/bin/activate
  info "Activated existing venv"
fi

# 5. Alembic migrations (best-effort)
if [ -f alembic.ini ]; then
  log "Running alembic migrations (best-effort)"
  if command -v alembic >/dev/null 2>&1; then
    alembic upgrade head || warn "Alembic migration failed"
  else
    python -m alembic upgrade head 2>/dev/null || warn "Alembic (python -m) failed; DB may be unreachable"
  fi
else
  warn "alembic.ini not found; skipping migrations"
fi

# 6. Seed demo knowledge base (optional, best-effort)
# Only run seed if embedding/API keys or Ollama host are configured to avoid
# failing when no external model credentials are present.
if [ -f scripts/seed_alpha.py ]; then
  if [ -n "${OPENAI_API_KEY:-}" ] || [ -n "${NOMIC_API_KEY:-}" ] || [ -n "${OLLAMA_HOST:-}" ]; then
    log "Seeding knowledge base (best-effort)"
    python scripts/seed_alpha.py || warn "Seeding failed"
  else
    warn "Skipping seed: OPENAI_API_KEY, NOMIC_API_KEY, or OLLAMA_HOST not set"
  fi
fi

# 7. Pre-warm Ollama models (best-effort)
if command -v curl >/dev/null 2>&1; then
  if curl -s --fail http://localhost:11434/api/generate -o /dev/null; then
    log "Pre-warming Ollama models (background)"
    curl -s http://localhost:11434/api/generate -d '{"model":"llama3.1","prompt":"hi","stream":false,"keep_alive":"30m"}' -o /dev/null -m 60 &
    curl -s http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"hi"}' -o /dev/null -m 30 &
    sleep 1
  else
    warn "Ollama HTTP API not reachable on http://localhost:11434; skipping prewarm"
  fi
fi

# 8. Meta WA token check - warn but don't fail
if [ -n "${META_WA_PHONE_NUMBER_ID:-}" ] && [ -n "${META_WA_ACCESS_TOKEN:-}" ]; then
  log "Validating Meta WA token (best-effort)"
  if ! python - <<'PY'
from dotenv import load_dotenv
import os, httpx
load_dotenv()
pid=os.environ.get('META_WA_PHONE_NUMBER_ID')
tok=os.environ.get('META_WA_ACCESS_TOKEN')
if not pid or not tok:
    raise SystemExit(1)
r=httpx.get(f'https://graph.facebook.com/v20.0/{pid}', params={'access_token': tok}, timeout=10)
if r.status_code!=200:
    raise SystemExit(1)
print('OK')
PY
  then
    info "Meta WA token OK"
  else
    warn "Meta WA token validation failed; continuing anyway"
  fi
else
  warn "META_WA_PHONE_NUMBER_ID or META_WA_ACCESS_TOKEN not set; skipping Meta WA validation"
fi

# 9. Final: start FastAPI (foreground)
mkdir -p logs
info "Launching FastAPI on :8000 (logs at logs/api.log)"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info 2>&1 | tee logs/api.log
