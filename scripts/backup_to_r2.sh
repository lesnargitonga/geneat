#!/usr/bin/env bash
# Wrapper for nightly DB backup → R2.
# Add to crontab:   0 2 * * *   /app/scripts/backup_to_r2.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONPATH="${PYTHONPATH:-.}"
exec python -m scripts.backup_to_r2
