from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services import ops_automation as ops


@pytest.fixture
def admin_env(monkeypatch):
    monkeypatch.setenv("ADMIN_WA_NUMBERS", "+254700000099")


@pytest.mark.asyncio
async def test_non_admin_returns_none(admin_env) -> None:
    db = AsyncMock()
    out = await ops.try_handle_ops_command(
        db,
        text="!dispatch HN-ORD-ABC123 Courier Co",
        sender="+254700000001",
        tenant_slug="hazina-nomads",
    )
    assert out is None


@pytest.mark.asyncio
async def test_dispatch_updates_order(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-TEST01"},
    )

    async def fake_find(db, ref):
        assert ref == "HN-ORD-TEST01"
        return order

    monkeypatch.setattr(ops, "find_order_by_public_reference", fake_find)

    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!dispatch hn-ord-test01 Express Messengers (KCA 123G)",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert reply is not None
    assert "OUT FOR DELIVERY" in reply
    assert order.details["fulfillment_status"] == "out_for_delivery"
    assert order.details["courier_note"] == "Express Messengers (KCA 123G)"
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_delivered_not_found(admin_env, monkeypatch) -> None:
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=None),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!delivered HN-ORD-MISSING",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert reply == "❌ Order not found: HN-ORD-MISSING"
