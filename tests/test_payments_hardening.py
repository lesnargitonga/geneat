from __future__ import annotations

import hashlib
import hmac
import time
import uuid

import pytest

from app.core.config import get_settings
from app.db.models import Order
from app.integrations.payments.intasend import IntaSendAdapter
from app.integrations.payments.stripe import StripeAdapter


@pytest.fixture(autouse=True)
def _clear_settings_cache_after():
    yield
    get_settings.cache_clear()


def _reset_settings(monkeypatch, **env: str) -> None:
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def test_intasend_rejects_empty_secret_in_prod(monkeypatch):
    _reset_settings(
        monkeypatch,
        APP_ENV="prod",
        INTASEND_WEBHOOK_SECRET="",
    )
    assert IntaSendAdapter().verify_callback(headers={}, raw_body=b"{}") is False


def test_intasend_allows_empty_secret_outside_prod(monkeypatch):
    _reset_settings(
        monkeypatch,
        APP_ENV="test",
        INTASEND_WEBHOOK_SECRET="",
    )
    assert IntaSendAdapter().verify_callback(headers={}, raw_body=b"{}") is True


def test_intasend_hmac_verification(monkeypatch):
    raw = b'{"state":"COMPLETE"}'
    secret = "whsec_intasend"
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    _reset_settings(
        monkeypatch,
        APP_ENV="prod",
        INTASEND_WEBHOOK_SECRET=secret,
    )
    adapter = IntaSendAdapter()
    assert adapter.verify_callback(headers={"x-intasend-signature": sig}, raw_body=raw) is True
    assert adapter.verify_callback(headers={"x-intasend-signature": "bad"}, raw_body=raw) is False


def test_intasend_parse_nested_invoice_payload():
    parsed = IntaSendAdapter().parse_callback({
        "invoice": {
            "invoice_id": "KZ3B67R",
            "state": "COMPLETE",
            "api_ref": "ORDER-123",
        }
    })
    assert parsed.reference == "KZ3B67R"
    assert parsed.status == "paid"
    assert parsed.raw == {
        "invoice_id": "KZ3B67R",
        "state": "COMPLETE",
        "api_ref": "ORDER-123",
    }


def test_stripe_hmac_verification(monkeypatch):
    raw = b'{"type":"checkout.session.completed"}'
    secret = "whsec_stripe"
    ts = str(int(time.time()))
    signed = ts.encode() + b"." + raw
    sig = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    _reset_settings(monkeypatch, APP_ENV="prod", STRIPE_WEBHOOK_SECRET=secret)
    adapter = StripeAdapter()
    assert adapter.verify_callback(
        headers={"stripe-signature": f"t={ts},v1={sig}"},
        raw_body=raw,
    ) is True
    assert adapter.verify_callback(
        headers={"stripe-signature": f"t={ts},v1=deadbeef"},
        raw_body=raw,
    ) is False


def test_stripe_parse_uses_checkout_session_id_for_order_match():
    parsed = StripeAdapter().parse_callback({
        "type": "checkout.session.completed",
        "data": {"object": {"id": "cs_test_123", "client_reference_id": "ORDER1"}},
    })
    assert parsed.status == "paid"
    assert parsed.reference == "cs_test_123"


def test_payment_simulator_skips_real_provider_config_errors():
    from app.core.config import Settings
    from app.core.config_validator import validate_settings

    settings = Settings(
        app_env="test",
        llm_provider="local",
        payment_provider="intasend",
        payment_simulator=True,
        intasend_api_token="",
        intasend_webhook_secret="",
        phone_hash_pepper="pepper",
        database_url="sqlite+aiosqlite:///:memory:",
    )
    errors, _warnings = validate_settings(settings)
    assert not errors


def test_receipt_message_includes_items_amount_and_reference():
    from app.api.payments import _receipt_message

    order_id = uuid.UUID("11111111-2222-3333-4444-555555555555")
    order = Order(
        id=order_id,
        customer_id=uuid.uuid4(),
        amount=10,
        details={
            "items": [
                {"sku_or_name": "Demo Espresso", "qty": 1, "unit_price": 10},
            ],
        },
    )

    msg = _receipt_message(
        order,
        provider="intasend",
        receipt="INV-123",
        amount_paid=10,
        business_name="Lily Pond Cafe",
    )

    assert "Lily Pond Cafe receipt" in msg
    assert "Order: 11111111" in msg
    assert "1 x Demo Espresso @ KES 10" in msg
    assert "Paid: KES 10 via IntaSend" in msg
    assert "Reference: INV-123" in msg


def test_payment_failed_message_uses_customer_language():
    from app.api.payments import _payment_failed_message

    english = _payment_failed_message(language="en")
    swahili = _payment_failed_message(language="sw")

    assert "Payment did not go through" in english
    assert "order is not confirmed yet" in english
    assert "Malipo hayajapita" in swahili
    assert "haijathibitishwa" in swahili


@pytest.mark.asyncio
async def test_order_business_id_backfills_from_conversation():
    from app.api.payments import _business_id_for_order

    bid = uuid.uuid4()
    conv_id = uuid.uuid4()
    order = Order(
        customer_id=uuid.uuid4(),
        conversation_id=conv_id,
        amount=100,
    )

    class _Result:
        def scalar_one_or_none(self):
            return bid

    class _DB:
        async def execute(self, _stmt):
            return _Result()

    assert await _business_id_for_order(_DB(), order) == bid
    assert order.business_id == bid
