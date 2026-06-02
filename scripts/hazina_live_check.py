"""Safe Hazina Nomads live readiness check.

This check does not confirm checkout or trigger payment. It proves that the
target API is deployed, deep dependencies are sane, Hazina routing is active,
and the guided checkout starts one field at a time.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import time
from dataclasses import dataclass
from typing import Any

import httpx


DEFAULT_BASE_URL = "https://api.lesnarai.co.ke"
HAZINA_API_URL = "https://hazina-api.onrender.com"
HAZINA_SLUG = "hazina-nomads"

BAD_LEAKS = (
    "Lily Pond",
    "Demo Espresso",
    "KES 10",
    "croissant",
    "finish your lecture",
    "system took too long",
    "formatting hiccup",
    "small hiccup",
    "tool_calls",
    "create_order",
    "request_mpesa_payment",
)


@dataclass(frozen=True)
class Check:
    name: str
    ok: bool
    detail: str = ""


def _norm(text: str) -> str:
    return " ".join((text or "").lower().split())


def _bad_leak(text: str) -> str | None:
    normalized = _norm(text)
    for leak in BAD_LEAKS:
        if _norm(leak) in normalized:
            return leak
    return None


def _line(check: Check) -> str:
    mark = "OK " if check.ok else "BAD"
    suffix = f" - {check.detail}" if check.detail else ""
    return f"{mark} {check.name}{suffix}"


async def _get_json(client: httpx.AsyncClient, url: str) -> tuple[int, Any, float]:
    start = time.perf_counter()
    response = await client.get(url)
    elapsed = time.perf_counter() - start
    try:
        body: Any = response.json()
    except json.JSONDecodeError:
        body = response.text[:500]
    return response.status_code, body, elapsed


async def _post_mock(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    phone: str,
    text: str,
    admin_token: str | None = None,
) -> tuple[int, dict[str, Any], float]:
    start = time.perf_counter()
    headers: dict[str, str] = {}
    if admin_token:
        headers["Authorization"] = f"Bearer {admin_token}"
    response = await client.post(
        f"{base_url.rstrip('/')}/mock/message",
        headers=headers,
        json={
            "phone": phone,
            "business_slug": HAZINA_SLUG,
            "text": text,
            "language": "en",
        },
    )
    elapsed = time.perf_counter() - start
    try:
        body = response.json()
    except json.JSONDecodeError:
        body = {"reply": response.text[:500]}
    return response.status_code, body, elapsed


def _env_file_value(key: str) -> str:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return ""
    prefix = f"{key}="
    for line in env_path.read_text(errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or not stripped.startswith(prefix):
            continue
        return stripped.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _reply_ok(
    reply: str,
    *,
    must_include: tuple[str, ...],
    max_seconds: float,
    elapsed: float,
) -> tuple[bool, str]:
    missing = [item for item in must_include if _norm(item) not in _norm(reply)]
    leak = _bad_leak(reply)
    parts: list[str] = [f"elapsed={elapsed:.2f}s"]
    if missing:
        parts.append(f"missing={missing}")
    if leak:
        parts.append(f"leak={leak!r}")
    if elapsed > max_seconds:
        parts.append(f"slow>{max_seconds:.1f}s")
    preview = reply.replace("\n", " ")[:180] or "<empty>"
    parts.append(preview)
    return not missing and not leak and elapsed <= max_seconds, "; ".join(parts)


async def check_base(
    base_url: str,
    *,
    timeout: float,
    skip_deep: bool,
    admin_token: str | None,
) -> list[Check]:
    base_url = base_url.rstrip("/")
    results: list[Check] = []
    phone = f"+254799{int(time.time()) % 1000000:06d}"
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for route in ("/version", "/readyz"):
            try:
                status, body, elapsed = await _get_json(client, f"{base_url}{route}")
                ok = status == 200 and (route == "/version" or (isinstance(body, dict) and body.get("status") == "ok"))
                detail = f"status={status} elapsed={elapsed:.2f}s"
                if isinstance(body, dict):
                    detail += f" service={body.get('service') or body.get('status') or 'unknown'}"
                results.append(Check(route.lstrip("/"), ok, detail))
            except Exception as exc:
                results.append(Check(route.lstrip("/"), False, f"{type(exc).__name__}: {exc}"))

        if not skip_deep:
            try:
                status, body, elapsed = await _get_json(client, f"{base_url}/health/deep")
                checks = body.get("checks") if isinstance(body, dict) else {}
                deep_ok = status == 200 and isinstance(body, dict) and body.get("status") == "ok"
                results.append(Check("health.deep.ok", deep_ok, f"status={status} app={body.get('status') if isinstance(body, dict) else 'n/a'} elapsed={elapsed:.2f}s"))
                if isinstance(checks, dict):
                    for name in ("db", "redis", "pgvector", "whatsapp", "payments", "llm"):
                        check = checks.get(name) or {}
                        results.append(Check(f"health.deep.{name}", bool(check.get("ok")), str(check)[:220]))
            except Exception as exc:
                results.append(Check("health.deep", False, f"{type(exc).__name__}: {exc}"))

        status, body, elapsed = await _post_mock(
            client,
            base_url,
            phone=phone,
            text="What do you sell?",
            admin_token=admin_token,
        )
        reply = str(body.get("reply") or "")
        ok, detail = _reply_ok(
            reply,
            must_include=("The Kenya Edit", "The Departure Drop", "USD", "KES"),
            max_seconds=4.0,
            elapsed=elapsed,
        )
        results.append(Check("hazina.catalog_reply", status < 400 and ok, f"status={status}; {detail}"))

        status, body, elapsed = await _post_mock(
            client,
            base_url,
            phone=phone,
            text="I want to order The Kenya Edit",
            admin_token=admin_token,
        )
        reply = str(body.get("reply") or "")
        ok, detail = _reply_ok(
            reply,
            must_include=("The Kenya Edit", "what name"),
            max_seconds=4.0,
            elapsed=elapsed,
        )
        payment_started = any(term in _norm(reply) for term in ("stk", "checkout link", "enter your pin"))
        results.append(
            Check(
                "hazina.checkout_starts_without_payment",
                status < 400 and ok and not payment_started,
                f"status={status}; payment_started={payment_started}; {detail}",
            )
        )

        status, body, elapsed = await _post_mock(
            client,
            base_url,
            phone=phone,
            text="Lesnar",
            admin_token=admin_token,
        )
        reply = str(body.get("reply") or "")
        ok, detail = _reply_ok(
            reply,
            must_include=("delivery",),
            max_seconds=4.0,
            elapsed=elapsed,
        )
        results.append(Check("hazina.checkout_step_name_to_delivery", status < 400 and ok, f"status={status}; {detail}"))
    return results


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Run safe Hazina live readiness checks.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--hazina-api", action="store_true", help=f"use {HAZINA_API_URL}")
    parser.add_argument("--both", action="store_true", help="check api.lesnarai.co.ke and hazina-api")
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument("--skip-deep", action="store_true")
    parser.add_argument(
        "--admin-token",
        default=os.environ.get("HAZINA_DOCTOR_ADMIN_TOKEN")
        or os.environ.get("ADMIN_API_TOKEN")
        or _env_file_value("ADMIN_API_TOKEN"),
        help="Bearer token for production /mock/message checks. Defaults to HAZINA_DOCTOR_ADMIN_TOKEN, ADMIN_API_TOKEN, then local .env.",
    )
    args = parser.parse_args()

    targets = [args.base_url]
    if args.hazina_api:
        targets = [HAZINA_API_URL]
    if args.both:
        targets = [args.base_url, HAZINA_API_URL]

    failures = 0
    for target in targets:
        print()
        print(f"== Hazina check: {target.rstrip('/')} ==")
        checks = await check_base(
            target,
            timeout=args.timeout,
            skip_deep=args.skip_deep,
            admin_token=args.admin_token.strip() or None,
        )
        for check in checks:
            print(_line(check))
            if not check.ok:
                failures += 1

    print()
    if failures:
        print(f"HAZINA CHECK FAILED: {failures} failing check(s).")
        return 1
    print("HAZINA CHECK PASSED.")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
