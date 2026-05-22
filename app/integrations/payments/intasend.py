"""IntaSend M-Pesa adapter — fastest path to live revenue in Kenya.

Same-day developer onboarding; no Daraja Go-Live required. The aggregator
debits its own Daraja paybill and settles to your bank/MMF.

Docs: https://developers.intasend.com/docs/m-pesa-stk-push
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

log = get_logger("intasend")


class IntaSendAdapter:
    name = "intasend"

    def _base(self) -> str:
        s = get_settings()
        if getattr(s, "intasend_test_mode", True):
            return "https://sandbox.intasend.com"
        return "https://payment.intasend.com"

    def _auth_headers(self) -> dict[str, str]:
        s = get_settings()
        token = getattr(s, "intasend_api_token", None)
        if not token:
            raise UpstreamError("intasend credentials missing")
        token_value = token.get_secret_value() if hasattr(token, "get_secret_value") else str(token)
        return {"Authorization": f"Bearer {token_value}"}

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
        payload = {
            "amount": int(round(amount)),
            "phone_number": msisdn.lstrip("+"),
            "api_ref": reference[:32],
            "currency": currency,
            "narrative": description[:64],
        }
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{self._base()}/api/v1/payment/mpesa-stk-push/",
                json=payload,
                headers=self._auth_headers(),
            )
            if r.status_code >= 400:
                raise UpstreamError(f"intasend stk failed: {r.status_code} {r.text[:300]}")
            data = r.json()
        return PaymentResult(
            provider=self.name,
            reference=str(data.get("invoice", {}).get("invoice_id") or data.get("id") or ""),
            status="pending",
            raw=data,
        )

    @retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.5, max=3.0))
    async def fetch_status(self, reference: str) -> PaymentResult:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{self._base()}/api/v1/payment/status/",
                json={"invoice_id": reference},
                headers=self._auth_headers(),
            )
            if r.status_code >= 400:
                raise UpstreamError(f"intasend status failed: {r.status_code} {r.text[:300]}")
            data = r.json()
        return self.parse_callback(data)

    def verify_callback(self, *, headers: dict, raw_body: bytes) -> bool:
        s = get_settings()
        secret = getattr(s, "intasend_webhook_secret", None)
        secret_val = secret.get_secret_value() if hasattr(secret, "get_secret_value") else (secret or "")
        if not secret_val:
            return not getattr(s, "is_prod", False)
        sig = headers.get("x-intasend-signature") or headers.get("X-IntaSend-Signature") or ""
        expected = hmac.new(secret_val.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)

    def parse_callback(self, payload: dict) -> PaymentResult:
        invoice = payload.get("invoice") if isinstance(payload.get("invoice"), dict) else payload
        state = (invoice.get("state") or "").upper()
        status = {"COMPLETE": "paid", "FAILED": "failed", "PENDING": "pending"}.get(state, "pending")
        return PaymentResult(
            provider=self.name,
            reference=str(invoice.get("invoice_id") or invoice.get("id") or payload.get("invoice_id") or payload.get("id") or ""),
            status=status,
            raw=invoice if isinstance(invoice, dict) else payload,
        )
