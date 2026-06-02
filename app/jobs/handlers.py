"""Built-in durable job handlers."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.event_bus import EVT_BROADCAST_PROGRESS, EVT_PAYMENT_COMPLETED, publish
from app.core.logging import get_logger
from app.db.models import (
    AuditEvent,
    Broadcast,
    BroadcastStatus,
    Customer,
    Order,
    PaymentStatus,
)
from app.db.session import SessionLocal
from app.jobs.runner import JobSnapshot, enqueue_job, job_handler

log = get_logger("jobs.handlers")


@job_handler("whatsapp.inbound")
async def run_whatsapp_inbound(job: JobSnapshot) -> None:
    """Process a Meta WhatsApp webhook payload off the HTTP request thread."""
    body = job.payload.get("payload") if isinstance(job.payload, dict) else None
    if not isinstance(body, dict):
        log.warning("wa_inbound_job_bad_payload", job_id=str(job.id))
        return
    from app.api.whatsapp import process_whatsapp_payload

    await process_whatsapp_payload(body)


async def _publish_broadcast_progress(bc: Broadcast) -> None:
    try:
        await publish(
            EVT_BROADCAST_PROGRESS,
            target=str(bc.id),
            payload={
                "broadcast_id": str(bc.id),
                "business_id": str(bc.business_id),
                "sent": bc.sent_count,
                "failed": bc.failed_count,
                "total": bc.recipients_total,
                "status": bc.status.value,
            },
        )
    except Exception as exc:  # pragma: no cover
        log.warning("broadcast_progress_publish_failed", broadcast_id=str(bc.id), error=str(exc))


@job_handler("broadcast.send")
async def run_broadcast_send(job: JobSnapshot) -> None:
    payload = job.payload
    bc_id = uuid.UUID(str(payload["broadcast_id"]))
    phones = [str(p) for p in payload.get("phones") or []]

    from app.channels import whatsapp as wa_channel
    from app.integrations.whatsapp_client import send_template

    async with SessionLocal() as db:
        bc = (await db.execute(
            select(Broadcast).where(Broadcast.id == bc_id)
        )).scalar_one_or_none()
        if bc is None:
            return
        if bc.status == BroadcastStatus.cancelled:
            bc.finished_at = bc.finished_at or datetime.now(timezone.utc)
            await db.commit()
            return
        if bc.status not in (BroadcastStatus.sending, BroadcastStatus.failed):
            log.info("broadcast_job_ignored", broadcast_id=str(bc.id), status=bc.status.value)
            return

        bc.status = BroadcastStatus.sending
        bc.started_at = bc.started_at or datetime.now(timezone.utc)
        await db.commit()

        sent = int(bc.sent_count or 0)
        failed = int(bc.failed_count or 0)
        start_index = min(sent + failed, len(phones))

        for phone in phones[start_index:]:
            await db.refresh(bc)
            if bc.status == BroadcastStatus.cancelled:
                bc.finished_at = datetime.now(timezone.utc)
                await db.commit()
                await _publish_broadcast_progress(bc)
                return
            try:
                if bc.template_name:
                    await send_template(phone, bc.template_name, lang=bc.language)
                else:
                    res = await wa_channel.send_text(phone, bc.body or "")
                    if res.get("ok") is False:
                        raise RuntimeError(str(res.get("error") or "send_failed"))
                sent += 1
            except Exception as e:  # noqa: BLE001
                log.warning("broadcast_send_failed", phone=phone[-4:], error=str(e))
                failed += 1

            bc.sent_count = sent
            bc.failed_count = failed
            await db.commit()
            if (sent + failed) % 10 == 0:
                await _publish_broadcast_progress(bc)

        bc.sent_count = sent
        bc.failed_count = failed
        if bc.status != BroadcastStatus.cancelled:
            bc.status = BroadcastStatus.done if not failed or sent > 0 else BroadcastStatus.failed
        bc.finished_at = datetime.now(timezone.utc)
        await db.commit()
        await _publish_broadcast_progress(bc)


@job_handler("order.ready")
async def run_order_ready(job: JobSnapshot) -> None:
    payload = job.payload
    order_id = uuid.UUID(str(payload["order_id"]))
    business_name = str(payload.get("business_name") or "the cafe")
    items_summary = str(payload.get("items_summary") or "your order")

    async with SessionLocal() as db:
        order = await db.get(Order, order_id)
        if order is None:
            return
        if order.payment_status != PaymentStatus.paid:
            log.info(
                "ready_notify_skipped_unpaid_order",
                order=str(order.id),
                payment_status=order.payment_status.value,
            )
            return
        customer = await db.get(Customer, order.customer_id)
        if customer is None:
            return
        details = dict(order.details or {})
        details["fulfillment_status"] = "ready"
        details["ready_at"] = datetime.now(timezone.utc).isoformat()
        order.details = details
        await db.commit()

    body = (
        f"Heads-up — your order ({items_summary}) is ready for pickup at "
        f"{business_name}. Show your receipt at the counter. Karibu!"
    )
    from app.channels import whatsapp as wa_channel
    res = await wa_channel.send_text(customer.phone_number, body)
    if res.get("ok") is False:
        raise RuntimeError(str(res.get("error") or "send_failed"))
    log.info("ready_notify_sent", order=str(order_id), ok=res.get("ok", True))


@job_handler("payment.simulator_confirm")
async def run_simulated_payment_confirm(job: JobSnapshot) -> None:
    checkout_id = str(job.payload["checkout_id"])
    async with SessionLocal() as db:
        order = (
            await db.execute(select(Order).where(Order.mpesa_checkout_id == checkout_id))
        ).scalar_one_or_none()
        if order is None:
            return
        if order.payment_status == PaymentStatus.paid:
            return
        from app.api.payments import _schedule_ready_after_payment, _transition_payment_status
        transitioned = await _transition_payment_status(
            db,
            order,
            from_statuses={PaymentStatus.pending, PaymentStatus.failed, PaymentStatus.cancelled, PaymentStatus.timeout},
            to_status=PaymentStatus.paid,
            receipt=f"SIM-{checkout_id}",
        )
        if not transitioned:
            return
        db.add(AuditEvent(
            actor="sim",
            action="callback_paid",
            target=str(order.id),
            data={"simulated": True},
        ))
        await _schedule_ready_after_payment(db, order, order.business_id)
        customer = await db.get(Customer, order.customer_id)
        await db.commit()

    try:
        await publish(EVT_PAYMENT_COMPLETED, target=str(order.id), payload={
            "order_id": str(order.id),
            "business_id": str(order.business_id) if order.business_id else None,
            "amount": float(order.amount or 0),
            "receipt": order.mpesa_receipt or "",
            "provider": "simulator",
        })
    except Exception as exc:  # pragma: no cover
        log.warning("simulated_payment_publish_failed", order=str(order.id), error=str(exc))
    if customer is not None:
        from app.integrations import whatsapp_client
        await whatsapp_client.send_text(
            customer.phone_number,
            f"Simulated: payment of KES {float(order.amount or 0):.0f} received. Asante!",
        )


@job_handler("payment.unpaid_followup")
async def run_unpaid_payment_followup(job: JobSnapshot) -> None:
    order_id = uuid.UUID(str(job.payload["order_id"]))
    async with SessionLocal() as db:
        order = await db.get(Order, order_id)
        if order is None or order.payment_status != PaymentStatus.pending:
            return
        customer = await db.get(Customer, order.customer_id)
        language = customer.preferred_language if customer is not None else None

    if customer is not None:
        from app.integrations import whatsapp_client
        is_sw = (language or "").lower().startswith(("sw", "she"))
        body = (
            "Bado hatujaona malipo ya oda yako. Ikiwa STK iliisha muda, andika 'resend STK'. Ikiwa hutaki kuendelea, andika 'cancel payment'."
            if is_sw else
            "I have not seen payment for your order yet. If the STK expired, type 'resend STK'. If you do not want to continue, type 'cancel payment'."
        )
        await whatsapp_client.send_text(
            customer.phone_number,
            body,
        )
    async with SessionLocal() as db:
        order = await db.get(Order, order_id)
        if order is not None and order.payment_status == PaymentStatus.pending:
            from app.api.payments import _transition_payment_status
            await _transition_payment_status(
                db,
                order,
                from_statuses={PaymentStatus.pending},
                to_status=PaymentStatus.timeout,
            )
            await db.commit()


@job_handler("payment.intasend_poll")
async def run_intasend_payment_poll(job: JobSnapshot) -> None:
    checkout_id = str(job.payload["checkout_id"])
    order_id = uuid.UUID(str(job.payload["order_id"]))
    poll_count = int(job.payload.get("poll_count") or 1)

    from app.api.payments import _apply_provider_payment_result, _notify_order_customer
    from app.integrations.payments.intasend import IntaSendAdapter

    parsed = await IntaSendAdapter().fetch_status(checkout_id)
    if parsed.status == "pending":
        async with SessionLocal() as db:
            order = await db.get(Order, order_id)
            if order is None or order.payment_status != PaymentStatus.pending:
                log.info(
                    "intasend_poll_stopped_terminal_order",
                    order=str(order_id),
                    checkout_id=checkout_id,
                    payment_status=order.payment_status.value if order is not None else "missing",
                )
                return
        if poll_count >= 12:
            log.info("intasend_poll_gave_up_pending", order=str(order_id), checkout_id=checkout_id)
            return
        async with SessionLocal() as db:
            await enqueue_job(
                db,
                kind="payment.intasend_poll",
                business_id=job.business_id,
                run_at=datetime.now(timezone.utc) + timedelta(seconds=20),
                max_attempts=1,
                ttl_seconds=10 * 60,
                payload={
                    "order_id": str(order_id),
                    "checkout_id": checkout_id,
                    "poll_count": poll_count + 1,
                },
            )
            await db.commit()
        return

    async with SessionLocal() as db:
        order = await db.get(Order, order_id)
        if order is None:
            return
        handled, msg, _ = await _apply_provider_payment_result(
            db,
            order=order,
            provider="intasend",
            status=parsed.status,
            raw=parsed.raw,
        )
    if handled and msg:
        await _notify_order_customer(order, msg)
