"""Run safe WhatsApp/mock reply regressions against local or hosted API.

The scenarios here are deliberately "no money movement" checks. They catch
customer-visible failures such as internal KB leakage, wrong menu prices,
random menu photos, and fake payment confirmations before a human finds them
in WhatsApp.
"""
from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass, field
from typing import Any

import httpx


LOCAL_BASE_URL = "http://localhost:8000"
LIVE_BASE_URL = "https://api.lesnarai.co.ke"
BAD_LEAKS = (
    "DEMO FLOW",
    "for live Lily Pond demos",
    "tiny proof item",
    "M-Pesa STK demos",
    "if a customer asks",
    "create_order",
    "request_mpesa_payment",
    "knowledge_lookup",
    "tool_calls",
    "system took too long",
    "formatting hiccup",
)


@dataclass(frozen=True)
class Scenario:
    name: str
    text: str
    must_include: tuple[str, ...] = ()
    must_not_include: tuple[str, ...] = BAD_LEAKS
    expect_image: bool | None = None
    max_latency_seconds: float = 8.0
    notes: str = ""


SAFE_SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        name="full_menu_clean",
        text="I need the full menu, now!",
        must_include=("Here is the menu I have", "Espresso - KES 120", "Flat White / Cappuccino / Latte - KES 220"),
        expect_image=False,
    ),
    Scenario(
        name="menu_photo_as_text",
        text="Lemme see a picture of your menu",
        must_include=("I do not have a clean menu-board photo yet", "Here is the menu I have"),
        expect_image=False,
    ),
    Scenario(
        name="plain_espresso_price",
        text="How much is the espresso?",
        must_include=("Espresso is KES 120",),
        must_not_include=BAD_LEAKS + ("Espresso is KES 10",),
        expect_image=False,
    ),
    Scenario(
        name="demo_espresso_price",
        text="How much is the demo espresso?",
        must_include=("Demo Espresso is KES 10",),
        expect_image=False,
    ),
    Scenario(
        name="croissant_availability",
        text="Do you have croissants?",
        must_include=("Croissant", "KES"),
        expect_image=False,
    ),
    Scenario(
        name="espresso_confusion_recovery",
        text="You mean you don't know what an espresso is or you don't sell?",
        must_include=("Espresso - KES 120",),
        expect_image=False,
    ),
    Scenario(
        name="paid_without_order_not_confirmed",
        text="Paid",
        must_include=("do not see an order",),
        must_not_include=BAD_LEAKS + ("confirmed", "ready", "paid."),
        expect_image=False,
    ),
    Scenario(
        name="no_stk_without_order_not_model",
        text="No stk yet",
        must_include=("do not see an unpaid order",),
        must_not_include=BAD_LEAKS + ("sent a fresh STK",),
        expect_image=False,
    ),
)


def _norm(text: str) -> str:
    return " ".join((text or "").lower().split())


def _check_scenario(scenario: Scenario, payload: dict[str, Any], elapsed: float) -> list[str]:
    reply = str(payload.get("reply") or "")
    reply_norm = _norm(reply)
    failures: list[str] = []
    for expected in scenario.must_include:
        if _norm(expected) not in reply_norm:
            failures.append(f"missing {expected!r}")
    for forbidden in scenario.must_not_include:
        if _norm(forbidden) in reply_norm:
            failures.append(f"leaked/forbidden {forbidden!r}")
    image_url = payload.get("image_url")
    if scenario.expect_image is False and image_url:
        failures.append(f"unexpected image_url={image_url!r}")
    if scenario.expect_image is True and not image_url:
        failures.append("expected image_url")
    if elapsed > scenario.max_latency_seconds:
        failures.append(f"slow response {elapsed:.2f}s > {scenario.max_latency_seconds:.2f}s")
    return failures


def run_matrix(*, base_url: str, business_slug: str, phone_prefix: str, timeout: float) -> int:
    url = f"{base_url.rstrip('/')}/mock/message"
    failures: list[str] = []
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for index, scenario in enumerate(SAFE_SCENARIOS, start=1):
            phone = f"{phone_prefix}{index:04d}"
            request = {"phone": phone, "business_slug": business_slug, "text": scenario.text}
            start = time.perf_counter()
            try:
                response = client.post(url, json=request)
                elapsed = time.perf_counter() - start
            except httpx.HTTPError as exc:
                failures.append(f"{scenario.name}: request failed: {exc}")
                print(f"FAIL {scenario.name}: request failed: {exc}")
                continue
            if response.status_code >= 400:
                failures.append(f"{scenario.name}: HTTP {response.status_code}: {response.text[:200]}")
                print(f"FAIL {scenario.name}: HTTP {response.status_code}")
                continue
            try:
                payload = response.json()
            except json.JSONDecodeError:
                failures.append(f"{scenario.name}: non-JSON response: {response.text[:200]}")
                print(f"FAIL {scenario.name}: non-JSON response")
                continue
            scenario_failures = _check_scenario(scenario, payload, elapsed)
            reply_preview = str(payload.get("reply") or "").replace("\n", " ")[:180]
            if scenario_failures:
                failures.append(f"{scenario.name}: {', '.join(scenario_failures)}")
                print(f"FAIL {scenario.name} ({elapsed:.2f}s): {', '.join(scenario_failures)}")
                print(f"  reply: {reply_preview}")
            else:
                print(f"PASS {scenario.name} ({elapsed:.2f}s): {reply_preview}")

    if failures:
        print()
        print(f"{len(failures)}/{len(SAFE_SCENARIOS)} scenarios failed")
        return 1
    print()
    print(f"{len(SAFE_SCENARIOS)}/{len(SAFE_SCENARIOS)} scenarios passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run safe WhatsApp/mock reply evals.")
    parser.add_argument("--base-url", default=LOCAL_BASE_URL)
    parser.add_argument("--live", action="store_true", help=f"use {LIVE_BASE_URL}")
    parser.add_argument("--business-slug", default="lily-pond-cafe")
    parser.add_argument("--phone-prefix", default="+1555900")
    parser.add_argument("--timeout", type=float, default=35.0)
    args = parser.parse_args()

    base_url = LIVE_BASE_URL if args.live else args.base_url
    return run_matrix(
        base_url=base_url,
        business_slug=args.business_slug,
        phone_prefix=args.phone_prefix,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    raise SystemExit(main())
