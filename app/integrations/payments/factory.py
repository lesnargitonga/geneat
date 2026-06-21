"""Pick the active payment adapter from settings and order context."""
from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.core.exceptions import UpstreamError
from app.integrations.payments.base import PaymentService


def _paystack_configured(settings) -> bool:
    sk = getattr(settings, "paystack_secret_key", None)
    if sk is None:
        return False
    val = sk.get_secret_value() if hasattr(sk, "get_secret_value") else str(sk)
    return bool(val.strip())


def _intasend_configured(settings) -> bool:
    tok = getattr(settings, "intasend_api_token", None)
    if tok is None:
        return False
    val = tok.get_secret_value() if hasattr(tok, "get_secret_value") else str(tok)
    return bool(val.strip())


def _intasend_checkout_configured(settings) -> bool:
    key = getattr(settings, "intasend_publishable_key", None)
    value = key.get_secret_value() if hasattr(key, "get_secret_value") else str(key or "")
    return _intasend_configured(settings) and bool(value.strip())


def resolve_payment_service(
    *,
    currency: str = "KES",
    method: str | None = None,
) -> PaymentService:
    """Route KES M-Pesa to IntaSend and USD card checkout to Paystack.

    Falls back to ``PAYMENT_PROVIDER`` when hybrid keys are missing.
    """
    settings = get_settings()
    if getattr(settings, "payment_simulator", False):
        from app.integrations.payments.simulator import SimulatorAdapter

        return SimulatorAdapter()

    cur = (currency or "KES").upper()
    pref = (method or "").lower()

    if cur == "USD" or pref in {"card", "paystack", "visa", "mastercard", "apple_pay"}:
        if _paystack_configured(settings):
            from app.integrations.payments.paystack import PaystackAdapter

            return PaystackAdapter()
        if _intasend_checkout_configured(settings):
            from app.integrations.payments.intasend import IntaSendAdapter

            return IntaSendAdapter()
        provider = (getattr(settings, "payment_provider", "daraja") or "daraja").lower()
        if provider == "paystack":
            from app.integrations.payments.paystack import PaystackAdapter

            return PaystackAdapter()
        raise UpstreamError(
            "Card checkout requires PAYSTACK_SECRET_KEY or both "
            "INTASEND_API_TOKEN and INTASEND_PUBLISHABLE_KEY."
        )

    if _intasend_configured(settings):
        from app.integrations.payments.intasend import IntaSendAdapter

        return IntaSendAdapter()
    provider = (getattr(settings, "payment_provider", "daraja") or "daraja").lower()
    if provider == "intasend":
        from app.integrations.payments.intasend import IntaSendAdapter

        return IntaSendAdapter()
    if provider == "paystack" and _paystack_configured(settings):
        from app.integrations.payments.paystack import PaystackAdapter

        return PaystackAdapter()
    if provider == "stripe":
        from app.integrations.payments.stripe import StripeAdapter

        return StripeAdapter()
    if provider == "paystack":
        from app.integrations.payments.paystack import PaystackAdapter

        return PaystackAdapter()
    from app.integrations.payments.daraja import DarajaAdapter

    return DarajaAdapter()


@lru_cache(maxsize=1)
def get_payment_service() -> PaymentService:
    """Legacy single-provider lookup — uses ``PAYMENT_PROVIDER`` env."""
    return resolve_payment_service(currency="KES")
