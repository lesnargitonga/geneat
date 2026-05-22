"""PaymentService — region-agnostic payment adapter factory.

Production lesson: Safaricom Daraja "Go Live" approval can take weeks.
Aggregators (IntaSend, Paystack) onboard in hours and handle the
compliance/PCI burden on their side. Stripe covers the rest of the world.

Usage:
    from app.integrations.payments import get_payment_service
    svc = get_payment_service()            # picks adapter from settings.payment_provider
    res = await svc.request_payment(msisdn=..., amount=..., reference=...)

Switching providers is a one-line `.env` change (`PAYMENT_PROVIDER=intasend`).
"""
from app.integrations.payments.base import PaymentService, PaymentResult
from app.integrations.payments.factory import get_payment_service

__all__ = ["PaymentService", "PaymentResult", "get_payment_service"]
