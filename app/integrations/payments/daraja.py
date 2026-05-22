"""Wraps the existing Daraja STK client behind the PaymentService interface."""
from typing import Optional

from app.integrations import mpesa_client
from app.integrations.payments.base import PaymentResult


class DarajaAdapter:
    name = "daraja"

    async def request_payment(
        self,
        *,
        msisdn: str,
        amount: float,
        reference: str,
        currency: str = "KES",
        description: str = "Payment",
        email: Optional[str] = None,
    ) -> PaymentResult:
        res = await mpesa_client.stk_push(
            msisdn=msisdn, amount=amount, reference=reference, description=description,
        )
        return PaymentResult(
            provider=self.name,
            reference=res.get("CheckoutRequestID", ""),
            status="pending",
            raw=res,
        )

    def verify_callback(self, *, headers: dict, raw_body: bytes) -> bool:
        # Daraja: source-IP allowlist + ledger validation in the route.
        return True

    def parse_callback(self, payload: dict) -> PaymentResult:
        stk = (payload.get("Body") or {}).get("stkCallback") or {}
        rc = stk.get("ResultCode")
        status = "paid" if rc == 0 else ("failed" if rc not in (None, 0) else "pending")
        return PaymentResult(
            provider=self.name,
            reference=stk.get("CheckoutRequestID", ""),
            status=status,
            raw=stk,
        )
