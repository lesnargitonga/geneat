#!/usr/bin/env bash
set -euo pipefail
OUTDIR="logs/security"
mkdir -p "$OUTDIR"

# Prefer project virtualenv if present
if [ -d ".venv" ] && [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
  PIP=".venv/bin/pip"
  export PATH=".venv/bin:$PATH"
else
  PY="$(command -v python3 || command -v python)"
  PIP="$(command -v pip || true)"
fi

echo "Using PY=$PY PIP=$PIP"

echo "Installing required tools (bandit, pip-audit, safety) if missing..."
$PIP install --upgrade pip >/dev/null 2>&1 || true
$PIP install --upgrade bandit pip-audit safety >/dev/null 2>&1 || true

echo "Running bandit (app/)..."
bandit -r app -f json -o "$OUTDIR/bandit.json" || echo "bandit finished with non-zero exit"

echo "Running pip-audit..."
pip-audit -f json -o "$OUTDIR/pip_audit.json" || echo "pip-audit finished with non-zero exit"

echo "Running safety (optional)..."
safety check --full-report --json > "$OUTDIR/safety.json" || echo "safety finished with non-zero exit"

echo "Security scans complete. Reports written to $OUTDIR"
