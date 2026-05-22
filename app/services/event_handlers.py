"""Default cross-worker event handlers.

This module is imported during lifespan startup *before* the Redis Pub/Sub
listener subscribes, so every ``@on_event`` registration is in place when
the first event arrives.

Today's handlers are intentionally lightweight \u2014 they log and audit. Voice
hang-up / in-call announcements will plug into ``app.channels.voice`` once
the WebSocket session manager is updated to consult an in-worker registry of
active streams.
"""
from __future__ import annotations

from app.core.event_bus import (
    EVT_CONVERSATION_INTERLEAVED,
    EVT_ESCALATION_OPENED,
    EVT_PAYMENT_COMPLETED,
    EVT_VOICE_HANGUP,
    EVT_VOICE_SAY,
    on_event,
)
from app.core.logging import get_logger

log = get_logger("event_handlers")


@on_event(EVT_PAYMENT_COMPLETED)
async def _on_payment_completed(evt: dict) -> None:
    p = evt.get("payload") or {}
    log.info(
        "event.payment_completed",
        order_id=p.get("order_id"),
        business_id=p.get("business_id"),
        amount=p.get("amount"),
        origin=evt.get("origin"),
    )
    # Future: look up an in-worker voice session for the caller and
    # publish EVT_VOICE_SAY with a confirmation line.


@on_event(EVT_VOICE_HANGUP)
async def _on_voice_hangup(evt: dict) -> None:
    target = evt.get("target") or ""
    log.info("event.voice_hangup", conversation_id=target, origin=evt.get("origin"))
    try:
        from app.channels.voice_registry import close_stream  # type: ignore
    except Exception:
        return
    try:
        await close_stream(target, reason=(evt.get("payload") or {}).get("reason", ""))
    except Exception as e:  # pragma: no cover
        log.warning("voice_hangup_handler_failed", error=str(e))


@on_event(EVT_VOICE_SAY)
async def _on_voice_say(evt: dict) -> None:
    target = evt.get("target") or ""
    p = evt.get("payload") or {}
    log.info("event.voice_say", conversation_id=target, lang=p.get("language"))
    try:
        from app.channels.voice_registry import inject_say  # type: ignore
    except Exception:
        return
    try:
        await inject_say(target, text=p.get("text", ""), language=p.get("language"))
    except Exception as e:  # pragma: no cover
        log.warning("voice_say_handler_failed", error=str(e))


@on_event(EVT_ESCALATION_OPENED)
async def _on_escalation_opened(evt: dict) -> None:
    p = evt.get("payload") or {}
    log.info(
        "event.escalation_opened",
        conversation_id=p.get("conversation_id"),
        business_id=p.get("business_id"),
    )


@on_event(EVT_CONVERSATION_INTERLEAVED)
async def _on_conversation_interleaved(evt: dict) -> None:
    p = evt.get("payload") or {}
    log.info(
        "event.conversation_interleaved",
        active=p.get("active_channel"),
        incoming=p.get("incoming_channel"),
        conversation_id=p.get("conversation_id"),
    )
