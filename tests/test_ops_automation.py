from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import get_settings
from app.services import ops_automation as ops


@pytest.fixture
def admin_env(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("ADMIN_WA_NUMBERS", "+254700000099")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


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
        details={"public_reference": "HN-ORD-TEST01", "fulfillment_status": "ready_for_dispatch"},
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
    assert isinstance(order.details.get("ops_audit"), list)
    assert order.details["ops_audit"][-1]["command"] == "dispatch"
    assert order.details["ops_audit"][-1]["new_status"] == "out_for_delivery"
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


@pytest.mark.asyncio
async def test_accept_updates_order(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-ACCEPT1"},
    )

    async def fake_find(db, ref):
        assert ref == "HN-ORD-ACCEPT1"
        return order

    monkeypatch.setattr(ops, "find_order_by_public_reference", fake_find)
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!accept hn-ord-accept1",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "SOURCING APPROVED" in (reply or "")
    assert order.details["fulfillment_status"] == "sourcing_approved"
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_runner_assigns_runner_details(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-RUNNER1", "fulfillment_status": "sourcing_approved"},
    )

    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!runner HN-ORD-RUNNER1 James +254700000012",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "runner assigned" in (reply or "").lower()
    assert order.details["fulfillment_status"] == "runner_assigned"
    assert order.details["runner_name"] == "James"
    assert order.details["runner_phone"] == "+254700000012"


@pytest.mark.asyncio
async def test_issue_sets_issue_pending_with_note(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-ISSUE01"},
    )
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!issue HN-ORD-ISSUE01 item_unavailable: offered alternative",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "ISSUE PENDING" in (reply or "")
    assert "Type: item_unavailable" in (reply or "")
    assert order.details["fulfillment_status"] == "issue_pending"
    assert order.details["issue_type"] == "item_unavailable"
    assert order.details["issue_status"] == "open"
    assert order.details["issue_owner"] == "+254700000099"
    assert "alternative" in order.details["issue_note"].lower()
    assert order.details["ops_audit"][-1]["command"] == "issue"
    assert order.details["ops_audit"][-1]["new_status"] == "issue_pending"


@pytest.mark.asyncio
async def test_issue_without_taxonomy_defaults_to_issue_pending(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-ISSUE02"},
    )
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!issue HN-ORD-ISSUE02 customer says they cannot be reached now",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "Type: issue_pending" in (reply or "")
    assert order.details["issue_type"] == "issue_pending"


@pytest.mark.asyncio
async def test_cancel_sets_cancelled_with_reason(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-CANCEL1"},
    )
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!cancel HN-ORD-CANCEL1 customer requested cancel",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "CANCELLED" in (reply or "")
    assert order.details["fulfillment_status"] == "cancelled"
    assert "customer requested cancel" in order.details["cancel_reason"]


@pytest.mark.asyncio
async def test_invalid_transition_delivered_without_dispatch(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-BADSTEP", "fulfillment_status": "pending_payment"},
    )
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!delivered HN-ORD-BADSTEP",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "Invalid transition" in (reply or "")
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_invalid_transition_dispatch_before_ready(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        details={"public_reference": "HN-ORD-BADSTEP2", "fulfillment_status": "quality_check"},
    )
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!dispatch HN-ORD-BADSTEP2 Any Courier",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "Invalid transition" in (reply or "")
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_order_snapshot_command(admin_env, monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid.uuid4(),
        payment_status=SimpleNamespace(value="pending"),
        details={
            "public_reference": "HN-ORD-SNAP01",
            "fulfillment_status": "quality_check",
            "delivery_location": "Villa Rosa",
            "runner_name": "James",
            "issue_type": "item_unavailable",
            "issue_status": "open",
        },
    )
    monkeypatch.setattr(
        ops,
        "find_order_by_public_reference",
        AsyncMock(return_value=order),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!order HN-ORD-SNAP01",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "HN-ORD-SNAP01" in (reply or "")
    assert "status=quality_check" in (reply or "")
    assert "runner=James" in (reply or "")


@pytest.mark.asyncio
async def test_orders_list_command(admin_env, monkeypatch) -> None:
    orders = [
        SimpleNamespace(
            id=uuid.uuid4(),
            payment_status=SimpleNamespace(value="pending"),
            details={"public_reference": "HN-ORD-LIST01", "fulfillment_status": "packing"},
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            payment_status=SimpleNamespace(value="paid"),
            details={"public_reference": "HN-ORD-LIST02", "fulfillment_status": "out_for_delivery"},
        ),
    ]
    monkeypatch.setattr(
        ops,
        "_latest_hazina_orders",
        AsyncMock(return_value=orders),
    )
    db = AsyncMock()
    reply = await ops.try_handle_ops_command(
        db,
        text="!orders",
        sender="+254700000099",
        tenant_slug="hazina-nomads",
    )
    assert "Latest Hazina orders" in (reply or "")
    assert "HN-ORD-LIST01" in (reply or "")
    assert "HN-ORD-LIST02" in (reply or "")
