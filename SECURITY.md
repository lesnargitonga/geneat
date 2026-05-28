SECURITY
========

Overview
--------

This document records the results of a live-run security audit performed from this workspace (2026-05-24) and lists short-term mitigations and recommended hardening steps.

Live-run findings (quick summary)
--------------------------------
- DB pool exhaustion under synthetic load: `QueuePool limit of size 10 overflow 20 reached` caused many 5xx responses.
- Redis locking degraded to PG advisory locks (`redis_lock_timeout_using_pg`) increasing DB contention.
- LLM calls experienced long latencies (examples ~14s), increasing connection hold time and amplifying DB pressure.
- Outbound delivery uses the `outbox` table; migrations were validated and runner present.

Immediate mitigations (apply before next load test)
-------------------------------------------------
1. Increase SQLAlchemy DB pool size and overflow in production (eg `db_pool_size=50`, `db_max_overflow=100`) and tune connection timeouts.
2. Restore/verify Redis availability and low latency so the app uses Redis locks instead of heavy PG advisory locks.
3. Reduce client concurrency / ramp slowly while validating DB pool usage.
4. Ensure secrets and provider credentials are set in production (see app/core/config.py production checks).
5. Use monitoring/alerts for `omni_http_requests_total` 5xx growth, `omni_db_pool_checked_out`, and `omni_llm_invoke_duration_seconds`.

Next technical steps (recommended)
--------------------------------
- Add an automated security scan to CI: run `bandit`, `pip-audit`, and a secrets detector on every push.
- Add a `scripts/security_audit.sh` that runs `bandit -r app`, `pip-audit`, and `gitleaks`/`detect-secrets` locally.
- Configure `pre-commit` with secret-detection hooks to prevent accidental commits of credentials.
- Store production secrets in a managed vault (HashiCorp Vault, AWS Secrets Manager, or similar); do not commit `.env` with production secrets.
- Add runtime guardrails: reject startup in `prod` when critical secrets are missing (implemented in `app/core/config.py`).
- Harden network boundaries: require TLS for all external services and restrict Postgres/Redis to private networks.

Operational checklist
---------------------
1. Rotate any keys used in testing where they may have been exposed.
2. Confirm billing/usage for LLM providers after a test run.
3. Run `scripts/security_audit.sh` and attach the outputs to your incident ticket.

Files changed / created for this audit
-------------------------------------
- `app/core/config.py`: production secret checks added
- `README.md`: linked to this SECURITY.md

If you want, I can: (a) add the `scripts/security_audit.sh` now, (b) run `bandit`/`pip-audit` and save results, or (c) add a pre-commit config. Tell me which you prefer.
