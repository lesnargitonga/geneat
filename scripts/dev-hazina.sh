#!/usr/bin/env bash
# Stop other local frontends, optionally clear Next cache, start Hazina on :3001.
#
# Usage:
#   ./scripts/dev-hazina.sh              # clean .next, foreground dev server
#   ./scripts/dev-hazina.sh --no-clean   # faster restart, keep .next
#   ./scripts/dev-hazina.sh --background # detach (logs: hazina-portal/.dev-hazina.log)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL="${ROOT}/hazina-portal"
PORT=3001
CLEAN=1
BACKGROUND=0

for arg in "$@"; do
  case "$arg" in
    --no-clean) CLEAN=0 ;;
    --background|-b) BACKGROUND=1 ;;
    -h|--help)
      sed -n '2,8p' "$0"
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

ensure_port_free() {
  local p=$1
  if port_in_use "$p"; then
    echo "ERROR: port ${p} is still in use after cleanup." >&2
    ss -tlnp "sport = :${p}" 2>/dev/null || true
    echo "Run this from your own terminal (outside a restricted sandbox):" >&2
    echo "  fuser -k ${p}/tcp   # or: kill -9 \$(lsof -t -i:${p})" >&2
    exit 1
  fi
}

stop_repo_next() {
  pkill -f "${ROOT}/hazina-portal/node_modules/.bin/next dev" 2>/dev/null || true
  pkill -f "${ROOT}/gen-eat-portal/node_modules/.bin/next dev" 2>/dev/null || true
  pkill -f "next dev -p 300[012]" 2>/dev/null || true
}

echo "==> Stopping dev servers on ports 3000, 3001, 3002…"
stop_repo_next
for p in 3000 3001 3002; do
  kill_listeners_on_port "$p"
done
stop_repo_next
sleep 1
ensure_port_free "${PORT}"

if [[ ! -d "${PORTAL}/node_modules" ]]; then
  echo "==> Installing hazina-portal dependencies…"
  (cd "${PORTAL}" && npm install)
fi

if [[ "$CLEAN" -eq 1 ]]; then
  echo "==> Removing ${PORTAL}/.next …"
  rm -rf "${PORTAL}/.next"
else
  echo "==> Skipping .next clean (--no-clean)"
fi

cd "${PORTAL}"

wait_for_ready() {
  local url="http://127.0.0.1:${PORT}/"
  local i
  for i in $(seq 1 90); do
    if curl -sf -o /dev/null "$url"; then
      echo ""
      echo "✓ Hazina portal ready: http://localhost:${PORT}"
      echo "  Collections: http://localhost:${PORT}/collections"
      echo "  JKIA gifts:  http://localhost:${PORT}/last-minute-kenya-gifts-jkia"
      echo "  About:       http://localhost:${PORT}/about"
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
  nohup npm run dev >>"${LOG}" 2>&1 &
  echo $! > "${PORTAL}/.dev-hazina.pid"
  wait_for_ready
else
  echo "==> Starting next dev on port ${PORT} (Ctrl+C to stop)…"
  npm run dev &
  DEV_PID=$!
  trap 'kill ${DEV_PID} 2>/dev/null || true' EXIT INT TERM
  wait_for_ready || { kill ${DEV_PID} 2>/dev/null || true; exit 1; }
  wait ${DEV_PID}
fi
