"""Outbox service: enqueue and manage durable outbound messages.

Lightweight helper used by the webhook dispatcher to persist outbound
work to Postgres so a separate runner can safely deliver without relying
on in-process memory or Redis pub/sub delivery semantics.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from sqlalchemy import select, update

from app.db.session import SessionLocal
from app.db.models import Outbox


async def enqueue(kind: str, payload: Dict[str, Any], business_id=None, scheduled_at: datetime | None = None) -> int:
    if scheduled_at is None:
        scheduled_at = datetime.now(timezone.utc)
    async with SessionLocal() as db:
        row = Outbox(
            kind=kind,
            payload=payload,
            business_id=business_id,
            scheduled_at=scheduled_at,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return int(row.id)


async def fetch_pending(limit: int = 50) -> List[Outbox]:
    """Claim a small batch of pending outbox rows for processing.

    This simple implementation selects rows that are not locked and whose
    scheduled_at <= now(), then updates their locked_until to a short TTL
    so other runners skip them.
    """
    now = datetime.now(timezone.utc)
    lock_ttl = now + timedelta(seconds=60)
    async with SessionLocal() as db:
        q = (
            select(Outbox)
            .where(Outbox.sent_at.is_(None))
            .where((Outbox.locked_until.is_(None)) | (Outbox.locked_until < now))
            .where(Outbox.scheduled_at <= now)
            .order_by(Outbox.scheduled_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        res = (await db.execute(q)).scalars().all()
        ids = [r.id for r in res]
        if ids:
            await db.execute(
                update(Outbox)
                .where(Outbox.id.in_(ids))
                .values(locked_until=lock_ttl)
            )
            await db.commit()
        return res


async def mark_sent(outbox_id: int) -> None:
    async with SessionLocal() as db:
        await db.execute(
            update(Outbox)
            .where(Outbox.id == outbox_id)
            .values(sent_at=datetime.now(timezone.utc), last_error=None, locked_until=None)
        )
        await db.commit()


async def mark_failed(outbox_id: int, error: str) -> None:
    # Use the underlying table column for atomic increment expression.
    attempts_col = Outbox.__table__.c.attempts
    async with SessionLocal() as db:
        await db.execute(
            update(Outbox)
            .where(Outbox.id == outbox_id)
            .values(last_error=error, attempts=attempts_col + 1, locked_until=None)
        )
        await db.commit()
