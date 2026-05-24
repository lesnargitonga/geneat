"""Durable order-ready follow-up scheduling."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.jobs.runner import enqueue_job

log = get_logger("jobs.order_ready")


async def schedule_ready_notification(
    db: AsyncSession,
    *,
    business_id: uuid.UUID | None,
    business_name: str,
    items_summary: str,
    delay_seconds: float,
    order_id: str,
) -> None:
    """Persist a ready-for-pickup WhatsApp follow-up.

    The job stores the order id and display text only. The customer phone is
    resolved at delivery time from the order/customer rows, so the job payload
    does not duplicate raw MSISDNs.
    """
    run_at = datetime.now(timezone.utc) + timedelta(seconds=max(0.0, float(delay_seconds)))
    await enqueue_job(
        db,
        kind="order.ready",
        business_id=business_id,
        run_at=run_at,
        max_attempts=5,
        ttl_seconds=max(60 * 60, int(delay_seconds) + 60 * 60),
        payload={
            "order_id": order_id,
            "business_name": business_name,
            "items_summary": items_summary,
        },
    )
    log.info("ready_notify_enqueued", order=order_id, delay_s=int(delay_seconds))
