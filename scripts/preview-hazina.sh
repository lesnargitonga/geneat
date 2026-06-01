#!/usr/bin/env bash
# Rebuild and run Hazina portal in production mode (pre-deploy CSS check).
# Daily work: use ./scripts/dev-hazina.sh instead (hot reload on :3004).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL="${ROOT}/hazina-portal"
PORT="${HAZINA_PREVIEW_PORT:-3004}"

kill_port() {
  local p=$1
  pkill -f "next start -p ${p}" 2>/dev/null || true
  pkill -f "next dev -p ${p}" 2>/dev/null || true
  pkill -f "${PORTAL}/node_modules/.bin/next" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${p}/tcp" 2>/dev/null || true
  fi
}

echo "==> Stopping stale Hazina servers on 3001–3005…"
for p in 3001 3002 3003 3004 3005; do
  kill_port "$p"
done
sleep 1

echo "==> Building hazina-portal…"
rm -rf "${PORTAL}/.next"
(cd "${PORTAL}" && npm run build)

echo "==> Starting production server on http://localhost:${PORT}"
cd "${PORTAL}"
exec npx next start -p "${PORT}"
