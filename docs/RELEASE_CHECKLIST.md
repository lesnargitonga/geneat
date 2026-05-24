Release checklist
-----------------

Canonical system truth lives in [../README.md](../README.md). Keep this file as
a short release pointer.

- Bump app version and update changelog.
- Run `alembic upgrade head` in a staging environment and run smoke tests.
- Rotate provider keys if required by the release.
- Verify Prometheus alerts and dashboards reflect new metrics.
- Tag the release and create a changelog entry.
