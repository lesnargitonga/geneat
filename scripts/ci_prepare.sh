#!/usr/bin/env bash
set -euo pipefail
# CI helper: load .env if present, echo key values, and run alembic migrations.
if [ -f .env ]; then
  set -a
  . .env
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required}"
echo "CI prepare: DATABASE_URL=${DATABASE_URL}"
echo "CI prepare: OPENAI_EMBED_DIMENSIONS=${OPENAI_EMBED_DIMENSIONS:-768}"
alembic upgrade head
