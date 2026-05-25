"""Pre-demo battery for the Gen-Eat hosted stack.

Default checks are safe and do not intentionally create orders or trigger
payment requests. Use this before a public demo to catch the failures that
single-turn smoke tests miss: stale deploys, provider health drift, policy
leaks, slow deterministic paths, and DB/Redis pressure under a small burst.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from eval_whatsapp_reply_matrix import (  # noqa: E402
    BAD_LEAKS,
    LIVE_BASE_URL,
    LOCAL_BASE_URL,
    TENANT_FIXTURES,
    _norm,
    run_matrix,
)


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    detail: str = ""


def _status(result: CheckResult) -> str:
    mark = "OK " if result.ok else "BAD"
    suffix = f" - {result.detail}" if result.detail else ""
    return f"{mark} {result.name}{suffix}"


def _has_bad_leak(text: str) -> str | None:
    normalized = _norm(text)
    for forbidden in BAD_LEAKS:
        if _norm(forbidden) in normalized:
            return forbidden
    return None


async def _get_json(client: httpx.AsyncClient, url: str, *, attempts: int = 3) -> tuple[int, Any, float]:
    last_status = 0
    last_body: Any = ""
    elapsed = 0.0
    for attempt in range(attempts):
        start = time.perf_counter()
        try:
            response = await client.get(url)
            elapsed = time.perf_counter() - start
            last_status = response.status_code
            try:
                last_body = response.json()
            except json.JSONDecodeError:
                last_body = response.text[:300]
            if response.status_code < 500:
                return response.status_code, last_body, elapsed
        except httpx.HTTPError as exc:
            elapsed = time.perf_counter() - start
            last_body = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            await asyncio.sleep(1.2 * (attempt + 1))
    return last_status, last_body, elapsed


async def _post_mock(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    phone: str,
    business_slug: str,
    text: str,
) -> tuple[int, dict[str, Any], float]:
    start = time.perf_counter()
    response = await client.post(
        f"{base_url.rstrip('/')}/mock/message",
        json={"phone": phone, "business_slug": business_slug, "text": text},
    )
    elapsed = time.perf_counter() - start
    try:
        body = response.json()
    except json.JSONDecodeError:
        body = {"reply": response.text[:300]}
    return response.status_code, body, elapsed


async def health_checks(base_url: str, *, timeout: float) -> list[CheckResult]:
    results: list[CheckResult] = []
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        status, body, elapsed = await _get_json(client, f"{base_url.rstrip('/')}/healthz")
        results.append(
            CheckResult(
                "healthz",
                status == 200 and isinstance(body, dict) and body.get("status") == "ok",
                f"status={status} elapsed={elapsed:.2f}s",
            )
        )

        status, body, elapsed = await _get_json(client, f"{base_url.rstrip('/')}/readyz")
        ready_ok = status == 200 and isinstance(body, dict) and body.get("status") == "ok"
        results.append(CheckResult("readyz", ready_ok, f"status={status} elapsed={elapsed:.2f}s"))

        status, body, elapsed = await _get_json(client, f"{base_url.rstrip('/')}/health/deep", attempts=3)
        deep_ok = status == 200 and isinstance(body, dict) and body.get("status") in {"ok", "degraded"}
        results.append(CheckResult("health/deep", deep_ok, f"status={status} elapsed={elapsed:.2f}s"))
        if isinstance(body, dict):
            checks = body.get("checks") or {}
            for name in ("db", "redis", "pgvector", "whatsapp", "payments", "llm"):
                check = checks.get(name) or {}
                results.append(CheckResult(f"deep.{name}", bool(check.get("ok")), str(check)[:220]))
            payments = checks.get("payments") or {}
            if payments.get("provider") == "intasend":
                results.append(
                    CheckResult(
                        "deep.payments.live_mode",
                        payments.get("test_mode") is False,
                        f"test_mode={payments.get('test_mode')}",
                    )
                )
            llm = checks.get("llm") or {}
            results.append(
                CheckResult(
                    "deep.llm.openai_gpt5",
                    llm.get("provider") == "openai" and str(llm.get("model") or "").startswith("gpt-5"),
                    f"provider={llm.get('provider')} model={llm.get('model')}",
                )
            )
    return results


async def stateful_conversation_checks(base_url: str, *, timeout: float) -> list[CheckResult]:
    """Run multi-turn, no-money conversations per tenant.

    These are deliberately phrased so they should stay on deterministic menu
    and payment-status paths. If they invoke the LLM heavily, latency will make
    the check fail.
    """
    results: list[CheckResult] = []
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for tenant_index, fixture in enumerate(TENANT_FIXTURES.values(), start=1):
            phone = f"+1555930{tenant_index:03d}"
            turns = [
                ("menu", "I need the full menu, now!", fixture.menu_expected[:1], 2.5),
                ("photo_menu", "Lemme see a picture of your menu", ("I do not have a clean menu-board photo yet",), 2.5),
                ("price", fixture.price_text, fixture.price_expected, 2.5),
                ("availability", fixture.availability_text, fixture.availability_expected[:1], 2.5),
                ("paid_without_order", "Paid", ("do not see an order",), 2.5),
                ("no_stk_without_order", "No STK yet", ("do not see an unpaid order",), 2.5),
            ]
            for turn_index, (label, text, expected, max_seconds) in enumerate(turns, start=1):
                name = f"stateful.{fixture.slug}.{label}"
                try:
                    status, body, elapsed = await _post_mock(
                        client,
                        base_url,
                        phone=f"{phone}{turn_index}",
                        business_slug=fixture.slug,
                        text=text,
                    )
                except httpx.HTTPError as exc:
                    results.append(CheckResult(name, False, f"{type(exc).__name__}: {exc}"))
                    continue
                reply = str(body.get("reply") or "")
                leak = _has_bad_leak(reply)
                missing = [item for item in expected if _norm(item) not in _norm(reply)]
                image_url = body.get("image_url")
                ok = status < 400 and not missing and not leak and not image_url and elapsed <= max_seconds
                detail_parts = [f"status={status}", f"elapsed={elapsed:.2f}s"]
                if missing:
                    detail_parts.append(f"missing={missing}")
                if leak:
                    detail_parts.append(f"leak={leak!r}")
                if image_url:
                    detail_parts.append("unexpected_image")
                detail_parts.append(reply.replace("\n", " ")[:140])
                results.append(CheckResult(name, ok, "; ".join(detail_parts)))
    return results


async def deterministic_load_check(
    base_url: str,
    *,
    requests: int,
    concurrency: int,
    timeout: float,
    max_p95_ms: float,
) -> list[CheckResult]:
    fixtures = tuple(TENANT_FIXTURES.values())
    sem = asyncio.Semaphore(concurrency)
    samples: list[dict[str, Any]] = []

    async def one(index: int, client: httpx.AsyncClient) -> None:
        fixture = fixtures[index % len(fixtures)]
        text = fixture.price_text if index % 2 == 0 else "I need the full menu, now!"
        async with sem:
            start = time.perf_counter()
            try:
                response = await client.post(
                    f"{base_url.rstrip('/')}/mock/message",
                    json={
                        "phone": f"+1555940{index:04d}",
                        "business_slug": fixture.slug,
                        "text": text,
                    },
                )
                elapsed_ms = (time.perf_counter() - start) * 1000
                try:
                    body = response.json()
                except json.JSONDecodeError:
                    body = {"reply": response.text[:300]}
                samples.append(
                    {
                        "ok": response.status_code < 400,
                        "status": response.status_code,
                        "lat_ms": elapsed_ms,
                        "reply": str(body.get("reply") or ""),
                    }
                )
            except httpx.HTTPError as exc:
                elapsed_ms = (time.perf_counter() - start) * 1000
                samples.append({"ok": False, "status": None, "lat_ms": elapsed_ms, "reply": str(exc)})

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        await asyncio.gather(*(one(index, client) for index in range(requests)))

    status_failures = [item for item in samples if not item["ok"]]
    leaks = [item for item in samples if _has_bad_leak(item["reply"])]
    latencies = sorted(item["lat_ms"] for item in samples)
    p95 = latencies[int(len(latencies) * 0.95) - 1] if latencies else 0.0
    max_latency = max(latencies) if latencies else 0.0
    status_counts = Counter(str(item["status"] or "client_error") for item in samples)
    if status_counts.get("429"):
        status_note = "rate limited; wait for the window to reset before the public demo"
    else:
        status_note = f"statuses={dict(status_counts)}"
    return [
        CheckResult(
            "load.deterministic_burst",
            not status_failures and not leaks and p95 <= max_p95_ms,
            (
                f"requests={requests} concurrency={concurrency} "
                f"p95={p95:.0f}ms max={max_latency:.0f}ms "
                f"status_failures={len(status_failures)} leaks={len(leaks)} "
                f"{status_note}"
            ),
        )
    ]


def _print_results(title: str, results: list[CheckResult]) -> int:
    print()
    print(f"== {title} ==")
    failures = 0
    for result in results:
        print(_status(result))
        if not result.ok:
            failures += 1
    return failures


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Run the Gen-Eat pre-demo battery.")
    parser.add_argument("--base-url", default=LOCAL_BASE_URL)
    parser.add_argument("--live", action="store_true", help=f"use {LIVE_BASE_URL}")
    parser.add_argument("--timeout", type=float, default=40.0)
    parser.add_argument("--skip-matrix", action="store_true")
    parser.add_argument("--skip-stateful", action="store_true")
    parser.add_argument("--skip-load", action="store_true")
    parser.add_argument(
        "--stateful-cooldown-seconds",
        type=float,
        default=65.0,
        help="cooldown before stateful checks when the reply matrix already used most of the /mock rate window",
    )
    parser.add_argument("--load-requests", type=int, default=16)
    parser.add_argument("--load-concurrency", type=int, default=4)
    parser.add_argument("--load-max-p95-ms", type=float, default=2500.0)
    parser.add_argument(
        "--load-cooldown-seconds",
        type=float,
        default=65.0,
        help="cooldown before burst load so prior /mock checks do not trip the 60/min endpoint limit",
    )
    args = parser.parse_args()

    base_url = LIVE_BASE_URL if args.live else args.base_url
    print(f"Pre-demo battery target: {base_url}")
    print("Money movement: disabled. This battery only uses safe mock-channel checks.")

    failures = 0
    failures += _print_results("Health", await health_checks(base_url, timeout=args.timeout))

    if not args.skip_matrix:
        print()
        print("== Reply Matrix ==")
        matrix_rc = run_matrix(
            base_url=base_url,
            fixtures=tuple(TENANT_FIXTURES.values()),
            phone_prefix="+1555920",
            timeout=args.timeout,
        )
        failures += 1 if matrix_rc else 0

    if not args.skip_stateful:
        if args.stateful_cooldown_seconds > 0 and not args.skip_matrix:
            print()
            print(
                "Cooling down before stateful checks "
                f"({args.stateful_cooldown_seconds:.0f}s) to avoid self-triggering /mock rate limits..."
            )
            await asyncio.sleep(args.stateful_cooldown_seconds)
        failures += _print_results(
            "Stateful No-Money Conversations",
            await stateful_conversation_checks(base_url, timeout=args.timeout),
        )

    if not args.skip_load:
        if args.load_cooldown_seconds > 0 and (not args.skip_matrix or not args.skip_stateful):
            print()
            print(
                "Cooling down before deterministic load "
                f"({args.load_cooldown_seconds:.0f}s) to avoid self-triggering /mock rate limits..."
            )
            await asyncio.sleep(args.load_cooldown_seconds)
        failures += _print_results(
            "Deterministic Load",
            await deterministic_load_check(
                base_url,
                requests=args.load_requests,
                concurrency=args.load_concurrency,
                timeout=args.timeout,
                max_p95_ms=args.load_max_p95_ms,
            ),
        )

    print()
    if failures:
        print(f"PRE-DEMO BATTERY FAILED: {failures} failing check group(s).")
        return 1
    print("PRE-DEMO BATTERY PASSED.")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
