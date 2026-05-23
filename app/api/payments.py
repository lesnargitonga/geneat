"""Payments API: STK push trigger + Daraja callback handler + unpaid follow-up.

- POST /payments/stk-push       (internal/admin)
- POST /payments/callback       (Safaricom → us)

The 5-minute unpaid follow-up is persisted in ``background_jobs`` so it
survives request completion and API worker restarts.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.core.config import get_settings
from app.core.exceptions import RateLimited, UpstreamError
from app.core.logging import get_logger
from app.core.redis_client import claim_idempotency
from app.core.security import normalize_msisdn, verify_mpesa_source_ip
from app.db.models import AuditEvent, Business, Conversation, Customer, Order, PaymentStatus
from app.db.session import SessionLocal
from app.integrations import mpesa_client
from app.integrations import whatsapp_client
from app.jobs.runner import enqueue_job

log = get_logger("payments")
settings = get_settings()
router = APIRouter(prefix="/payments", tags=["payments"])


class STKIn(BaseModel):
    order_id: str
    msisdn: str
    amount: float = Field(..., gt=0)
    reference: str = Field("ORDER", max_length=12)


class STKOut(BaseModel):
    checkout_request_id: str


async def _business_id_for_order(db: AsyncSession, order: Order) -> uuid.UUID | None:
    """Return the tenant for an order and opportunistically backfill it."""
    if order.business_id is not None:
        return order.business_id
    if order.conversation_id is None:
        return None
    bid = (await db.execute(
        select(Conversation.business_id).where(Conversation.id == order.conversation_id)
    )).scalar_one_or_none()
    if bid is not None:
        order.business_id = bid
    return bid


async def _publish_paid_event(order: Order, business_id: uuid.UUID | None, provider: str) -> None:
    try:
        from app.core.event_bus import EVT_PAYMENT_COMPLETED, publish
        await publish(EVT_PAYMENT_COMPLETED, target=str(order.id), payload={
            "order_id": str(order.id),
            "business_id": str(business_id) if business_id else None,
            "amount": float(order.amount or 0),
            "receipt": order.mpesa_receipt or "",
            "provider": provider,
        })
    except Exception as e:  # pragma: no cover
        log.warning("event_bus_payment_publish_failed", error=str(e))


def _money(amount: float | int | str | None) -> str:
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        value = 0.0
    if value.is_integer():
        return f"KES {value:.0f}"
    return f"KES {value:.2f}"


def _order_items_summary(order: Order) -> str:
    details = order.details if isinstance(order.details, dict) else {}
    items = details.get("items") if isinstance(details.get("items"), list) else []
    lines: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("sku_or_name") or item.get("name") or "Item").strip()
        try:
            qty = int(item.get("qty") or 1)
        except (TypeError, ValueError):
            qty = 1
        unit_price = item.get("unit_price")
        if unit_price is None:
            lines.append(f"{qty} x {name}")
        else:
            lines.append(f"{qty} x {name} @ {_money(unit_price)}")
    return "\n".join(lines) if lines else "your order"


def _receipt_message(
    order: Order,
    *,
    provider: str,
    receipt: str,
    amount_paid: float | int | str | None = None,
    business_name: str | None = None,
) -> str:
    provider_label = {
        "daraja": "M-Pesa",
        "intasend": "IntaSend",
        "paystack": "Paystack",
        "stripe": "Stripe",
        "simulator": "Simulator",
    }.get(provider, provider.title())
    short_order = str(order.id).split("-", 1)[0]
    paid = amount_paid if amount_paid is not None else order.amount
    header = f"{business_name} receipt" if business_name else "Payment receipt"
    return (
        f"{header}\n"
        f"Order: {short_order}\n"
        f"Items:\n{_order_items_summary(order)}\n"
        f"Paid: {_money(paid)} via {provider_label}\n"
        f"Reference: {receipt}\n"
        "Asante! Show this message at pickup."
    )


async def _business_name(db: AsyncSession, business_id: uuid.UUID | None) -> str | None:
    if business_id is None:
        return None
    return (await db.execute(
        select(Business.name).where(Business.id == business_id)
    )).scalar_one_or_none()


def _is_swahili_language(language: str | None) -> bool:
    return (language or "").lower().startswith(("sw", "she"))


async def _customer_language(db: AsyncSession, order: Order) -> str | None:
    customer = await db.get(Customer, order.customer_id)
    return customer.preferred_language if customer is not None else None


def _payment_failed_message(*, language: str | None, cancelled: bool = False) -> str:
    is_sw = _is_swahili_language(language)
    if cancelled:
        return (
            "Umesitisha malipo, kwa hivyo oda haijathibitishwa. "
            "Ukitaka nijaribu tena, niambie nitume STK nyingine."
            if is_sw else
            "Payment was cancelled, so the order is not confirmed yet. "
            "If you want to try again, tell me to resend the STK prompt."
        )
    return (
        "Malipo hayajapita, kwa hivyo oda haijathibitishwa bado. "
        "Ukitaka nijaribu tena, niambie nitume STK nyingine."
        if is_sw else
        "Payment did not go through, so the order is not confirmed yet. "
        "If you want to try again, tell me to resend the STK prompt."
    )


async def _schedule_ready_after_payment(
    db: AsyncSession,
    order: Order,
    business_id: uuid.UUID | None,
) -> None:
    if business_id is None:
        return
    biz = await db.get(Business, business_id)
    prep_min = 8
    business_name = "the cafe"
    if biz is not None:
        business_name = biz.name
        try:
            prep_min = int((biz.profile or {}).get("avg_prep_minutes", 8) or 8)
        except Exception:
            prep_min = 8
    try:
        from app.jobs.order_ready_notifier import schedule_ready_notification
        await schedule_ready_notification(
            db,
            business_id=business_id,
            business_name=business_name,
            items_summary=_order_items_summary(order).replace("\n", ", "),
            delay_seconds=prep_min * 60,
            order_id=str(order.id),
        )
    except Exception as exc:  # pragma: no cover
        log.warning("ready_notify_schedule_after_payment_failed", error=str(exc), order=str(order.id))


async def _notify_order_customer(order: Order, msg: str) -> None:
    try:
        async with SessionLocal() as db:
            cust = (await db.execute(select(Customer).where(Customer.id == order.customer_id))).scalar_one()
            await whatsapp_client.send_text(cust.phone_number, msg)
    except Exception as e:  # pragma: no cover
        log.warning("payment_notify_failed", error=str(e))


async def _apply_provider_payment_result(
    db: AsyncSession,
    *,
    order: Order,
    provider: str,
    status: str,
    raw: dict | None = None,
) -> tuple[bool, str | None, uuid.UUID | None]:
    business_id = await _business_id_for_order(db, order)
    if order.payment_status == PaymentStatus.paid:
        log.info(
            "payment_callback_ignored_already_paid",
            provider=provider,
            ref=order.mpesa_checkout_id,
            status=status,
        )
        return False, None, business_id
    if order.payment_status in {PaymentStatus.cancelled, PaymentStatus.failed, PaymentStatus.timeout} and status != "paid":
        log.info(
            "payment_callback_ignored_terminal_unpaid_order",
            provider=provider,
            ref=order.mpesa_checkout_id,
            current_status=order.payment_status.value,
            provider_status=status,
        )
        return False, None, business_id

    if status == "paid":
        order.payment_status = PaymentStatus.paid
        receipt = str(
            (raw or {}).get("mpesa_reference")
            or (raw or {}).get("api_ref")
            or (raw or {}).get("reference")
            or order.mpesa_checkout_id
            or ""
        )
        order.mpesa_receipt = receipt
        msg = _receipt_message(
            order,
            provider=provider,
            receipt=receipt,
            amount_paid=order.amount,
            business_name=await _business_name(db, business_id),
        )
        await _schedule_ready_after_payment(db, order, business_id)
    elif status == "failed":
        order.payment_status = PaymentStatus.failed
        msg = _payment_failed_message(language=await _customer_language(db, order))
    else:
        return False, None, business_id

    db.add(AuditEvent(
        actor=provider,
        action=f"callback_{order.payment_status.value}",
        target=str(order.id),
        data={"state": status},
    ))
    await db.commit()
    if order.payment_status == PaymentStatus.paid:
        await _publish_paid_event(order, business_id, provider)
    return True, msg, business_id


@router.post("/stk-push", response_model=STKOut)
async def stk_push_endpoint(payload: STKIn, db: AsyncSession = Depends(db_session)):
    msisdn = normalize_msisdn(payload.msisdn)
    order = (await db.execute(select(Order).where(Order.id == uuid.UUID(payload.order_id)))).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "order not found")
    try:
        result = await mpesa_client.stk_push(
            msisdn=msisdn, amount=payload.amount, reference=payload.reference,
            description="Order Payment",
        )
    except RateLimited as e:
        raise HTTPException(429, e.message)
    except UpstreamError as e:
        raise HTTPException(502, e.message)

    checkout_id = result["CheckoutRequestID"]
    business_id = await _business_id_for_order(db, order)
    order.mpesa_checkout_id = checkout_id
    order.payment_status = PaymentStatus.pending
    await enqueue_job(
        db,
        kind="payment.unpaid_followup",
        business_id=business_id,
        run_at=datetime.now(timezone.utc) + timedelta(seconds=300),
        max_attempts=5,
        payload={"order_id": str(order.id), "checkout_id": checkout_id},
    )
    await db.commit()
    return STKOut(checkout_request_id=checkout_id)


@router.post("/callback")
async def mpesa_callback(request: Request):
    """Daraja → us. Verified by source IP + idempotency on CheckoutRequestID."""
    client_ip = request.client.host if request.client else ""
    if settings.mpesa_env == "production" and not verify_mpesa_source_ip(client_ip):
        log.warning("mpesa_callback_bad_ip", ip=client_ip)
        raise HTTPException(401, "bad source ip")

    payload = await request.json()
    stk = (payload.get("Body") or {}).get("stkCallback") or {}
    checkout_id = stk.get("CheckoutRequestID")
    result_code = stk.get("ResultCode")
    if not checkout_id:
        raise HTTPException(400, "missing CheckoutRequestID")

    # Idempotency: Safaricom occasionally retries
    fresh = await claim_idempotency(f"mpesa:cb:{checkout_id}", ttl_seconds=7 * 86_400)
    if not fresh:
        log.info("mpesa_callback_duplicate", checkout_id=checkout_id)
        return {"ResultCode": 0, "ResultDesc": "duplicate ignored"}

    async with SessionLocal() as db:
        order = (await db.execute(select(Order).where(Order.mpesa_checkout_id == checkout_id))).scalar_one_or_none()
        if not order:
            log.warning("mpesa_callback_unknown_order", checkout_id=checkout_id)
            return {"ResultCode": 0, "ResultDesc": "unknown order ignored"}

        business_id = await _business_id_for_order(db, order)
        if order.payment_status == PaymentStatus.paid:
            log.info("mpesa_callback_duplicate_paid_order", checkout_id=checkout_id, order_id=str(order.id))
            return {"ResultCode": 0, "ResultDesc": "duplicate paid order ignored"}
        if order.payment_status in {
            PaymentStatus.cancelled,
            PaymentStatus.failed,
            PaymentStatus.timeout,
        } and result_code != 0:
            log.info(
                "mpesa_callback_ignored_terminal_unpaid_order",
                checkout_id=checkout_id,
                order_id=str(order.id),
                current_status=order.payment_status.value,
                result_code=result_code,
            )
            return {"ResultCode": 0, "ResultDesc": "terminal unpaid order ignored"}

        # Bind tenant scope for the rest of this turn: every log line emitted
        # from here carries the tenant id so cross-tenant bleed is traceable.
        from app.core.logging import business_id_ctx
        if business_id is not None:
            business_id_ctx.set(str(business_id))
        log.info("mpesa_callback_matched",
                 checkout_id=checkout_id, order_id=str(order.id),
                 business_id=str(business_id) if business_id else None)

        if result_code == 0:
            meta = {item["Name"]: item.get("Value") for item in (stk.get("CallbackMetadata") or {}).get("Item", [])}
            # Ledger validation — defend against spoofed callbacks even after
            # IP allowlist passes. Amount must match what we asked Daraja for,
            # and a receipt number must be present + not previously seen.
            cb_amount = float(meta.get("Amount") or 0)
            receipt = str(meta.get("MpesaReceiptNumber") or "").strip()
            expected = float(order.amount or 0)
            if not receipt:
                log.warning("mpesa_callback_no_receipt", checkout_id=checkout_id)
                return {"ResultCode": 0, "ResultDesc": "missing receipt"}
            if abs(cb_amount - expected) > 0.5:
                log.error("mpesa_callback_amount_mismatch",
                          checkout_id=checkout_id, expected=expected, got=cb_amount)
                db.add(AuditEvent(
                    actor="mpesa", action="callback_amount_mismatch",
                    target=str(order.id),
                    data={"expected": expected, "got": cb_amount, "ip": client_ip},
                ))
                await db.commit()
                return {"ResultCode": 0, "ResultDesc": "amount mismatch ignored"}
            # Receipt-level idempotency (Safaricom can replay with the same receipt)
            fresh_receipt = await claim_idempotency(
                f"mpesa:receipt:{receipt}", ttl_seconds=30 * 86_400,
            )
            if not fresh_receipt:
                log.info("mpesa_callback_duplicate_receipt", receipt=receipt)
                return {"ResultCode": 0, "ResultDesc": "duplicate receipt ignored"}

            order.payment_status = PaymentStatus.paid
            order.mpesa_receipt = receipt
            msg = _receipt_message(
                order,
                provider="daraja",
                receipt=receipt,
                amount_paid=cb_amount,
                business_name=await _business_name(db, business_id),
            )
            await _schedule_ready_after_payment(db, order, business_id)
        elif result_code == 1032:  # User cancelled
            order.payment_status = PaymentStatus.cancelled
            msg = _payment_failed_message(
                language=await _customer_language(db, order),
                cancelled=True,
            )
        else:
            order.payment_status = PaymentStatus.failed
            msg = _payment_failed_message(language=await _customer_language(db, order))

        db.add(AuditEvent(
            actor="mpesa", action=f"callback_{order.payment_status.value}",
            target=str(order.id), data={"result_code": result_code, "ip": client_ip},
        ))
        await db.commit()

        if order.payment_status == PaymentStatus.paid:
            await _publish_paid_event(order, business_id, "daraja")

    # Notify the customer over WhatsApp (best-effort).
    await _notify_order_customer(order, msg)

    return {"ResultCode": 0, "ResultDesc": "ok"}


# ── IntaSend callback (used when PAYMENT_PROVIDER=intasend) ──────────

@router.post("/intasend/callback")
async def intasend_callback(request: Request):
    """IntaSend webhook → confirm order on COMPLETE state.

    Verifies HMAC via the configured INTASEND_WEBHOOK_SECRET, then
    idempotently marks the matching order paid using `invoice_id`.
    """
    return await _generic_provider_callback(request, expected_provider="intasend")


@router.post("/paystack/callback")
async def paystack_callback(request: Request):
    """Paystack webhook → mark hosted-checkout orders paid/failed."""
    return await _generic_provider_callback(request, expected_provider="paystack")


@router.post("/stripe/callback")
async def stripe_callback(request: Request):
    """Stripe webhook → mark hosted-checkout orders paid/failed."""
    return await _generic_provider_callback(request, expected_provider="stripe")


async def _generic_provider_callback(request: Request, *, expected_provider: str) -> dict:
    from app.integrations.payments import get_payment_service
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    svc = get_payment_service()
    if svc.name != expected_provider:
        raise HTTPException(400, f"{expected_provider} not active payment provider")
    if not svc.verify_callback(headers=headers, raw_body=raw):
        log.warning("payment_callback_bad_signature", provider=expected_provider)
        raise HTTPException(401, "bad signature")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "invalid json")
    parsed = svc.parse_callback(payload)
    if not parsed.reference:
        raise HTTPException(400, "missing reference")
    if parsed.status == "pending":
        return {"ok": True, "pending": True}

    fresh = await claim_idempotency(
        f"{expected_provider}:cb:{parsed.reference}:{parsed.status}",
        ttl_seconds=7 * 86_400,
    )
    if not fresh:
        return {"ok": True, "duplicate": True}

    async with SessionLocal() as db:
        order = (await db.execute(
            select(Order).where(Order.mpesa_checkout_id == parsed.reference)
        )).scalar_one_or_none()
        if not order:
            log.warning("payment_callback_unknown_order", provider=expected_provider, ref=parsed.reference)
            return {"ok": True, "unknown": True}
        business_id = await _business_id_for_order(db, order)
        from app.core.logging import business_id_ctx
        if business_id is not None:
            business_id_ctx.set(str(business_id))
        log.info("payment_callback_matched",
                 provider=expected_provider,
                 ref=parsed.reference, order_id=str(order.id),
                 business_id=str(business_id) if business_id else None)
        handled, msg, _ = await _apply_provider_payment_result(
            db,
            order=order,
            provider=expected_provider,
            status=parsed.status,
            raw=parsed.raw,
        )
        if not handled:
            if parsed.status == "pending":
                return {"ok": True, "pending": True}
            return {"ok": True, "already_paid": order.payment_status == PaymentStatus.paid}
        await _notify_order_customer(order, msg or "")
    return {"ok": True}
