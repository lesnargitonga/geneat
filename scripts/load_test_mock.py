"""Synthetic load tester for the `/mock/message` endpoint.

Usage:
  python scripts/load_test_mock.py --url http://127.0.0.1:8000/mock/message \
      --concurrency 10 --requests 100

Sends JSON POST payloads concurrently and reports latency percentiles,
response status counts, and a few sample replies. By default each request
uses a unique phone number so the test measures app throughput, not the
per-customer serialization lock. Pass --same-phone to stress that lock.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import time
from typing import Any

import httpx

DEFAULT_PAYLOAD = {
    "phone": "+254700000001",
    "text": "I want a flat white",
    "language": "en",
}


def _unique_phone(base: str, index: int) -> str:
    digits = "".join(ch for ch in base if ch.isdigit())
    if len(digits) < 6:
        return f"{base}-{index}"
    prefix = "+" if base.strip().startswith("+") else ""
    width = min(6, len(digits))
    head = digits[:-width]
    tail = int(digits[-width:])
    return f"{prefix}{head}{(tail + index) % (10 ** width):0{width}d}"


def _payload_for(base_payload: dict[str, Any], index: int, *, same_phone: bool) -> dict[str, Any]:
    payload = dict(base_payload)
    if not same_phone:
        payload["phone"] = _unique_phone(str(base_payload["phone"]), index)
    return payload


async def _one(
    client: httpx.AsyncClient,
    url: str,
    payload: dict[str, Any],
    sem: asyncio.Semaphore,
    i: int,
    *,
    timeout: float,
) -> dict[str, Any]:
    async with sem:
        t0 = time.perf_counter()
        try:
            r = await client.post(url, json=payload, timeout=timeout)
            elapsed = (time.perf_counter() - t0) * 1000.0
            try:
                body = r.json()
            except Exception:
                body = None
            return {"ok": 200 <= r.status_code < 300, "status": r.status_code, "lat_ms": elapsed, "body": body}
        except Exception as e:
            elapsed = (time.perf_counter() - t0) * 1000.0
            return {"ok": False, "status": None, "lat_ms": elapsed, "error": str(e)}


async def run(
    url: str,
    concurrency: int,
    requests: int,
    payload: dict[str, Any],
    *,
    same_phone: bool,
    timeout: float,
) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient() as client:
        tasks = [
            asyncio.create_task(
                _one(
                    client,
                    url,
                    _payload_for(payload, i, same_phone=same_phone),
                    sem,
                    i,
                    timeout=timeout,
                )
            )
            for i in range(requests)
        ]
        res = await asyncio.gather(*tasks)
    return res


def summarize(results: list[dict[str, Any]]) -> None:
    latencies = [r.get("lat_ms") for r in results if r.get("lat_ms") is not None]
    ok = sum(1 for r in results if r.get("ok"))
    total = len(results)
    statuses = {}
    for r in results:
        s = r.get("status")
        statuses[s] = statuses.get(s, 0) + 1

    print(f"Total: {total}, OK: {ok}")
    print("Status codes:")
    for s, c in sorted(statuses.items(), key=lambda item: (item[0] is None, str(item[0]))):
        label = "client_error" if s is None else str(s)
        print(f"  {label}: {c}")
    if latencies:
        print("Latency ms (p50, p90, p99, max):")
        latencies.sort()
        p50 = statistics.median(latencies)
        p90 = latencies[int(len(latencies) * 0.9) - 1]
        p99 = latencies[int(len(latencies) * 0.99) - 1] if len(latencies) >= 100 else latencies[-1]
        print(f"  p50={p50:.1f} p90={p90:.1f} p99={p99:.1f} max={max(latencies):.1f}")

    # show some sample bodies
    samples = [r.get("body") for r in results if r.get("body")]
    if samples:
        print("\nSample replies:")
        for s in samples[:5]:
            try:
                reply = s.get("reply") if isinstance(s, dict) else str(s)
            except Exception:
                reply = str(s)
            print(" - ", (reply or "<empty>")[:200])

    errors = [r.get("error") for r in results if r.get("error")]
    if errors:
        print("\nSample client errors:")
        for err in errors[:5]:
            print(" - ", str(err)[:200])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=os.environ.get("LOAD_TEST_URL", "http://127.0.0.1:8000/mock/message"))
    p.add_argument("--concurrency", type=int, default=10)
    p.add_argument("--requests", type=int, default=100)
    p.add_argument("--phone", default=DEFAULT_PAYLOAD["phone"])
    p.add_argument("--text", default=DEFAULT_PAYLOAD["text"])
    p.add_argument("--language", default=DEFAULT_PAYLOAD["language"])
    p.add_argument("--business-slug", default=None)
    p.add_argument("--same-phone", action="store_true", help="Reuse one phone number to stress per-customer serialization.")
    p.add_argument("--timeout", type=float, default=60.0)
    args = p.parse_args()

    payload = {"phone": args.phone, "text": args.text, "language": args.language}
    if args.business_slug:
        payload["business_slug"] = args.business_slug
    print(
        f"Running load test: url={args.url} concurrency={args.concurrency} "
        f"requests={args.requests} same_phone={args.same_phone}"
    )
    results = asyncio.run(
        run(
            args.url,
            args.concurrency,
            args.requests,
            payload,
            same_phone=args.same_phone,
            timeout=args.timeout,
        )
    )
    summarize(results)


if __name__ == "__main__":
    raise SystemExit(main())
