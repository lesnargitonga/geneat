"""Shared payment-service contract."""
from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class PaymentResult:
    provider: str
    reference: str               # provider's transaction/checkout id
    status: str                  # "pending" | "paid" | "failed"
    redirect_url: Optional[str] = None  # for hosted-checkout providers (Stripe/Paystack)
    raw: Optional[dict] = None


class PaymentService(Protocol):
    name: str

    async def request_payment(
        self,
        *,
        msisdn: str,
        amount: float,
        reference: str,
        currency: str = "KES",
        description: str = "Payment",
        email: Optional[str] = None,
    ) -> PaymentResult: ...

    def verify_callback(self, *, headers: dict, raw_body: bytes) -> bool: ...

    def parse_callback(self, payload: dict) -> PaymentResult: ...
