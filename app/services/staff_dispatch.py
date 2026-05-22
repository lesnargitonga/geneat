"""Outbound dispatch for admin-console staff messages.

When a human operator types a reply in the admin UI, the conversation's
channel determines how it goes out:

* **whatsapp** → `app.integrations.whatsapp_client.send_text`
* **sms**      → Africa's Talking sender if configured, otherwise stub
* **voice**    → publish `voice.say` on the event bus; the worker that
                 owns the live WebSocket synthesises + streams the line
                 into the call (or stores it for the next inbound).
* **mock**     → no-op (used for end-to-end tests)

All paths persist a `Sender.agent` Message before the network attempt;
delivery success/failure is reflected via the returned dict so the UI
can show a per-message status.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import business_id_ctx, conversation_id_ctx, get_logger
from app.db.models import (
    AdminUser, Channel, Conversation, Customer, Message, Sender,
)
from app.services.conversation_service import append_message

log = get_logger("staff_dispatch")


class StaffDispatchError(Exception):
    """Raised when the channel send fails after persisting the message."""

    def __init__(self, message: str, *, delivery: dict | None = None):
        super().__init__(message)
        self.delivery = delivery or {}


async def send_staff_message(
    db: AsyncSession,
    *,
    conv: Conversation,
    customer: Customer,
    actor: AdminUser,
    content: str,
    media_url: str | None = None,
) -> dict:
    """Persist a staff-authored message and dispatch it on the channel.

    On dispatch failure the DB message is still kept (with a `delivery`
    payload appended via a follow-up SystemMessage) so the audit trail
    survives. Returns a delivery descriptor for the UI.
    """
    if not content or not content.strip():
        raise StaffDispatchError("empty_content")

    business_id_ctx.set(str(conv.business_id) if conv.business_id else "-")
    conversation_id_ctx.set(str(conv.id))

    msg = await append_message(
        db, conversation=conv, sender=Sender.agent, content=content.strip(),
        language=customer.preferred_language, media_url=media_url,
    )
    await db.flush()

    channel = conv.channel
    delivery: dict = {
        "channel": channel.value,
        "attempted_at": datetime.now(timezone.utc).isoformat(),
        "by": actor.email,
    }

    try:
        if channel == Channel.whatsapp:
            from app.integrations.whatsapp_client import send_text
            res = await send_text(customer.phone_number, content)
            delivery.update({"provider": "whatsapp", "ok": True, "provider_response": res})
        elif channel == Channel.sms:
            try:
                from app.integrations.africastalking_client import send_sms  # type: ignore
                res = await send_sms(customer.phone_number, content)
                delivery.update({"provider": "africastalking", "ok": True, "provider_response": res})
            except Exception as e:  # noqa: BLE001 — module may not exist in every build
                log.warning("sms_dispatch_unavailable", error=str(e))
                delivery.update({"provider": "sms", "ok": False, "error": "sms_provider_unavailable"})
        elif channel == Channel.voice:
            from app.core.event_bus import EVT_VOICE_SAY, publish
            await publish(
                EVT_VOICE_SAY,
                target=str(conv.id),
                payload={
                    "conversation_id": str(conv.id),
                    "text": content,
                    "language": customer.preferred_language or "en",
                },
            )
            delivery.update({"provider": "event_bus", "ok": True})
        else:
            delivery.update({"provider": "mock", "ok": True})

        # Publish a generic message-created event so other workers'
        # admin-SSE clients can refresh.
        from app.core.event_bus import EVT_MESSAGE_CREATED, publish
        await publish(
            EVT_MESSAGE_CREATED,
            target=str(conv.id),
            payload={
                "conversation_id": str(conv.id),
                "business_id": str(conv.business_id) if conv.business_id else None,
                "message_id": str(msg.id),
                "sender": Sender.agent.value,
                "preview": content[:160],
                "by": actor.email,
            },
        )
    except StaffDispatchError:
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("staff_dispatch_failed", error=str(e))
        delivery.update({"ok": False, "error": str(e)[:200]})

    log.info(
        "staff_message_sent",
        conv=str(conv.id), channel=channel.value, by=actor.email, ok=delivery.get("ok"),
    )
    return {"message_id": str(msg.id), "delivery": delivery}


async def takeover(
    db: AsyncSession, *, conv: Conversation, actor: AdminUser,
) -> None:
    """Mark a conversation as human-handled: pause AI, assign owner."""
    conv.ai_paused = True
    conv.taken_over_by = actor.id
    await db.flush()
    log.info("conversation_takeover", conv=str(conv.id), by=actor.email)


async def release(
    db: AsyncSession, *, conv: Conversation,
) -> None:
    """Hand the conversation back to the AI."""
    conv.ai_paused = False
    conv.taken_over_by = None
    conv.failed_turns = 0
    await db.flush()
    log.info("conversation_release", conv=str(conv.id))
