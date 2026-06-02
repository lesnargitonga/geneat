"""Public order tracking credentials and payload for the Hazina portal."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.hazina_catalog import HAZINA_COLLECTIONS
from app.core.config import get_settings
from app.db.models import Order
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

_COLLECTION_BY_ID = {row["id"]: row for row in HAZINA_COLLECTIONS}

_TIMELINE_LABELS = (
    ("brief", "Brief received"),
    ("sourcing", "Sourcing in progress"),
    ("quality", "Quality check"),
    ("packing", "Being packaged"),
    ("ready", "Ready for dispatch"),
    ("delivery", "On the way"),
    ("delivered", "Delivered"),
)


def public_reference_for(order_id: UUID) -> str:
    return f"HN-ORD-{order_id.hex[:8].upper()}"


async def ensure_order_tracking(db: AsyncSession, order: Order) -> tuple[str, str]:
    """Persist ``public_reference`` + ``tracking_token`` on the order row."""
    details = dict(order.details or {})
    token = str(details.get("tracking_token") or "").strip()
    ref = str(details.get("public_reference") or "").strip()
    if not token:
        token = secrets.token_urlsafe(16)
        details["tracking_token"] = token
    if not ref:
        ref = public_reference_for(order.id)
        details["public_reference"] = ref
    if details != order.details:
        order.details = details
        await db.flush()
    return ref, token


def tracking_page_url(public_reference: str, tracking_token: str) -> str:
    base = get_settings().public_hazina_portal_url.rstrip("/")
    return f"{base}/orders/{public_reference}?token={tracking_token}"


def tracking_link_line(order: Order, *, is_sw: bool = False) -> str:
    details = order.details if isinstance(order.details, dict) else {}
    ref = str(details.get("public_reference") or public_reference_for(order.id))
    token = str(details.get("tracking_token") or "")
    if not token:
        return ""
    url = tracking_page_url(ref, token)
    if is_sw:
        return f"Fuatilia uwasilishaji hapa: {url}"
    return f"Track your courier here: {url}"


def _timeline_steps(fulfillment: str) -> list[dict[str, Any]]:
    status = normalize_fulfillment_status(fulfillment)
    active_index_map = {
        BRIEF_RECEIVED: 0,
        AWAITING_CONFIRMATION: 0,
        PENDING_PAYMENT: 0,
        SOURCING_APPROVED: 1,
        RUNNER_ASSIGNED: 1,
        SOURCING_IN_PROGRESS: 1,
        QUALITY_CHECK: 2,
        PACKING: 3,
        READY_FOR_DISPATCH: 4,
        OUT_FOR_DELIVERY: 5,
        DELIVERED: 6,
    }
    active_index = active_index_map.get(status, 0)

    steps: list[dict[str, Any]] = []
    for idx, (step_id, label) in enumerate(_TIMELINE_LABELS):
        if idx < active_index:
            step_status = "complete"
        elif idx == active_index and active_index < len(_TIMELINE_LABELS):
            step_status = "active"
        else:
            step_status = "upcoming"
        if status == DELIVERED:
            step_status = "complete"
        if status in {ISSUE_PENDING, CANCELLED}:
            if idx < 1:
                step_status = "complete"
            elif idx == 1:
                step_status = "active"
            else:
                step_status = "upcoming"
        steps.append({"id": step_id, "label": label, "status": step_status})
    return steps


def _display_lines(details: dict[str, Any]) -> list[dict[str, Any]]:
    product_id = str(details.get("product_id") or "").strip()
    if product_id and product_id in _COLLECTION_BY_ID:
        row = _COLLECTION_BY_ID[product_id]
        qty = 1
        items = details.get("items") or []
        if isinstance(items, list) and items:
            qty = max(1, int((items[0] or {}).get("qty") or 1))
        usd = float(details.get("amount_usd") or row["price_usd"]) * qty
        return [{"name": row["name"], "quantity": qty, "price_usd": round(usd, 2)}]

    lines: list[dict[str, Any]] = []
    for raw in details.get("items") or []:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name") or raw.get("sku_or_name") or "Item").strip()
        qty = max(1, int(raw.get("qty") or raw.get("quantity") or 1))
        unit = float(raw.get("unit_price") or 0)
        if unit <= 0 and details.get("amount_usd"):
            continue
        price_usd = round(unit * qty / 129.0, 2) if unit > 500 else round(unit * qty, 2)
        if details.get("payment_currency", "").upper() == "USD" and unit > 0 and unit < 500:
            price_usd = round(unit * qty, 2)
        lines.append({"name": name, "quantity": qty, "price_usd": price_usd})
    return lines


def build_public_order_payload(order: Order) -> dict[str, Any]:
    details = order.details if isinstance(order.details, dict) else {}
    fulfillment = normalize_fulfillment_status(details.get("fulfillment_status"))
    ref = str(details.get("public_reference") or public_reference_for(order.id))

    pay_cur = str(details.get("payment_currency") or order.currency or "KES").upper()
    amount_usd = details.get("amount_usd")
    if amount_usd is None and pay_cur == "USD":
        amount_usd = round(float(order.amount or 0), 2)
    total_usd = round(float(amount_usd), 2) if amount_usd is not None else None
    total_kes = int(float(order.amount or 0)) if pay_cur == "KES" else int(round(float(order.amount or 0)))

    lines = _display_lines(details)
    if total_usd is None and lines:
        total_usd = round(sum(line["price_usd"] for line in lines), 2)

    created = order.created_at or datetime.now(timezone.utc)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    placed_at = f"{created.day} {created.strftime('%B %Y')} · {created.strftime('%H:%M')} UTC"

    destination = (
        str(details.get("delivery_location") or "").strip()
        or str(details.get("delivery_notes") or "").strip()
        or "Delivery address on file with concierge"
    )
    delivery_window = str(details.get("delivery_window") or "").strip()
    if not delivery_window and details.get("departure_time_iso"):
        delivery_window = f"JKIA · {details['departure_time_iso']}"
    if not delivery_window and order.appointment_time:
        appt = order.appointment_time
        if appt.tzinfo is None:
            appt = appt.replace(tzinfo=timezone.utc)
        delivery_window = f"{appt.day} {appt.strftime('%B')} · {appt.strftime('%H:%M')} UTC"

    timeline = _timeline_steps(fulfillment)
    for step in timeline:
        if step["id"] == "delivery" and step["status"] == "active":
            courier = details.get("courier_note") or details.get("courier")
            if courier:
                step["courier_note"] = str(courier)

    issue_type = str(details.get("issue_type") or "").strip()
    issue_status = str(details.get("issue_status") or "").strip()
    issue_note = str(details.get("issue_note") or "").strip()

    return {
        "reference": ref,
        "placed_at": placed_at,
        "destination": destination,
        "delivery_window": delivery_window or "Window confirmed by concierge",
        "lines": lines,
        "total_usd": total_usd or 0.0,
        "total_kes": total_kes,
        "payment_status": order.payment_status.value,
        "fulfillment_status": fulfillment,
        "timeline": timeline,
        "issue_type": issue_type or None,
        "issue_status": issue_status or None,
        "issue_note": issue_note or None,
    }


async def fetch_public_order(
    db: AsyncSession,
    *,
    public_reference: str,
    token: str,
) -> Order | None:
    """Return the order when reference + token match a Hazina Nomads row."""
    from app.services.ops_automation import find_order_by_public_reference

    ref = (public_reference or "").strip()
    tok = (token or "").strip()
    if not ref or not tok:
        return None

    order = await find_order_by_public_reference(db, ref)
    if order is None:
        return None

    details = order.details if isinstance(order.details, dict) else {}
    stored = str(details.get("tracking_token") or "")
    if not stored or not secrets.compare_digest(stored, tok):
        return None

    return order
