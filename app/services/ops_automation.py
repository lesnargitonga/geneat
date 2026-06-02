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
_ACCEPT_RE = re.compile(r"^\s*!accept\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$", re.IGNORECASE)
_RUNNER_RE = re.compile(
    r"^\s*!runner\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s+(?P<name>[^\+]+?)\s+(?P<phone>\+?[0-9][0-9\-\s]{7,})\s*$",
    re.IGNORECASE,
)
_SOURCING_RE = re.compile(r"^\s*!sourcing\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$", re.IGNORECASE)
_QC_RE = re.compile(r"^\s*!qc\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$", re.IGNORECASE)
_PACKING_RE = re.compile(r"^\s*!packing\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$", re.IGNORECASE)
_READY_RE = re.compile(r"^\s*!ready\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$", re.IGNORECASE)
_ISSUE_RE = re.compile(
    r"^\s*!issue\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s+(?P<note>.+)\s*$",
    re.IGNORECASE,
)
_CANCEL_RE = re.compile(
    r"^\s*!cancel\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s+(?P<reason>.+)\s*$",
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


def _append_ops_audit(
    order: Order,
    *,
    sender: str,
    command: str,
    prev_status: str | None,
    new_status: str | None,
    note: str | None = None,
) -> None:
    details = dict(order.details or {})
    entries = details.get("ops_audit")
    audit = list(entries) if isinstance(entries, list) else []
    audit.append(
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "admin": sender,
            "command": command,
            "previous_status": prev_status,
            "new_status": new_status,
            "note": (note or "").strip() or None,
        }
    )
    details["ops_audit"] = audit[-200:]
    order.details = details


async def _resolve_order_or_error(db: AsyncSession, ref: str) -> tuple[Order | None, str | None]:
    order = await find_order_by_public_reference(db, ref)
    if order is None:
        return None, f"❌ Order not found: {ref}"
    return order, None


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
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(
            db,
            order,
            status="out_for_delivery",
            courier_note=courier,
        )
        _append_ops_audit(
            order,
            sender=sender,
            command="dispatch",
            prev_status=prev_status,
            new_status="out_for_delivery",
            note=courier,
        )
        await db.commit()
        return f"✅ {ref} marked OUT FOR DELIVERY.\nCourier: {courier}"

    delivered_match = _DELIVERED_RE.match(body)
    if delivered_match:
        ref = delivered_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="delivered")
        _append_ops_audit(
            order,
            sender=sender,
            command="delivered",
            prev_status=prev_status,
            new_status="delivered",
        )
        await db.commit()
        return f"✅ {ref} marked DELIVERED."

    accept_match = _ACCEPT_RE.match(body)
    if accept_match:
        ref = accept_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="sourcing_approved")
        _append_ops_audit(
            order,
            sender=sender,
            command="accept",
            prev_status=prev_status,
            new_status="sourcing_approved",
        )
        await db.commit()
        return f"✅ {ref} marked SOURCING APPROVED."

    runner_match = _RUNNER_RE.match(body)
    if runner_match:
        ref = runner_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        runner_name = runner_match.group("name").strip()
        runner_phone_raw = runner_match.group("phone").strip()
        try:
            runner_phone = normalize_msisdn(runner_phone_raw)
        except ValueError:
            return "❌ Runner phone must be a valid MSISDN."
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="runner_assigned")
        details = dict(order.details or {})
        details["runner_name"] = runner_name
        details["runner_phone"] = runner_phone
        order.details = details
        _append_ops_audit(
            order,
            sender=sender,
            command="runner",
            prev_status=prev_status,
            new_status="runner_assigned",
            note=f"{runner_name} {runner_phone}",
        )
        await db.commit()
        return f"✅ {ref} runner assigned: {runner_name} ({runner_phone})."

    sourcing_match = _SOURCING_RE.match(body)
    if sourcing_match:
        ref = sourcing_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="sourcing_in_progress")
        _append_ops_audit(
            order,
            sender=sender,
            command="sourcing",
            prev_status=prev_status,
            new_status="sourcing_in_progress",
        )
        await db.commit()
        return f"✅ {ref} marked SOURCING IN PROGRESS."

    qc_match = _QC_RE.match(body)
    if qc_match:
        ref = qc_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="quality_check")
        _append_ops_audit(
            order,
            sender=sender,
            command="qc",
            prev_status=prev_status,
            new_status="quality_check",
        )
        await db.commit()
        return f"✅ {ref} marked QUALITY CHECK."

    packing_match = _PACKING_RE.match(body)
    if packing_match:
        ref = packing_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="packing")
        _append_ops_audit(
            order,
            sender=sender,
            command="packing",
            prev_status=prev_status,
            new_status="packing",
        )
        await db.commit()
        return f"✅ {ref} marked PACKING."

    ready_match = _READY_RE.match(body)
    if ready_match:
        ref = ready_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="ready_for_dispatch")
        _append_ops_audit(
            order,
            sender=sender,
            command="ready",
            prev_status=prev_status,
            new_status="ready_for_dispatch",
        )
        await db.commit()
        return f"✅ {ref} marked READY FOR DISPATCH."

    issue_match = _ISSUE_RE.match(body)
    if issue_match:
        ref = issue_match.group("ref").upper()
        note = issue_match.group("note").strip()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="issue_pending")
        details = dict(order.details or {})
        details["issue_note"] = note
        order.details = details
        _append_ops_audit(
            order,
            sender=sender,
            command="issue",
            prev_status=prev_status,
            new_status="issue_pending",
            note=note,
        )
        await db.commit()
        return f"⚠️ {ref} marked ISSUE PENDING.\nNote: {note}"

    cancel_match = _CANCEL_RE.match(body)
    if cancel_match:
        ref = cancel_match.group("ref").upper()
        reason = cancel_match.group("reason").strip()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status="cancelled")
        details = dict(order.details or {})
        details["cancel_reason"] = reason
        order.details = details
        _append_ops_audit(
            order,
            sender=sender,
            command="cancel",
            prev_status=prev_status,
            new_status="cancelled",
            note=reason,
        )
        await db.commit()
        return f"✅ {ref} marked CANCELLED.\nReason: {reason}"

    if body.lower().startswith(
        ("!dispatch", "!delivered", "!accept", "!runner", "!sourcing", "!qc", "!packing", "!ready", "!issue", "!cancel")
    ):
        return (
            "❌ Unrecognized ops command. Supported: "
            "`!accept`, `!runner`, `!sourcing`, `!qc`, `!packing`, `!ready`, "
            "`!dispatch`, `!delivered`, `!issue`, `!cancel`."
        )

    return None
