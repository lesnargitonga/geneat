Load test scenarios
====================

Canonical system truth lives in [../README.md](../README.md). Keep this file
as a short scenario pointer.

Examples for running targeted load tests locally or in a CI job:

- `smoke`: 100 requests / 10 concurrency against `/` to validate basic health.
- `short-chat`: 300 requests / 20 concurrency against `/api/chat` with synthetic payloads.

Use the `scripts/load_test_sample.py` helper for quick sanity checks; for larger
tests use `k6`, `locust` or a cloud load generator.
