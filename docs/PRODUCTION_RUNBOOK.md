Production runbook (summary)
===========================

Canonical system truth lives in [../README.md](../README.md). Keep this file as
a short operator checklist.

1. Provision Postgres 16 with pgvector and Redis 7.
2. Store secrets in a secret manager; do not commit `.env`.
3. Run DB migrations: `alembic upgrade head`.
4. Boot app behind pgbouncer for connection pooling.
5. Ensure Prometheus scrapes `/metrics` and Sentry DSN is configured.
6. Run smoke checks: `./scripts/run_smoke_tests.py`.
7. After deploy, validate provider integrations and payment flows.
