from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.ai.tools import build_tools
from app.catalog.hazina_catalog import (
    HAZINA_COLLECTIONS,
    HAZINA_TREASURES,
    build_hazina_kb_catalog,
    build_hazina_menu_photos,
)
from app.core.config import get_settings
from app.db.models import Order, PaymentStatus


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_request_mpesa_payment_usd_returns_redirect_url(db, fake_redis, monkeypatch):
    monkeypatch.setenv("PAYMENT_SIMULATOR", "true")
    get_settings.cache_clear()

    tools = {t.name: t for t in build_tools(db, None, None, msisdn="+254711111111")}
    pay_tool = tools["request_mpesa_payment"]
    result = await pay_tool.ainvoke({
        "amount_kes": 11500,
        "order_reference": "abcd1234",
        "msisdn": "+254711111111",
        "currency": "USD",
        "amount_usd": 89.0,
    })

    assert result["ok"] is True
    assert result["provider"] == "simulator"
    assert result["payment_currency"] == "USD"
    assert result["amount_usd"] == 89.0
    assert result["redirect_url"]


@pytest.mark.asyncio
async def test_create_order_sets_usd_details(db, fake_redis, monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()

    conv_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    conv = SimpleNamespace(id=conv_id, customer_id=customer_id, business_id=None)

    async def fake_execute(_stmt):
        result = MagicMock()
        result.scalar_one.return_value = conv
        result.scalar_one_or_none.return_value = None
        result.scalars.return_value.all.return_value = []
        return result

    db.execute = AsyncMock(side_effect=fake_execute)

    order = Order(
        customer_id=customer_id,
        conversation_id=conv_id,
        amount=11500,
        payment_status=PaymentStatus.pending,
        details={"items": [], "fulfillment_status": "pending_payment"},
    )

    async def fake_create_pending_order(*args, **kwargs):
        return order, True

    monkeypatch.setattr("app.ai.tools.create_pending_order", fake_create_pending_order)
    monkeypatch.setattr("app.core.rate_limit.try_consume", AsyncMock(return_value=True))

    tools = {t.name: t for t in build_tools(db, conv_id, None)}
    order_tool = tools["create_order"]
    result = await order_tool.ainvoke({
        "items": [{"sku_or_name": "The Kenya Edit", "qty": 1, "unit_price": 11500}],
        "delivery_location": "Hemingways Karen room 412",
        "payment_currency": "USD",
        "amount_usd": 89.0,
    })

    assert result["ok"] is True
    assert result.get("payment_currency") == "USD"
    assert result.get("amount_usd") == 89.0
    assert order.details["payment_currency"] == "USD"
    assert order.details["amount_usd"] == 89.0


def test_build_hazina_menu_photos_maps_collections_and_treasures() -> None:
    photos = build_hazina_menu_photos("https://hazina.example.com")
    assert photos["kenya-edit"].startswith("https://hazina.example.com/treasures/")
    assert photos["maasai-bracelet"].startswith("https://hazina.example.com/treasures/")
    assert photos["raw-honey"].endswith("/treasures/raw-honey-jars.webp")
    assert photos["african-woven-mat"].endswith("/treasures/african-woven-mats.webp")
    assert photos["leather-luggage-tag"].endswith("/treasures/leather-luggage-tag-lifestyle.webp")
    assert photos["maasai-necklace"].endswith("/treasures/maasai-necklace-worn.webp")
    assert photos["the kenya edit"].startswith("https://hazina.example.com/")
    assert "hn-t-010" in photos


def test_build_hazina_kb_catalog_includes_every_treasure() -> None:
    chunks = build_hazina_kb_catalog()
    treasure_chunks = [c for c in chunks if c.startswith("TREASURE:")]
    assert len(treasure_chunks) == len(HAZINA_TREASURES)
    for row in HAZINA_COLLECTIONS:
        assert any(row["sku"] in c and row["name"].upper() in c for c in chunks)
    for row in HAZINA_TREASURES:
        assert any(row["sku"] in c and row["name"] in c for c in treasure_chunks)
