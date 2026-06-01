"""Seed the **Hazina Nomads** tenant — premium tourist gift concierge MVP.

Run after migrations (idempotent upsert by slug):

    PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

Optional flags:
    --skip-kb     Upsert business row only (no RAG re-embed)

Requires a working embedder (EMBED_PROVIDER in .env).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from sqlalchemy import select, update

from app.catalog.hazina_catalog import (
    HAZINA_COLLECTIONS,
    HAZINA_TREASURES,
    MIN_CUSTOM_ITEMS,
    PACKAGING_FEE_USD,
    build_hazina_menu_photos,
)
from app.core.config import get_settings
from app.db.models import Business
from app.db.session import SessionLocal
from app.services.hazina_kb import KB_CATALOG, sync_hazina_knowledge_base

SLUG = "hazina-nomads"
NAME = "Hazina Nomads"
INDUSTRY = "gift-concierge"
LOCATION = "Nairobi, Kenya — Westlands, Kilimani, Karen & JKIA delivery"
CONTACT_PHONE = "+15556578220"
CONTACT_EMAIL = "concierge@hazina-nomads.com"
LANG_PRIMARY = "en"
LANG_SECONDARY = "sw"
LATITUDE = -1.2921
LONGITUDE = 36.7853

BRAND_VOICE = (
    "Professional, calm, high-end hotel concierge. You curate premium Kenyan gift "
    "boxes for travellers — never a discount souvenir shop. Keep replies concise "
    "(1–3 sentences), use the guest's name when known, and never use slang or "
    "campus-café tone. Confirm delivery location (hotel name and room, JKIA "
    "terminal, or international address for DHL/export quote) and timing before promising dispatch. Display USD first "
    "for tourist clarity, with KES visible for local M-Pesa settlement. Guests may order "
    "five curated collections or compose a custom box from individual treasures "
    f"(minimum {MIN_CUSTOM_ITEMS} items plus optional packaging USD {PACKAGING_FEE_USD})."
)

GREETING_TEMPLATE = (
    "Welcome to Hazina Nomads — curated treasures for the modern nomad. "
    "I can help you shop our gift collections, build a custom box, arrange hotel/JKIA delivery, "
    "or quote DHL export shipping. How may I assist you today?"
)

PROFILE: dict = {
    "vertical": "retail",
    "tagline": "Curated treasures for the modern nomad.",
    "brand": {
        "name": "Hazina Nomads",
        "meaning": "Hazina = treasure (Swahili)",
        "colors": {
            "terracotta": "#B85C38",
            "sage": "#8A9A5B",
            "charcoal": "#2C2C2C",
            "cream": "#F5F0E8",
        },
    },
    "currency": "USD",
    "currency_display": "USD first, KES equivalent",
    "usd_pricing": True,
    "payment_methods": ["M-Pesa (IntaSend STK)", "Visa/Mastercard/Apple Pay (Paystack USD)"],
    "custom_orders": True,
    "corporate_gifting": True,
    "timezone": "Africa/Nairobi",
    "delivery_zones": ["Westlands", "Kilimani", "Karen", "JKIA", "DHL export quote"],
    "international_shipping": {
        "enabled": True,
        "carrier_preference": "DHL Express or equivalent insured courier",
        "quote_before_payment": True,
    },
    "jkia_delivery_window_hours": 4,
    "late_dispatch_fee_usd": 15,
    "late_dispatch_after": "20:00 EAT",
    "products": HAZINA_COLLECTIONS,
    "treasures": HAZINA_TREASURES,
    "menu_photos": build_hazina_menu_photos(
        os.environ.get("PUBLIC_HAZINA_PORTAL_URL", "https://hazina.lesnarai.co.ke")
    ),
    "affiliate": {
        "host_commission_pct": 15,
        "referral_prefix": "REF-HOST-",
    },
}

async def upsert_business(db) -> Business:
    biz = (
        await db.execute(select(Business).where(Business.slug == SLUG))
    ).scalar_one_or_none()
    if biz is None:
        biz = Business(slug=SLUG)
        db.add(biz)
    biz.name = NAME
    biz.industry = INDUSTRY
    biz.location = LOCATION
    biz.contact_phone = CONTACT_PHONE
    biz.contact_email = CONTACT_EMAIL
    biz.brand_voice = BRAND_VOICE
    biz.greeting_template = GREETING_TEMPLATE
    biz.language_primary = LANG_PRIMARY
    biz.language_secondary = LANG_SECONDARY
    biz.latitude = LATITUDE
    biz.longitude = LONGITUDE
    biz.profile = PROFILE
    biz.active = True
    meta_pid = (
        os.environ.get("META_WA_PHONE_NUMBER_ID", "").strip()
        or get_settings().meta_wa_phone_number_id
        or ""
    )
    if meta_pid:
        await db.execute(
            update(Business)
            .where(Business.slug != SLUG)
            .where(Business.meta_wa_phone_number_id == str(meta_pid))
            .values(meta_wa_phone_number_id=None)
        )
        biz.meta_wa_phone_number_id = str(meta_pid)
        print(f"  • Claimed Meta phone_number_id for Hazina → {meta_pid[:6]}…")
    await db.flush()
    return biz


async def main(argv: argparse.Namespace) -> int:
    async with SessionLocal() as db:
        print(f"→ Upserting business '{SLUG}'...")
        biz = await upsert_business(db)
        await db.commit()
        await db.refresh(biz)
        print(
            f"  ✓ {biz.name} (id={biz.id}, slug={biz.slug}) — "
            f"{len(HAZINA_COLLECTIONS)} collections, {len(HAZINA_TREASURES)} treasures"
        )

        if not argv.skip_kb:
            print("→ Re-embedding knowledge base...")
            n = await sync_hazina_knowledge_base(db, biz.id, force=True)
            await db.commit()
            print(f"  ✓ {n} KB chunks ingested ({len(KB_CATALOG)} catalog chunks)")

    print()
    print("Hazina Nomads tenant ready.")
    print("Next steps:")
    print("  • Set DEFAULT_BUSINESS_SLUG=hazina-nomads in .env / Render")
    print("  • Point META_WA_PHONE_NUMBER_ID at this tenant when WA number is live")
    print("  • Add PAYSTACK_SECRET_KEY for USD card checkout")
    print("  • python scripts/tenant_go_live_check.py --slug hazina-nomads")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Seed Hazina Nomads tenant")
    p.add_argument("--skip-kb", action="store_true", help="Skip KB re-embed")
    rc = asyncio.run(main(p.parse_args()))
    sys.exit(rc)
