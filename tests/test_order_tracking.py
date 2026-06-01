from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.db.models import PaymentStatus
from app.services.order_tracking import (
    build_public_order_payload,
    ensure_order_tracking,
    fetch_public_order,
    public_reference_for,
    tracking_page_url,
)


def test_public_reference_format() -> None:
    oid = uuid.UUID("28491a2b-3c4d-5e6f-7890-abcdef123456")
    assert public_reference_for(oid) == "HN-ORD-28491A2B"


def test_tracking_page_url() -> None:
    url = tracking_page_url("HN-ORD-TEST", "tok123")
    assert "/orders/HN-ORD-TEST?token=tok123" in url


def test_build_payload_collection_single_line() -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        amount=32400,
        currency="KES",
        payment_status=PaymentStatus.pending,
        created_at=datetime(2026, 6, 2, 14, 32, tzinfo=timezone.utc),
        appointment_time=None,
        details={
            "public_reference": "HN-ORD-28491A2B",
            "product_id": "kenya-edit",
            "amount_usd": 249.0,
            "payment_currency": "USD",
            "fulfillment_status": "out_for_delivery",
            "delivery_location": "Villa Rosa Kempinski, Room 412",
            "delivery_window": "Today · 16:00 – 18:00 EAT",
            "courier_note": "Express Messengers (KCA 123G)",
            "items": [{"sku_or_name": "The Kenya Edit", "qty": 1, "unit_price": 32400}],
        },
    )
    payload = build_public_order_payload(order)
    assert payload["reference"] == "HN-ORD-28491A2B"
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["name"] == "The Kenya Edit"
    assert payload["lines"][0]["price_usd"] == 249.0
    assert payload["total_usd"] == 249.0
    active = [s for s in payload["timeline"] if s["status"] == "active"][0]
    assert active["label"] == "Out for Delivery"
    assert active.get("courier_note") == "Express Messengers (KCA 123G)"


@pytest.mark.asyncio
async def test_ensure_order_tracking_writes_credentials() -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={},
    )
    db = AsyncMock()
    ref, token = await ensure_order_tracking(db, order)
    assert ref.startswith("HN-ORD-")
    assert len(token) >= 16
    assert order.details["tracking_token"] == token
    assert order.details["public_reference"] == ref
    db.flush.assert_awaited()


@pytest.mark.asyncio
async def test_fetch_public_order_rejects_bad_token(monkeypatch) -> None:
    good_token = secrets.token_urlsafe(16)
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-ABC", "tracking_token": good_token},
    )

    async def fake_find(db, ref):
        return order

    monkeypatch.setattr(
        "app.services.ops_automation.find_order_by_public_reference",
        fake_find,
    )
    db = AsyncMock()

    assert await fetch_public_order(db, public_reference="HN-ORD-ABC", token=good_token) is order
    assert await fetch_public_order(db, public_reference="HN-ORD-ABC", token="wrong-token") is None
