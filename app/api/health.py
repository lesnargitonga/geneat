from __future__ import annotations

import asyncio
import os
import time

import httpx
from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.core.circuit_breaker import snapshot_all
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.redis_client import get_redis

log = get_logger("health")
router = APIRouter(tags=["health"])


@router.get("/healthz")
async def liveness() -> dict:
    """Process-up check. Cheap; no I/O. Use for k8s liveness probes."""
    return {"status": "ok"}


async def _check_db(db: AsyncSession) -> dict:
    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=2.0)
        return {"ok": True, "latency_ms": int((time.perf_counter() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "detail": str(e)[:200]}


async def _check_redis() -> dict:
    t0 = time.perf_counter()
    try:
        r = await get_redis()
        ok = bool(await asyncio.wait_for(r.ping(), timeout=2.0))
        return {"ok": ok, "latency_ms": int((time.perf_counter() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "detail": str(e)[:200]}


async def _check_pgvector(db: AsyncSession) -> dict:
    try:
        row = (await db.execute(text(
            "SELECT extname FROM pg_extension WHERE extname = 'vector'"
        ))).fetchone()
        if row is None:
            return {"ok": False, "error": "pgvector_extension_missing"}
        cnt = (await db.execute(text("SELECT COUNT(*) FROM knowledge_base"))).scalar_one()
        return {"ok": True, "kb_rows": int(cnt)}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "detail": str(e)[:200]}


async def _check_whatsapp() -> dict:
    s = get_settings()
    phone_id = getattr(s, "meta_wa_phone_number_id", "") or os.getenv("META_WA_PHONE_NUMBER_ID", "")
    try:
        token = s.meta_wa_access_token.get_secret_value()
    except Exception:
        token = os.getenv("META_WA_ACCESS_TOKEN", "")
    if not (phone_id and token):
        return {"ok": False, "error": "not_configured"}
    url = f"https://graph.facebook.com/v20.0/{phone_id}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            resp = await c.get(url, headers={"Authorization": f"Bearer {token}"})
        return {"ok": resp.status_code == 200, "status": resp.status_code}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "detail": str(e)[:200]}


async def _check_payment_provider() -> dict:
    s = get_settings()
    if getattr(s, "payment_simulator", False):
        return {"ok": True, "provider": "simulator"}
    provider = getattr(s, "payment_provider", "daraja")
    hosts = {
        "intasend": "https://payment.intasend.com",
        "daraja": "https://sandbox.safaricom.co.ke",
        "paystack": "https://api.paystack.co",
        "stripe": "https://api.stripe.com",
    }
    url = hosts.get(provider, "https://example.com")
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            resp = await c.get(url)
        return {"ok": resp.status_code < 500, "provider": provider, "status": resp.status_code}
    except Exception as e:
        return {"ok": False, "provider": provider, "error": type(e).__name__, "detail": str(e)[:200]}


async def _check_llm_provider() -> dict:
    s = get_settings()
    provider = getattr(s, "llm_provider", "openai")
    try:
        if provider == "openai":
            key = s.openai_api_key.get_secret_value()
            model = s.openai_model
            if not (key and model):
                return {"ok": False, "provider": provider, "error": "not_configured"}
            async with httpx.AsyncClient(timeout=8.0) as c:
                resp = await c.get(
                    f"https://api.openai.com/v1/models/{model}",
                    headers={"Authorization": f"Bearer {key}"},
                )
            return {"ok": resp.status_code == 200, "provider": provider, "model": model, "status": resp.status_code}

        if provider == "groq":
            key = s.groq_api_key.get_secret_value()
            if not key:
                return {"ok": False, "provider": provider, "error": "not_configured"}
            async with httpx.AsyncClient(timeout=8.0) as c:
                resp = await c.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
            return {"ok": resp.status_code == 200, "provider": provider, "status": resp.status_code}

        if provider == "gemini":
            key = s.gemini_api_key.get_secret_value()
            if not key:
                return {"ok": False, "provider": provider, "error": "not_configured"}
            async with httpx.AsyncClient(timeout=8.0) as c:
                resp = await c.get(
                    "https://generativelanguage.googleapis.com/v1beta/models",
                    params={"key": key},
                )
            return {"ok": resp.status_code == 200, "provider": provider, "status": resp.status_code}

        if provider == "local":
            base = (s.local_llm_base_url or "").rstrip("/")
            if base.endswith("/v1"):
                base = base[:-3]
            if not base:
                return {"ok": False, "provider": provider, "error": "not_configured"}
            async with httpx.AsyncClient(timeout=5.0) as c:
                resp = await c.get(f"{base}/api/tags")
            return {"ok": resp.status_code == 200, "provider": provider, "status": resp.status_code}
    except Exception as e:
        return {"ok": False, "provider": provider, "error": type(e).__name__, "detail": str(e)[:200]}

    return {"ok": False, "provider": provider, "error": "unsupported_provider"}


@router.get("/readyz")
async def readiness(db: AsyncSession = Depends(db_session)) -> dict:
    db_res, redis_res = await asyncio.gather(_check_db(db), _check_redis())
    overall = db_res["ok"] and redis_res["ok"]
    return {
        "status": "ok" if overall else "degraded",
        "db": db_res,
        "redis": redis_res,
    }


@router.get("/health/deep")
async def deep_health(
    response: Response,
    db: AsyncSession = Depends(db_session),
) -> dict:
    """Full dependency probe (DB + Redis + pgvector + WhatsApp + PSP + breakers).
    Slower (3-10s); use for ops dashboards, not k8s probes."""
    redis_task = asyncio.create_task(_check_redis())
    wa_task = asyncio.create_task(_check_whatsapp())
    pay_task = asyncio.create_task(_check_payment_provider())
    llm_task = asyncio.create_task(_check_llm_provider())

    # AsyncSession cannot provision/execute multiple DB operations in
    # parallel. Keep the DB probes sequential and let external probes overlap.
    db_res = await _check_db(db)
    pgv_res = await _check_pgvector(db)
    redis_res, wa_res, pay_res, llm_res = await asyncio.gather(redis_task, wa_task, pay_task, llm_task)
    critical = db_res["ok"] and redis_res["ok"] and pgv_res["ok"]
    soft = wa_res["ok"] and pay_res["ok"] and llm_res["ok"]
    if not critical:
        response.status_code = 503
        status = "unhealthy"
    elif not soft:
        status = "degraded"
    else:
        status = "ok"
    return {
        "status": status,
        "checks": {
            "db": db_res,
            "redis": redis_res,
            "pgvector": pgv_res,
            "whatsapp": wa_res,
            "payments": pay_res,
            "llm": llm_res,
        },
        "breakers": snapshot_all(),
    }
