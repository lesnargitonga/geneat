PgBouncer: PR summary
=====================

Canonical system truth lives in [../../README.md](../../README.md). Keep this
file as a short change summary.

This PR adds local connection pooling via `pgbouncer` and supporting
monitoring and CI checks. Summary of what changed:

- `docker-compose.yml`: adds a `pgbouncer` service for local testing.
- `deploy/pgbouncer/pgbouncer.ini`: minimal example config (transaction pool).
- `deploy/pgbouncer/pgbouncer.service`: systemd service sample for ops.
- `scripts/setup_pgbouncer.sh`: helper that creates the required userlist file.
- `scripts/check_pgbouncer.py` + `tests/test_check_pgbouncer.py`: healthcheck and CI wrapper.
- `deploy/monitoring/*`: basic Prometheus/Alertmanager/Grafana examples to start monitoring.

Notes for reviewers:

- pgbouncer in this repo is configured for local/dev trust mode. Do not
  use `userlist.txt` with secrets in the repo for production.
- Production hardening (md5/cert auth, systemd packaging, exporters)
  documented in `deploy/pgbouncer/README.md`.
