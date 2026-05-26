"""Run safe WhatsApp/mock reply regressions against local or hosted API.

The matrix is split into shared behavior contracts plus small tenant fixtures.
That keeps the important rules universal while making each business contribute
only a few real menu examples.
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
    "LIVE DEMO",
    "for live Lily Pond demos",
    "tiny proof item",
    "proof item",
    "M-Pesa STK demos",
    "during pitches",
    "if a customer asks",
    "create_order",
    "request_mpesa_payment",
    "knowledge_lookup",
    "tool_calls",
    "system took too long",
    "formatting hiccup",
    "small hiccup",
    "trouble formatting",
    "tell me again what you'd like to order",
    "finish your lecture",
)
DETERMINISTIC_MAX_LATENCY_SECONDS = 2.5


@dataclass(frozen=True)
class Scenario:
    name: str
    text: str
    must_include: tuple[str, ...] = ()
    must_not_include: tuple[str, ...] = BAD_LEAKS
    expect_image: bool | None = None
    max_latency_seconds: float = DETERMINISTIC_MAX_LATENCY_SECONDS
    notes: str = ""


@dataclass(frozen=True)
class TenantFixture:
    slug: str
    label: str
    menu_expected: tuple[str, ...]
    price_text: str
    price_expected: tuple[str, ...]
    availability_text: str
    availability_expected: tuple[str, ...]
    photo_text: str
    order_text: str
    bare_item_text: str
    order_expected: tuple[str, ...]
    confusion_text: str = ""
    confusion_expected: tuple[str, ...] = ()
    extra_scenarios: tuple[Scenario, ...] = ()
    must_not_include: tuple[str, ...] = ()


TENANT_FIXTURES: dict[str, TenantFixture] = {
    "lily-pond-cafe": TenantFixture(
        slug="lily-pond-cafe",
        label="Lily Pond Cafe",
        menu_expected=("Espresso - KES 120", "Flat White / Cappuccino / Latte - KES 220"),
        price_text="How much is the espresso?",
        price_expected=("Espresso is KES 120",),
        availability_text="Do you have croissants?",
        availability_expected=("Croissant", "KES"),
        photo_text="Got any pictures of the espresso?",
        order_text="May I have the espresso?",
        bare_item_text="The espresso",
        order_expected=("what name should I put on the Espresso order",),
        confusion_text="You mean you don't know what an espresso is or you don't sell?",
        confusion_expected=("Espresso - KES 120",),
        extra_scenarios=(
            Scenario(
                name="demo_espresso_price",
                text="How much is the demo espresso?",
                must_include=("Demo Espresso is KES 10",),
                expect_image=False,
            ),
        ),
        must_not_include=("Espresso is KES 10",),
    ),
    "library-bites": TenantFixture(
        slug="library-bites",
        label="Library Bites",
        menu_expected=("Chicken Mayo Sandwich - KES 280", "Mandazi (2) - KES 80"),
        price_text="How much is the latte?",
        price_expected=("Latte is KES 180",),
        availability_text="Do you have sandwiches?",
        availability_expected=("Sandwich", "KES"),
        photo_text="Send me a picture of the chicken mayo sandwich",
        order_text="May I have the latte?",
        bare_item_text="The latte",
        order_expected=("what name should I put on the Latte order",),
        confusion_text="You mean you don't sell the latte?",
        confusion_expected=("Latte - KES 180",),
    ),
    "pavilion-grill": TenantFixture(
        slug="pavilion-grill",
        label="Pavilion Grill",
        menu_expected=("Pavilion Classic - KES 580", "Fries - KES 180"),
        price_text="How much is the Pavilion Classic?",
        price_expected=("Pavilion Classic is KES 580",),
        availability_text="Do you have Pavilion Classic?",
        availability_expected=("Pavilion Classic", "KES 580"),
        photo_text="Can I see a picture of the Pavilion Classic?",
        order_text="May I have the Pavilion Classic?",
        bare_item_text="The Pavilion Classic",
        order_expected=("what name should I put on the Pavilion Classic order",),
        confusion_text="You mean you don't sell the Pavilion Classic?",
        confusion_expected=("Pavilion Classic - KES 580",),
    ),
    "block-a-express": TenantFixture(
        slug="block-a-express",
        label="Block A Express",
        menu_expected=("Espresso - KES 100", "Cinnamon Roll - KES 220"),
        price_text="How much is the espresso?",
        price_expected=("Espresso is KES 100",),
        availability_text="Do you have cinnamon rolls?",
        availability_expected=("Cinnamon Roll", "KES 220"),
        photo_text="Show me a pic of the cinnamon roll",
        order_text="May I have the espresso?",
        bare_item_text="The espresso",
        order_expected=("what name should I put on the Espresso order",),
        confusion_text="You mean you don't sell espresso?",
        confusion_expected=("Espresso - KES 100",),
    ),
}


def _shared_scenarios(fixture: TenantFixture) -> tuple[Scenario, ...]:
    tenant_forbidden = BAD_LEAKS + fixture.must_not_include
    order_without_article = fixture.order_text.replace("the ", "", 1).replace("The ", "", 1)
    hey_order = "Hey, " + fixture.order_text[:1].lower() + fixture.order_text[1:]
    target_item = fixture.bare_item_text.replace("The ", "").replace("the ", "").strip(" ?.!") or fixture.bare_item_text
    scenarios = [
        Scenario(
            name="full_menu_clean",
            text="I need the full menu, now!",
            must_include=("Here is the menu I have",) + fixture.menu_expected,
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="menu_photo_as_text",
            text="Lemme see a picture of your menu",
            must_include=("I do not have a clean menu-board photo yet", "Here is the menu I have")
            + fixture.menu_expected[:1],
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="full_menu_polite",
            text="Can you send me the full menu please?",
            must_include=("Here is the menu I have",) + fixture.menu_expected[:1],
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="menu_first",
            text="Lemme see the menu first",
            must_include=("Here is the menu I have",) + fixture.menu_expected[:1],
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="menu_correction",
            text="That's not the menu",
            must_include=("Here is the menu I have",) + fixture.menu_expected[:1],
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="sell_more",
            text="Thanks, what else do you sell at the cafe?",
            must_include=("Here is the menu I have",) + fixture.menu_expected[:1],
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="sell_anything_else",
            text="Do you sell anything else?",
            must_include=("Here is the menu I have",) + fixture.menu_expected[:1],
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="greeting_safe",
            text="Hey",
            must_include=("I can help with the menu",),
            must_not_include=tenant_forbidden + ("ready", "pickup", "queue", "lecture"),
            expect_image=False,
        ),
        Scenario(
            name="greeting_there_safe",
            text="Hi there",
            must_include=("I can help with the menu",),
            must_not_include=tenant_forbidden + ("ready", "pickup", "queue", "lecture"),
            expect_image=False,
        ),
        Scenario(
            name="hours_open_now",
            text="Are you open now?",
            must_include=("open",),
            must_not_include=tenant_forbidden + ("ready", "pickup", "queue"),
            expect_image=False,
        ),
        Scenario(
            name="known_price",
            text=fixture.price_text,
            must_include=fixture.price_expected,
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="known_availability",
            text=fixture.availability_text,
            must_include=fixture.availability_expected,
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="target_item_availability",
            text=f"Do you sell {target_item}?",
            must_include=fixture.confusion_expected or fixture.availability_expected,
            must_not_include=tenant_forbidden,
            expect_image=False,
        ),
        Scenario(
            name="specific_photo",
            text=fixture.photo_text,
            must_not_include=tenant_forbidden,
            expect_image=True,
            max_latency_seconds=8.0,
        ),
        Scenario(
            name="order_needs_name_not_model",
            text=fixture.order_text,
            must_include=fixture.order_expected,
            must_not_include=tenant_forbidden + ("system took too long", "formatting hiccup"),
            expect_image=False,
        ),
        Scenario(
            name="order_without_article_needs_name",
            text=order_without_article,
            must_include=fixture.order_expected,
            must_not_include=tenant_forbidden + ("system took too long", "formatting hiccup", "small hiccup"),
            expect_image=False,
        ),
        Scenario(
            name="greeting_plus_order_needs_name",
            text=hey_order,
            must_include=fixture.order_expected,
            must_not_include=tenant_forbidden + ("system took too long", "formatting hiccup", "small hiccup"),
            expect_image=False,
        ),
        Scenario(
            name="bare_item_needs_name_not_model",
            text=fixture.bare_item_text,
            must_include=fixture.order_expected,
            must_not_include=tenant_forbidden + ("system took too long", "formatting hiccup"),
            expect_image=False,
        ),
        Scenario(
            name="generic_photo_clarifies",
            text="Yes please, send a picture",
            must_include=("Which item should I send a picture of?",),
            must_not_include=tenant_forbidden,
            expect_image=False,
            max_latency_seconds=8.0,
        ),
        Scenario(
            name="paid_without_order_not_confirmed",
            text="Paid",
            must_include=("do not see an order",),
            must_not_include=tenant_forbidden + ("confirmed", "ready", "paid."),
            expect_image=False,
        ),
        Scenario(
            name="cancel_without_order_not_policy",
            text="Cancel the payment for 10 please",
            must_include=("do not see an unpaid order",),
            must_not_include=tenant_forbidden + ("DEMO FLOW", "ready", "confirmed"),
            expect_image=False,
        ),
        Scenario(
            name="pickup_without_order_not_promised",
            text="Can I skip line and pick up at 12:30?",
            must_include=("do not see a paid order",),
            must_not_include=tenant_forbidden + ("yes", "ready", "confirmed", "skip the queue"),
            expect_image=False,
        ),
        Scenario(
            name="no_stk_without_order_not_model",
            text="No stk yet",
            must_include=("do not see an unpaid order",),
            must_not_include=tenant_forbidden + ("sent a fresh STK",),
            expect_image=False,
        ),
    ]
    if fixture.confusion_text:
        scenarios.append(
            Scenario(
                name="confusion_recovery",
                text=fixture.confusion_text,
                must_include=fixture.confusion_expected,
                must_not_include=tenant_forbidden,
                expect_image=False,
            )
        )
    scenarios.extend(fixture.extra_scenarios)
    return tuple(scenarios)


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


def _print_available_tenants() -> None:
    print("Available tenants:")
    for slug, fixture in TENANT_FIXTURES.items():
        print(f"  {slug}: {fixture.label}")


def _resolve_fixtures(tenant_args: list[str] | None) -> tuple[TenantFixture, ...]:
    if not tenant_args:
        return tuple(TENANT_FIXTURES.values())
    normalized = [tenant.strip() for tenant in tenant_args if tenant.strip()]
    if not normalized or "all" in normalized:
        return tuple(TENANT_FIXTURES.values())
    unknown = [tenant for tenant in normalized if tenant not in TENANT_FIXTURES]
    if unknown:
        raise ValueError(f"unknown tenant fixture(s): {', '.join(unknown)}")
    return tuple(TENANT_FIXTURES[tenant] for tenant in normalized)


def run_matrix(*, base_url: str, fixtures: tuple[TenantFixture, ...], phone_prefix: str, timeout: float) -> int:
    return run_matrix_paced(
        base_url=base_url,
        fixtures=fixtures,
        phone_prefix=phone_prefix,
        timeout=timeout,
        delay_seconds=0.0,
    )


def run_matrix_paced(
    *,
    base_url: str,
    fixtures: tuple[TenantFixture, ...],
    phone_prefix: str,
    timeout: float,
    delay_seconds: float = 0.0,
) -> int:
    url = f"{base_url.rstrip('/')}/mock/message"
    failures: list[str] = []
    total = 0
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for tenant_index, fixture in enumerate(fixtures, start=1):
            scenarios = _shared_scenarios(fixture)
            total += len(scenarios)
            print()
            print(f"== {fixture.label} ({fixture.slug}) ==")
            for scenario_index, scenario in enumerate(scenarios, start=1):
                phone = f"{phone_prefix}{tenant_index:02d}{scenario_index:03d}"
                request = {"phone": phone, "business_slug": fixture.slug, "text": scenario.text}
                start = time.perf_counter()
                try:
                    response = client.post(url, json=request)
                    elapsed = time.perf_counter() - start
                except httpx.HTTPError as exc:
                    failures.append(f"{fixture.slug}/{scenario.name}: request failed: {exc}")
                    print(f"FAIL {scenario.name}: request failed: {exc}")
                    continue
                if response.status_code >= 400:
                    failures.append(
                        f"{fixture.slug}/{scenario.name}: HTTP {response.status_code}: {response.text[:200]}"
                    )
                    print(f"FAIL {scenario.name}: HTTP {response.status_code}")
                    continue
                try:
                    payload = response.json()
                except json.JSONDecodeError:
                    failures.append(f"{fixture.slug}/{scenario.name}: non-JSON response: {response.text[:200]}")
                    print(f"FAIL {scenario.name}: non-JSON response")
                    continue
                scenario_failures = _check_scenario(scenario, payload, elapsed)
                reply_preview = str(payload.get("reply") or "").replace("\n", " ")[:180]
                if scenario_failures:
                    failures.append(f"{fixture.slug}/{scenario.name}: {', '.join(scenario_failures)}")
                    print(f"FAIL {scenario.name} ({elapsed:.2f}s): {', '.join(scenario_failures)}")
                    print(f"  reply: {reply_preview}")
                else:
                    print(f"PASS {scenario.name} ({elapsed:.2f}s): {reply_preview}")
                if delay_seconds > 0:
                    time.sleep(delay_seconds)

    if failures:
        print()
        print(f"{len(failures)}/{total} scenarios failed")
        return 1
    print()
    print(f"{total}/{total} scenarios passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run safe WhatsApp/mock reply evals.")
    parser.add_argument("--base-url", default=LOCAL_BASE_URL)
    parser.add_argument("--live", action="store_true", help=f"use {LIVE_BASE_URL}")
    parser.add_argument(
        "--tenant",
        action="append",
        help="tenant fixture slug to run; may be passed multiple times; default is all",
    )
    parser.add_argument(
        "--business-slug",
        action="append",
        help="backward-compatible alias for --tenant",
    )
    parser.add_argument("--list-tenants", action="store_true", help="show configured tenant fixtures")
    parser.add_argument("--phone-prefix", default="+1555900")
    parser.add_argument("--timeout", type=float, default=35.0)
    args = parser.parse_args()

    if args.list_tenants:
        _print_available_tenants()
        return 0

    tenant_args = (args.tenant or []) + (args.business_slug or [])
    try:
        fixtures = _resolve_fixtures(tenant_args)
    except ValueError as exc:
        print(exc)
        _print_available_tenants()
        return 2

    base_url = LIVE_BASE_URL if args.live else args.base_url
    delay_seconds = 1.05 if args.live else 0.0
    return run_matrix_paced(
        base_url=base_url,
        fixtures=fixtures,
        phone_prefix=args.phone_prefix,
        timeout=args.timeout,
        delay_seconds=delay_seconds,
    )


if __name__ == "__main__":
    raise SystemExit(main())
