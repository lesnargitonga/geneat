"""CLI: process pending outbox rows once and exit.

Useful for one-off maintenance or during CI to flush queued webhooks.
Skips if DATABASE_URL isn't configured to avoid accidental runs in CI.
"""
from __future__ import annotations

import asyncio
import os
import sys


async def _run_once():
    from app.services.outbox import fetch_pending
    from app.jobs.outbox_runner import _process_row

    rows = await fetch_pending(limit=200)
    if not rows:
        print("No pending outbox rows")
        return 0
    n = 0
    for r in rows:
        await _process_row(r)
        n += 1
    print(f"Processed {n} outbox rows")
    return n


def main():
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set; skipping flush")
        return 0
    return asyncio.run(_run_once())


if __name__ == "__main__":
    sys.exit(main() or 0)
