"""Cross-channel session manager.

Serializes concurrent processing for a given MSISDN across all channels so
two webhooks for the same phone don't race. Tries Redis first (fast,
distributed) and falls back to a Postgres advisory lock if Redis is down.
"""
from __future__ import annotations

import hashlib
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.redis_client import msisdn_lock

log = get_logger("session")


@asynccontextmanager
async def acquire_session(msisdn: str, db: AsyncSession) -> AsyncIterator[None]:
    """Serialize concurrent processing for one MSISDN.

    CRITICAL: this is wrapped by @asynccontextmanager — it must yield exactly
    once on any code path. If the caller's body raises after we yield, that
    exception is thrown back into us at the yield site; we must re-raise it
    rather than swallow it and yield again (which would corrupt the generator).
    """
    yielded = False
    try:
        async with msisdn_lock(msisdn, timeout=5.0) as acquired:
            if acquired:
                yielded = True
                yield
                return
            # Redis is up but couldn't get the lock within timeout — fall
            # through to PG advisory which will block until available.
            log.warning("redis_lock_timeout_using_pg", msisdn_hash=_h(msisdn))
    except Exception as e:
        if yielded:
            # Exception came from the caller's body, not from Redis.
            # Must propagate so asynccontextmanager closes cleanly.
            raise
        log.warning("redis_unavailable_using_pg_advisory_lock", error=str(e))

    # ── Postgres advisory-lock fallback ───────────────────────────────
    key = int.from_bytes(
        hashlib.blake2b(msisdn.encode(), digest_size=8).digest(),
        "big", signed=True,
    )
    await db.execute(text("SELECT pg_advisory_lock(:k)"), {"k": key})
    try:
        yield
    finally:
        await db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})


def _h(msisdn: str) -> str:
    return hashlib.sha256(msisdn.encode()).hexdigest()[:10]


# ── Channel presence (cross-channel interleaving guard) ───────────────
# When a customer is on a live voice call, an incoming WhatsApp message
# *while the AI is still speaking* would race for the same conversation.
# We track a per-MSISDN "active channel" key in Redis; channels.base
# consults it and defers or enqueues if a higher-priority channel is busy.
#
# Voice > WhatsApp > SMS. (Voice is the only synchronous channel.)
#
# Keys: presence:msisdn:{msisdn} -> "voice" | "whatsapp" | "sms"
# TTL is short and refreshed by the owning channel; if the owner crashes
# the key expires within `PRESENCE_TTL_SEC` and other channels recover.

PRESENCE_TTL_SEC = 90  # generous: covers TTS playback + ASR roundtrip
_PRIORITY = {"voice": 3, "whatsapp": 2, "sms": 1, "": 0}


def _presence_key(msisdn: str) -> str:
    # We hash the MSISDN so Redis values never carry raw PII at rest.
    return f"presence:msisdn:{hashlib.sha256(msisdn.encode()).hexdigest()[:24]}"


async def mark_channel_active(msisdn: str, channel: str, ttl: int = PRESENCE_TTL_SEC) -> None:
    """Claim or refresh the active-channel marker for an MSISDN."""
    try:
        from app.core.redis_client import get_redis
        r = await get_redis()
        await r.set(_presence_key(msisdn), channel, ex=ttl)
    except Exception as e:  # pragma: no cover
        log.warning("presence_mark_failed", error=str(e))


async def clear_channel(msisdn: str, channel: str) -> None:
    """Release the marker iff we still own it (compare-and-delete)."""
    try:
        from app.core.redis_client import get_redis
        r = await get_redis()
        await r.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
            "return redis.call('del', KEYS[1]) else return 0 end",
            1, _presence_key(msisdn), channel,
        )
    except Exception as e:  # pragma: no cover
        log.warning("presence_clear_failed", error=str(e))


async def current_active_channel(msisdn: str) -> str | None:
    """Returns the channel currently holding presence, or None."""
    try:
        from app.core.redis_client import get_redis
        r = await get_redis()
        v = await r.get(_presence_key(msisdn))
        return v or None
    except Exception:
        return None


async def should_defer(msisdn: str, incoming_channel: str) -> str | None:
    """If a higher-priority channel is active, return its name; else None.

    Caller pattern::

        active = await should_defer(msisdn, "whatsapp")
        if active:
            # send a polite "still on the call" reply and queue
            ...
    """
    active = await current_active_channel(msisdn)
    if not active or active == incoming_channel:
        return None
    if _PRIORITY.get(active, 0) > _PRIORITY.get(incoming_channel, 0):
        return active
    return None


@asynccontextmanager
async def channel_presence(msisdn: str, channel: str) -> AsyncIterator[None]:
    """Context manager: claim presence on enter, release on exit.

    Use this in the **synchronous** channel (voice) so the marker exists for
    the lifetime of the WebSocket. Async channels (WhatsApp/SMS) should not
    mark presence \u2014 their turns are too short and would create false
    interleavings.
    """
    await mark_channel_active(msisdn, channel)
    try:
        yield
    finally:
        await clear_channel(msisdn, channel)
