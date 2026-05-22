"""Pick the active payment adapter from settings.PAYMENT_PROVIDER."""
from functools import lru_cache

from app.core.config import get_settings
from app.integrations.payments.base import PaymentService


@lru_cache(maxsize=1)
def get_payment_service() -> PaymentService:
    settings = get_settings()
    # Allow an explicit simulator override for demos/local testing.
    if getattr(settings, "payment_simulator", False):
        from app.integrations.payments.simulator import SimulatorAdapter
        return SimulatorAdapter()
    provider = (getattr(settings, "payment_provider", "daraja") or "daraja").lower()
    if provider == "intasend":
        from app.integrations.payments.intasend import IntaSendAdapter
        return IntaSendAdapter()
    if provider == "paystack":
        from app.integrations.payments.paystack import PaystackAdapter
        return PaystackAdapter()
    if provider == "stripe":
        from app.integrations.payments.stripe import StripeAdapter
        return StripeAdapter()
    from app.integrations.payments.daraja import DarajaAdapter
    return DarajaAdapter()
