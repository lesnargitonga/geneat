"""Load Hazina customer session context before LLM / RAG (Redis + orders)."""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Order, PaymentStatus
from app.services.fulfillment_status import (
    CANCELLED,
    DELIVERED,
    PENDING_PAYMENT,
    normalize_fulfillment_status,
)

_CHECKOUT_KEY = "gift_checkout:{conv_id}"


@dataclass(frozen=True)
class HazinaSessionContext:
    checkout: dict[str, Any] | None
    order: Order | None
    fulfillment_status: str | None
    payment_status: str | None
    public_reference: str | None
    payment_currency: str


async def load_redis_checkout(conversation_id: uuid.UUID) -> dict[str, Any] | None:
    try:
        from app.core.redis_client import get_redis

        raw = await (await get_redis()).get(_CHECKOUT_KEY.format(conv_id=str(conversation_id)))
        if not raw:
            return None
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


async def load_hazina_session_context(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    conversation_id: uuid.UUID,
) -> HazinaSessionContext:
    checkout = await load_redis_checkout(conversation_id)
    order = await _latest_active_hazina_order(
        db,
        customer_id=customer_id,
        business_id=business_id,
    )
    if order is None:
        return HazinaSessionContext(
            checkout=checkout,
            order=None,
            fulfillment_status=None,
            payment_status=None,
            public_reference=None,
            payment_currency="KES",
        )
    details = order.details if isinstance(order.details, dict) else {}
    return HazinaSessionContext(
        checkout=checkout,
        order=order,
        fulfillment_status=normalize_fulfillment_status(details.get("fulfillment_status")),
        payment_status=order.payment_status.value,
        public_reference=str(details.get("public_reference") or "").strip() or None,
        payment_currency=str(details.get("payment_currency") or "KES").upper(),
    )


async def _latest_active_hazina_order(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
) -> Order | None:
    stmt = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .where(Order.business_id == business_id if business_id is not None else Order.business_id.is_(None))
        .order_by(Order.created_at.desc())
        .limit(12)
    )
    orders = (await db.execute(stmt)).scalars().all()
    for order in orders:
        if _order_is_active_for_greeter(order):
            return order
    return None


def _order_is_active_for_greeter(order: Order) -> bool:
    if order.payment_status == PaymentStatus.pending:
        return True
    if order.payment_status != PaymentStatus.paid:
        return False
    details = order.details if isinstance(order.details, dict) else {}
    status = normalize_fulfillment_status(details.get("fulfillment_status"))
    return status not in {DELIVERED, CANCELLED}
