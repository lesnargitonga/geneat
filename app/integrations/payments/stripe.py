"""Stripe adapter — global card processing. Use for US/UK/EU markets."""
import hashlib
import hmac
import time
from typing import Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.core.config import get_settings
from app.core.exceptions import UpstreamError
from app.core.logging import get_logger
from app.integrations.payments.base import PaymentResult

log = get_logger("stripe")


class StripeAdapter:
    name = "stripe"
    base = "https://api.stripe.com/v1"

    @retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.5, max=3.0))
    async def request_payment(
        self,
        *,
        msisdn: str,
        amount: float,
        reference: str,
        currency: str = "USD",
        description: str = "Payment",
        email: Optional[str] = None,
    ) -> PaymentResult:
        s = get_settings()
        sk = getattr(s, "stripe_secret_key", None)
        success_url = getattr(s, "stripe_success_url", "https://example.com/ok")
        cancel_url = getattr(s, "stripe_cancel_url", "https://example.com/cancel")
        if not sk:
            raise UpstreamError("stripe credentials missing")
        sk_val = sk.get_secret_value() if hasattr(sk, "get_secret_value") else sk
        data = {
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": reference[:200],
            "line_items[0][price_data][currency]": currency.lower(),
            "line_items[0][price_data][product_data][name]": description[:100],
            "line_items[0][price_data][unit_amount]": str(int(round(amount * 100))),
            "line_items[0][quantity]": "1",
        }
        if email:
            data["customer_email"] = email
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{self.base}/checkout/sessions",
                data=data,
                headers={"Authorization": f"Bearer {sk_val}"},
            )
            if r.status_code >= 400:
                raise UpstreamError(f"stripe session failed: {r.status_code} {r.text[:300]}")
            j = r.json()
        return PaymentResult(
            provider=self.name,
            reference=j.get("id", reference),
            status="pending",
            redirect_url=j.get("url"),
            raw=j,
        )

    def verify_callback(self, *, headers: dict, raw_body: bytes) -> bool:
        s = get_settings()
        secret = getattr(s, "stripe_webhook_secret", None)
        secret_val = secret.get_secret_value() if hasattr(secret, "get_secret_value") else (secret or "")
        if not secret_val:
            return False
        sig_header = headers.get("stripe-signature") or headers.get("Stripe-Signature") or ""
        parts: dict[str, list[str]] = {}
        for item in sig_header.split(","):
            if "=" not in item:
                continue
            k, v = item.split("=", 1)
            parts.setdefault(k.strip(), []).append(v.strip())
        ts = (parts.get("t") or [""])[0]
        signatures = parts.get("v1") or []
        if not ts or not signatures:
            return False
        try:
            ts_int = int(ts)
        except ValueError:
            return False
        if abs(time.time() - ts_int) > 300:
            return False
        signed_payload = ts.encode() + b"." + raw_body
        expected = hmac.new(secret_val.encode(), signed_payload, hashlib.sha256).hexdigest()
        return any(hmac.compare_digest(expected, sig) for sig in signatures)

    def parse_callback(self, payload: dict) -> PaymentResult:
        ev = payload.get("type", "")
        obj = (payload.get("data") or {}).get("object", {})
        status_map = {
            "checkout.session.completed": "paid",
            "payment_intent.succeeded": "paid",
            "payment_intent.payment_failed": "failed",
        }
        reference = obj.get("id") or obj.get("client_reference_id") or ""
        return PaymentResult(
            provider=self.name,
            reference=reference,
            status=status_map.get(ev, "pending"),
            raw=obj,
        )
