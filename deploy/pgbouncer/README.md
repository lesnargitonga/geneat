Pgbouncer — local development and production notes
===============================================

Canonical system truth lives in [../../README.md](../../README.md), especially
the production deployment and operations sections.

Purpose
-------

This folder contains a minimal pgbouncer configuration intended for
local development and a short set of production-facing notes. Use the
local setup to test connection pooling and to exercise pool-size tuning
before applying similar settings to hosted environments.

Files
-----

- `pgbouncer.ini` — example config used by `docker-compose` for local run
- `userlist.txt` — auth file (left empty for `auth_type = trust` in dev)
- `scripts/setup_pgbouncer.sh` — helper that writes `userlist.txt`

Local quickstart
----------------

1. Prepare the pgbouncer files (writes `deploy/pgbouncer/userlist.txt`):

```bash
bash scripts/setup_pgbouncer.sh
```

2. Start the stack with pgbouncer included:

```bash
docker-compose up -d postgres redis pgbouncer
```

3. Verify pgbouncer is accepting connections (psql is convenient):

```bash
# connect to pgbouncer admin port and run an admin command
psql -h 127.0.0.1 -p 6432 -U omni -d omni -c "SHOW POOLS;"

# or just check a simple query through the pool
psql -h 127.0.0.1 -p 6432 -U omni -d omni -c "SELECT 1;"
```

4. Useful diagnostics from the app host:

- `scripts/check_pgvector_dim.py` — verifies `knowledge_base.embedding` is
  `vector(768)` (used by CI)

Production notes and tuning
--------------------------

The `pgbouncer` configuration in this repo is intentionally conservative
for local testing (`auth_type = trust`). For production you should:

- Use `auth_type = md5` or `cert` and maintain a locked-down `userlist.txt`.
- Run pgbouncer on a dedicated host or container with resource limits.
- Tune `default_pool_size` to match your application worker concurrency
  and the Postgres `max_connections` budget. A common approach is:

  - Estimate the number of application worker processes/threads that may
    need DB connections concurrently.
  - Set `default_pool_size` so that `max_client_conn` and the DB's
    `max_connections` are not exceeded by the total pooled server
    connections from all app instances.

Example production guidance:

- `max_client_conn = 5000`  # allow many client sockets to pgbouncer
- `default_pool_size = 50`  # per-database pool size (tune down as needed)
- `pool_mode = transaction`  # safe default for web apps
- `server_reset_query = DISCARD ALL`

Healthchecks
------------

Add a simple script or probe that runs an admin command and validates
the pool is responsive. For example (psql):

```bash
psql -h 127.0.0.1 -p 6432 -U omni -d omni -c "SHOW POOLS;"
```

Or a simple programmatic check that connects to the pgbouncer port and
executes `SELECT 1;` — failure to connect or a query timeout should
raise an alert.

CI and automation
-----------------

The repository includes a CI step that runs migrations and validates the
pgvector embedding dimension (`.github/workflows/ci-alembic-pgvector.yml`).
When adding pgbouncer to CI, run migrations against the upstream Postgres
and ensure pgbouncer is configured to forward admin commands where
required (CI may prefer talking directly to the DB for migrations).

Security
--------

- Do not commit `userlist.txt` with plaintext credentials.
- Prefer external secret management for production credentials.

Where to look
-------------

- Local config: [deploy/pgbouncer/pgbouncer.ini](pgbouncer/pgbouncer.ini)
- Helper: [scripts/setup_pgbouncer.sh](../../scripts/setup_pgbouncer.sh)
- Docker entry: [docker-compose.yml](../../docker-compose.yml)
