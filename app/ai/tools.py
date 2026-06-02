"""LangChain tools exposed to the agent.

Phase 2 ships *interfaces* and `dry_run=True` stubs for the integrations that
land in later phases (M-Pesa, calendar). The function bodies that DO have real
logic in Phase 2: `knowledge_lookup` and `escalate_to_human`.
"""
from __future__ import annotations

import time
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.rag import format_context, retrieve
from app.core.logging import get_logger
from app.db.models import ToolInvocation
from app.services.cafe_automation import CafeOrderItem, create_pending_order, stored_items_match

log = get_logger("tools")


# ── Schemas ───────────────────────────────────────────────────────────

class KBQuery(BaseModel):
    query: str = Field(..., description="Natural-language question to search the business knowledge base for.")
    k: int = Field(5, ge=1, le=10)


class CatalogSearchArgs(BaseModel):
    query: str = Field(
        "",
        description="Optional filter hint (category name, SKU fragment, or product name). "
        "Leave empty to return the full read-only catalog.",
    )


class OrderItem(BaseModel):
    sku_or_name: str
    qty: int = Field(1, ge=1)
    unit_price: float | None = None


class CreateOrderArgs(BaseModel):
    items: list[OrderItem]
    delivery_notes: str | None = None
    delivery_location: str | None = Field(
        None,
        description=(
            "Structured delivery destination: hotel name + room, front-desk hold, "
            "or JKIA terminal (e.g. 'Hemingways Karen room 412', 'JKIA Terminal 1A')."
        ),
    )
    departure_time_iso: str | None = Field(
        None,
        description="ISO-8601 departure/flight time — required for JKIA deliveries.",
    )
    appointment_time_iso: str | None = Field(
        None, description="ISO-8601 if this order is also a booking (e.g. salon, clinic).",
    )
    payment_currency: str | None = Field(
        None,
        description="KES (default) for M-Pesa STK, or USD for Paystack card checkout.",
    )
    amount_usd: float | None = Field(
        None, gt=0, description="USD total when payment_currency is USD.",
    )


class DhlShippingArgs(BaseModel):
    destination_country: str = Field(..., description="ISO country name or code, e.g. 'United Kingdom'.")
    box_weight_kg: float = Field(1.5, gt=0, le=30, description="Estimated packed box weight in kg.")


class MpesaArgs(BaseModel):
    amount_kes: float = Field(..., gt=0)
    order_reference: str = Field(..., description="Short reference, max 12 chars.")
    msisdn: str = Field(..., description="E.164 phone number to charge.")
    currency: str = Field(
        "KES",
        description="KES for M-Pesa STK; USD for Paystack card checkout link.",
    )
    amount_usd: float | None = Field(
        None, gt=0, description="USD amount when currency is USD.",
    )


class BookingArgs(BaseModel):
    title: str
    start_time_iso: str
    duration_minutes: int = 30
    notes: str | None = None


class EscalateArgs(BaseModel):
    reason: str


class LocationPinArgs(BaseModel):
    name: str | None = Field(
        None, description="Short label shown above the pin (e.g. business name).",
    )
    address: str | None = Field(
        None, description="One-line address shown under the pin.",
    )
    latitude: float | None = Field(
        None, description="Override latitude. Defaults to the business's stored lat.",
    )
    longitude: float | None = Field(
        None, description="Override longitude. Defaults to the business's stored lng.",
    )


class MenuPhotoArgs(BaseModel):
    item: str = Field(
        ...,
        description=(
            "The menu item the customer asked to see — e.g. 'espresso', "
            "'flat white', 'big pond plate', 'croissant'. Free text; the "
            "lookup is fuzzy. Use 'menu' if they asked for the whole menu."
        ),
    )
    caption: str | None = Field(
        None,
        description="Optional short caption to send alongside the image.",
    )


class CustomerNameArgs(BaseModel):
    name: str = Field(
        ...,
        description="The customer's first name, exactly as they typed it (no titles, no quotes).",
        min_length=1,
        max_length=80,
    )


# ── Tool factory: binds tools to an AsyncSession + conversation_id ────

def build_tools(
    db: AsyncSession,
    conversation_id: uuid.UUID | None,
    business_id: uuid.UUID | None,
    *,
    msisdn: str | None = None,
    channel: str | None = None,
    business_slug: str | None = None,
):

    async def _audit(name: str, args: dict, result: Any, ok: bool, t0: float):
        try:
            # In unit tests we use an in-memory SQLite DB that doesn't have
            # the full Postgres schema (JSONB / pgvector). Skip persisting
            # tool audit rows when running tests to avoid OperationalError.
            import os
            if os.environ.get("APP_ENV") == "test":
                log.debug("tool_audit_skipped_in_test", tool=name, ok=ok, conv=str(conversation_id))
                return

            inv = ToolInvocation(
                conversation_id=conversation_id, tool_name=name,
                arguments=args, result=result if isinstance(result, dict) else {"value": str(result)},
                success=ok, latency_ms=int((time.perf_counter() - t0) * 1000),
            )
            db.add(inv)
            await db.flush()
            log.info("tool_audit_flushed", tool=name, ok=ok, inv_id=inv.id, conv=str(conversation_id))
        except Exception as e:  # pragma: no cover
            log.warning("audit_failed", tool=name, error=str(e), conv=str(conversation_id))

    # ── knowledge_lookup ──
    async def knowledge_lookup(query: str, k: int = 3) -> str:
        t0 = time.perf_counter()
        chunks = await retrieve(db, query, business_id=business_id, k=k)
        out = format_context(chunks)
        await _audit("knowledge_lookup", {"query": query, "k": k},
                     {"hits": len(chunks)}, True, t0)
        return out

    # ── search_catalog (Hazina deterministic catalog — no hallucinated SKUs) ──
    async def search_catalog(query: str = "") -> dict:
        from app.services.business_service import HAZINA_NOMADS_SLUG
        from app.catalog.hazina_catalog import hazina_catalog_search_payload

        t0 = time.perf_counter()
        slug = (business_slug or "").strip().lower()
        if slug != HAZINA_NOMADS_SLUG:
            result = {
                "ok": False,
                "error": "catalog_unavailable",
                "message": "search_catalog is only available for Hazina Nomads.",
            }
            await _audit("search_catalog", {"query": query}, result, False, t0)
            return result

        payload = hazina_catalog_search_payload()
        hint = (query or "").strip().lower()
        if hint:
            filtered_collections = [
                row for row in payload["collections"]
                if hint in row["name"].lower()
                or hint in row["sku"].lower()
                or hint in str(row.get("contents") or "").lower()
            ]
            filtered_treasures = [
                row for row in payload["treasures"]
                if hint in row["name"].lower()
                or hint in row["sku"].lower()
                or hint in str(row.get("category") or "").lower()
            ]
            payload = {
                **payload,
                "collections": filtered_collections,
                "treasures": filtered_treasures,
                "filter": hint,
            }
        result = {"ok": True, "read_only": True, "catalog": payload}
        await _audit("search_catalog", {"query": query}, result, True, t0)
        return result

    # ── create_order (stub: writes to DB but no payment yet) ──
    async def create_order(
        items: list[OrderItem | dict],
        delivery_notes: str | None = None,
        delivery_location: str | None = None,
        departure_time_iso: str | None = None,
        appointment_time_iso: str | None = None,
        payment_currency: str | None = None,
        amount_usd: float | None = None,
    ) -> dict:
        # Normalise items — StructuredTool may pass them as dicts.
        items = [i if isinstance(i, OrderItem) else OrderItem(**i) for i in items]
        args = CreateOrderArgs(
            items=items,
            delivery_notes=delivery_notes,
            delivery_location=delivery_location,
            departure_time_iso=departure_time_iso,
            appointment_time_iso=appointment_time_iso,
            payment_currency=payment_currency,
            amount_usd=amount_usd,
        )
        t0 = time.perf_counter()
        if not conversation_id:
            return {"ok": False, "error": "no_conversation"}
        # Resolve customer via conversation
        from sqlalchemy import select
        from app.db.models import Conversation, Order, PaymentStatus
        conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one()
        tenant_id = business_id or conv.business_id

        # Per-customer order velocity guard. Capacity = 5 orders, refill =
        # 5 per hour ⇒ a normal student can place ~5 orders in a burst but
        # can't queue-stuff a cafe with 50 fake tickets in 10 minutes.
        # Bucket scoped to (customer, business) so a student can still
        # order from a different cafe without being blocked.
        from app.core.rate_limit import try_consume
        bucket = f"order:create:{conv.customer_id}:{tenant_id}"
        if not await try_consume(bucket, capacity=5, refill_per_sec=5 / 3600):
            result = {
                "ok": False,
                "error": "too_many_orders",
                "message": "You've placed several orders very recently. Please wait a few minutes before adding another.",
            }
            await _audit("create_order", args.model_dump(), result, False, t0)
            return result

        cafe_items = [
            CafeOrderItem(
                sku_or_name=item.sku_or_name,
                qty=item.qty,
                unit_price=float(item.unit_price or 0),
            )
            for item in args.items
        ]
        amount = sum(item.line_total for item in cafe_items)
        existing_orders = (await db.execute(
            select(Order)
            .where(Order.conversation_id == conversation_id)
            .where(Order.customer_id == conv.customer_id)
            .where(Order.payment_status == PaymentStatus.pending)
            .where(Order.business_id == tenant_id if tenant_id is not None else Order.business_id.is_(None))
            .order_by(Order.created_at.desc())
            .limit(5)
        )).scalars().all()
        for existing in existing_orders:
            if abs(float(existing.amount or 0) - float(amount or 0)) <= 0.01 and stored_items_match(existing.details, cafe_items):
                result = {
                    "ok": True,
                    "order_id": str(existing.id),
                    "amount_kes": float(existing.amount or 0),
                    "deduped": True,
                    "message": "Existing pending order reused; do not create a duplicate order.",
                }
                await _audit("create_order", args.model_dump(), result, True, t0)
                return result

        appt_iso = args.appointment_time_iso or args.departure_time_iso
        appt = datetime.fromisoformat(appt_iso) if appt_iso else None
        note_parts: list[str] = []
        if args.delivery_location:
            note_parts.append(f"Location: {args.delivery_location}")
        if args.departure_time_iso:
            note_parts.append(f"Departure: {args.departure_time_iso}")
        if args.delivery_notes:
            note_parts.append(args.delivery_notes)
        composed_notes = " | ".join(note_parts) if note_parts else None
        order, _created = await create_pending_order(
            db,
            customer_id=conv.customer_id,
            conversation_id=conv.id,
            business_id=tenant_id,
            items=cafe_items,
            delivery_notes=composed_notes,
            delivery_location=args.delivery_location,
            departure_time_iso=args.departure_time_iso,
            fast_path="llm_tool",
            appointment_time=appt,
        )
        pay_cur = (args.payment_currency or "KES").upper()
        if pay_cur == "USD" or args.amount_usd:
            details = dict(order.details or {})
            details["payment_currency"] = pay_cur
            if args.amount_usd is not None:
                details["amount_usd"] = round(float(args.amount_usd), 2)
            elif pay_cur == "USD":
                details["amount_usd"] = round(float(amount) / 129.0, 2)
            order.details = details
            await db.flush()

        result = {
            "ok": True,
            "order_id": str(order.id),
            "amount_kes": float(amount),
            "payment_status": "pending",
            "message": "Order recorded; payment must be confirmed before ready notifications are sent.",
        }
        if pay_cur == "USD":
            usd_val = (order.details or {}).get("amount_usd")
            if usd_val is not None:
                result["amount_usd"] = float(usd_val)
                result["payment_currency"] = "USD"
        await _audit("create_order", args.model_dump(), result, True, t0)
        return result

    # ── request_mpesa_payment ──
    async def request_mpesa_payment(
        amount_kes: float,
        order_reference: str,
        msisdn: str,
        currency: str = "KES",
        amount_usd: float | None = None,
    ) -> dict:
        args = MpesaArgs(
            amount_kes=amount_kes,
            order_reference=order_reference,
            msisdn=msisdn,
            currency=currency,
            amount_usd=amount_usd,
        )
        """Trigger STK push or USD checkout link. Routes through
        ``resolve_payment_service`` (IntaSend for KES, Paystack for USD).

        Tool name kept as 'mpesa' since that's what the user-facing prompt knows.

        Idempotency: short-lived Redis lock keyed on
        (conversation, msisdn, order_reference, amount) prevents duplicate
        STK pushes if the agent loop re-invokes the tool within 10 minutes.
        """
        from app.core.exceptions import RateLimited, UpstreamError
        from app.core.redis_client import claim_with_result, store_result
        from app.core.security import normalize_msisdn
        from app.integrations.payments import resolve_payment_service
        from app.db.models import Order, PaymentStatus
        from sqlalchemy import select

        t0 = time.perf_counter()
        pay_cur = (args.currency or "KES").upper()
        try:
            msisdn = normalize_msisdn(args.msisdn)
        except Exception as e:
            result = {"ok": False, "error": "invalid_msisdn", "message": str(e)}
            await _audit("request_mpesa_payment", args.model_dump(), result, False, t0)
            return result

        # Idempotency key combines logical payment identity. Re-entry within
        # 10 min returns the cached result instead of double-charging.
        idem_amount = int((args.amount_usd or 0) * 100) if pay_cur == "USD" else int(args.amount_kes * 100)
        idem_key = f"pay:{conversation_id}:{msisdn}:{args.order_reference}:{pay_cur}:{idem_amount}"
        fresh, cached = await claim_with_result(idem_key, ttl_seconds=600)
        if not fresh:
            if cached is not None:
                log.info("mpesa_idempotent_hit", key=idem_key, cached=True)
                cached = dict(cached)
                cached["idempotent_replay"] = True
                await _audit("request_mpesa_payment", args.model_dump(), cached, cached.get("ok", False), t0)
                return cached
            # In-flight (PENDING) — refuse a second push.
            in_flight_msg = (
                "A payment request is already being processed for this reference."
            )
            result = {"ok": False, "error": "in_flight", "message": in_flight_msg}
            log.info("mpesa_idempotent_inflight", key=idem_key)
            await _audit("request_mpesa_payment", args.model_dump(), result, False, t0)
            return result

        try:
            # Attach to the most recent pending order in this exact tenant
            # conversation. A customer can chat with several businesses using
            # one phone number, so customer-only matching is unsafe.
            latest = None
            tenant_id = business_id
            order_details: dict = {}
            if conversation_id:
                from app.db.models import Conversation
                conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one()
                tenant_id = business_id or conv.business_id
                latest = (await db.execute(
                    select(Order)
                    .where(Order.conversation_id == conversation_id)
                    .where(Order.customer_id == conv.customer_id)
                    .where(Order.payment_status == PaymentStatus.pending)
                    .where(Order.business_id == tenant_id if tenant_id is not None else Order.business_id.is_(None))
                    .order_by(Order.created_at.desc()).limit(1)
                )).scalar_one_or_none()
                if latest is not None and isinstance(latest.details, dict):
                    order_details = latest.details
                    if not pay_cur or pay_cur == "KES":
                        pay_cur = str(order_details.get("payment_currency") or pay_cur).upper()
                if (
                    latest is not None
                    and latest.mpesa_checkout_id
                    and str(latest.id).startswith(args.order_reference)
                ):
                    pending_msg = (
                        "An STK push is already pending for this order. Ask the customer to check their phone or wait before retrying."
                        if pay_cur == "KES" else
                        "A checkout link is already pending for this order. Share the existing link or wait before retrying."
                    )
                    result = {
                        "ok": False,
                        "error": "in_flight",
                        "checkout_request_id": latest.mpesa_checkout_id,
                        "message": pending_msg,
                    }
                    await store_result(idem_key, result, ttl_seconds=600)
                    await _audit("request_mpesa_payment", args.model_dump(), result, False, t0)
                    return result

            svc = resolve_payment_service(currency=pay_cur)
            pay_amount = float(args.amount_kes)
            if pay_cur == "USD":
                pay_amount = float(
                    args.amount_usd
                    or order_details.get("amount_usd")
                    or round(float(args.amount_kes) / 129.0, 2)
                )
            pay_kwargs: dict[str, object] = {
                "msisdn": msisdn,
                "amount": pay_amount,
                "reference": args.order_reference,
                "description": "Order Payment",
            }
            if pay_cur == "USD" and svc.name == "paystack":
                pay_kwargs["currency"] = "USD"
            res = await svc.request_payment(**pay_kwargs)
            checkout_id = res.reference
            if latest is not None:
                latest.mpesa_checkout_id = checkout_id
                await db.flush()
                if svc.name == "intasend":
                    from app.jobs.runner import enqueue_job
                    await enqueue_job(
                        db,
                        kind="payment.intasend_poll",
                        business_id=tenant_id,
                        run_at=datetime.now(timezone.utc) + timedelta(seconds=20),
                        max_attempts=1,
                        ttl_seconds=10 * 60,
                        payload={
                            "order_id": str(latest.id),
                            "checkout_id": checkout_id,
                            "poll_count": 1,
                        },
                    )
            if pay_cur == "USD" and res.redirect_url:
                msg = f"Paystack checkout link ready for USD {pay_amount:.2f} via {svc.name}."
            else:
                msg = f"STK push sent to {msisdn} via {svc.name}."
                if res.redirect_url:
                    msg += f" Pay link: {res.redirect_url}"
            result = {
                "ok": True,
                "checkout_request_id": checkout_id,
                "provider": svc.name,
                "redirect_url": res.redirect_url,
                "amount_kes": float(args.amount_kes),
                "payment_currency": pay_cur,
                "message": msg,
            }
            if pay_cur == "USD":
                result["amount_usd"] = pay_amount
            # Demo: auto-confirm simulated payments after a short delay so
            # WhatsApp demos can show the 'payment received' path end-to-end.
            try:
                from app.core.config import get_settings
                s = get_settings()
                if svc.name == "simulator" and getattr(s, "payment_simulator_autoconfirm", False):
                    delay = int(getattr(s, "payment_simulator_autoconfirm_delay", 3) or 3)
                    from app.jobs.runner import enqueue_job
                    await enqueue_job(
                        db,
                        kind="payment.simulator_confirm",
                        business_id=tenant_id if "tenant_id" in locals() else business_id,
                        run_at=datetime.now(timezone.utc) + timedelta(seconds=delay),
                        max_attempts=5,
                        ttl_seconds=15 * 60,
                        payload={"checkout_id": checkout_id},
                    )
            except Exception as exc:  # pragma: no cover
                log.warning("payment_simulator_autoconfirm_enqueue_failed", error=str(exc))
        except RateLimited as e:
            result = {"ok": False, "error": "rate_limited", "message": e.message}
        except UpstreamError as e:
            result = {"ok": False, "error": "upstream", "message": e.message}
        except Exception as e:
            # tenacity wraps inner exceptions in RetryError — unwrap so the
            # real provider response (e.g. IntaSend body) is preserved.
            inner = e
            try:
                from tenacity import RetryError
                if isinstance(e, RetryError) and e.last_attempt is not None:
                    inner = e.last_attempt.exception() or e
            except Exception:
                pass
            if isinstance(inner, UpstreamError):
                result = {"ok": False, "error": "upstream", "message": inner.message}
            elif isinstance(inner, RateLimited):
                result = {"ok": False, "error": "rate_limited", "message": inner.message}
            else:
                result = {"ok": False, "error": "unexpected", "message": str(inner)}

        # Cache the result so retries within the TTL return the same outcome.
        await store_result(idem_key, result, ttl_seconds=600)
        await _audit("request_mpesa_payment", args.model_dump(), result, result.get("ok", False), t0)
        return result

    # ── book_appointment ──
    async def book_appointment(
        title: str,
        start_time_iso: str,
        duration_minutes: int = 30,
        notes: str | None = None,
    ) -> dict:
        args = BookingArgs(
            title=title, start_time_iso=start_time_iso,
            duration_minutes=duration_minutes, notes=notes,
        )
        from datetime import datetime
        from app.integrations import calendar_client
        from app.db.models import Order
        from sqlalchemy import select

        t0 = time.perf_counter()
        try:
            start = datetime.fromisoformat(args.start_time_iso)
            # `calendar_client.create_event` uses the blocking googleapiclient
            # client (.execute()). Offload to a thread so the agent's event
            # loop isn't blocked and the AI timeout can still be enforced.
            res = await asyncio.to_thread(
                calendar_client.create_event,
                title=args.title, start=start, duration_minutes=args.duration_minutes,
                description=args.notes,
            )
            if res.ok and conversation_id:
                from app.db.models import Conversation
                conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one()
                latest = (await db.execute(
                    select(Order)
                    .where(Order.conversation_id == conversation_id)
                    .where(Order.customer_id == conv.customer_id)
                    .where(Order.business_id == (business_id or conv.business_id) if (business_id or conv.business_id) is not None else Order.business_id.is_(None))
                    .order_by(Order.created_at.desc()).limit(1)
                )).scalar_one_or_none()
                if latest:
                    latest.calendar_event_id = res.event_id
                    latest.appointment_time = start
                    await db.flush()
            result = {"ok": res.ok, "calendar_event_id": res.event_id,
                      "dry_run": res.dry_run, "link": res.html_link, "error": res.error}
        except Exception as e:
            result = {"ok": False, "error": str(e)}
        await _audit("book_appointment", args.model_dump(), result, result.get("ok", False), t0)
        return result

    # ── escalate_to_human ──
    async def escalate_to_human(reason: str) -> dict:
        args = EscalateArgs(reason=reason)
        t0 = time.perf_counter()
        result = {"ok": True, "escalated": True, "reason": args.reason}
        await _audit("escalate_to_human", args.model_dump(), result, True, t0)
        return result

    # ── send_location_pin (WhatsApp) ──
    async def send_location_pin(
        name: str | None = None,
        address: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> dict:
        """Send a clickable map pin to the customer on WhatsApp. Defaults
        to the business's stored coordinates when lat/lng aren't given."""
        args = LocationPinArgs(name=name, address=address, latitude=latitude, longitude=longitude)
        from sqlalchemy import select
        from app.db.models import Business
        t0 = time.perf_counter()

        lat, lng = args.latitude, args.longitude
        name = args.name
        address = args.address
        if business_id and (lat is None or lng is None or not name or not address):
            biz = (await db.execute(
                select(Business).where(Business.id == business_id)
            )).scalar_one_or_none()
            if biz:
                lat = lat if lat is not None else getattr(biz, "latitude", None)
                lng = lng if lng is not None else getattr(biz, "longitude", None)
                name = name or biz.name
                address = address or biz.location

        if lat is None or lng is None:
            result = {"ok": False, "error": "no_coordinates",
                      "message": "No coordinates stored for this business."}
            await _audit("send_location_pin", args.model_dump(), result, False, t0)
            return result

        if channel != "whatsapp" or not msisdn:
            # Channel can't render pins — return the data as text so the
            # agent can quote a Maps URL instead.
            maps = f"https://maps.google.com/?q={lat},{lng}"
            result = {"ok": True, "sent": False, "channel": channel,
                      "maps_url": maps, "name": name, "address": address,
                      "message": f"Map: {maps}"}
            await _audit("send_location_pin", args.model_dump(), result, True, t0)
            return result

        try:
            from app.integrations import whatsapp_client
            await whatsapp_client.send_location(
                msisdn, latitude=float(lat), longitude=float(lng),
                name=name, address=address,
            )
            result = {"ok": True, "sent": True, "channel": "whatsapp",
                      "name": name, "address": address}
        except Exception as e:
            result = {"ok": False, "error": "upstream", "message": str(e)}
        await _audit("send_location_pin", args.model_dump(), result,
                     result.get("ok", False), t0)
        return result

    # ── send_menu_photo (WhatsApp) ──
    async def send_menu_photo(item: str, caption: str | None = None) -> dict:
        """Deliver a real photo of a menu item to the customer over WhatsApp.

        Pulls the image URL from the per-business menu photo registry
        (`app.services.menu_photos`) and dispatches via the provider-aware
        `app.channels.whatsapp.send_image`. On non-WhatsApp channels returns
        the URL so the agent can paste it as a link.
        """
        args = MenuPhotoArgs(item=item, caption=caption)
        from sqlalchemy import select
        from app.db.models import Business
        from app.services.menu_photos import find_photo
        t0 = time.perf_counter()

        biz_slug = None
        if business_id:
            biz = (await db.execute(
                select(Business).where(Business.id == business_id)
            )).scalar_one_or_none()
            if biz is not None:
                biz_slug = biz.slug

        if not biz_slug:
            result = {"ok": False, "error": "no_business",
                      "message": "I don't have photos configured yet."}
            await _audit("send_menu_photo", args.model_dump(), result, False, t0)
            return result

        profile_menu_photos = None
        if biz is not None and isinstance(biz.profile, dict):
            raw_menu_photos = biz.profile.get("menu_photos")
            if isinstance(raw_menu_photos, dict):
                profile_menu_photos = raw_menu_photos

        matched, url = find_photo(biz_slug, args.item, profile_menu_photos)
        if not url:
            result = {"ok": False, "error": "no_photo",
                      "item": args.item,
                      "message": "I don't have a photo of that one yet."}
            await _audit("send_menu_photo", args.model_dump(), result, False, t0)
            return result

        from app.core.redis_client import claim_with_result, store_result

        dedupe_key = f"photo:{conversation_id}:{channel}:{msisdn}:{matched}"
        fresh, cached = await claim_with_result(dedupe_key, ttl_seconds=45)
        if not fresh and cached is not None:
            result = dict(cached)
            result["deduped"] = True
            await _audit("send_menu_photo", args.model_dump(), result, result.get("ok", False), t0)
            return result

        if channel != "whatsapp" or not msisdn:
            # Other channels: return the URL structurally so the UI can render
            # it inline, but keep the tool message URL-free so the model
            # doesn't regurgitate a naked image link in chat.
            result = {"ok": True, "sent": False, "channel": channel,
                      "item": matched, "image_url": url,
                      "message": f"Photo ready for {matched}."}
            await store_result(dedupe_key, result, ttl_seconds=45)
            await _audit("send_menu_photo", args.model_dump(), result, True, t0)
            return result

        try:
            from app.channels import whatsapp as wa_channel
            send_res = await wa_channel.send_image(msisdn, url, caption=args.caption)
            ok = bool(send_res.get("ok"))
            result = {"ok": ok, "sent": ok, "channel": "whatsapp",
                      "item": matched,
                      "image_url": url,
                      "provider_sid": send_res.get("sid"),
                      "media_id": send_res.get("id"),
                      "error": send_res.get("error")}
        except Exception as e:
            result = {"ok": False, "error": "upstream", "message": str(e)}
        await store_result(dedupe_key, result, ttl_seconds=45)
        await _audit("send_menu_photo", args.model_dump(), result,
                     result.get("ok", False), t0)
        return result

    # ── update_customer_name ──
    async def update_customer_name(name: str) -> dict:
        """Persist the customer's name on their profile so future turns can
        use it ('Lesnar — your espresso is ready!'). Called as soon as the
        customer tells the agent their name."""
        args = CustomerNameArgs(name=name)
        from sqlalchemy import select
        from app.db.models import Conversation, Customer
        t0 = time.perf_counter()
        if not conversation_id:
            result = {"ok": False, "error": "no_conversation"}
            await _audit("update_customer_name", args.model_dump(), result, False, t0)
            return result
        try:
            conv = (await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )).scalar_one()
            cust = (await db.execute(
                select(Customer).where(Customer.id == conv.customer_id)
            )).scalar_one()
            cleaned = args.name.strip().strip("\"'").split()[0]  # first token only
            cleaned = cleaned[:80].title() if cleaned.islower() else cleaned[:80]
            cust.name = cleaned
            await db.flush()
            result = {"ok": True, "name": cleaned}
        except Exception as e:
            result = {"ok": False, "error": "db", "message": str(e)}
        await _audit("update_customer_name", args.model_dump(), result,
                     result.get("ok", False), t0)
        return result

    # ── calculate_dhl_shipping (stub — Day 4+ real API) ──
    async def calculate_dhl_shipping(
        destination_country: str,
        box_weight_kg: float = 1.5,
    ) -> dict:
        """Estimate international DHL or equivalent insured shipping for diaspora / corporate sends."""
        args = DhlShippingArgs(
            destination_country=destination_country,
            box_weight_kg=box_weight_kg,
        )
        t0 = time.perf_counter()
        # MVP stub: flat bands by weight — replace with DHL rate API at launch+.
        weight = args.box_weight_kg
        if weight <= 2:
            usd = 45.0
        elif weight <= 5:
            usd = 78.0
        else:
            usd = round(78.0 + (weight - 5) * 12.0, 2)
        result = {
            "ok": True,
            "destination": args.destination_country,
            "weight_kg": weight,
            "estimate_usd": usd,
            "carrier": "DHL Express or equivalent insured courier",
            "lead_days": "3–5 business days",
            "note": "Estimate only — confirm at checkout. Nairobi pickup included.",
            "stub": True,
        }
        await _audit("calculate_dhl_shipping", args.model_dump(), result, True, t0)
        return result

    tool_list = [
        StructuredTool.from_function(coroutine=knowledge_lookup, name="knowledge_lookup",
                                     description="Search the business knowledge base (menu, prices, hours, FAQs).",
                                     args_schema=KBQuery),
        StructuredTool.from_function(coroutine=create_order, name="create_order",
                                     description="Create an order/booking record once items+price are confirmed with the customer.",
                                     args_schema=CreateOrderArgs),
        StructuredTool.from_function(
            coroutine=request_mpesa_payment,
            name="request_mpesa_payment",
            description=(
                "Trigger M-Pesa STK (KES) or Paystack card checkout link (USD). "
                "Pass currency='USD' and amount_usd for international card payments."
            ),
            args_schema=MpesaArgs,
        ),
        StructuredTool.from_function(coroutine=book_appointment, name="book_appointment",
                                     description="Book an appointment slot on the business calendar.",
                                     args_schema=BookingArgs),
        StructuredTool.from_function(coroutine=escalate_to_human, name="escalate_to_human",
                                     description="Hand off the conversation to a human agent.",
                                     args_schema=EscalateArgs),
        StructuredTool.from_function(coroutine=send_location_pin, name="send_location_pin",
                                     description=(
                                         "Send the business's map pin to the customer over WhatsApp. "
                                         "Use when they ask 'where are you', 'send me directions', "
                                         "'tuma location', or similar. On non-WhatsApp channels this "
                                         "returns a Google Maps URL the agent can paste in its reply."
                                     ),
                                     args_schema=LocationPinArgs),
        StructuredTool.from_function(coroutine=send_menu_photo, name="send_menu_photo",
                                     description=(
                                         "Send the customer an actual photograph of a menu item over "
                                         "WhatsApp. CALL THIS whenever the customer asks 'do you have "
                                         "pictures?', 'show me', 'lemme see', 'picha', 'photo', or "
                                         "names a specific item and asks how it looks. Pass `item` as "
                                         "the dish/drink name (free text — fuzzy match). On non-"
                                         "WhatsApp channels this returns the image URL the agent can "
                                         "paste as a link."
                                     ),
                                     args_schema=MenuPhotoArgs),
        StructuredTool.from_function(coroutine=update_customer_name, name="update_customer_name",
                                     description=(
                                         "Save the customer's first name on their profile. CALL THIS "
                                         "the moment the customer tells you their name (e.g. 'Lesnar', "
                                         "'my name is Aisha', 'naitwa Brian'). Pass the bare first "
                                         "name. Do NOT call for nicknames the customer says belong to "
                                         "someone else."
                                     ),
                                     args_schema=CustomerNameArgs),
        StructuredTool.from_function(
            coroutine=calculate_dhl_shipping,
            name="calculate_dhl_shipping",
            description=(
                "Estimate DHL Express international shipping cost and lead time for "
                "sending a gift box abroad (diaspora / corporate). Returns USD estimate."
            ),
            args_schema=DhlShippingArgs,
        ),
    ]
    if (business_slug or "").strip().lower() == "hazina-nomads":
        tool_list.insert(
            1,
            StructuredTool.from_function(
                coroutine=search_catalog,
                name="search_catalog",
                description=(
                    "Return the authoritative read-only Hazina catalog (collections + treasures). "
                    "CALL before recommending any product, SKU, or price."
                ),
                args_schema=CatalogSearchArgs,
            ),
        )
    return tool_list
