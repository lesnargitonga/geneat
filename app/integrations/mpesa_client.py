"""Safaricom Daraja API client (STK Push + OAuth token caching).

Cache strategy: tokens last 3599s; we cache in Redis with a 3500s TTL so all
workers share one. Falls back to in-process cache if Redis is down.

Base URLs:
  sandbox   → https://sandbox.safaricom.co.ke
  production → https://api.safaricom.co.ke
  tests     → MPESA_BASE_URL_OVERRIDE env var (points at the mock server)
"""
from __future__ import annotations

import base64
import os
import time
from datetime import datetime

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.core.config import get_settings
from app.core.exceptions import RateLimited, UpstreamError
from app.core.logging import get_logger
from app.core.rate_limit import mpesa_stk_allowed
from app.core.redis_client import get_redis

log = get_logger("mpesa")

_PROD_URL = "https://api.safaricom.co.ke"
_SBX_URL = "https://sandbox.safaricom.co.ke"
_TOKEN_CACHE: dict = {"value": None, "expires": 0.0}


def base_url() -> str:
    override = os.getenv("MPESA_BASE_URL_OVERRIDE")
    if override:
        return override
    return _PROD_URL if get_settings().mpesa_env == "production" else _SBX_URL


def _password_and_timestamp() -> tuple[str, str]:
    s = get_settings()
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    raw = f"{s.mpesa_shortcode}{s.mpesa_passkey.get_secret_value()}{ts}"
    return base64.b64encode(raw.encode()).decode(), ts


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.4, max=4.0))
async def get_access_token() -> str:
    now = time.time()
    # 1. Redis-shared cache
    try:
        r = await get_redis()
        cached = await r.get("mpesa:token")
        if cached:
            return cached
    except Exception:
        pass
    # 2. In-process cache
    if _TOKEN_CACHE["value"] and _TOKEN_CACHE["expires"] > now + 30:
        return _TOKEN_CACHE["value"]

    s = get_settings()
    key = s.mpesa_consumer_key.get_secret_value()
    sec = s.mpesa_consumer_secret.get_secret_value()
    if not key or not sec:
        raise UpstreamError("mpesa credentials missing")
    auth = base64.b64encode(f"{key}:{sec}".encode()).decode()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{base_url()}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {auth}"},
        )
        if r.status_code >= 400:
            raise UpstreamError(f"mpesa oauth failed: {r.status_code}")
        token = r.json()["access_token"]

    _TOKEN_CACHE.update(value=token, expires=now + 3500)
    try:
        rr = await get_redis(); await rr.set("mpesa:token", token, ex=3500)
    except Exception:
        pass
    return token


@retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.5, max=3.0))
async def stk_push(*, msisdn: str, amount: float, reference: str, description: str = "Payment") -> dict:
    """Trigger STK push. Enforces per-MSISDN rate limit (Safaricom ~1/30s)."""
    if not await mpesa_stk_allowed(msisdn):
        raise RateLimited("STK already requested in the last 30 seconds for this phone")

    token = await get_access_token()
    password, ts = _password_and_timestamp()
    s = get_settings()
    payload = {
        "BusinessShortCode": s.mpesa_shortcode,
        "Password": password,
        "Timestamp": ts,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(round(amount)),
        "PartyA": msisdn.lstrip("+"),
        "PartyB": s.mpesa_shortcode,
        "PhoneNumber": msisdn.lstrip("+"),
        "CallBackURL": s.mpesa_callback_url,
        "AccountReference": reference[:12],
        "TransactionDesc": description[:13] or "Payment",
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{base_url()}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            log.error("stk_push_failed", status=r.status_code, body=r.text[:500])
            raise UpstreamError(f"stk push failed: {r.status_code}")
        data = r.json()
        if data.get("ResponseCode") != "0":
            raise UpstreamError(f"stk push rejected: {data.get('errorMessage') or data}")
        log.info("stk_push_ok", checkout_id=data.get("CheckoutRequestID"))
        return data
