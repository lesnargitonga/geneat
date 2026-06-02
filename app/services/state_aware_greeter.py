"""Deterministic returning-client greeter — runs before LangGraph RAG."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PaymentStatus
from app.services.conversation_context import HazinaSessionContext, load_hazina_session_context
from app.services.fulfillment_status import (
    OUT_FOR_DELIVERY,
    PENDING_PAYMENT,
    READY_FOR_DISPATCH,
)

_RETURNING_GREETING_RE = re.compile(
    r"^\s*(?:"
    r"hi|hello|hey|sasa|niaje|mambo|habari|good\s+(?:morning|afternoon|evening)"
    r")(?:\s+there|\s+again)?\s*[!?.]*\s*$",
    re.IGNORECASE,
)
_PAYMENT_FOLLOWUP_RE = re.compile(
    r"\b(?:resend|stk|mpesa|pay(?:ment)?|link|checkout|yes|ndio|sawa)\b",
    re.IGNORECASE,
)
_ETA_FOLLOWUP_RE = re.compile(
    r"\b(?:eta|when|arriv|track|status|where|uko\s+wapi|linafika)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class GreeterResult:
    reply: str
    safety_flag: str
    handle_resend_payment: bool = False
    handle_eta: bool = False


def looks_like_returning_greeting(text: str) -> bool:
    return bool(_RETURNING_GREETING_RE.match(text or ""))


def looks_like_greeter_payment_followup(text: str) -> bool:
    return bool(_PAYMENT_FOLLOWUP_RE.search(text or ""))


def looks_like_greeter_eta_followup(text: str) -> bool:
    return bool(_ETA_FOLLOWUP_RE.search(text or ""))


async def try_state_aware_greeter(
    db: AsyncSession,
    *,
    text: str,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    conversation_id: uuid.UUID,
    is_sw: bool,
) -> GreeterResult | None:
    """Return a deterministic reply when session state makes 'Hi' meaningful."""
    ctx = await load_hazina_session_context(
        db,
        customer_id=customer_id,
        business_id=business_id,
        conversation_id=conversation_id,
    )

    if looks_like_greeter_payment_followup(text) and _awaiting_payment(ctx):
        return GreeterResult(
            reply=_pending_payment_reply(ctx, is_sw=is_sw),
            safety_flag="deterministic:hazina_greeter_payment_followup",
            handle_resend_payment=True,
        )

    if looks_like_greeter_eta_followup(text) and ctx.fulfillment_status == OUT_FOR_DELIVERY:
        return GreeterResult(
            reply=_out_for_delivery_reply(ctx, is_sw=is_sw),
            safety_flag="deterministic:hazina_greeter_eta",
            handle_eta=True,
        )

    if not looks_like_returning_greeting(text):
        return None

    if ctx.checkout and not _checkout_complete(ctx.checkout):
        return GreeterResult(
            reply=_checkout_resume_reply(ctx, is_sw=is_sw),
            safety_flag="deterministic:hazina_greeter_checkout_resume",
        )

    if _awaiting_payment(ctx):
        return GreeterResult(
            reply=_pending_payment_reply(ctx, is_sw=is_sw),
            safety_flag="deterministic:hazina_greeter_pending_payment",
            handle_resend_payment=True,
        )

    if ctx.fulfillment_status == OUT_FOR_DELIVERY:
        return GreeterResult(
            reply=_out_for_delivery_reply(ctx, is_sw=is_sw),
            safety_flag="deterministic:hazina_greeter_out_for_delivery",
            handle_eta=True,
        )

    if ctx.fulfillment_status == READY_FOR_DISPATCH:
        return GreeterResult(
            reply=_ready_for_dispatch_reply(ctx, is_sw=is_sw),
            safety_flag="deterministic:hazina_greeter_ready_dispatch",
        )

    return None


def _checkout_complete(checkout: dict) -> bool:
    step = str(checkout.get("step") or "").strip().lower()
    return step in {"confirm", "done", "complete"}


def _awaiting_payment(ctx: HazinaSessionContext) -> bool:
    if ctx.order is None:
        return False
    if ctx.payment_status == PaymentStatus.pending.value:
        return True
    return ctx.fulfillment_status == PENDING_PAYMENT and ctx.payment_status != PaymentStatus.paid.value


def _pending_payment_reply(ctx: HazinaSessionContext, *, is_sw: bool) -> str:
    ref = ctx.public_reference or "your brief"
    if ctx.payment_currency == "USD":
        if is_sw:
            return (
                f"Karibu tena. {ref} iko tayari kukamilishwa. "
                "Nitume tena kiungo cha Paystack, au uandike 'resend link'."
            )
        return (
            f"Welcome back. Your bespoke brief ({ref}) is ready for finalization. "
            "Would you like me to resend the Paystack secure checkout link? "
            "Reply 'resend link' anytime."
        )
    if is_sw:
        return (
            f"Karibu tena. {ref} iko tayari kukamilishwa. "
            "Nitume tena STK ya M-Pesa, au uandike 'resend STK'."
        )
    return (
        f"Welcome back. Your bespoke brief ({ref}) is ready for finalization. "
        "Would you like me to resend the M-Pesa prompt or Paystack link? "
        "Reply 'resend STK' or 'resend link'."
    )


def _out_for_delivery_reply(ctx: HazinaSessionContext, *, is_sw: bool) -> str:
    ref = ctx.public_reference or "your collection"
    if is_sw:
        return (
            f"Habari. {ref} iko njiani na courier wetu wa kibinafsi. "
            "Unaangalia ETA? Niambie, au tumia kiungo cha tracking kilichotumwa."
        )
    return (
        f"Hello. {ref} is currently en route with our private courier. "
        "Are you checking on the ETA? Share your tracking token when they arrive for handoff."
    )


def _ready_for_dispatch_reply(ctx: HazinaSessionContext, *, is_sw: bool) -> str:
    ref = ctx.public_reference or "your collection"
    if is_sw:
        return (
            f"Karibu tena. {ref} imepitia ukaguzi wa mwisho na iko tayari kwa uwasilishaji. "
            "Courier ataanza haraka — nitakujulisha pindi itakapoondoka."
        )
    return (
        f"Welcome back. {ref} has passed final quality checks and is being prepared for transfer. "
        "Our concierge courier will be in touch shortly."
    )


def _checkout_resume_reply(ctx: HazinaSessionContext, *, is_sw: bool) -> str:
    product = str((ctx.checkout or {}).get("product_name") or "your collection").strip()
    if is_sw:
        return (
            f"Karibu tena — bado tunakamilisha maelezo ya {product}. "
            "Endelea na jibu lako la mwisho, au andika 'cancel checkout' kuanza upya."
        )
    return (
        f"Welcome back — we were still finalizing your brief for {product}. "
        "Continue with your last answer, or type 'cancel checkout' to start fresh."
    )
