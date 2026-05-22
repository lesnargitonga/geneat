"""Cross-worker event bus over Redis Pub/Sub.

Uvicorn workers are independent processes; in-memory state (active voice
WebSocket connections, LangGraph agents mid-turn, breaker registries) is
per-worker. When one worker needs to nudge another \u2014 for example, M-Pesa
confirms an order on Worker B while the caller's voice WebSocket is bound to
Worker A \u2014 it publishes a JSON event on a shared Redis channel and the
target worker reacts locally.

Topology
--------
- One global channel ``omni:events`` carries every event.
- Each worker spawns a single background listener task at startup
  (``start_event_listener``).
- Handlers are registered per event ``type`` via ``on_event(type)`` (decorator)
  or ``register_handler(type, fn)``.
- Handlers run in the listener task; **must not block** \u2014 dispatch heavy
  work to ``asyncio.create_task`` or a job queue.

Wire format (JSON on the channel)
---------------------------------
::

    {
      "type": "voice.hangup" | "voice.say" | "payment.completed" | ...,
      "target": "<routing key>",        # e.g. conversation_id or msisdn
      "payload": { ... },
      "ts": "2025-...",
      "origin": "<worker pid>"          # debug only
    }

Failure model
-------------
- Redis disconnect \u2192 listener reconnects with exponential back-off; missed
  events during the gap are lost (Pub/Sub is fire-and-forget). For
  guaranteed delivery, layer a Streams-based queue on top.
- Handler exception \u2192 logged, listener continues; one bad event must never
  kill the bus.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.core.logging import get_logger
from app.core.redis_client import get_redis

log = get_logger("event_bus")

CHANNEL = "omni:events"

Handler = Callable[[dict], Awaitable[None]]
_handlers: dict[str, list[Handler]] = {}
_listener_task: asyncio.Task | None = None
_worker_id = f"pid-{os.getpid()}"


def register_handler(event_type: str, fn: Handler) -> None:
    """Register a coroutine to be invoked on every event of ``event_type``."""
    _handlers.setdefault(event_type, []).append(fn)


def on_event(event_type: str) -> Callable[[Handler], Handler]:
    """Decorator form of :func:`register_handler`."""
    def _wrap(fn: Handler) -> Handler:
        register_handler(event_type, fn)
        return fn
    return _wrap


async def publish(event_type: str, *, target: str = "", payload: dict | None = None) -> None:
    """Fire-and-forget broadcast to all workers (including the sender)."""
    msg = {
        "type": event_type,
        "target": target,
        "payload": payload or {},
        "ts": datetime.now(timezone.utc).isoformat(),
        "origin": _worker_id,
    }
    try:
        r = await get_redis()
        await r.publish(CHANNEL, json.dumps(msg, default=str))
    except Exception as e:  # pragma: no cover
        log.warning("event_bus_publish_failed", type=event_type, error=str(e))


async def _dispatch(raw: str) -> None:
    try:
        evt = json.loads(raw)
    except Exception:
        log.warning("event_bus_bad_payload", raw=raw[:200])
        return
    etype = evt.get("type") or ""
    try:
        from app.api.metrics import record_event
        record_event(etype)
    except Exception:
        pass
    handlers = list(_handlers.get(etype, ())) + list(_handlers.get("*", ()))
    if not handlers:
        return
    for h in handlers:
        try:
            await h(evt)
        except Exception as e:
            log.exception("event_bus_handler_failed", type=etype, error=str(e))


async def _listener_loop() -> None:
    """Run forever: subscribe, dispatch, reconnect on failure."""
    backoff = 1.0
    while True:
        try:
            r = await get_redis()
            pubsub = r.pubsub(ignore_subscribe_messages=True)
            await pubsub.subscribe(CHANNEL)
            log.info("event_bus_subscribed", channel=CHANNEL, worker=_worker_id)
            backoff = 1.0
            async for msg in pubsub.listen():
                if msg.get("type") != "message":
                    continue
                data = msg.get("data")
                if isinstance(data, bytes):
                    data = data.decode("utf-8", "replace")
                await _dispatch(data or "")
        except asyncio.CancelledError:
            raise
        except Exception as e:  # pragma: no cover
            log.warning("event_bus_listener_error", error=str(e), backoff=backoff)
            await asyncio.sleep(min(backoff, 30.0))
            backoff = min(backoff * 2, 30.0)


async def start_event_listener() -> asyncio.Task:
    """Idempotent \u2014 safe to call from lifespan startup."""
    global _listener_task
    if _listener_task is None or _listener_task.done():
        _listener_task = asyncio.create_task(_listener_loop(), name="event-bus-listener")
    return _listener_task


async def stop_event_listener() -> None:
    global _listener_task
    if _listener_task and not _listener_task.done():
        _listener_task.cancel()
        try:
            await _listener_task
        except (asyncio.CancelledError, Exception):
            pass
    _listener_task = None


# ── Well-known event types ────────────────────────────────────────────
# Producers and consumers agree on these. Keep payload shapes documented.

EVT_PAYMENT_COMPLETED = "payment.completed"
"""Fired by /payments/callback when an order flips to paid.
payload: {order_id, business_id, msisdn, amount, receipt}"""

EVT_VOICE_HANGUP = "voice.hangup"
"""Hang up an active voice WebSocket bound to another worker.
target: conversation_id. payload: {reason}"""

EVT_VOICE_SAY = "voice.say"
"""Inject a synthesised line into an active voice stream on another worker.
target: conversation_id. payload: {text, language}"""

EVT_ESCALATION_OPENED = "escalation.opened"
"""Customer escalated to human. payload: {conversation_id, business_id, phone_hash}"""

EVT_CONVERSATION_INTERLEAVED = "conversation.interleaved"
"""A second channel produced input for an MSISDN already engaged on another channel.
payload: {msisdn_hash, active_channel, incoming_channel, conversation_id}"""

EVT_MESSAGE_CREATED = "message.created"
"""A new message was persisted (inbound, AI, or staff-authored).
target: conversation_id.
payload: {conversation_id, business_id, message_id, sender, preview, by?}"""

EVT_CONVERSATION_TAKEOVER = "conversation.takeover"
"""Staff took over a conversation (AI paused).
payload: {conversation_id, business_id, by_user_id, by_email}"""

EVT_CONVERSATION_RELEASED = "conversation.released"
"""Conversation handed back to the AI.
payload: {conversation_id, business_id}"""

EVT_BROADCAST_PROGRESS = "broadcast.progress"
"""Progress update on a broadcast send.
target: broadcast_id.
payload: {broadcast_id, business_id, sent, failed, total, status}"""
