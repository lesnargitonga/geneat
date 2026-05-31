"""Business (tenant) lookup + profile loading.

Webhook resolves which Business is receiving a message by Meta phone_number_id.
The Business profile is then injected into the agent's system prompt so the AI
speaks with that brand's voice, knows that business's services, and only
retrieves KB chunks for that tenant.
"""
from __future__ import annotations

import uuid
import re
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models import Business

log = get_logger("business")

HAZINA_NOMADS_SLUG = "hazina-nomads"

_HAZINA_TENANT_HINT_RE = re.compile(
    r"\b("
    r"hazina(?:\s+nomads)?|"
    r"curated\s+treasures?|"
    r"gift\s+(?:box|boxes|collection|collections)|"
    r"custom\s+box|"
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


async def get_business_by_wa_phone_id(
    db: AsyncSession, phone_number_id: str | None
) -> Optional[BusinessProfile]:
    if not phone_number_id:
        return None
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
