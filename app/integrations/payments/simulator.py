"""A simple payment simulator for demos and local testing.

Returns deterministic `PaymentResult` objects without contacting third
party providers. Used when `settings.payment_simulator` is true.
"""
import asyncio
import time
import uuid
from dataclasses import asdict

from app.integrations.payments.base import PaymentResult, PaymentService


class SimulatorAdapter:
    name = "simulator"

    async def request_payment(self, *, msisdn: str, amount: float, reference: str, currency: str = "KES", description: str = "Payment", email: str | None = None) -> PaymentResult:
        # Simulate network delay
        await asyncio.sleep(0.2)
        ref = f"sim-{uuid.uuid4().hex[:12]}"
        # For demo flows we mark as pending (like an STK push) but include a
        # synthetic redirect URL so the UI can show a checkout experience.
        return PaymentResult(provider=self.name, reference=ref, status="pending", redirect_url=f"https://demo.pay/s/{ref}", raw={"simulated": True, "msisdn": msisdn, "amount": amount, "ref": ref})

    def verify_callback(self, *, headers: dict, raw_body: bytes) -> bool:
        # Always accept simulator callbacks in dev/demo mode
        return True

    def parse_callback(self, payload: dict) -> PaymentResult:
        # Expect payload like {"status":"paid","reference":"sim-..."}
        status = payload.get("status", "paid")
        ref = payload.get("reference") or payload.get("invoice_id") or "sim-unknown"
        return PaymentResult(provider=self.name, reference=ref, status=("paid" if status=="paid" else "failed"), raw=payload)
