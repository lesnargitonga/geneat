from __future__ import annotations

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
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "")
    get_settings.cache_clear()

    svc = resolve_payment_service(currency="USD")
    assert svc.name == "intasend"


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
        seen["json"] = request.read().decode()
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
    assert seen["public_key"] == "public-token"
    assert seen["auth"] == "Bearer secret-token"


@pytest.mark.asyncio
async def test_intasend_usd_checkout_works_without_publishable_key(monkeypatch) -> None:
    from app.core.config import get_settings
    from app.integrations.payments import intasend as module
    from app.integrations.payments.intasend import IntaSendAdapter

    get_settings.cache_clear()
    monkeypatch.setenv("INTASEND_API_TOKEN", "secret-token")
    monkeypatch.setenv("INTASEND_PUBLISHABLE_KEY", "")
    monkeypatch.setenv("INTASEND_TEST_MODE", "false")
    get_settings.cache_clear()

    seen: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        seen["public_key"] = request.headers.get("x-intasend-public-api-key")
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"id": "checkout_456", "url": "https://payment.intasend.com/checkout/checkout_456"})

    transport = httpx.MockTransport(handler)
    real_client = module.httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(module.httpx, "AsyncClient", client_factory)

    result = await IntaSendAdapter().request_payment(
        msisdn="+254700000000",
        amount=249,
        reference="HN-ORD-2",
        currency="USD",
    )

    assert result.redirect_url == "https://payment.intasend.com/checkout/checkout_456"
    assert seen["public_key"] is None
    assert seen["auth"] == "Bearer secret-token"
