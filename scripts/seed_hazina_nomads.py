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
    "KES for M-Pesa; quote USD equivalents when the guest asks. Zero custom "
    "orders at launch unless they mention corporate or high-budget gifting."
)

GREETING_TEMPLATE = (
    "Welcome to Hazina Nomads — curated treasures for the modern nomad. "
    "I can help you shop our gift collections, arrange delivery to your hotel or "
    "JKIA, or connect you with a concierge. How may I assist you today?"
)

# MVP catalog — mirrored in KB chunks and profile.products for portal/tools.
PRODUCTS: list[dict] = [
    {
        "id": "kenya-edit",
        "sku": "HN-KE-001",
        "name": "The Kenya Edit",
        "price_usd": 89,
        "price_kes": 11500,
        "target": "Safari tourists, European/US visitors",
        "contents": (
            "Premium Kenyan coffee (250g), handmade Maasai beadwork "
            "(bracelet or necklace), small artisan soapstone carving, printed brand story card"
        ),
        "lead_time_hours": 24,
        "personalization": False,
    },
    {
        "id": "highland-treasure",
        "sku": "HN-HT-002",
        "name": "The Highland Treasure",
        "price_usd": 59,
        "price_kes": 7600,
        "target": "General gifting, diaspora, colleagues",
        "contents": (
            "Export-grade Kenyan coffee, premium Kenyan loose-leaf tea, "
            "local raw honey, carved wooden tasting spoon"
        ),
        "lead_time_hours": 24,
        "personalization": False,
    },
    {
        "id": "nomad-leather-set",
        "sku": "HN-NL-003",
        "name": "The Nomad Leather Set",
        "price_usd": 129,
        "price_kes": 16600,
        "target": "Business travellers, wealthy tourists",
        "contents": "Handmade leather passport holder, luggage tag, and travel notebook",
        "lead_time_hours": 24,
        "personalization": True,
        "personalization_note": "Engraving requires 24-hour notice",
    },
    {
        "id": "safari-romance-box",
        "sku": "HN-SR-004",
        "name": "The Safari Romance Box",
        "price_usd": 199,
        "price_kes": 25600,
        "target": "Honeymooners, anniversary trips",
        "contents": (
            "Matching couple's beadwork, premium treats (chocolate/coffee), "
            "framed minimalist safari route map, leather luggage tags"
        ),
        "lead_time_hours": 48,
        "personalization": True,
    },
    {
        "id": "departure-drop",
        "sku": "HN-DD-005",
        "name": "The Departure Drop",
        "price_usd": 149,
        "price_kes": 19200,
        "target": "Last-minute JKIA departures",
        "contents": (
            "Pre-packed fast-moving items: coffee, tea, un-personalized leather, beadwork"
        ),
        "lead_time_hours": 4,
        "personalization": False,
        "jkia_only": True,
    },
]

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
    "custom_orders": False,
    "corporate_gifting": True,
    "timezone": "Africa/Nairobi",
    "delivery_zones": ["Westlands", "Kilimani", "Karen", "JKIA"],
    "jkia_delivery_window_hours": 4,
    "late_dispatch_fee_usd": 15,
    "late_dispatch_after": "20:00 EAT",
    "products": PRODUCTS,
    "menu_photos": {},
    "affiliate": {
        "host_commission_pct": 15,
        "referral_prefix": "REF-HOST-",
    },
}

KB_CATALOG: list[str] = [
    (
        "THE KENYA EDIT (SKU HN-KE-001) — USD 89 / KES 11,500. "
        "Target: safari tourists, European/US visitors. "
        "Includes: premium Kenyan coffee 250g, handmade Maasai beadwork "
        "(bracelet or necklace), small artisan soapstone carving, printed brand story card. "
        "Standard lead time: 24 hours. No custom contents at launch."
    ),
    (
        "THE HIGHLAND TREASURE (SKU HN-HT-002) — USD 59 / KES 7,600. "
        "Target: general gifting, diaspora, colleagues. "
        "Includes: export-grade Kenyan coffee, premium Kenyan loose-leaf tea, "
        "local raw honey, carved wooden tasting spoon. "
        "Standard lead time: 24 hours."
    ),
    (
        "THE NOMAD LEATHER SET (SKU HN-NL-003) — USD 129 / KES 16,600. "
        "Target: business travellers, wealthy tourists. "
        "Includes: handmade leather passport holder, luggage tag, travel notebook. "
        "Personalized engraving requires 24-hour notice before dispatch."
    ),
    (
        "THE SAFARI ROMANCE BOX (SKU HN-SR-004) — USD 199 / KES 25,600. "
        "Target: honeymooners, anniversary trips. "
        "Includes: matching couple's beadwork, premium treats (chocolate/coffee), "
        "framed minimalist safari route map, leather luggage tags. "
        "Allow 48 hours for assembly; engraving on leather tags needs 24-hour notice."
    ),
    (
        "THE DEPARTURE DROP (SKU HN-DD-005) — USD 149 / KES 19,200. "
        "Target: last-minute JKIA departures. "
        "Includes: pre-packed coffee, tea, un-personalized leather, beadwork. "
        "Guaranteed 4-hour delivery window to JKIA or Nairobi hotels — requires "
        "customer's terminal number and confirmed departure time."
    ),
]

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
        "CUSTOM ORDERS — We offer exactly five curated gift boxes at launch. "
        "No bespoke/custom boxes unless the guest mentions corporate gifting or "
        "a high-budget request; escalate those to a human concierge."
    ),
    (
        "PAYMENTS — Local guests: M-Pesa STK push via IntaSend (KES). "
        "International cards: USD checkout link via Paystack (Visa, Mastercard, Apple Pay). "
        "Do not promise payment until the guest confirms their preferred method."
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
        print(f"  ✓ {biz.name} (id={biz.id}, slug={biz.slug})")

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
    print("  • python scripts/tenant_go_live_check.py --slug hazina-nomads")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Seed Hazina Nomads tenant")
    p.add_argument("--skip-kb", action="store_true", help="Skip KB re-embed")
    rc = asyncio.run(main(p.parse_args()))
    sys.exit(rc)
