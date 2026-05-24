#!/usr/bin/env python3
"""Verify Sentry SDK initialization when `SENTRY_DSN` is present.

If `SENTRY_DSN` is unset the script exits 0 (local dev is allowed to skip).
If set, we attempt to initialize the SDK and exit non-zero on failure.
"""
import os
import sys


def main() -> int:
    dsn = os.getenv("SENTRY_DSN", "")
    if not dsn:
        print("SENTRY_DSN unset; skipping verification (OK for local dev)")
        return 0
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=dsn, traces_sample_rate=0.0)
        print("OK: Sentry SDK initialized")
        return 0
    except Exception as exc:
        print(f"ERROR: Sentry init failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
