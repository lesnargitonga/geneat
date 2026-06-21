"""Hazina ironclad fast path — cart recovery, menus, and payment before LLM/café controls."""
from __future__ import annotations

import re
import uuid
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PaymentStatus
from app.services.conversation_context import HazinaSessionContext, load_hazina_session_context
from app.services.fulfillment_status import PENDING_PAYMENT
from app.services.gift_automation import (
    GiftAutomationResult,
    checkout_in_progress,
    clear_hazina_checkout_state,
    is_hazina_slug,
)
from app.services.whatsapp_menus import (
    CMD_HAZINA_CLEAR_CART,
    CMD_HAZINA_COASTAL,
    CMD_HAZINA_COLLECTIONS,
    CMD_HAZINA_SEND_STK,
    CMD_HOME,
    ID_HAZINA_CLEAR_CART,
    ID_HAZINA_COASTAL,
    ID_HAZINA_COLLECTIONS,
    ID_HAZINA_SEND_STK,
    command_for_interactive_id,
    hazina_cart_recovery_payload,
    hazina_coastal_list_payload,
    hazina_welcome_body,
    main_menu_payload,
    product_list_payload,
)

if TYPE_CHECKING:
    from app.db.models import Customer

_TOP_FUNNEL_GREETING_RE = re.compile(
    r"^\s*(?:hi|hello|hey|menu|start|order|gift\s*box|sasa|niaje|mambo|habari|"
    r"good\s+(?:morning|afternoon|evening))(?:\s+there)?\s*[!?.]*\s*$",
    re.IGNORECASE,
)
_HAZINA_ORDER_REF_RE = re.compile(r"\bHN-ORD-[A-Z0-9]{6,12}\b", re.IGNORECASE)
_PAYMENT_RESEND_RE = re.compile(
    r"\b(?:resend|send)\s+(?:stk|mpesa|m-?pesa|payment|pay)\b|"
    r"\b(?:stk|mpesa)\s+(?:again|tena)\b",
    re.IGNORECASE,
)
_PAYMENT_CANCEL_RE = re.compile(
    r"\b(?:cancel|clear|delete|futa|ondoa)\s+(?:order|oda|cart|checkout|payment|stk)\b|"
    r"\b(?:start\s+over|start\s+again|anew)\b",
    re.IGNORECASE,
)


def _awaiting_payment(ctx: HazinaSessionContext) -> bool:
    if ctx.order is None:
        return False
    if ctx.payment_status == PaymentStatus.pending.value:
        return True
    return (
        ctx.fulfillment_status == PENDING_PAYMENT
        and ctx.payment_status != PaymentStatus.paid.value
    )


def _explicit_hazina_navigation(text: str, interactive_id: str | None) -> bool:
    """Allow through to deeper Hazina automation (checkout, catalog, etc.)."""
    if interactive_id:
        mapped = command_for_interactive_id(interactive_id)
        if mapped and mapped not in (CMD_HOME,):
            return True
    if _HAZINA_ORDER_REF_RE.search(text or ""):
        return True
    if _PAYMENT_RESEND_RE.search(text or "") or _PAYMENT_CANCEL_RE.search(text or ""):
        return True
    return False


async def try_hazina_deterministic_gate(
    db: AsyncSession,
    *,
    text: str,
    interactive_id: str | None,
    interactive_command: str | None,
    business_slug: str | None,
    customer: Customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    language: str | None,
) -> GiftAutomationResult | None:
    """Return instantly for Hazina discovery/cart — never fall through to café STK dumps."""
    if not is_hazina_slug(business_slug):
        return None

    is_sw = (language or "").lower().startswith(("sw", "she")) or (
        (getattr(customer, "preferred_language", None) or "").lower().startswith(("sw", "she"))
    )
    ctx = await load_hazina_session_context(
        db,
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
    )
    lid = (interactive_id or "").lower()
    body = (text or "").strip()
    cmd = interactive_command or command_for_interactive_id(interactive_id)
    in_checkout = await checkout_in_progress(conversation_id, customer=customer)

    # Pending cart: structured recovery (fixes raw STK status leaks).
    if cmd == CMD_HAZINA_SEND_STK or (
        _PAYMENT_RESEND_RE.search(body) and _awaiting_payment(ctx)
    ):
        reply = await _hazina_resend_payment(
            db,
            customer=customer,
            conversation_id=conversation_id,
            business_id=business_id,
            text=body or "resend STK",
            language=language,
        )
        total = int(float(ctx.order.amount or 0)) if ctx.order else 0
        return GiftAutomationResult(
            reply=reply,
            interactive=hazina_cart_recovery_payload(cart_total_kes=total, language=language)
            if _awaiting_payment(ctx)
            else main_menu_payload(
                business_name="Hazina Nomads",
                language=language,
                business_slug=business_slug,
            ),
            safety_flag="deterministic:hazina_send_stk",
        )

    if cmd == CMD_HAZINA_CLEAR_CART or (
        _PAYMENT_CANCEL_RE.search(body) and _awaiting_payment(ctx)
    ):
        reply = await _hazina_clear_pending_cart(
            db,
            customer=customer,
            conversation_id=conversation_id,
            business_id=business_id,
            text=body or "cancel order",
            language=language,
        )
        await clear_hazina_checkout_state(conversation_id, customer=customer)
        return GiftAutomationResult(
            reply=reply,
            interactive=main_menu_payload(
                business_name="Hazina Nomads",
                language=language,
                business_slug=business_slug,
            ),
            safety_flag="deterministic:hazina_clear_cart",
        )

    if (
        not in_checkout
        and _awaiting_payment(ctx)
        and re.search(r"\b(yes|yep|yeah|ndio|sawa|okay)\b", body, re.IGNORECASE)
    ):
        reply = await _hazina_resend_payment(
            db,
            customer=customer,
            conversation_id=conversation_id,
            business_id=business_id,
            text="resend STK",
            language=language,
        )
        total = int(float(ctx.order.amount or 0)) if ctx.order else 0
        payload = hazina_cart_recovery_payload(cart_total_kes=total, language=language)
        stk_body = str(payload.get("body") or "").strip()
        merged = f"{stk_body}\n\n{reply}" if reply.strip() else stk_body
        return GiftAutomationResult(
            reply=merged,
            interactive=payload,
            safety_flag="deterministic:hazina_send_stk_affirmative",
        )

    if (
        not in_checkout
        and _awaiting_payment(ctx)
        and not _explicit_hazina_navigation(body, interactive_id)
    ):
        order = ctx.order
        total = int(float(order.amount or 0)) if order else 0
        payload = hazina_cart_recovery_payload(cart_total_kes=total, language=language)
        return GiftAutomationResult(
            reply=str(payload.get("body") or "").strip(),
            interactive=payload,
            safety_flag="deterministic:hazina_cart_recovery",
        )

    # Top-of-funnel menus (zero LLM) — always reset stale checkout state.
    if cmd == CMD_HAZINA_COASTAL or lid == ID_HAZINA_COASTAL:
        await clear_hazina_checkout_state(conversation_id, customer=customer)
        return GiftAutomationResult(
            reply=(
                "Hizi ni vipande vya Pwani ya Kiswahili — chagua kimoja:"
                if is_sw else
                "Here are Swahili Coast artisan pieces — select one:"
            ),
            interactive=hazina_coastal_list_payload(language=language),
            safety_flag="deterministic:hazina_coastal_list",
        )

    if cmd == CMD_HOME or body == CMD_HOME or _TOP_FUNNEL_GREETING_RE.match(body):
        await clear_hazina_checkout_state(conversation_id, customer=customer)
        return GiftAutomationResult(
            reply=hazina_welcome_body(language=language),
            interactive=main_menu_payload(
                business_name="Hazina Nomads",
                language=language,
                business_slug=business_slug,
            ),
            safety_flag="deterministic:hazina_router_menu",
        )

    if lid in (ID_HAZINA_COLLECTIONS, "lp:shop") or cmd == CMD_HAZINA_COLLECTIONS:
        await clear_hazina_checkout_state(conversation_id, customer=customer)
        return GiftAutomationResult(
            reply=(
                "Hizi ndizo signature collections zetu — chagua moja:"
                if is_sw else
                "Here are our signature collections — select one to begin:"
            ),
            interactive=product_list_payload(language=language),
            safety_flag="deterministic:hazina_collections_list",
        )

    return None


def _order_summary(order) -> str:
    from app.channels.base import _order_items_summary_from_details

    return _order_items_summary_from_details(order.details if order else {})


async def _hazina_resend_payment(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str:
    from app.channels.base import _resend_pending_payment_reply

    return await _resend_pending_payment_reply(
        db,
        customer=customer,
        conversation_id=conversation_id,
        business_id=business_id,
        text=text,
        language=language,
    )


async def _hazina_clear_pending_cart(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str:
    from app.channels.base import _cancel_pending_order_reply

    return await _cancel_pending_order_reply(
        db,
        customer=customer,
        conversation_id=conversation_id,
        business_id=business_id,
        text=text,
        language=language,
    )
