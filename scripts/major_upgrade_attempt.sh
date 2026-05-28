#!/usr/bin/env bash
# Attempt incremental upgrades for LLM/graph packages and record logs.

set -uo pipefail
LOG="logs/major_upgrade_attempt.log"
mkdir -p logs

echo "Major upgrade attempt started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > "$LOG"

# Activate virtualenv if present
if [ -f ".venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

PACKAGES=(
  "langchain"
  "langchain-core"
  "langchain-openai"
  "langchain-community"
  "langchain-text-splitters"
  "langgraph"
  "langgraph-checkpoint"
  "openai"
)

for pkg in "${PACKAGES[@]}"; do
  echo "---- Upgrading $pkg ----" | tee -a "$LOG"
  pip install -U "$pkg" >> "$LOG" 2>&1 || {
    echo "FAILED to upgrade $pkg (see $LOG)" | tee -a "$LOG"
    continue
  }
  echo "Upgraded $pkg" | tee -a "$LOG"
done

echo "=== Freeze relevant packages to requirements.upgraded.txt ===" | tee -a "$LOG"
pip freeze | grep -E "^(langchain|langgraph|openai|langchain-core|langchain-openai|langchain-community|langchain-text-splitters|langgraph-checkpoint)" > requirements.upgraded.txt || true

echo "=== pip check ===" | tee -a "$LOG"
pip check >> "$LOG" 2>&1 || echo "pip check reported issues (see $LOG)" | tee -a "$LOG"

echo "Done at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG"
