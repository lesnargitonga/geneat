from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.db.models import Order, PaymentStatus
from app.services import state_aware_greeter as greeter
from app.services.conversation_context import HazinaSessionContext
from app.services.fulfillment_status import OUT_FOR_DELIVERY, PENDING_PAYMENT


def test_returning_greeting_detector() -> None:
    assert greeter.looks_like_returning_greeting("Hi")
    assert greeter.looks_like_returning_greeting("hello again!")
    assert not greeter.looks_like_returning_greeting("order kenya edit")


def test_pending_payment_greeter_copy() -> None:
    ctx = HazinaSessionContext(
        checkout=None,
        order=MagicMock(),
        fulfillment_status=PENDING_PAYMENT,
        payment_status=PaymentStatus.pending.value,
        public_reference="HN-ORD-ABC123",
        payment_currency="KES",
    )
    reply = greeter._pending_payment_reply(ctx, is_sw=False)
    assert "Welcome back" in reply
    assert "M-Pesa" in reply
    assert "HN-ORD-ABC123" in reply


def test_out_for_delivery_greeter_copy() -> None:
    ctx = HazinaSessionContext(
        checkout=None,
        order=MagicMock(),
        fulfillment_status=OUT_FOR_DELIVERY,
        payment_status=PaymentStatus.paid.value,
        public_reference="HN-ORD-XYZ",
        payment_currency="KES",
    )
    reply = greeter._out_for_delivery_reply(ctx, is_sw=False)
    assert "en route" in reply
    assert "ETA" in reply


@pytest.mark.asyncio
async def test_try_state_aware_greeter_pending_payment(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_load(*_a, **_k):
        return HazinaSessionContext(
            checkout=None,
            order=MagicMock(),
            fulfillment_status=PENDING_PAYMENT,
            payment_status=PaymentStatus.pending.value,
            public_reference="HN-ORD-1",
            payment_currency="USD",
        )

    monkeypatch.setattr(greeter, "load_hazina_session_context", _fake_load)
    db = AsyncMock()
    result = await greeter.try_state_aware_greeter(
        db,
        text="hello",
        customer_id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
        is_sw=False,
    )
    assert result is not None
    assert "Paystack" in result.reply
