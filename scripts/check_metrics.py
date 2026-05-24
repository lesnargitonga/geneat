#!/usr/bin/env python3
"""Simple check for the Prometheus `/metrics` endpoint.

Exits 0 when the endpoint responds 200 and returns non-empty payload.
"""
import os
import sys

import httpx


def main() -> int:
    url = os.getenv("METRICS_URL", "http://127.0.0.1:8000/metrics")
    try:
        r = httpx.get(url, timeout=5.0)
        if r.status_code != 200:
            print(f"ERROR: Metrics endpoint returned status {r.status_code}", file=sys.stderr)
            return 2
        if not r.text.strip():
            print("ERROR: Metrics endpoint returned empty body", file=sys.stderr)
            return 3
        print(f"OK: Metrics endpoint {url} reachable ({len(r.text)} bytes)")
        return 0
    except Exception as exc:
        print(f"ERROR: Metrics endpoint check failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
