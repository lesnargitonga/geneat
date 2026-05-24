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

Outbox worker / scaling
-----------------------

For high-volume deployments decouple outbound delivery from the web workers
by running the outbox processor as one or more dedicated workers. This
prevents long HTTP delivery retries from tying up request-handling threads
and allows you to autoscale delivery independently of API capacity.

Systemd unit (example)
```
[Unit]
Description=omnichannel-ai outbox worker
After=network.target

[Service]
User=www-data
WorkingDirectory=/srv/omnichannel-ai
EnvironmentFile=/etc/omnichannel-ai/env
ExecStart=/srv/omnichannel-ai/.venv/bin/python -m app.jobs.outbox_runner
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Docker-compose worker example
```
	outbox_worker:
		image: your-registry/omni:latest
		command: ["/srv/omnichannel-ai/.venv/bin/python", "-m", "app.jobs.outbox_runner"]
		env_file: .env
		depends_on:
			- redis
			- db
		deploy:
			replicas: 2
			restart_policy:
				condition: on-failure
```

Operational notes
- Ensure `alembic upgrade head` has been applied before starting workers.
- Configure Prometheus alerts for `OutboxDeliveryFailures` and job backlog.
- Run `scripts/flush_outbox.py` for one-off delivery when re-processing is needed.
