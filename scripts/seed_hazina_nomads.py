"""Seed the **Hazina Nomads** tenant — premium tourist gift concierge MVP.

Run after migrations (idempotent upsert by slug):

    PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

Optional flags:
    --skip-kb     Upsert business row only (no RAG re-embed)
    --wipe-kb     Clear and re-ingest KB even if unchanged

Requires a working embedder (EMBED_PROVIDER in .env).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid

from sqlalchemy import delete, select

from app.ai.rag import ingest_text
from app.catalog.hazina_catalog import (
    HAZINA_COLLECTIONS,
    HAZINA_TREASURES,
    MIN_CUSTOM_ITEMS,
    PACKAGING_FEE_USD,
    build_hazina_kb_catalog,
    build_hazina_menu_photos,
)
from app.core.config import get_settings
from app.db.models import Business, KnowledgeChunk
from app.db.session import SessionLocal

SLUG = "hazina-nomads"
NAME = "Hazina Nomads"
INDUSTRY = "gift-concierge"
LOCATION = "Nairobi, Kenya — Westlands, Kilimani, Karen & JKIA delivery"
CONTACT_PHONE = "+254700000001"
CONTACT_EMAIL = "concierge@hazina-nomads.com"
LANG_PRIMARY = "en"
LANG_SECONDARY = "sw"
LATITUDE = -1.2921
LONGITUDE = 36.7853

BRAND_VOICE = (
    "Professional, calm, high-end hotel concierge. You curate premium Kenyan gift "
    "boxes for travellers — never a discount souvenir shop. Keep replies concise "
    "(1–3 sentences), use the guest's name when known, and never use slang or "
    "campus-café tone. Confirm delivery location (hotel name and room, or JKIA "
    "terminal) and departure time before promising dispatch. Default currency is "
    "KES for M-Pesa; quote USD equivalents when the guest asks. Guests may order "
    "five curated collections or compose a custom box from individual treasures "
    f"(minimum {MIN_CUSTOM_ITEMS} items plus optional packaging USD {PACKAGING_FEE_USD})."
)

GREETING_TEMPLATE = (
    "Welcome to Hazina Nomads — curated treasures for the modern nomad. "
    "I can help you shop our gift collections, build a custom box, arrange delivery "
    "to your hotel or JKIA, or connect you with a concierge. How may I assist you today?"
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
    "currency": "KES",
    "usd_pricing": True,
    "payment_methods": ["M-Pesa (IntaSend STK)", "Visa/Mastercard/Apple Pay (Paystack USD)"],
    "custom_orders": True,
    "corporate_gifting": True,
    "timezone": "Africa/Nairobi",
    "delivery_zones": ["Westlands", "Kilimani", "Karen", "JKIA"],
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

KB_CATALOG: list[str] = build_hazina_kb_catalog()

KB_POLICIES: list[str] = [
    (
        "DELIVERY ZONES — We deliver to Westlands, Kilimani, Karen, and JKIA "
        "(all terminals). We do not dispatch to other Nairobi neighbourhoods at MVP launch."
    ),
    (
        "JKIA DELIVERIES — Require at least 4 hours lead time before the guest's "
        "departure, the customer's terminal number (e.g. 1A, 1E), and a reachable "
        "phone number. The Departure Drop is optimised for this use case."
    ),
    (
        "HOTEL DELIVERIES — Collect hotel name, room number (or front-desk hold), "
        "and preferred delivery window. Confirm the guest's name on the order."
    ),
    (
        "LATE DISPATCH — Deliveries requested after 20:00 East Africa Time incur a "
        "USD 15 late-dispatch fee. Same-day JKIA requests before 20:00 follow the "
        "4-hour window rule without the late fee if feasible."
    ),
    (
        "CUSTOM BOXES — Guests may compose their own gift box from individual treasures "
        f"(minimum {MIN_CUSTOM_ITEMS} items). Premium packaging (SKU HN-T-070) is optional. "
        "Confirm each SKU, delivery location, and payment method before dispatch."
    ),
    (
        "PAYMENTS — Local guests: M-Pesa STK push via IntaSend (KES). "
        "International cards: USD checkout link via Paystack (Visa, Mastercard, Apple Pay). "
        "Ask which method the guest prefers before initiating payment."
    ),
    (
        "BRAND POSITIONING — Hazina Nomads is a premium travel concierge, not a "
        "souvenir shop. Emphasise curation, packaging quality, and reliable last-mile delivery."
    ),
    (
        "CONTACT — WhatsApp concierge: +254 700 000 001. Email: concierge@hazina-nomads.com. "
        "Operating hours for dispatch coordination: 08:00–20:00 EAT daily."
    ),
]


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
        biz.meta_wa_phone_number_id = str(meta_pid)
        print(f"  • Linked Meta phone_number_id → {meta_pid[:6]}…")
    await db.flush()
    return biz


async def reset_and_ingest_kb(db, business_id: uuid.UUID) -> int:
    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.business_id == business_id)
    )
    n = 0
    n += await ingest_text(db, business_id=business_id, source="catalog", chunks=KB_CATALOG)
    n += await ingest_text(db, business_id=business_id, source="policies", chunks=KB_POLICIES)
    return n


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
            n = await reset_and_ingest_kb(db, biz.id)
            await db.commit()
            print(
                f"  ✓ {n} KB chunks ingested "
                f"({len(KB_CATALOG)} catalog + {len(KB_POLICIES)} policy)"
            )

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
