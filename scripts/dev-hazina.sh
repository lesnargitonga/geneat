#!/usr/bin/env bash
# Hazina portal — one local URL, hot reload (refresh after saves; no rebuild).
#
# Usage:
#   ./scripts/dev-hazina.sh              # start next dev on :3004
#   ./scripts/dev-hazina.sh --clean      # wipe .next then start (fix stale CSS)
#   ./scripts/dev-hazina.sh --background # detach (logs: hazina-portal/.dev-hazina.log)
#
# Always: http://localhost:3004  (override: HAZINA_DEV_PORT=3005)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL="${ROOT}/hazina-portal"
PORT="${HAZINA_DEV_PORT:-3004}"
CLEAN=0
BACKGROUND=0

for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    --no-clean) CLEAN=0 ;;
    --background|-b) BACKGROUND=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

kill_listeners_on_port() {
  local p=$1
  local pids=""
  if command -v ss >/dev/null 2>&1; then
    pids=$(ss -tlnp "sport = :${p}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u | tr '\n' ' ' || true)
  fi
  if [[ -z "${pids// /}" ]] && command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -t -i:"${p}" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ' || true)
  fi
  if [[ -n "${pids// /}" ]]; then
    kill -TERM ${pids} 2>/dev/null || true
    sleep 0.3
    kill -9 ${pids} 2>/dev/null || true
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${p}/tcp" 2>/dev/null || true
  fi
}

port_in_use() {
  ss -tln "sport = :${1}" 2>/dev/null | grep -q LISTEN
}

stop_repo_next() {
  pkill -f "${ROOT}/hazina-portal/node_modules/.bin/next dev" 2>/dev/null || true
  pkill -f "${ROOT}/hazina-portal/node_modules/.bin/next start" 2>/dev/null || true
  pkill -f "next dev -p ${PORT}" 2>/dev/null || true
  pkill -f "next start -p ${PORT}" 2>/dev/null || true
}

echo "==> Stopping anything on port ${PORT} (next dev / next start)…"
stop_repo_next
kill_listeners_on_port "${PORT}"
stop_repo_next
sleep 0.5

if port_in_use "${PORT}"; then
  echo "ERROR: port ${PORT} is still in use. Try: fuser -k ${PORT}/tcp" >&2
  ss -tlnp "sport = :${PORT}" 2>/dev/null || true
  exit 1
fi

if [[ ! -d "${PORTAL}/node_modules" ]]; then
  echo "==> Installing hazina-portal dependencies…"
  (cd "${PORTAL}" && npm install)
fi

if [[ "$CLEAN" -eq 1 ]]; then
  echo "==> Removing ${PORTAL}/.next …"
  rm -rf "${PORTAL}/.next"
fi

cd "${PORTAL}"

wait_for_ready() {
  local url="http://127.0.0.1:${PORT}/"
  local i
  for i in $(seq 1 90); do
    if curl -sf -o /dev/null "$url"; then
      echo ""
      echo "✓ Hazina portal (dev, hot reload): http://localhost:${PORT}"
      echo "  Edit files → save → refresh the browser (same port)."
      echo "  Build page:  http://localhost:${PORT}/build"
      echo "  Collections: http://localhost:${PORT}/collections"
      echo ""
      echo "Chat widget needs API on :8000 — run in another terminal: make dev"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${url}" >&2
  return 1
}

if [[ "$BACKGROUND" -eq 1 ]]; then
  LOG="${PORTAL}/.dev-hazina.log"
  echo "==> Starting next dev in background (log: ${LOG})…"
  nohup npx next dev -p "${PORT}" >>"${LOG}" 2>&1 &
  echo $! > "${PORTAL}/.dev-hazina.pid"
  wait_for_ready
else
  echo "==> Starting next dev on port ${PORT} (Ctrl+C to stop)…"
  npx next dev -p "${PORT}" &
  DEV_PID=$!
  trap 'kill ${DEV_PID} 2>/dev/null || true' EXIT INT TERM
  wait_for_ready || { kill ${DEV_PID} 2>/dev/null || true; exit 1; }
  wait ${DEV_PID}
fi
