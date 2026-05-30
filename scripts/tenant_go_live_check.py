"""Per-tenant go-live readiness check for onboarding a new cafe.

Run this before pointing a real client's WhatsApp number at the bot. It prints
booleans and safe operational facts only (no tokens, secrets, or customer data).

Usage:
    python scripts/tenant_go_live_check.py --slug pavilion-grill
    python scripts/tenant_go_live_check.py --slug pavilion-grill --chat --live

Default checks are non-charging. ``--chat`` sends a safe menu/price question
through the portal/backend path; it must not create an order or trigger STK.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import func, select

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.config import get_settings
from app.db.models import Business, KnowledgeChunk
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


async def _post_json(url: str, payload: dict[str, Any], *, timeout: float = 45.0) -> tuple[bool, dict[str, Any] | str]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url, json=payload)
        try:
            body: dict[str, Any] | str = r.json()
        except Exception:
            body = r.text[:200]
        return (r.status_code < 500), body
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


async def _http_json(url: str, *, timeout: float = 12.0) -> tuple[bool, dict[str, Any] | str]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url)
        try:
            body: dict[str, Any] | str = r.json()
        except Exception:
            body = r.text[:200]
        return (r.status_code < 500), body
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


async def run(*, slug: str, backend: str, portal: str, chat: bool, include_db: bool) -> list[Check]:
    s = get_settings()
    checks: list[Check] = [
        Check("WhatsApp provider is meta", s.whatsapp_provider == "meta", s.whatsapp_provider),
        Check("Meta phone number id configured", bool(s.meta_wa_phone_number_id)),
        Check(
            "payment provider configured",
            bool(s.payment_provider),
            f"{s.payment_provider}; simulator={s.payment_simulator}",
        ),
    ]
    if s.payment_provider == "intasend" and not s.payment_simulator:
        checks.append(Check("IntaSend live mode (not test)", not s.intasend_test_mode, f"test_mode={s.intasend_test_mode}"))

    if include_db:
        try:
            async with SessionLocal() as db:
                biz = (await db.execute(select(Business).where(Business.slug == slug))).scalar_one_or_none()
                if biz is None:
                    checks.append(Check(f"tenant '{slug}' exists", False, "no business row with this slug"))
                else:
                    menu_chunks = (await db.execute(
                        select(func.count(KnowledgeChunk.id)).where(KnowledgeChunk.business_id == biz.id)
                    )).scalar_one()
                    priced_chunks = (await db.execute(
                        select(func.count(KnowledgeChunk.id)).where(
                            KnowledgeChunk.business_id == biz.id,
                            KnowledgeChunk.content.ilike("%KES%"),
                        )
                    )).scalar_one()
                    checks.extend([
                        Check(f"tenant '{slug}' exists", True, str(biz.id)),
                        Check("tenant active", bool(biz.active)),
                        Check("Meta phone id mapped to tenant", bool(biz.meta_wa_phone_number_id), biz.meta_wa_phone_number_id or "missing"),
                        Check("tenant contact phone set", bool(biz.contact_phone), biz.contact_phone or "missing"),
                        Check("menu knowledge loaded", int(menu_chunks) >= 1, f"{menu_chunks} chunks"),
                        Check("priced menu items present", int(priced_chunks) >= 1, f"{priced_chunks} priced chunks"),
                    ])
                    # Demo-only feature must not be enabled for a real client tenant.
                    demo_slug = (s.demo_business_slug or "").strip().lower()
                    if demo_slug and slug.lower() != demo_slug:
                        demo_chunks = (await db.execute(
                            select(func.count(KnowledgeChunk.id)).where(
                                KnowledgeChunk.business_id == biz.id,
                                KnowledgeChunk.content.ilike("%Demo Espresso%"),
                            )
                        )).scalar_one()
                        checks.append(Check(
                            "no demo-espresso leakage into client menu",
                            int(demo_chunks) == 0,
                            f"{demo_chunks} demo chunks (should be 0 for a real client)",
                        ))
        except Exception as exc:
            checks.append(Check("direct database checks", False, f"{type(exc).__name__}: {exc}"))

    ready_ok, ready_body = await _http_json(f"{backend}/readyz")
    checks.append(Check(
        "backend /readyz",
        ready_ok and isinstance(ready_body, dict) and ready_body.get("status") == "ok",
        str(ready_body)[:160],
    ))

    if chat:
        ok, body = await _post_json(
            f"{portal}/api/chat",
            {"phone": "+254799000099", "text": "What is on the menu?", "business_slug": slug, "language": "en"},
        )
        reply = body.get("reply", "") if isinstance(body, dict) else str(body)
        created_order = bool(isinstance(body, dict) and body.get("order_id"))
        checks.append(Check(
            "non-charging menu chat works",
            ok and bool(reply.strip()) and not created_order,
            (reply[:140] or "empty reply"),
        ))

    return checks


async def amain() -> int:
    parser = argparse.ArgumentParser(description="Per-tenant go-live readiness check.")
    parser.add_argument("--slug", required=True, help="business slug to verify (e.g. pavilion-grill)")
    parser.add_argument("--backend", default="http://127.0.0.1:8000")
    parser.add_argument("--portal", default="http://127.0.0.1:3000")
    parser.add_argument("--live", action="store_true", help="use hosted production URLs")
    parser.add_argument("--chat", action="store_true", help="run a safe no-order menu chat check")
    args = parser.parse_args()

    if args.live:
        args.backend = "https://api.lesnarai.co.ke"
        args.portal = "https://geneat.lesnarai.co.ke"

    checks = await run(
        slug=args.slug.strip(),
        backend=args.backend.rstrip("/"),
        portal=args.portal.rstrip("/"),
        chat=args.chat,
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
