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
from typing import Any

import httpx
from sqlalchemy import func, select, text

from app.core.config import get_settings
from app.db.models import AdminUser, Business, KnowledgeChunk
from app.db.session import SessionLocal


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""


def _line(check: Check) -> str:
    mark = "OK " if check.ok else "BAD"
    suffix = f" - {check.detail}" if check.detail else ""
    return f"{mark} {check.name}{suffix}"


async def _http_json(url: str, *, timeout: float = 8.0) -> tuple[bool, dict[str, Any] | str]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url)
        body: dict[str, Any] | str
        try:
            body = r.json()
        except Exception:
            body = r.text[:200]
        return r.status_code < 500, body
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


async def _http_text(url: str, *, timeout: float = 8.0) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url)
        return r.status_code < 500, r.text
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


async def _post_json(url: str, payload: dict[str, Any], *, timeout: float = 45.0) -> tuple[bool, dict[str, Any] | str]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url, json=payload)
        body: dict[str, Any] | str
        try:
            body = r.json()
        except Exception:
            body = r.text[:200]
        return r.status_code < 500, body
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


async def run(*, backend: str, portal: str, admin: str, chat: bool) -> list[Check]:
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

    ready_ok, ready_body = await _http_json(f"{backend}/readyz")
    checks.append(Check("backend /readyz", ready_ok and isinstance(ready_body, dict) and ready_body.get("status") == "ok", str(ready_body)[:180]))

    deep_ok, deep_body = await _http_json(f"{backend}/health/deep", timeout=12.0)
    checks.append(Check("backend /health/deep", deep_ok and isinstance(deep_body, dict) and deep_body.get("status") in {"ok", "degraded"}, str(deep_body)[:220]))

    try:
        challenge = "lily-demo-check"
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{backend}/webhooks/whatsapp",
                params={
                    "hub.mode": "subscribe",
                    "hub.challenge": challenge,
                    "hub.verify_token": s.meta_wa_verify_token,
                },
            )
        checks.append(Check("Meta webhook verify handshake", r.status_code == 200 and r.text == challenge, f"status={r.status_code}"))
    except Exception as exc:
        checks.append(Check("Meta webhook verify handshake", False, f"{type(exc).__name__}: {exc}"))

    portal_ok, portal_text = await _http_text(f"{portal}/cafes/lily-pond-cafe")
    checks.append(Check("portal Lily Pond page", portal_ok and "Order KES 10 on WhatsApp" in portal_text, "contains live CTA"))

    admin_ok, _ = await _http_json(admin)
    checks.append(Check("admin UI reachable", admin_ok, admin))

    if chat:
        ok, body = await _post_json(
            f"{portal}/api/chat",
            {
                "phone": "+254799000010",
                "text": "How much is the demo espresso?",
                "business_slug": "lily-pond-cafe",
                "language": "en",
            },
        )
        reply = body.get("reply", "") if isinstance(body, dict) else str(body)
        checks.append(Check("non-charging chat price check", ok and "KES 10" in reply, reply[:180]))

    return checks


async def amain() -> int:
    parser = argparse.ArgumentParser(description="Check Lily Pond demo readiness.")
    parser.add_argument("--backend", default="http://127.0.0.1:8000")
    parser.add_argument("--portal", default="http://127.0.0.1:3000")
    parser.add_argument("--admin", default="http://127.0.0.1:5173")
    parser.add_argument("--chat", action="store_true", help="run a safe no-order chat price check")
    args = parser.parse_args()

    checks = await run(backend=args.backend.rstrip("/"), portal=args.portal.rstrip("/"), admin=args.admin.rstrip("/"), chat=args.chat)
    for check in checks:
        print(_line(check))
    failed = [c for c in checks if not c.ok]
    print()
    print(f"summary: {len(checks) - len(failed)}/{len(checks)} checks passed")
    if failed:
        print("failed:", ", ".join(c.name for c in failed))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(amain()))
