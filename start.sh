#!/bin/bash
# ── OmniChannel AI Startup Script ──────────────────────────────
set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}=== OmniChannel AI Startup ===${NC}"

# 1. Docker
if ! systemctl is-active --quiet docker; then
  echo -e "${YELLOW}Starting Docker...${NC}"; sudo systemctl start docker
fi

# 2. Postgres + Redis
echo -e "${CYAN}→ Postgres + Redis${NC}"
docker-compose up -d postgres redis >/dev/null

# 3. Ollama (local AI engine)
if ! pgrep -x ollama >/dev/null; then
  echo -e "${CYAN}→ Starting Ollama${NC}"
  nohup ollama serve > /tmp/ollama.log 2>&1 &
  sleep 2
fi
if ! ollama list 2>/dev/null | grep -q "llama3.1"; then
  echo -e "${RED}Missing model llama3.1 — run: ollama pull llama3.1${NC}"; exit 1
fi
if ! ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
  echo -e "${RED}Missing model nomic-embed-text — run: ollama pull nomic-embed-text${NC}"; exit 1
fi
echo -e "${GREEN}  Ollama OK (llama3.1 + nomic-embed-text)${NC}"

# 4. Python venv
source .venv/bin/activate

# 5. Alembic migrations
echo -e "${CYAN}→ DB migrations${NC}"
alembic upgrade head 2>&1 | tail -3

# 5b. Seed demo knowledge base (idempotent — wipes & re-seeds each boot so
#     prompt-engineering iterations land immediately)
echo -e "${CYAN}→ Seeding knowledge base${NC}"
python scripts/seed_alpha.py 2>&1 | tail -5

# 5c. Pre-warm Ollama models so first customer reply is fast (~3s, not ~30s)
echo -e "${CYAN}→ Pre-warming Ollama models${NC}"
curl -s http://localhost:11434/api/generate \
  -d '{"model":"llama3.1","prompt":"hi","stream":false,"keep_alive":"30m"}' \
  -o /dev/null -m 60 &
curl -s http://localhost:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"hi"}' \
  -o /dev/null -m 30 &
wait
echo -e "${GREEN}  Models warm and pinned (keep_alive=30m)${NC}"

# 6. Live token check
echo -e "${CYAN}→ Validating Meta WA token${NC}"
TOKEN_OK=$(python -c "
import os, httpx
from dotenv import load_dotenv; load_dotenv()
pid=os.environ['META_WA_PHONE_NUMBER_ID']; tok=os.environ['META_WA_ACCESS_TOKEN']
r=httpx.get(f'https://graph.facebook.com/v20.0/{pid}', params={'access_token': tok}, timeout=10)
print('OK' if r.status_code==200 else f'BAD {r.status_code}')
" 2>&1)
if [[ "$TOKEN_OK" != "OK" ]]; then
  echo -e "${RED}  Meta token check: $TOKEN_OK${NC}"
  echo -e "${YELLOW}  → Regenerate at developers.facebook.com → WhatsApp → API Setup → Generate access token${NC}"
  echo -e "${YELLOW}  → Update META_WA_ACCESS_TOKEN in .env and rerun this script.${NC}"
else
  echo -e "${GREEN}  Meta WA token live${NC}"
fi

# 7. Launch API (foreground + tee to log)
mkdir -p logs
echo -e "${GREEN}→ Launching FastAPI on :8000  (logs at logs/api.log)${NC}"
echo -e "${CYAN}--- press Ctrl+C to stop ---${NC}"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info 2>&1 | tee logs/api.log
