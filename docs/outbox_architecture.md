Outbox architecture
====================

Canonical system truth lives in [../README.md](../README.md). This file is a
short architecture note for the outbox implementation.

The outbox provides durable, retriable delivery for outbound webhooks and
other side-effecting operations. Key points:

- Producers (e.g. `webhook_dispatcher`) enqueue an `outbox` row per target.
- A single background runner (`app.jobs.outbox_runner`) claims pending rows,
  delivers with bounded retries, updates endpoint health metadata, and marks
  rows `sent_at` or increments `attempts` on failure.
- This isolates delivery latency from request handling and ensures retries
  survive process restarts.

See `app/services/outbox.py` (enqueue/fetch/mark helpers) and
`app/jobs/outbox_runner.py` (delivery loop + metrics updates).
