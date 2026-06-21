from __future__ import annotations

import json

import httpx
import pytest

from app.integrations.payments.factory import resolve_payment_service


def test_resolve_payment_usd_requires_card_provider(monkeypatch) -> None:
    from app.core.config import get_settings

    from app.core.exceptions import UpstreamError

    get_settings.cache_clear()
    monkeypatch.setenv("PAYMENT_SIMULATOR", "false")
    monkeypatch.setenv("PAYMENT_PROVIDER", "intasend")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "")
    monkeypatch.setenv("INTASEND_API_TOKEN", "")
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "")
    get_settings.cache_clear()

    with pytest.raises(UpstreamError):
        resolve_payment_service(currency="USD")


def test_resolve_payment_kes_prefers_intasend(monkeypatch) -> None:
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("PAYMENT_SIMULATOR", "false")
    monkeypatch.setenv("PAYMENT_PROVIDER", "intasend")
    monkeypatch.setenv("INTASEND_API_TOKEN", "test-token")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test_x")
    get_settings.cache_clear()

    svc = resolve_payment_service(currency="KES")
    assert svc.name == "intasend"


def test_resolve_payment_usd_uses_paystack(monkeypatch) -> None:
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("PAYMENT_SIMULATOR", "false")
    monkeypatch.setenv("PAYMENT_PROVIDER", "intasend")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("INTASEND_API_TOKEN", "test-token")
    get_settings.cache_clear()

    svc = resolve_payment_service(currency="USD")
    assert svc.name == "paystack"


def test_resolve_payment_usd_falls_back_to_intasend_checkout(monkeypatch) -> None:
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("PAYMENT_SIMULATOR", "false")
    monkeypatch.setenv("PAYMENT_PROVIDER", "intasend")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "")
    monkeypatch.setenv("INTASEND_API_TOKEN", "test-token")
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "public-token")
    get_settings.cache_clear()

    svc = resolve_payment_service(currency="USD")
    assert svc.name == "intasend"


def test_resolve_payment_usd_does_not_treat_intasend_secret_as_checkout_key(monkeypatch) -> None:
    from app.core.config import get_settings
    from app.core.exceptions import UpstreamError

    monkeypatch.setenv("PAYMENT_SIMULATOR", "false")
    monkeypatch.setenv("PAYMENT_PROVIDER", "intasend")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "")
    monkeypatch.setenv("INTASEND_API_TOKEN", "test-token")
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "")
    get_settings.cache_clear()

    with pytest.raises(UpstreamError, match="INTASEND_PUBLISHABLE_KEY"):
        resolve_payment_service(currency="USD")


@pytest.mark.asyncio
async def test_intasend_usd_checkout_returns_redirect(monkeypatch) -> None:
    from app.core.config import get_settings
    from app.integrations.payments import intasend as module
    from app.integrations.payments.intasend import IntaSendAdapter

    get_settings.cache_clear()
    monkeypatch.setenv("INTASEND_API_TOKEN", "secret-token")
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "public-token")
    monkeypatch.setenv("INTASEND_TEST_MODE", "false")
    get_settings.cache_clear()

    seen: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["public_key"] = request.headers.get("x-intasend-public-api-key")
        seen["auth"] = request.headers.get("authorization")
        body = json.loads(request.read().decode())
        seen["body"] = body
        return httpx.Response(
            200,
            json={
                "id": "checkout_123",
                "checkout_url": "https://payment.intasend.com/checkout/checkout_123",
            },
        )

    transport = httpx.MockTransport(handler)
    real_client = module.httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(module.httpx, "AsyncClient", client_factory)

    result = await IntaSendAdapter().request_payment(
        msisdn="+254700000000",
        amount=249,
        reference="HN-ORD-1",
        currency="USD",
        description="Hazina checkout",
        email="guest@example.com",
    )

    assert result.provider == "intasend"
    assert result.redirect_url == "https://payment.intasend.com/checkout/checkout_123"
    assert result.reference == "checkout_123"
    assert seen["url"] == "https://api.intasend.com/api/v1/checkout/"
    assert seen["public_key"] == "public-token"
    assert seen["auth"] is None
    assert seen["body"]["amount"] == "249.0"
    assert seen["body"]["currency"] == "USD"
    assert seen["body"]["method"] == "CARD-PAYMENT"
    assert "public_key" not in seen["body"]


@pytest.mark.asyncio
async def test_intasend_usd_checkout_requires_publishable_key(monkeypatch) -> None:
    from app.core.config import get_settings
    from app.core.exceptions import UpstreamError
    from app.integrations.payments.intasend import IntaSendAdapter

    get_settings.cache_clear()
    monkeypatch.setenv("INTASEND_API_TOKEN", "secret-token")
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "")
    monkeypatch.setenv("INTASEND_TEST_MODE", "false")
    get_settings.cache_clear()

    with pytest.raises(UpstreamError, match="publishable key missing"):
        await IntaSendAdapter().request_payment(
            msisdn="+254700000000",
            amount=249,
            reference="HN-ORD-2",
            currency="USD",
        )
