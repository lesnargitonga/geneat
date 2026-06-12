"""Business (tenant) lookup + profile loading.

Webhook resolves which Business is receiving a message by Meta phone_number_id.
The Business profile is then injected into the agent's system prompt so the AI
speaks with that brand's voice, knows that business's services, and only
retrieves KB chunks for that tenant.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models import Business

log = get_logger("business")

HAZINA_NOMADS_SLUG = "hazina-nomads"

_HAZINA_TENANT_HINT_RE = re.compile(
    r"\b("
    r"hazina(?:\s+nomads)?|"
    r"curated\s+treasures?|"
    r"kenyan\s+(?:gift|gifts|souvenirs?)|"
    r"(?:premium|luxury)\s+(?:gift|gifts|souvenirs?)|"
    r"(?:gift|souvenir)\s+(?:concierge|delivery|for\s+(?:tourists?|travellers?|travelers?))|"
    r"gift\s+(?:box|boxes|collection|collections)|"
    r"order\s+(?:a\s+)?gift\s+box|"
    r"learn\s+more\s+about\s+hazina|"
    r"hello\s+hazina|"
    r"concierge\s+help|"
    r"i(?:'d| would)\s+like\s+(?:concierge|to\s+order)|"
    r"order\s+(?:a\s+)?gift\s+box|"
    r"custom\s+box|"
    r"corporate\s+gifting|"
    r"(?:host|guide|travel\s+planner).{0,60}(?:gift|box|concierge|guest)|"
    r"kenya\s+edit|"
    r"highland\s+treasure|"
    r"nomad\s+leather|"
    r"safari\s+romance|"
    r"departure\s+drop|"
    r"hn-[a-z0-9-]+|"
    r"jkia.{0,40}(?:gift|box|delivery)|"
    r"(?:hotel|suite|room).{0,40}(?:gift|box|delivery)"
    r")\b",
    re.IGNORECASE,
)


_VERTICAL_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("hospitality", ("hotel", "hospitality", "suite", "lounge", "resort", "lodge", "airbnb", "bnb")),
    ("restaurant",  ("restaurant", "cafe", "café", "eatery", "kitchen", "bistro", "bar & grill", "fast food", "food")),
    ("salon",       ("salon", "spa", "barber", "wellness", "beauty", "nails", "hair")),
    ("retail",      ("shop", "store", "retail", "boutique", "pharmacy", "supermarket", "mart", "outlet")),
    ("clinic",      ("clinic", "dental", "hospital", "medical", "physio")),
    ("fitness",     ("gym", "fitness", "yoga", "pilates", "crossfit")),
)


def _infer_vertical(industry: str, profile: dict) -> str:
    """Derive a coarse vertical class from the free-text industry string or
    an explicit override in profile['vertical']. Drives which playbook the
    agent loads (tool-firing rules, required-fields, vertical voice notes)."""
    explicit = (profile or {}).get("vertical")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip().lower()
    s = (industry or "").lower()
    for vert, keys in _VERTICAL_KEYWORDS:
        if any(k in s for k in keys):
            return vert
    return "general"


def looks_like_hazina_tenant_hint(text: str | None) -> bool:
    """Detect messages that almost certainly originated from Hazina surfaces.

    This is a defensive guard for Meta/Render drift: a wa.me link can point to
    the right display number while the provider ``phone_number_id`` is still
    mapped to an old tenant in the database. We keep the detector narrow so a
    normal café question does not unexpectedly jump tenants.
    """
    return bool(_HAZINA_TENANT_HINT_RE.search(text or ""))


@dataclass
class BusinessProfile:
    """Read-only snapshot passed into the agent state. Plain dataclass so
    LangGraph can serialise it cleanly into TypedDict-backed state."""
    id: uuid.UUID
    slug: str
    name: str
    industry: str
    location: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    brand_voice: str | None = None
    greeting_template: str | None = None
    language_primary: str = "en"
    language_secondary: str = "sw"
    profile: dict = field(default_factory=dict)
    vertical: str = "general"


def _to_profile(b: Business) -> BusinessProfile:
    prof = b.profile or {}
    return BusinessProfile(
        id=b.id, slug=b.slug, name=b.name, industry=b.industry,
        location=b.location, contact_phone=b.contact_phone,
        contact_email=b.contact_email, brand_voice=b.brand_voice,
        greeting_template=b.greeting_template,
        language_primary=b.language_primary,
        language_secondary=b.language_secondary,
        profile=prof,
        vertical=_infer_vertical(b.industry or "", prof),
    )


def _hazina_profile_defaults(portal_base_url: str) -> dict:
    from app.catalog.hazina_catalog import (
        HAZINA_COLLECTIONS,
        HAZINA_TREASURES,
        MIN_CUSTOM_ITEMS,
        PACKAGING_FEE_USD,
        build_hazina_menu_photos,
    )

    return {
        "vertical": "retail",
        "tagline": "Private sourcing concierge for premium Kenyan heritage.",
        "brand_pillars": ["Bespoke Curation", "Seamless Logistics", "Global Export"],
        "triad": "Bespoke Curation · Seamless Logistics · Global Export",
        "currency": "USD",
        "currency_display": "USD first, KES equivalent",
        "usd_pricing": True,
        "payment_methods": ["M-Pesa (IntaSend STK)", "Visa/Mastercard/Apple Pay (Paystack USD)"],
        "custom_orders": True,
        "corporate_gifting": True,
        "timezone": "Africa/Nairobi",
        "fulfillment_pillars": [
            "Bespoke Curation",
            "Seamless Logistics",
            "Global Export",
        ],
        "fulfillment_capabilities": [
            "private sourcing briefs",
            "property and residence handoffs",
            "departure-sensitive handoffs",
            "insured global export quotes",
        ],
        "regional_fulfillment": {
            "enabled": True,
            "requires_feasibility_confirmation": True,
            "scope": "verified nationwide property, residence, villa, lodge, and departure handoffs",
        },
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
        "menu_photos": build_hazina_menu_photos(portal_base_url),
        "order_rules": {
            "min_custom_items": MIN_CUSTOM_ITEMS,
            "packaging_fee_usd": PACKAGING_FEE_USD,
            "quote_dhl_before_payment": True,
        },
    }


def _hazina_canonical_photo_keys() -> set[str]:
    from app.catalog.hazina_catalog import HAZINA_COLLECTIONS

    keys = {"menu", "collections", "safari"}
    for row in HAZINA_COLLECTIONS:
        keys.add(str(row["id"]).lower())
        keys.add(str(row["name"]).lower())
        keys.add(str(row["sku"]).lower())
    return keys


async def ensure_hazina_business(
    db: AsyncSession,
    *,
    claim_meta_phone: bool = False,
) -> BusinessProfile:
    """Create/repair the Hazina tenant from the code catalog if it is absent.

    This prevents a live WhatsApp/portal route from dead-ending just because
    the hosted DB was not manually seeded after an environment rotation.
    """
    from app.core.config import get_settings

    settings = get_settings()
    res = await db.execute(select(Business).where(Business.slug == HAZINA_NOMADS_SLUG))
    biz = res.scalar_one_or_none()
    created = biz is None
    if biz is None:
        biz = Business(slug=HAZINA_NOMADS_SLUG)
        db.add(biz)

    biz.name = "Hazina Nomads"
    biz.industry = "gift-concierge"
    biz.location = "Kenya - bespoke curation, seamless logistics, and global export"
    biz.contact_phone = "+254715540653"
    biz.contact_email = "concierge@hazina-nomads.com"
    biz.brand_voice = (
        "Professional, calm, high-end hotel concierge. The Hazina Triad is "
        "Bespoke Curation, Seamless Logistics, and Global Export. Curate "
        "premium Kenyan signature collections and private sourcing briefs for travellers, "
        "hosts, guides, and international delivery. Do not list locations "
        "unprompted; say Hazina offers seamless nationwide and global logistics. "
        "Keep replies concise, quote USD first with KES visible, and collect "
        "handoff channel, exact location, timing, contact, and payment preference before checkout."
    )
    biz.greeting_template = (
        "Welcome to Hazina Nomads. We offer bespoke curation, seamless logistics, "
        "and global export for premium Kenyan heritage items. Would you like to "
        "view our signature collections, or initialize a private sourcing brief?"
    )
    biz.language_primary = "en"
    biz.language_secondary = "sw"
    biz.latitude = -1.2921
    biz.longitude = 36.7853
    biz.active = True

    defaults = _hazina_profile_defaults(settings.public_hazina_portal_url)
    existing = biz.profile if isinstance(biz.profile, dict) else {}
    existing_photos = existing.get("menu_photos") if isinstance(existing.get("menu_photos"), dict) else {}
    default_photos = defaults.get("menu_photos") if isinstance(defaults.get("menu_photos"), dict) else {}
    photo_keys_to_replace = _hazina_canonical_photo_keys()
    merged_photos = {**default_photos, **existing_photos}
    for key in photo_keys_to_replace:
        if key in default_photos:
            merged_photos[key] = default_photos[key]

    profile = {
        **defaults,
        **existing,
        "menu_photos": merged_photos,
    }
    biz.profile = profile

    meta_pid = (settings.meta_wa_phone_number_id or "").strip()
    if claim_meta_phone and meta_pid:
        await db.execute(
            update(Business)
            .where(Business.slug != HAZINA_NOMADS_SLUG)
            .where(Business.meta_wa_phone_number_id == meta_pid)
            .values(meta_wa_phone_number_id=None)
        )
        biz.meta_wa_phone_number_id = meta_pid

    await db.flush()

    if created or not existing.get("hazina_kb_catalog_count"):
        try:
            from app.services.hazina_kb import sync_hazina_knowledge_base

            synced = await sync_hazina_knowledge_base(db, biz.id)
            if synced:
                profile["hazina_kb_catalog_count"] = synced
                biz.profile = profile
                await db.flush()
        except Exception as exc:
            log.warning("hazina_kb_sync_failed", error=str(exc))

    log.warning(
        "hazina_business_auto_provisioned" if created else "hazina_business_auto_repaired",
        business_id=str(biz.id),
        claimed_meta_phone=bool(claim_meta_phone and meta_pid),
    )
    return _to_profile(biz)


async def get_business_by_wa_phone_id(
    db: AsyncSession, phone_number_id: str | None
) -> Optional[BusinessProfile]:
    if not phone_number_id:
        return None
    from app.core.config import get_settings  # local import to avoid cycle

    settings = get_settings()
    configured_meta_pid = (settings.meta_wa_phone_number_id or "").strip()
    hazina_is_primary = bool(getattr(settings, "hazina_claims_meta_phone", True)) or (
        (settings.default_business_slug or "").strip().lower() == HAZINA_NOMADS_SLUG
    )
    if hazina_is_primary and configured_meta_pid and str(phone_number_id) == configured_meta_pid:
        return await ensure_hazina_business(db, claim_meta_phone=True)

    res = await db.execute(
        select(Business).where(
            Business.meta_wa_phone_number_id == str(phone_number_id),
            Business.active.is_(True),
        )
    )
    b = res.scalar_one_or_none()
    return _to_profile(b) if b else None


async def get_business_by_slug(db: AsyncSession, slug: str) -> Optional[BusinessProfile]:
    res = await db.execute(select(Business).where(Business.slug == slug, Business.active.is_(True)))
    b = res.scalar_one_or_none()
    return _to_profile(b) if b else None


async def get_default_business(db: AsyncSession) -> Optional[BusinessProfile]:
    """Fall-back when webhook can't resolve a specific tenant. Prefers the
    business matching ``settings.default_business_slug``; otherwise picks the
    oldest active business."""
    from app.core.config import get_settings  # local import to avoid cycle
    slug = (get_settings().default_business_slug or "").strip()
    if slug:
        res = await db.execute(
            select(Business).where(
                Business.slug == slug, Business.active.is_(True),
            ).limit(1)
        )
        b = res.scalar_one_or_none()
        if b:
            return _to_profile(b)
        if slug == HAZINA_NOMADS_SLUG:
            return await ensure_hazina_business(db, claim_meta_phone=True)
    res = await db.execute(
        select(Business).where(Business.active.is_(True)).order_by(Business.created_at.asc()).limit(1)
    )
    b = res.scalar_one_or_none()
    return _to_profile(b) if b else None


async def get_business_for_turn(
    db: AsyncSession,
    *,
    phone_number_id: str | None = None,
    business_id: uuid.UUID | None = None,
) -> Optional[BusinessProfile]:
    """Resolution order: explicit business_id → meta phone_number_id → default."""
    if business_id:
        res = await db.execute(select(Business).where(Business.id == business_id))
        b = res.scalar_one_or_none()
        if b:
            return _to_profile(b)
    if phone_number_id:
        bp = await get_business_by_wa_phone_id(db, phone_number_id)
        if bp:
            return bp
    return await get_default_business(db)
