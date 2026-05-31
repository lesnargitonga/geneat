from __future__ import annotations

import pytest

from app.integrations.payments.factory import resolve_payment_service


def test_resolve_payment_usd_requires_paystack(monkeypatch) -> None:
    from app.core.config import get_settings

    from app.core.exceptions import UpstreamError

    get_settings.cache_clear()
    monkeypatch.setenv("PAYMENT_SIMULATOR", "false")
    monkeypatch.setenv("PAYMENT_PROVIDER", "intasend")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "")
    monkeypatch.setenv("INTASEND_API_TOKEN", "test-token")
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
