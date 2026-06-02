"""Hazina human-desk escalation: issue flag + admin WhatsApp alert."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import Customer, Order
from app.services.business_service import HAZINA_NOMADS_SLUG, get_business_by_slug

log = get_logger("hazina_escalation")

DESK_REPLY_EN = (
    "For corporate commissions and high-volume sourcing, our senior concierge team "
    "handles the brief directly. I have notified the desk, and a specialist will reach "
    "out to this number shortly."
)
DESK_REPLY_SW = (
    "Kwa maagizo ya kampuni na ununuzi wa wingi, timu yetu ya concierge wakuu "
    "inashughulikia brief moja kwa moja. Nimewaarifu desk, na mtaalam atawasiliana "
    "na nambari hii hivi karibuni."
)


def hazina_desk_reply(*, is_sw: bool) -> str:
    return DESK_REPLY_SW if is_sw else DESK_REPLY_EN


async def open_hazina_desk_issue(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    reason: str,
    msisdn: str | None = None,
) -> None:
    order = await _latest_openable_order(db, customer_id=customer_id, business_id=business_id)
    if order is not None:
        details = dict(order.details or {})
        details["issue_type"] = reason[:80] or "concierge_escalation"
        details["issue_status"] = "open"
        details["issue_opened_at"] = datetime.now(timezone.utc).isoformat()
        order.details = details
        await db.flush()

    await notify_admin_wa_numbers(
        f"🛎 Hazina desk — {reason}\nCustomer: {msisdn or 'unknown'}",
    )


async def _latest_openable_order(
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
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def notify_admin_wa_numbers(text: str) -> None:
    raw = get_settings().admin_wa_numbers.strip()
    if not raw:
        log.warning("hazina_admin_alert_skipped", reason="ADMIN_WA_NUMBERS_empty")
        return
    numbers = [n.strip() for n in raw.split(",") if n.strip()]
    if not numbers:
        return
    try:
        from app.integrations import whatsapp_client

        for number in numbers:
            try:
                await whatsapp_client.send_text(number, text)
            except Exception as exc:
                log.warning("admin_wa_alert_failed", number=number[:6] + "…", error=str(exc))
    except Exception as exc:
        log.warning("admin_wa_alert_import_failed", error=str(exc))


async def hazina_business_id(db: AsyncSession) -> uuid.UUID | None:
    biz = await get_business_by_slug(db, HAZINA_NOMADS_SLUG)
    return biz.id if biz else None
