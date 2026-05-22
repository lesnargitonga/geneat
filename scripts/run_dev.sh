#!/usr/bin/env bash
# Recommended dev launcher.
#
# Why this exists: uvicorn's auto-reload mode + multi-worker accumulates
# memory across reloads (LangGraph chains hold model handles, AsyncEngine
# pools, etc.). On a 16 GB box you can OOM after a few dozen restarts.
# This script pins a single worker, disables reload, and runs from the
# repo root with the correct PYTHONPATH and venv. Use this instead of
# bare ``uvicorn`` invocations.
set -euo pipefail

cd "$(dirname "$0")/.."

export PYTHONPATH="${PYTHONPATH:-.}"
export PYTHONDONTWRITEBYTECODE=1

VENV="./.venv/bin/uvicorn"
if [[ ! -x "$VENV" ]]; then
  echo "venv uvicorn not found at $VENV — run: python -m venv .venv && pip install -r requirements.txt" >&2
  exit 1
fi

exec "$VENV" app.main:app \
  --host "${HOST:-0.0.0.0}" \
  --port "${PORT:-8000}" \
  --workers 1 \
  --log-level "${LOG_LEVEL:-info}" \
  "$@"
