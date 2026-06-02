"""Ghost Ops — hidden WhatsApp admin commands for Hazina fulfillment."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import normalize_msisdn
from app.db.models import Order
from app.services.business_service import HAZINA_NOMADS_SLUG, get_business_by_slug
from app.services.fulfillment_status import (
    AWAITING_CONFIRMATION,
    BRIEF_RECEIVED,
    CANCELLED,
    DELIVERED,
    ISSUE_PENDING,
    OUT_FOR_DELIVERY,
    PACKING,
    PENDING_PAYMENT,
    QUALITY_CHECK,
    READY_FOR_DISPATCH,
    RUNNER_ASSIGNED,
    SOURCING_APPROVED,
    SOURCING_IN_PROGRESS,
    normalize_fulfillment_status,
)
from app.services.gift_automation import is_hazina_slug

log = get_logger("ops_automation")

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
_ORDER_RE = re.compile(r"^\s*!order\s+(?P<ref>HN-ORD-[A-Za-z0-9]+)\s*$", re.IGNORECASE)
_ORDERS_RE = re.compile(r"^\s*!orders\s*$", re.IGNORECASE)

_ISSUE_TYPES = {
    "item_unavailable",
    "customer_unreachable",
    "delivery_delay",
    "supplier_quality_reject",
    "wrong_location",
    "engraving_error",
    "payment_pending",
    "courier_failed",
    "customer_changed_time",
    "outside_zone_request",
    "refund_requested",
    "substitution_declined",
}

_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    SOURCING_APPROVED: {PENDING_PAYMENT, BRIEF_RECEIVED, AWAITING_CONFIRMATION, ISSUE_PENDING},
    RUNNER_ASSIGNED: {SOURCING_APPROVED},
    SOURCING_IN_PROGRESS: {RUNNER_ASSIGNED, SOURCING_APPROVED},
    QUALITY_CHECK: {SOURCING_IN_PROGRESS},
    PACKING: {QUALITY_CHECK},
    READY_FOR_DISPATCH: {PACKING},
    OUT_FOR_DELIVERY: {READY_FOR_DISPATCH},
    DELIVERED: {OUT_FOR_DELIVERY},
    ISSUE_PENDING: {
        PENDING_PAYMENT,
        BRIEF_RECEIVED,
        AWAITING_CONFIRMATION,
        SOURCING_APPROVED,
        RUNNER_ASSIGNED,
        SOURCING_IN_PROGRESS,
        QUALITY_CHECK,
        PACKING,
        READY_FOR_DISPATCH,
        OUT_FOR_DELIVERY,
    },
    CANCELLED: {
        PENDING_PAYMENT,
        BRIEF_RECEIVED,
        AWAITING_CONFIRMATION,
        SOURCING_APPROVED,
        RUNNER_ASSIGNED,
        SOURCING_IN_PROGRESS,
        QUALITY_CHECK,
        PACKING,
        READY_FOR_DISPATCH,
        ISSUE_PENDING,
    },
}


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


async def _latest_hazina_orders(db: AsyncSession, *, limit: int = 10) -> list[Order]:
    business = await get_business_by_slug(db, HAZINA_NOMADS_SLUG)
    if business is None:
        return []
    return (
        await db.execute(
            select(Order)
            .where(Order.business_id == business.id)
            .order_by(Order.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()


def _order_ref(order: Order) -> str:
    details = order.details if isinstance(order.details, dict) else {}
    return str(details.get("public_reference") or f"HN-ORD-{order.id.hex[:8].upper()}")


def _format_order_snapshot(order: Order) -> str:
    details = order.details if isinstance(order.details, dict) else {}
    ref = _order_ref(order)
    status = str(details.get("fulfillment_status") or "pending_payment")
    pay_status = getattr(order, "payment_status", None)
    pay = pay_status.value if hasattr(pay_status, "value") else str(pay_status or "unknown")
    runner = str(details.get("runner_name") or "").strip()
    issue_type = str(details.get("issue_type") or "").strip()
    issue_status = str(details.get("issue_status") or "").strip()
    destination = str(details.get("delivery_location") or "").strip() or "n/a"
    line = f"{ref} · status={status} · payment={pay} · destination={destination}"
    if runner:
        line += f" · runner={runner}"
    if issue_type:
        line += f" · issue={issue_type}:{issue_status or 'open'}"
    return line


def _parse_issue_note(raw: str) -> tuple[str, str]:
    """
    Parse issue text into (issue_type, issue_note).

    Accepted styles:
    - "<issue_type>: note"
    - "<issue_type> note..."
    Falls back to `issue_pending` type when unknown.
    """
    text = (raw or "").strip()
    if not text:
        return "issue_pending", ""
    token, _, rest = text.partition(":")
    first = token.strip().split()[0].lower() if token.strip() else ""
    if first in _ISSUE_TYPES:
        note = rest.strip() if rest else text[len(first) :].strip()
        return first, note or "Issue logged by ops."
    return "issue_pending", text


def _current_status(order: Order) -> str:
    return normalize_fulfillment_status((order.details or {}).get("fulfillment_status"))


def _check_transition(order: Order, target_status: str) -> str | None:
    current = _current_status(order)
    if current == target_status:
        return None
    allowed_from = _ALLOWED_TRANSITIONS.get(target_status)
    if not allowed_from:
        return None
    if current in allowed_from:
        return None
    return (
        f"❌ Invalid transition: {current or 'unknown'} → {target_status}. "
        "Please advance the order through the required prior step."
    )


async def try_handle_ops_command(
    db: AsyncSession,
    text: str,
    sender: str,
    tenant_slug: str | None,
) -> str | None:
    """Parse admin WhatsApp ops commands. Non-admins always get ``None``."""
    body = (text or "").strip()
    if not is_ops_admin(sender):
        if body.startswith("!"):
            log.warning("ops_command_unauthorized", sender=sender, command=body.split()[0][:32])
            try:
                from app.api.metrics import record_event
                record_event("ops_command_unauthorized")
            except Exception:
                pass
        return None

    if tenant_slug and not is_hazina_slug(tenant_slug):
        return None

    if not body.startswith("!"):
        return None

    orders_match = _ORDERS_RE.match(body)
    if orders_match:
        rows = await _latest_hazina_orders(db, limit=8)
        if not rows:
            return "ℹ️ No Hazina orders found."
        lines = ["🧾 Latest Hazina orders:"]
        lines.extend(f"- {_format_order_snapshot(order)}" for order in rows)
        return "\n".join(lines)

    order_match = _ORDER_RE.match(body)
    if order_match:
        ref = order_match.group("ref").upper()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        return f"🔎 {_format_order_snapshot(order)}"

    dispatch_match = _DISPATCH_RE.match(body)
    if dispatch_match:
        ref = dispatch_match.group("ref").upper()
        courier = dispatch_match.group("courier").strip()
        if not courier:
            return "❌ Courier details are required."
        order = await find_order_by_public_reference(db, ref)
        if order is None:
            return f"❌ Order not found: {ref}"
        transition_err = _check_transition(order, OUT_FOR_DELIVERY)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(
            db,
            order,
            status=OUT_FOR_DELIVERY,
            courier_note=courier,
        )
        _append_ops_audit(
            order,
            sender=sender,
            command="dispatch",
            prev_status=prev_status,
            new_status=OUT_FOR_DELIVERY,
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
        transition_err = _check_transition(order, DELIVERED)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=DELIVERED)
        _append_ops_audit(
            order,
            sender=sender,
            command="delivered",
            prev_status=prev_status,
            new_status=DELIVERED,
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
        transition_err = _check_transition(order, SOURCING_APPROVED)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=SOURCING_APPROVED)
        _append_ops_audit(
            order,
            sender=sender,
            command="accept",
            prev_status=prev_status,
            new_status=SOURCING_APPROVED,
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
        transition_err = _check_transition(order, RUNNER_ASSIGNED)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=RUNNER_ASSIGNED)
        details = dict(order.details or {})
        details["runner_name"] = runner_name
        details["runner_phone"] = runner_phone
        order.details = details
        _append_ops_audit(
            order,
            sender=sender,
            command="runner",
            prev_status=prev_status,
            new_status=RUNNER_ASSIGNED,
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
        transition_err = _check_transition(order, SOURCING_IN_PROGRESS)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=SOURCING_IN_PROGRESS)
        _append_ops_audit(
            order,
            sender=sender,
            command="sourcing",
            prev_status=prev_status,
            new_status=SOURCING_IN_PROGRESS,
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
        transition_err = _check_transition(order, QUALITY_CHECK)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=QUALITY_CHECK)
        _append_ops_audit(
            order,
            sender=sender,
            command="qc",
            prev_status=prev_status,
            new_status=QUALITY_CHECK,
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
        transition_err = _check_transition(order, PACKING)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=PACKING)
        _append_ops_audit(
            order,
            sender=sender,
            command="packing",
            prev_status=prev_status,
            new_status=PACKING,
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
        transition_err = _check_transition(order, READY_FOR_DISPATCH)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=READY_FOR_DISPATCH)
        _append_ops_audit(
            order,
            sender=sender,
            command="ready",
            prev_status=prev_status,
            new_status=READY_FOR_DISPATCH,
        )
        await db.commit()
        return f"✅ {ref} marked READY FOR DISPATCH."

    issue_match = _ISSUE_RE.match(body)
    if issue_match:
        ref = issue_match.group("ref").upper()
        raw_note = issue_match.group("note").strip()
        issue_type, note = _parse_issue_note(raw_note)
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        transition_err = _check_transition(order, ISSUE_PENDING)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=ISSUE_PENDING)
        details = dict(order.details or {})
        details["issue_note"] = note
        details["issue_type"] = issue_type
        details["issue_status"] = "open"
        details["issue_owner"] = sender
        order.details = details
        _append_ops_audit(
            order,
            sender=sender,
            command="issue",
            prev_status=prev_status,
            new_status=ISSUE_PENDING,
            note=f"{issue_type}: {note}",
        )
        await db.commit()
        return f"⚠️ {ref} marked ISSUE PENDING.\nType: {issue_type}\nNote: {note}"

    cancel_match = _CANCEL_RE.match(body)
    if cancel_match:
        ref = cancel_match.group("ref").upper()
        reason = cancel_match.group("reason").strip()
        order, err = await _resolve_order_or_error(db, ref)
        if err:
            return err
        assert order is not None
        transition_err = _check_transition(order, CANCELLED)
        if transition_err:
            return transition_err
        prev_status = str((order.details or {}).get("fulfillment_status") or "")
        await _set_fulfillment(db, order, status=CANCELLED)
        details = dict(order.details or {})
        details["cancel_reason"] = reason
        order.details = details
        _append_ops_audit(
            order,
            sender=sender,
            command="cancel",
            prev_status=prev_status,
            new_status=CANCELLED,
            note=reason,
        )
        await db.commit()
        return f"✅ {ref} marked CANCELLED.\nReason: {reason}"

    if body.lower().startswith(
        ("!orders", "!order", "!dispatch", "!delivered", "!accept", "!runner", "!sourcing", "!qc", "!packing", "!ready", "!issue", "!cancel")
    ):
        return (
            "❌ Unrecognized ops command. Supported: "
            "`!orders`, `!order`, "
            "`!accept`, `!runner`, `!sourcing`, `!qc`, `!packing`, `!ready`, "
            "`!dispatch`, `!delivered`, `!issue`, `!cancel`."
        )

    return None
