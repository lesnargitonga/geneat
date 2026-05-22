"""Outbound webhook delivery worker.

Subscribes to the in-process event bus (which itself fans out from the
cross-worker Redis Pub/Sub) and delivers each event to every matching
:class:`~app.db.models.WebhookEndpoint` for the relevant business.

Design constraints
------------------
* **Cross-worker dedup.** Multiple uvicorn workers receive the same Redis
  message. To avoid N×deliveries, we acquire a short-lived Redis SET-NX
  lock keyed on the event identity ``(type|target|ts|origin)`` — only the
  first worker to claim wins the dispatch.
* **HMAC-SHA256 signing.** Body is signed with the endpoint's ``secret``
  and sent as ``X-Omni-Signature: sha256=<hex>``. Receivers MUST verify.
* **Bounded retries.** 3 attempts with exponential backoff
  (0.5s → 2s → 8s). Anything still failing flips ``last_error`` /
  ``failure_count++`` and is dropped. ``failure_count >= 20`` auto-disables
  the endpoint to stop hammering dead URLs.
* **Per-endpoint concurrency limit.** A single asyncio Semaphore bounds
  total concurrent outbound POSTs across the worker so a slow receiver
  cannot starve the loop.

Wire-up: ``app.main.lifespan`` imports this module after
``app.services.event_handlers``, which registers all handlers via the
``@on_event(...)`` side-effect.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from app.core.event_bus import (
    EVT_BROADCAST_PROGRESS,
    EVT_CONVERSATION_INTERLEAVED,
    EVT_CONVERSATION_RELEASED,
    EVT_CONVERSATION_TAKEOVER,
    EVT_ESCALATION_OPENED,
    EVT_MESSAGE_CREATED,
    EVT_PAYMENT_COMPLETED,
    on_event,
)
from app.core.logging import get_logger
from app.core.redis_client import get_redis
from app.db.models import WebhookEndpoint
from app.db.session import SessionLocal

log = get_logger("webhook_dispatcher")

# Hard cap on concurrent outbound HTTP requests across this worker.
_SEM = asyncio.Semaphore(16)

# How long a dispatch lock is held in Redis. Long enough that a slow
# worker can't double-fire, short enough to expire if a worker crashes.
_DISPATCH_LOCK_TTL = 60
# Auto-disable an endpoint after this many consecutive failures.
_AUTO_DISABLE_AFTER = 20

# Events we route to outbound webhooks. EVT_VOICE_* are intentionally
# excluded — they are inter-worker control messages, not customer events.
_DISPATCHABLE = {
    EVT_PAYMENT_COMPLETED,
    EVT_ESCALATION_OPENED,
    EVT_MESSAGE_CREATED,
    EVT_CONVERSATION_TAKEOVER,
    EVT_CONVERSATION_RELEASED,
    EVT_CONVERSATION_INTERLEAVED,
    EVT_BROADCAST_PROGRESS,
}


def _sign(secret: str, body: bytes) -> str:
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


def _extract_business_id(evt: dict) -> str | None:
    """Find the tenant this event belongs to. Handlers MUST include
    ``business_id`` in ``payload`` for events to be dispatchable."""
    p = evt.get("payload") or {}
    bid = p.get("business_id")
    return str(bid) if bid else None


async def _claim_dispatch(evt: dict) -> bool:
    """SET-NX a short-lived key so only one worker delivers a given event."""
    key = (
        f"omni:webhook:dispatch:"
        f"{evt.get('type','')}:{evt.get('target','')}:"
        f"{evt.get('ts','')}:{evt.get('origin','')}"
    )
    try:
        r = await get_redis()
        # NX + EX in one round-trip. Returns True if we won the race.
        return bool(await r.set(key, "1", nx=True, ex=_DISPATCH_LOCK_TTL))
    except Exception as e:  # pragma: no cover — degrade open
        log.warning("webhook_lock_failed", error=str(e))
        return True  # If Redis is unreachable, ship rather than swallow.


async def _post_with_retries(
    endpoint: WebhookEndpoint, body: bytes, sig: str,
) -> tuple[int | None, str | None]:
    """Returns (final_http_status, last_error). One of the two is always
    populated. ``status`` is None if no response was ever received."""
    delays = [0.5, 2.0, 8.0]
    last_status: int | None = None
    last_error: str | None = None
    headers = {
        "Content-Type": "application/json",
        "X-Omni-Signature": sig,
        "X-Omni-Event-Id": uuid.uuid4().hex,
        "User-Agent": "Gen-Eat-Webhooks/1.0",
    }
    timeout = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for attempt, delay in enumerate(delays):
            try:
                resp = await client.post(endpoint.url, content=body, headers=headers)
                last_status = resp.status_code
                if 200 <= resp.status_code < 300:
                    return last_status, None
                last_error = f"http_{resp.status_code}"
                # 4xx (other than 408/429) are not retried — receiver is
                # telling us our request is permanently bad.
                if 400 <= resp.status_code < 500 and resp.status_code not in (408, 429):
                    return last_status, last_error
            except httpx.HTTPError as e:
                last_error = type(e).__name__
            if attempt < len(delays) - 1:
                await asyncio.sleep(delay)
    return last_status, last_error or "exhausted_retries"


async def _deliver_one(endpoint: WebhookEndpoint, body: bytes, sig: str) -> None:
    async with _SEM:
        status, err = await _post_with_retries(endpoint, body, sig)
    try:
        from app.api.metrics import record_webhook
        etype = json.loads(body).get("type", "")
        record_webhook(etype, "ok" if err is None else "failed")
    except Exception:
        pass
    # Reload row in a fresh session so we don't clobber other concurrent
    # updates from admin endpoints.
    async with SessionLocal() as db:
        fresh = await db.get(WebhookEndpoint, endpoint.id)
        if fresh is None:
            return
        fresh.last_delivery_at = datetime.now(timezone.utc)
        fresh.last_status = status
        if err is None:
            fresh.last_error = None
            fresh.failure_count = 0
        else:
            fresh.last_error = err[:500]
            fresh.failure_count = (fresh.failure_count or 0) + 1
            if fresh.failure_count >= _AUTO_DISABLE_AFTER:
                fresh.active = False
                log.warning(
                    "webhook_auto_disabled",
                    endpoint_id=str(fresh.id),
                    business_id=str(fresh.business_id),
                    url=fresh.url,
                    failure_count=fresh.failure_count,
                )
                try:
                    from app.api.metrics import record_webhook
                    etype = json.loads(body).get("type", "")
                    record_webhook(etype, "disabled")
                except Exception:
                    pass
        await db.commit()


async def _handle(evt: dict) -> None:
    etype = evt.get("type") or ""
    if etype not in _DISPATCHABLE:
        return
    business_id = _extract_business_id(evt)
    if not business_id:
        return
    if not await _claim_dispatch(evt):
        return  # Some other worker is delivering this event.

    # Fetch matching, active endpoints. Containment check via JSONB ``?``
    # (text key contained in JSON array). We do the filter in Python to
    # keep the query portable.
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(WebhookEndpoint).where(
                    WebhookEndpoint.business_id == uuid.UUID(business_id),
                    WebhookEndpoint.active.is_(True),
                )
            )
        ).scalars().all()

    targets = [r for r in rows if etype in (r.events or []) or "*" in (r.events or [])]
    if not targets:
        return

    body = json.dumps(
        {
            "id": uuid.uuid4().hex,
            "type": etype,
            "target": evt.get("target") or "",
            "payload": evt.get("payload") or {},
            "ts": evt.get("ts") or datetime.now(timezone.utc).isoformat(),
        },
        default=str,
        separators=(",", ":"),
    ).encode("utf-8")

    log.info(
        "webhook_dispatch",
        event=etype,
        business_id=business_id,
        endpoint_count=len(targets),
    )

    # Per-endpoint signature (each endpoint has its own secret).
    await asyncio.gather(
        *(_deliver_one(ep, body, _sign(ep.secret, body)) for ep in targets),
        return_exceptions=True,
    )


def _register() -> None:
    """Register a handler for every dispatchable event type. Import-time
    side-effect — called from app.main.lifespan."""
    for et in _DISPATCHABLE:
        on_event(et)(_handle)


_register()
