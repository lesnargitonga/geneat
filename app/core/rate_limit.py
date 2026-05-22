"""Rate limiting: inbound (slowapi) + outbound token-bucket on Redis.

Outbound bucket is used wherever we call out to WhatsApp / M-Pesa / SMS so we
never exceed provider quotas (Meta: 80 msg/s tier-2, Daraja STK: ~1/30s/MSISDN).
"""
from __future__ import annotations

import time

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.redis_client import get_redis

settings = get_settings()

# In-process limiter for inbound HTTP (per remote IP).
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rl_inbound_per_min}/minute"])


# ── Redis token-bucket for outbound ──────────────────────────────────

_LUA_BUCKET = """
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill   = tonumber(ARGV[2])      -- tokens per second
local now      = tonumber(ARGV[3])      -- ms
local cost     = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local ts     = tonumber(data[2]) or now
local delta  = math.max(0, now - ts) / 1000.0
tokens = math.min(capacity, tokens + delta * refill)

local allowed = 0
if tokens >= cost then
    tokens = tokens - cost
    allowed = 1
end
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, 60000)
return allowed
"""


async def try_consume(bucket: str, capacity: int, refill_per_sec: float, cost: int = 1) -> bool:
    """Returns True if `cost` tokens were available and consumed."""
    r = await get_redis()
    now_ms = int(time.time() * 1000)
    allowed = await r.eval(_LUA_BUCKET, 1, f"rl:{bucket}", capacity, refill_per_sec, now_ms, cost)
    return bool(allowed)


async def wa_outbound_allowed() -> bool:
    return await try_consume(
        "wa:outbound", capacity=settings.rl_wa_outbound_per_sec,
        refill_per_sec=settings.rl_wa_outbound_per_sec,
    )


async def mpesa_stk_allowed(msisdn: str) -> bool:
    """At most one STK per `rl_mpesa_stk_per_msisdn_sec` window per phone."""
    period = settings.rl_mpesa_stk_per_msisdn_sec
    return await try_consume(
        f"mpesa:stk:{msisdn}", capacity=1, refill_per_sec=1.0 / period,
    )
