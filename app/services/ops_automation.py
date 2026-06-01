"""Ghost Ops — hidden WhatsApp admin commands for Hazina fulfillment."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import normalize_msisdn
from app.db.models import Order
from app.services.business_service import HAZINA_NOMADS_SLUG, get_business_by_slug
from app.services.gift_automation import is_hazina_slug

_DISPATCH_RE = re.compile(
    r"^\s*!dispatch\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s+(?P<courier>.+)\s*$",
    re.IGNORECASE,
)
_DELIVERED_RE = re.compile(
    r"^\s*!delivered\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$",
    re.IGNORECASE,
)


def _admin_msisdns() -> frozenset[str]:
    raw = get_settings().admin_wa_numbers.strip()
    if not raw:
        return frozenset()
    numbers: set[str] = set()
    for part in raw.split(","):
        piece = part.strip()
        if not piece:
            continue
        try:
            numbers.add(normalize_msisdn(piece))
        except ValueError:
            continue
    return frozenset(numbers)


def is_ops_admin(sender: str) -> bool:
    """True when ``sender`` is listed in ``ADMIN_WA_NUMBERS``."""
    allowed = _admin_msisdns()
    if not allowed:
        return False
    try:
        normalized = normalize_msisdn(sender)
    except ValueError:
        return False
    return normalized in allowed


async def find_order_by_public_reference(
    db: AsyncSession,
    public_reference: str,
) -> Order | None:
    """Resolve a Hazina order by ``public_reference`` or ``HN-ORD-{uuid8}`` suffix."""
    ref = (public_reference or "").strip().upper()
    if not ref:
        return None

    business = await get_business_by_slug(db, HAZINA_NOMADS_SLUG)
    if business is None:
        return None

    orders = (
        await db.execute(
            select(Order)
            .where(Order.business_id == business.id)
            .order_by(Order.created_at.desc())
            .limit(500)
        )
    ).scalars().all()

    for candidate in orders:
        details = candidate.details if isinstance(candidate.details, dict) else {}
        stored = str(details.get("public_reference") or "").strip().upper()
        if stored == ref:
            return candidate

    if ref.startswith("HN-ORD-") and len(ref) > 7:
        suffix = ref.removeprefix("HN-ORD-").lower()
        for candidate in orders:
            if candidate.id.hex[:8].upper() == suffix[:8].upper():
                return candidate
    return None


async def _set_fulfillment(
    db: AsyncSession,
    order: Order,
    *,
    status: str,
    courier_note: str | None = None,
) -> None:
    details = dict(order.details or {})
    details["fulfillment_status"] = status
    details["fulfillment_updated_at"] = datetime.now(timezone.utc).isoformat()
    if courier_note is not None:
        details["courier_note"] = courier_note.strip()
    order.details = details
    await db.flush()


async def try_handle_ops_command(
    db: AsyncSession,
    text: str,
    sender: str,
    tenant_slug: str | None,
) -> str | None:
    """Parse admin WhatsApp ops commands. Non-admins always get ``None``."""
    if not is_ops_admin(sender):
        return None

    if tenant_slug and not is_hazina_slug(tenant_slug):
        return None

    body = (text or "").strip()
    if not body.startswith("!"):
        return None

    dispatch_match = _DISPATCH_RE.match(body)
    if dispatch_match:
        ref = dispatch_match.group("ref").upper()
        courier = dispatch_match.group("courier").strip()
        if not courier:
            return "❌ Courier details are required."
        order = await find_order_by_public_reference(db, ref)
        if order is None:
            return f"❌ Order not found: {ref}"
        await _set_fulfillment(
            db,
            order,
            status="out_for_delivery",
            courier_note=courier,
        )
        await db.commit()
        return f"✅ {ref} marked OUT FOR DELIVERY.\nCourier: {courier}"

    delivered_match = _DELIVERED_RE.match(body)
    if delivered_match:
        ref = delivered_match.group("ref").upper()
        order = await find_order_by_public_reference(db, ref)
        if order is None:
            return f"❌ Order not found: {ref}"
        await _set_fulfillment(db, order, status="delivered")
        await db.commit()
        return f"✅ {ref} marked DELIVERED."

    if body.lower().startswith(("!dispatch", "!delivered")):
        return "❌ Unrecognized ops command. Use `!dispatch <HN-ORD-…> <courier>` or `!delivered <HN-ORD-…>`."

    return None
