"""Public, token-gated order tracking for the Hazina Nomads portal."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.core.rate_limit import limiter
from app.db.session import SessionLocal
from app.services.order_tracking import build_public_order_payload, fetch_public_order

router = APIRouter(prefix="/api/public/orders", tags=["public-orders"])


class OrderLineOut(BaseModel):
    name: str
    quantity: int
    price_usd: float


class TimelineStepOut(BaseModel):
    id: str
    label: str
    status: str
    courier_note: str | None = None


class PublicOrderOut(BaseModel):
    reference: str
    placed_at: str
    destination: str
    delivery_window: str
    lines: list[OrderLineOut]
    total_usd: float
    total_kes: int
    payment_status: str
    fulfillment_status: str
    timeline: list[TimelineStepOut]


@router.get("/{order_id}", response_model=PublicOrderOut)
@limiter.limit("60/minute")
async def get_public_order(
    request: Request,
    order_id: str,
    token: str = Query(..., min_length=8, max_length=64),
) -> PublicOrderOut:
    """Return order tracking payload when ``order_id`` + ``token`` match."""
    _ = request
    ref = order_id.strip()
    async with SessionLocal() as db:
        order = await fetch_public_order(db, public_reference=ref, token=token.strip())
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        payload = build_public_order_payload(order)
    return PublicOrderOut(**payload)
