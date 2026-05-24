Monitoring runbook
==================

Canonical system truth lives in [../README.md](../README.md), especially
[Observability And Operations](../README.md#17-observability-and-operations).

Quick checklist for monitoring and on-call responders:

- Ensure Prometheus scrapes `/metrics` from each app replica.
- Alert on `AppDown`, `PGBouncerDown`, and `HighJobBacklog` (see deploy/monitoring).
- Use `scripts/check_metrics.py` and `scripts/check_pgbouncer.py` for local validation.
- When an endpoint is failing frequently, rotate provider credentials and re-run smoke tests.
