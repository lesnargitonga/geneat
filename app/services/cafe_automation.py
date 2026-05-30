"""Deterministic cafe ordering helpers.

These helpers keep fast-path channel automation and LLM tools on the same
order/payment behavior: normalize cart items, dedupe pending orders, create
orders, and trigger payment prompts.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.quick_replies import MenuOrderMatch, match_order_item_from_chunks
from app.core.exceptions import RateLimited, UpstreamError
from app.db.models import Conversation, Order, PaymentStatus
from app.integrations.payments import get_payment_service


@dataclass(frozen=True)
class CafeOrderItem:
    sku_or_name: str
    qty: int = 1
    unit_price: float = 0.0
    modifiers: list[str] = field(default_factory=list)

    @property
    def line_total(self) -> float:
        return round(float(self.unit_price) * int(self.qty or 1), 2)

    def to_order_dict(self) -> dict[str, object]:
        row: dict[str, object] = {
            "sku_or_name": self.sku_or_name,
            "qty": int(self.qty or 1),
            "unit_price": round(float(self.unit_price or 0), 2),
        }
        if self.modifiers:
            row["modifiers"] = list(self.modifiers)
        return row


@dataclass(frozen=True)
class PaymentAttempt:
    ok: bool
    message: str
    checkout_id: str | None = None
    provider: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class CafeOrderAutomationResult:
    order: Order
    created: bool
    payment: PaymentAttempt | None = None

    @property
    def amount_kes(self) -> int:
        return int(float(self.order.amount or 0))


_SPLIT_RE = re.compile(r"\s*(?:,|&|\+|\band\b|\bna\b)\s+", re.IGNORECASE)
_ORDER_PREFIX_RE = re.compile(
    r"\b(?:i want|i need|i'?ll have|i'?d like|i would like|can i have|"
    r"can i get|may i have|may i get|let me get|lemme get|order|sort|get me|"
    r"nipe|nataka|leta)\b",
    re.IGNORECASE,
)
_MODIFIER_PRICE_RULES = (
    (re.compile(r"\b(oat|almond)\b", re.IGNORECASE), 40, "{milk} milk"),
    (re.compile(r"\b(?:add )?(poached )?egg\b", re.IGNORECASE), 80, "poached egg"),
)


def normalize_items(items: Iterable[CafeOrderItem]) -> list[dict[str, object]]:
    normalised: list[dict[str, object]] = []
    for item in items:
        normalised.append(
            {
                "name": item.sku_or_name.strip().lower(),
                "qty": int(item.qty or 1),
                "unit_price": round(float(item.unit_price or 0), 2),
                "modifiers": sorted(m.lower() for m in item.modifiers),
            }
        )
    return sorted(
        normalised,
        key=lambda row: (
            str(row["name"]),
            int(row["qty"]),
            float(row["unit_price"]),
            ",".join(row["modifiers"]),
        ),
    )


def stored_items_match(details: object, items: Sequence[CafeOrderItem]) -> bool:
    if not isinstance(details, dict):
        return False
    stored = details.get("items")
    if not isinstance(stored, list):
        return False
    parsed: list[CafeOrderItem] = []
    try:
        for row in stored:
            if not isinstance(row, dict):
                continue
            parsed.append(
                CafeOrderItem(
                    sku_or_name=str(row.get("sku_or_name") or row.get("name") or ""),
                    qty=int(row.get("qty") or 1),
                    unit_price=float(row.get("unit_price") or 0),
                    modifiers=[str(m) for m in (row.get("modifiers") or [])],
                )
            )
    except Exception:
        return False
    return normalize_items(parsed) == normalize_items(items)


def order_items_summary(items: Sequence[CafeOrderItem]) -> str:
    pieces = []
    for item in items:
        name = item.sku_or_name
        if item.modifiers:
            name = f"{name} ({', '.join(item.modifiers)})"
        pieces.append(f"{int(item.qty or 1)} x {name}")
    return ", ".join(pieces) or "your order"


def order_items_from_details(details: object) -> list[CafeOrderItem]:
    if not isinstance(details, dict):
        return []
    rows = details.get("items")
    if not isinstance(rows, list):
        return []
    items: list[CafeOrderItem] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            items.append(
                CafeOrderItem(
                    sku_or_name=str(row.get("sku_or_name") or row.get("name") or "item").strip() or "item",
                    qty=int(row.get("qty") or 1),
                    unit_price=float(row.get("unit_price") or 0),
                    modifiers=[str(m) for m in (row.get("modifiers") or [])],
                )
            )
        except Exception:
            continue
    return items


def _clean_order_segment(text: str) -> str:
    cleaned = _ORDER_PREFIX_RE.sub(" ", text or "")
    cleaned = re.sub(r"\b(?:my name is|name is|i am|i'm|naitwa|jina langu ni)\b.*$", " ", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip(" .,!?:;")


def _apply_modifiers(segment: str, match: MenuOrderMatch) -> CafeOrderItem:
    unit_price = float(match.unit_price)
    modifiers: list[str] = []
    segment_l = segment.lower()
    for pattern, add_price, label_template in _MODIFIER_PRICE_RULES:
        found = pattern.search(segment_l)
        if not found:
            continue
        if "egg" in label_template and "avocado" not in match.label.lower():
            continue
        if "milk" in label_template and not any(
            token in match.label.lower()
            for token in ("latte", "flat white", "cappuccino", "mocha", "coffee", "macchiato", "cortado")
        ):
            continue
        label = label_template.format(milk=found.group(1).lower())
        if label not in modifiers:
            modifiers.append(label)
            unit_price += add_price
    return CafeOrderItem(
        sku_or_name=match.label,
        qty=match.quantity,
        unit_price=unit_price,
        modifiers=modifiers,
    )


def parse_cafe_order_items(text: str, chunks: Sequence) -> list[CafeOrderItem]:
    """Parse one or more menu items from a customer order phrase."""
    candidate = _clean_order_segment(text)
    if not candidate:
        return []
    parts = [p.strip() for p in _SPLIT_RE.split(candidate) if p.strip()]
    if len(parts) <= 1:
        parts = [candidate]

    items: list[CafeOrderItem] = []
    seen: set[tuple[str, int, float, tuple[str, ...]]] = set()
    for part in parts[:6]:
        match = match_order_item_from_chunks(part, chunks)
        if match is None and part != candidate:
            # Some modifiers make short split phrases ambiguous. Retry with
            # the whole utterance before giving up on that line.
            match = match_order_item_from_chunks(candidate, chunks)
        if match is None:
            continue
        item = _apply_modifiers(part if part != candidate else candidate, match)
        key = (
            item.sku_or_name.lower(),
            item.qty,
            item.unit_price,
            tuple(sorted(item.modifiers)),
        )
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


async def create_pending_order(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    conversation_id: uuid.UUID | None,
    business_id: uuid.UUID | None,
    items: Sequence[CafeOrderItem],
    delivery_notes: str | None = None,
    fast_path: str | None = None,
    appointment_time: datetime | None = None,
) -> tuple[Order, bool]:
    tenant_id = business_id
    conv = None
    if conversation_id is not None:
        conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
        if conv is not None:
            tenant_id = business_id or conv.business_id

    amount = round(sum(item.line_total for item in items), 2)
    pending = (await db.execute(
        select(Order)
        .where(Order.conversation_id == conversation_id if conversation_id is not None else Order.conversation_id.is_(None))
        .where(Order.customer_id == customer_id)
        .where(Order.payment_status == PaymentStatus.pending)
        .where(Order.business_id == tenant_id if tenant_id is not None else Order.business_id.is_(None))
        .order_by(Order.created_at.desc())
        .limit(5)
    )).scalars().all()
    for order in pending:
        if abs(float(order.amount or 0) - amount) <= 0.01 and stored_items_match(order.details, items):
            return order, False

    details: dict[str, object] = {
        "items": [item.to_order_dict() for item in items],
        "delivery_notes": delivery_notes,
        "fulfillment_status": "pending_payment",
    }
    if fast_path:
        details["fast_path"] = fast_path

    order = Order(
        customer_id=customer_id,
        business_id=tenant_id,
        conversation_id=conversation_id,
        details=details,
        amount=amount,
        payment_status=PaymentStatus.pending,
        appointment_time=appointment_time,
    )
    db.add(order)
    await db.flush()
    return order, True


async def request_order_payment(
    db: AsyncSession,
    *,
    order: Order,
    msisdn: str,
    business_id: uuid.UUID | None,
) -> PaymentAttempt:
    from app.jobs.runner import enqueue_job

    try:
        svc = get_payment_service()
        result = await svc.request_payment(
            msisdn=msisdn,
            amount=float(order.amount or 0),
            reference=str(order.id)[:8],
            description="Order Payment",
        )
        order.mpesa_checkout_id = result.reference
        details = dict(order.details or {})
        details["fulfillment_status"] = "pending_payment"
        order.details = details
        await db.flush()
        if svc.name == "intasend":
            await enqueue_job(
                db,
                kind="payment.intasend_poll",
                business_id=business_id,
                run_at=datetime.now(timezone.utc) + timedelta(seconds=20),
                max_attempts=1,
                ttl_seconds=10 * 60,
                payload={
                    "order_id": str(order.id),
                    "checkout_id": result.reference,
                    "poll_count": 1,
                },
            )
        message = f"STK push sent to {msisdn} via {svc.name}."
        if result.redirect_url:
            message += f" Pay link: {result.redirect_url}"
        return PaymentAttempt(
            ok=True,
            message=message,
            checkout_id=result.reference,
            provider=svc.name,
        )
    except RateLimited as exc:
        return PaymentAttempt(ok=False, message=exc.message, error="rate_limited")
    except UpstreamError as exc:
        return PaymentAttempt(ok=False, message=exc.message, error="upstream")
    except Exception as exc:  # noqa: BLE001
        return PaymentAttempt(ok=False, message=str(exc), error="unexpected")


async def create_order_and_request_payment(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    msisdn: str,
    items: Sequence[CafeOrderItem],
    delivery_notes: str | None = None,
    fast_path: str | None = None,
) -> CafeOrderAutomationResult:
    order, created = await create_pending_order(
        db,
        customer_id=customer_id,
        conversation_id=conversation_id,
        business_id=business_id,
        items=items,
        delivery_notes=delivery_notes,
        fast_path=fast_path,
    )
    if order.mpesa_checkout_id and not created:
        return CafeOrderAutomationResult(order=order, created=False, payment=None)
    payment = await request_order_payment(
        db,
        order=order,
        msisdn=msisdn,
        business_id=business_id,
    )
    return CafeOrderAutomationResult(order=order, created=created, payment=payment)
