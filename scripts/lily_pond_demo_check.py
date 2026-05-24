"""Readiness check for the Lily Pond live demo.

This script prints booleans and safe operational facts only. It does not print
tokens, passwords, webhook secrets, checkout references, or raw customer data.

Default checks are non-charging. Add ``--chat`` to send a safe price question
through the local portal/backend path; it should not create an order or trigger
STK.
"""
from __future__ import annotations

import argparse
import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any

import httpx
from sqlalchemy import func, select, text

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.config import get_settings
from app.db.models import AdminUser, Business, KnowledgeChunk
from app.db.session import SessionLocal


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""


def _color(text: str, code: str) -> str:
    if not os.getenv("NO_COLOR") and os.getenv("TERM") != "dumb":
        return f"\033[{code}m{text}\033[0m"
    return text


def _line(check: Check) -> str:
    mark = _color("OK ", "32") if check.ok else _color("BAD", "31")
    suffix = f" - {check.detail}" if check.detail else ""
    return f"{mark} {check.name}{suffix}"


async def _http_json(
    url: str,
    *,
    timeout: float = 8.0,
    attempts: int = 1,
    backoff: float = 1.5,
) -> tuple[bool, dict[str, Any] | str]:
    last: dict[str, Any] | str = ""
    for attempt in range(max(1, attempts)):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.get(url)
            try:
                body: dict[str, Any] | str = r.json()
            except Exception:
                body = r.text[:200]
            if r.status_code < 500:
                return True, body
            last = f"HTTP {r.status_code}: {str(body)[:180]}"
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            await asyncio.sleep(backoff * (attempt + 1))
    return False, last


async def _http_text(
    url: str,
    *,
    timeout: float = 8.0,
    attempts: int = 1,
    backoff: float = 1.5,
) -> tuple[bool, str]:
    last = ""
    for attempt in range(max(1, attempts)):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.get(url)
            if r.status_code < 500:
                return True, r.text
            last = f"HTTP {r.status_code}: {r.text[:180]}"
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            await asyncio.sleep(backoff * (attempt + 1))
    return False, last


async def _post_json(
    url: str,
    payload: dict[str, Any],
    *,
    timeout: float = 45.0,
    attempts: int = 1,
    backoff: float = 1.5,
) -> tuple[bool, dict[str, Any] | str]:
    last: dict[str, Any] | str = ""
    for attempt in range(max(1, attempts)):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(url, json=payload)
            try:
                body: dict[str, Any] | str = r.json()
            except Exception:
                body = r.text[:200]
            if r.status_code < 500:
                return True, body
            last = f"HTTP {r.status_code}: {str(body)[:180]}"
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            await asyncio.sleep(backoff * (attempt + 1))
    return False, last


async def run(
    *,
    backend: str,
    portal: str,
    admin: str,
    chat: bool,
    photo: bool,
    include_db: bool,
) -> list[Check]:
    s = get_settings()
    expected_phone = os.getenv("LILY_POND_CONTACT_PHONE", "+15556578220")
    checks: list[Check] = [
        Check("default business slug", s.default_business_slug == "lily-pond-cafe", s.default_business_slug),
        Check("LLM provider", s.llm_provider == "openai", s.llm_provider),
        Check("OpenAI key configured", bool(s.openai_api_key.get_secret_value().strip())),
        Check("OpenAI chat model", bool(s.openai_model), s.openai_model),
        Check(
            "OpenAI Responses tool storage",
            (not s.openai_use_responses_api) or s.openai_store_responses,
            f"use_responses={s.openai_use_responses_api}; store={s.openai_store_responses}",
        ),
        Check("embedding provider", s.embed_provider == "openai", s.embed_provider),
        Check("OpenAI embedding dimensions", int(s.openai_embed_dimensions) == 768, str(s.openai_embed_dimensions)),
        Check("WhatsApp provider", s.whatsapp_provider == "meta", s.whatsapp_provider),
        Check("Meta phone number id configured", bool(s.meta_wa_phone_number_id)),
        Check("payment provider configured", bool(s.payment_provider), f"{s.payment_provider}; simulator={s.payment_simulator}"),
    ]
    if s.payment_provider == "intasend" and not s.payment_simulator:
        checks.append(Check("IntaSend live mode", not s.intasend_test_mode, f"test_mode={s.intasend_test_mode}"))

    if include_db:
        try:
            async with SessionLocal() as db:
                version = (await db.execute(text("SELECT version_num FROM alembic_version"))).scalar_one_or_none()
                embedding_type = (await db.execute(text(
                    """
                    SELECT format_type(a.atttypid, a.atttypmod)
                    FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    WHERE c.relname = 'knowledge_base'
                      AND a.attname = 'embedding'
                    """
                ))).scalar_one_or_none()
                biz = (await db.execute(select(Business).where(Business.slug == "lily-pond-cafe"))).scalar_one_or_none()
                admin_users = (await db.execute(
                    select(func.count(AdminUser.id)).where(
                        AdminUser.active.is_(True),
                        AdminUser.is_superadmin.is_(True),
                    )
                )).scalar_one()

                checks.append(Check("Alembic head recorded", version == "0010_enforce_embedding_768", str(version)))
                checks.append(Check("KB embedding dimension", embedding_type == "vector(768)", str(embedding_type)))
                checks.append(Check("active superadmin exists", int(admin_users) >= 1, str(admin_users)))

                if biz is None:
                    checks.append(Check("Lily Pond tenant exists", False))
                else:
                    demo_chunks = (await db.execute(
                        select(func.count(KnowledgeChunk.id)).where(
                            KnowledgeChunk.business_id == biz.id,
                            KnowledgeChunk.content.ilike("%Demo Espresso%"),
                        )
                    )).scalar_one()
                    checks.extend([
                        Check("Lily Pond tenant exists", True, str(biz.id)),
                        Check("Lily Pond active", bool(biz.active)),
                        Check("Lily Pond live phone", biz.contact_phone == expected_phone, biz.contact_phone or ""),
                        Check("Meta phone id mapped to Lily Pond", bool(biz.meta_wa_phone_number_id)),
                        Check("Demo Espresso KB chunks", int(demo_chunks) >= 1, str(demo_chunks)),
                    ])
        except Exception as exc:
            checks.append(
                Check(
                    "direct database checks",
                    False,
                    f"{type(exc).__name__}: {exc}",
                )
            )
    else:
        checks.append(
            Check(
                "direct database checks",
                True,
                "skipped in live mode; covered by hosted health/chat/photo checks",
            )
        )

    ready_ok, ready_body = await _http_json(f"{backend}/readyz", timeout=12.0, attempts=3)
    checks.append(Check("backend /readyz", ready_ok and isinstance(ready_body, dict) and ready_body.get("status") == "ok", str(ready_body)[:180]))

    deep_ok, deep_body = await _http_json(f"{backend}/health/deep", timeout=20.0, attempts=3)
    checks.append(Check("backend /health/deep", deep_ok and isinstance(deep_body, dict) and deep_body.get("status") in {"ok", "degraded"}, str(deep_body)[:220]))
    if isinstance(deep_body, dict):
        deep_checks = deep_body.get("checks") or {}
        llm_body = (deep_checks.get("llm") or {})
        payments_body = (deep_checks.get("payments") or {})
        breakers = deep_body.get("breakers") or []
        openai_breaker = next((b for b in breakers if isinstance(b, dict) and b.get("name") == "llm:openai"), None)
        if payments_body.get("provider") == "intasend" and "test_mode" in payments_body:
            checks.append(
                Check(
                    "hosted IntaSend live mode",
                    payments_body.get("test_mode") is False,
                    f"test_mode={payments_body.get('test_mode')}",
                )
            )
        checks.append(
            Check(
                "LLM provider health",
                bool(llm_body.get("ok")),
                str(llm_body)[:180],
            )
        )
        checks.append(
            Check(
                "OpenAI breaker closed",
                not openai_breaker or openai_breaker.get("state") == "closed",
                str(openai_breaker or {"state": "unknown"})[:180],
            )
        )

    try:
        challenge = "lily-demo-check"
        status = 0
        text = ""
        error = ""
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    r = await client.get(
                        f"{backend}/webhooks/whatsapp",
                        params={
                            "hub.mode": "subscribe",
                            "hub.challenge": challenge,
                            "hub.verify_token": s.meta_wa_verify_token,
                        },
                    )
                status = r.status_code
                text = r.text
                error = ""
            except Exception as exc:
                status = 0
                text = ""
                error = f"{type(exc).__name__}: {exc}"
            if status and status < 500:
                break
            await asyncio.sleep(1.5 * (attempt + 1))
        detail = f"status={status}" if not error else error
        checks.append(Check("Meta webhook verify handshake", status == 200 and text == challenge, detail))
    except Exception as exc:
        checks.append(Check("Meta webhook verify handshake", False, f"{type(exc).__name__}: {exc}"))

    portal_ok, portal_text = await _http_text(f"{portal}/cafes/lily-pond-cafe", attempts=2)
    checks.append(Check("portal Lily Pond page", portal_ok and "Order KES 10 on WhatsApp" in portal_text, "contains live CTA"))

    if admin:
        admin_ok, _ = await _http_json(admin, attempts=2)
        checks.append(Check("admin UI reachable", admin_ok, admin))
    else:
        checks.append(Check("admin UI reachable", True, "skipped (GENEAT_ADMIN_URL not set)"))

    if chat:
        ok, body = await _post_json(
            f"{portal}/api/chat",
            {
                "phone": "+254799000010",
                "text": "How much is the demo espresso?",
                "business_slug": "lily-pond-cafe",
                "language": "en",
            },
            attempts=2,
        )
        reply = body.get("reply", "") if isinstance(body, dict) else str(body)
        checks.append(Check("non-charging chat price check", ok and "KES 10" in reply, reply[:180]))

    if photo:
        ok, body = await _post_json(
            f"{portal}/api/chat",
            {
                "phone": "+254799000011",
                "text": "show me a photo of the flat white",
                "business_slug": "lily-pond-cafe",
                "language": "en",
            },
            attempts=2,
        )
        image_url = body.get("image_url") if isinstance(body, dict) else None
        photo_item = body.get("photo_item") if isinstance(body, dict) else None
        checks.append(
            Check(
                "photo request returns image",
                ok and bool(image_url),
                f"item={photo_item or '-'} image={'yes' if image_url else 'no'}",
            )
        )

    return checks


async def amain() -> int:
    parser = argparse.ArgumentParser(description="Check Lily Pond demo readiness.")
    parser.add_argument("--backend", default="http://127.0.0.1:8000")
    parser.add_argument("--portal", default="http://127.0.0.1:3000")
    parser.add_argument("--admin", default="http://127.0.0.1:5173")
    parser.add_argument("--live", action="store_true", help="use hosted production-like URLs")
    parser.add_argument("--chat", action="store_true", help="run a safe no-order chat price check")
    parser.add_argument("--photo", action="store_true", help="run a safe photo-request chat check")
    args = parser.parse_args()

    if args.live:
        args.backend = "https://api.lesnarai.co.ke"
        args.portal = "https://geneat.lesnarai.co.ke"
        args.admin = os.getenv("GENEAT_ADMIN_URL", "").strip()

    checks = await run(
        backend=args.backend.rstrip("/"),
        portal=args.portal.rstrip("/"),
        admin=args.admin.rstrip("/"),
        chat=args.chat,
        photo=args.photo,
        include_db=not args.live,
    )
    for check in checks:
        print(_line(check))
    failed = [c for c in checks if not c.ok]
    print()
    summary = f"summary: {len(checks) - len(failed)}/{len(checks)} checks passed"
    print(_color(summary, "32" if not failed else "33"))
    if failed:
        print(_color("failed:", "31"), ", ".join(c.name for c in failed))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(amain()))
