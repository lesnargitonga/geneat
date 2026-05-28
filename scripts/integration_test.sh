#!/usr/bin/env bash
set -euo pipefail

OUTDIR="logs/integration"
mkdir -p "$OUTDIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run integration tests. Install docker and try again."
  exit 1
fi

echo "Bringing up Postgres and Redis via docker-compose..."
docker compose up -d postgres redis pgbouncer

echo "Waiting for Postgres to become ready..."
for i in $(seq 1 30); do
  docker exec "$(docker compose ps -q postgres)" pg_isready -U omni >/dev/null 2>&1 && break || sleep 2
done

echo "Waiting for Redis to become ready..."
for i in $(seq 1 30); do
  docker exec "$(docker compose ps -q redis)" redis-cli ping >/dev/null 2>&1 && break || sleep 2
done

echo "Running alembic migrations inside an ephemeral api container..."
docker compose run --rm api alembic upgrade head

export DATABASE_URL="postgresql+psycopg://omni:omni@localhost:5432/omni"
export REDIS_URL="redis://localhost:6379"
export APP_ENV="integration"

echo "Running pytest (integration)..."
pytest -q "$@"

echo "Tearing down docker-compose services..."
docker compose down

echo "Integration tests finished. Reports (if any) in $OUTDIR"
