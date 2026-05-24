"""Async Redis client singleton + helpers for locking, idempotency, rate limiting.

Provides graceful degradation for local/dev paths. In production, idempotency
claims fail closed if Redis is unreachable because provider retries and payment
side effects must not be treated as fresh work without a dedupe store.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("redis")

_client: aioredis.Redis | None = None


def _idempotency_fail_closed(error: Exception, *, key: str) -> None:
    if bool(getattr(get_settings(), "is_prod", False)):
        log.error("idempotency_redis_required", key=key, error=str(error))
        raise RuntimeError("Redis is required for idempotency in production") from error


async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(
            get_settings().redis_url, encoding="utf-8", decode_responses=True,
            health_check_interval=30,
        )
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


# ── Idempotency ───────────────────────────────────────────────────────

async def claim_idempotency(key: str, ttl_seconds: int = 86_400) -> bool:
    """Return True if this key was freshly claimed (i.e. first time we see it)."""
    try:
        r = await get_redis()
        return bool(await r.set(f"idem:{key}", "1", nx=True, ex=ttl_seconds))
    except Exception as e:  # pragma: no cover
        _idempotency_fail_closed(e, key=key)
        log.warning("idempotency_redis_unavailable", error=str(e))
        return True  # fail-open; caller should also dedupe at DB layer


# ── Result-cached idempotency (for tools that return JSON) ────────────

async def claim_with_result(
    key: str, ttl_seconds: int = 600
) -> tuple[bool, dict | None]:
    """Atomic claim that also caches the result.

    Returns (is_fresh, cached_result_if_any).
    - is_fresh=True  → caller should execute and then `store_result(key, result)`.
    - is_fresh=False → cached_result_if_any holds the previous JSON result
                       (or None if previous run hasn't stored one yet).
    """
    import json
    try:
        r = await get_redis()
        ok = await r.set(f"idem:{key}", "PENDING", nx=True, ex=ttl_seconds)
        if ok:
            return True, None
        cached = await r.get(f"idem:{key}")
        if cached and cached != "PENDING":
            try:
                return False, json.loads(cached)
            except Exception:
                return False, None
        return False, None
    except Exception as e:  # pragma: no cover
        _idempotency_fail_closed(e, key=key)
        log.warning("idempotency_redis_unavailable", error=str(e))
        return True, None


async def store_result(key: str, result: dict, ttl_seconds: int = 600) -> None:
    import json
    try:
        r = await get_redis()
        await r.set(f"idem:{key}", json.dumps(result, default=str), ex=ttl_seconds)
    except Exception as e:  # pragma: no cover
        log.warning("idempotency_store_failed", error=str(e))


# ── Distributed lock (per-MSISDN session lock) ────────────────────────

@asynccontextmanager
async def msisdn_lock(msisdn: str, timeout: float = 5.0) -> AsyncIterator[bool]:
    """Acquire a short-lived lock so two concurrent webhooks for the same number
    don't both mutate state. Yields True if acquired, False if it timed out
    (caller can then choose to queue or 429)."""
    from app.core.security import hash_msisdn
    r = await get_redis()
    key = f"lock:msisdn:{hash_msisdn(msisdn)}"
    token = str(id(asyncio.current_task()))
    acquired = False
    try:
        for _ in range(int(timeout * 20)):  # 50ms polling
            if await r.set(key, token, nx=True, ex=30):
                acquired = True
                break
            await asyncio.sleep(0.05)
        yield acquired
    finally:
        if acquired:
            # Lua compare-and-delete to avoid releasing someone else's lock
            await r.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1, key, token,
            )
