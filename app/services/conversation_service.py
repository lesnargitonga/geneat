"""Conversation lifecycle: get-or-create customer, get active conversation,
append messages, escalate to human, mark resolved.

Channel-agnostic: WhatsApp / Voice / Mock all call the same functions, ensuring
state continuity across channels (the spec's "starts on WA then calls" case).
"""
from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import (
    Channel, ConvStatus, Conversation, Customer, Message, Sender,
)

log = get_logger("conv")
settings = get_settings()


async def get_or_create_customer(
    db: AsyncSession, phone: str, name: str | None = None, language: str | None = None
) -> Customer:
    res = await db.execute(select(Customer).where(Customer.phone_number == phone))
    cust = res.scalar_one_or_none()
    if cust:
        if name and not cust.name:
            cust.name = name
        # Refresh language on every turn — the customer's register can drift
        # (greeting in English, then switches to Sheng). We want to always
        # mirror the most recent confidently-detected language.
        if language:
            cust.preferred_language = language
        await db.flush()
        return cust
    cust = Customer(phone_number=phone, name=name, preferred_language=language)
    db.add(cust)
    await db.flush()
    return cust


async def get_active_business_id(
    db: AsyncSession, customer: Customer,
) -> uuid.UUID | None:
    """Return the business_id of the customer's most recent active
    conversation (regardless of channel), or None if they have none.

    Used by the channel router to make /biz switches sticky: once a
    customer has switched to tenant X, subsequent turns without an
    explicit tenant hint default to X instead of falling back to the
    "oldest active business" global default.
    """
    res = await db.execute(
        select(Conversation.business_id)
        .where(Conversation.customer_id == customer.id)
        .where(Conversation.status == ConvStatus.active)
        .where(Conversation.business_id.is_not(None))
        .order_by(Conversation.last_activity_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


async def get_or_open_conversation(
    db: AsyncSession,
    customer: Customer,
    channel: Channel,
    business_id: uuid.UUID | None = None,
) -> Conversation:
    """Return the most recent active conversation for this (customer, business)
    pair. Without business scoping, a single tester MSISDN would glue all
    cross-tenant messages into one thread."""
    q = (
        select(Conversation)
        .where(Conversation.customer_id == customer.id)
        .where(Conversation.status == ConvStatus.active)
    )
    if business_id is not None:
        q = q.where(Conversation.business_id == business_id)
    else:
        # When no business is known (legacy / generic), only match rows that
        # also have NULL business_id so we don't accidentally re-attach to a
        # tenant-scoped thread.
        q = q.where(Conversation.business_id.is_(None))
    q = q.order_by(Conversation.last_activity_at.desc()).limit(1)

    conv = (await db.execute(q)).scalar_one_or_none()
    if conv:
        return conv
    conv = Conversation(
        customer_id=customer.id,
        business_id=business_id,
        channel=channel,
        status=ConvStatus.active,
    )
    db.add(conv)
    await db.flush()
    return conv


async def close_active_conversations(
    db: AsyncSession, customer: Customer, business_id: uuid.UUID | None = None
) -> int:
    """Mark all of this customer's active conversations as resolved. Used by
    the /biz switch slash command so the next message starts a fresh thread
    against the new tenant."""
    q = (
        update(Conversation)
        .where(Conversation.customer_id == customer.id)
        .where(Conversation.status == ConvStatus.active)
    )
    if business_id is not None:
        q = q.where(Conversation.business_id != business_id)
    q = q.values(status=ConvStatus.resolved)
    res = await db.execute(q)
    return res.rowcount or 0


async def append_message(
    db: AsyncSession,
    *,
    conversation: Conversation,
    sender: Sender,
    content: str,
    language: str | None = None,
    media_url: str | None = None,
    provider_message_id: str | None = None,
    safety_flags: list[str] | None = None,
) -> Message:
    msg = Message(
        conversation_id=conversation.id,
        sender=sender,
        content=content,
        language=language,
        media_url=media_url,
        provider_message_id=provider_message_id,
        safety_flags=safety_flags or None,
    )
    db.add(msg)
    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values(last_activity_at=func.now())
    )
    await db.flush()
    return msg


async def recent_history(
    db: AsyncSession, conversation_id: uuid.UUID, limit: int = 20
) -> Sequence[Message]:
    res = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.desc())
        .limit(limit)
    )
    return list(reversed(res.scalars().all()))


async def bump_failed_turn(db: AsyncSession, conv: Conversation) -> bool:
    """Increment failed-turn counter; return True if threshold exceeded → escalate."""
    conv.failed_turns += 1
    await db.flush()
    if conv.failed_turns >= settings.ai_max_failed_turns:
        await escalate(db, conv, reason="failed_turn_threshold")
        return True
    return False


async def reset_failed_turns(db: AsyncSession, conv: Conversation) -> None:
    if conv.failed_turns:
        conv.failed_turns = 0
        await db.flush()


async def escalate(db: AsyncSession, conv: Conversation, *, reason: str) -> None:
    conv.status = ConvStatus.human_escalated
    await db.flush()
    log.warning("conversation_escalated", conv_id=str(conv.id), reason=reason)
    # Owner alert wiring lives in channels/whatsapp.py (Phase 3) — keep this
    # function side-effect-free re: network calls for testability.


async def resolve(db: AsyncSession, conv: Conversation) -> None:
    conv.status = ConvStatus.resolved
    await db.flush()
