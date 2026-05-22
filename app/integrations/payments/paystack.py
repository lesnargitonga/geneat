"""Paystack adapter — Kenya/Nigeria/Ghana/SA. 24-48h compliance review.

Best when you need both card + mobile-money in one provider. The standard
flow is hosted checkout (initialize → redirect → callback).

Docs: https://paystack.com/docs/api/transaction
"""
import hmac
import hashlib
from typing import Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.core.config import get_settings
from app.core.exceptions import UpstreamError
from app.core.logging import get_logger
from app.integrations.payments.base import PaymentResult

log = get_logger("paystack")


class PaystackAdapter:
    name = "paystack"
    base = "https://api.paystack.co"

    @retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.5, max=3.0))
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
        s = get_settings()
        sk = getattr(s, "paystack_secret_key", None)
        if not sk:
            raise UpstreamError("paystack credentials missing")
        sk_val = sk.get_secret_value() if hasattr(sk, "get_secret_value") else sk
        payload = {
            "amount": int(round(amount * 100)),  # paystack uses minor units
            "email": email or f"{msisdn.lstrip('+')}@no-reply.local",
            "currency": currency,
            "reference": reference[:64],
            "metadata": {"phone": msisdn, "description": description},
        }
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{self.base}/transaction/initialize",
                json=payload,
                headers={"Authorization": f"Bearer {sk_val}"},
            )
            if r.status_code >= 400:
                raise UpstreamError(f"paystack init failed: {r.status_code} {r.text[:300]}")
            data = r.json().get("data", {})
        return PaymentResult(
            provider=self.name,
            reference=data.get("reference", reference),
            status="pending",
            redirect_url=data.get("authorization_url"),
            raw=data,
        )

    def verify_callback(self, *, headers: dict, raw_body: bytes) -> bool:
        s = get_settings()
        sk = getattr(s, "paystack_secret_key", None)
        sk_val = sk.get_secret_value() if hasattr(sk, "get_secret_value") else (sk or "")
        if not sk_val:
            return False
        sig = headers.get("x-paystack-signature") or headers.get("X-Paystack-Signature") or ""
        expected = hmac.new(sk_val.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(sig, expected)

    def parse_callback(self, payload: dict) -> PaymentResult:
        event = payload.get("event", "")
        data = payload.get("data", {})
        status = "paid" if event == "charge.success" else (
            "failed" if "failed" in event else "pending"
        )
        return PaymentResult(
            provider=self.name,
            reference=str(data.get("reference") or ""),
            status=status,
            raw=data,
        )
