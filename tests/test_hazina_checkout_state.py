"""Hazina checkout Redis state + cart recovery single-surface tests."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.gift_automation import (
    _hazina_pending_payment_turn,
    checkout_in_progress,
    clear_hazina_checkout_state,
)
from app.services.hazina_deterministic_gate import try_hazina_deterministic_gate
from app.services.whatsapp_menus import hazina_cart_recovery_payload


@pytest.mark.asyncio
async def test_checkout_in_progress_true_when_step_set() -> None:
    conv = uuid.uuid4()
    with patch("app.services.gift_automation._get_checkout", AsyncMock(return_value={"step": "name"})):
        assert await checkout_in_progress(conv) is True


@pytest.mark.asyncio
async def test_checkout_in_progress_false_when_empty() -> None:
    conv = uuid.uuid4()
    with patch("app.services.gift_automation._get_checkout", AsyncMock(return_value=None)):
        assert await checkout_in_progress(conv) is False


def test_pending_payment_turn_reply_matches_interactive_body() -> None:
    order = MagicMock()
    order.amount = 32400
    order.details = {"payment_currency": "KES"}
    result = _hazina_pending_payment_turn(
        order,
        language="en",
        is_sw=False,
        payment=MagicMock(ok=True, currency="KES"),
    )
    payload = hazina_cart_recovery_payload(cart_total_kes=32400, language="en")
    assert result.reply.startswith(payload["body"])
    assert "STK" in result.reply
    assert result.interactive == payload


@pytest.mark.asyncio
async def test_gate_skips_cart_wall_during_checkout() -> None:
    conv = uuid.uuid4()
    customer = MagicMock()
    customer.id = uuid.uuid4()
    customer.phone_number = "+254700000001"
    customer.preferred_language = "en"

    ctx = MagicMock()
    ctx.order = MagicMock()
    ctx.order.amount = 32400
    ctx.payment_status = "pending"

    with (
        patch("app.services.hazina_deterministic_gate.checkout_in_progress", AsyncMock(return_value=True)),
        patch("app.services.hazina_deterministic_gate.load_hazina_session_context", AsyncMock(return_value=ctx)),
        patch("app.services.hazina_deterministic_gate._awaiting_payment", return_value=True),
    ):
        result = await try_hazina_deterministic_gate(
            AsyncMock(),
            text="hotel delivery",
            interactive_id=None,
            interactive_command=None,
            business_slug="hazina-nomads",
            customer=customer,
            conversation_id=conv,
            business_id=uuid.uuid4(),
            language="en",
        )
    assert result is None


@pytest.mark.asyncio
async def test_gate_clears_checkout_on_collections_navigation() -> None:
    conv = uuid.uuid4()
    customer = MagicMock()
    customer.id = uuid.uuid4()
    customer.preferred_language = "en"

    ctx = MagicMock()
    ctx.order = None

    with (
        patch("app.services.hazina_deterministic_gate.checkout_in_progress", AsyncMock(return_value=False)),
        patch("app.services.hazina_deterministic_gate.load_hazina_session_context", AsyncMock(return_value=ctx)),
        patch("app.services.hazina_deterministic_gate.clear_hazina_checkout_state", AsyncMock()) as clear_mock,
    ):
        result = await try_hazina_deterministic_gate(
            AsyncMock(),
            text="Signature Collections [lp:hazina:collections]",
            interactive_id="lp:hazina:collections",
            interactive_command="__hazina_collections__",
            business_slug="hazina-nomads",
            customer=customer,
            conversation_id=conv,
            business_id=uuid.uuid4(),
            language="en",
        )
    clear_mock.assert_awaited_once_with(conv)
    assert result is not None
    assert result.interactive is not None
