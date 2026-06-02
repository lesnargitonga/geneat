"""Proactive customer WhatsApp when Ghost Ops moves fulfillment state."""
from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select

from app.core.logging import get_logger
from app.db.models import Customer, Order
from app.db.session import SessionLocal
from app.services.fulfillment_status import OUT_FOR_DELIVERY, READY_FOR_DISPATCH

log = get_logger("fulfillment_notify")

_CUSTOMER_MESSAGES: dict[str, tuple[str, str]] = {
    READY_FOR_DISPATCH: (
        "Your Hazina collection has passed final quality checks and is being prepared for transfer.",
        "Mkusanyiko wako wa Hazina umepita ukaguzi wa mwisho na uko tayari kwa uwasilishaji.",
    ),
    OUT_FOR_DELIVERY: (
        "Your concierge courier has secured your collection. "
        "Please have your tracking token ready for handoff.",
        "Courier wetu wa concierge ameshika mkusanyiko wako. "
        "Tafadhali kuwa na tracking token tayari kwa ukabidhiaji.",
    ),
}


def schedule_fulfillment_customer_notification(
    *,
    order_id: uuid.UUID,
    previous_status: str,
    new_status: str,
) -> None:
    import os

    if os.environ.get("APP_ENV") == "test":
        return
    if previous_status == new_status:
        return
    if new_status not in _CUSTOMER_MESSAGES:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        _send_fulfillment_notification(order_id=order_id, new_status=new_status),
        name=f"fulfillment-notify-{order_id}",
    )


async def _send_fulfillment_notification(*, order_id: uuid.UUID, new_status: str) -> None:
    messages = _CUSTOMER_MESSAGES.get(new_status)
    if not messages:
        return
    try:
        async with SessionLocal() as db:
            order = (
                await db.execute(select(Order).where(Order.id == order_id))
            ).scalar_one_or_none()
            if order is None:
                return
            cust = (
                await db.execute(select(Customer).where(Customer.id == order.customer_id))
            ).scalar_one_or_none()
            if cust is None or not cust.phone_number:
                return
            details = order.details if isinstance(order.details, dict) else {}
            if details.get(f"notified_{new_status}"):
                return
            lang = (cust.preferred_language or "en").lower()
            body = messages[1] if lang.startswith(("sw", "she")) else messages[0]
            from app.integrations import whatsapp_client

            await whatsapp_client.send_text(cust.phone_number, body)
            details = dict(details)
            details[f"notified_{new_status}"] = True
            order.details = details
            await db.commit()
            log.info(
                "fulfillment_customer_notified",
                order_id=str(order_id),
                status=new_status,
            )
    except Exception as exc:  # pragma: no cover
        log.warning(
            "fulfillment_customer_notify_failed",
            order_id=str(order_id),
            status=new_status,
            error=str(exc),
        )
