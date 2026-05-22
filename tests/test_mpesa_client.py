"""Phase 4 — M-Pesa Daraja client routed at the in-process mock server."""
from __future__ import annotations

import asyncio
import os

import httpx
import pytest

# Point the Daraja client at our mock app (in-process) via base-url override.
@pytest.fixture
def mock_mpesa(monkeypatch):
    from tests.mocks import mpesa_mock
    transport = httpx.ASGITransport(app=mpesa_mock.app)
    real_async_client = httpx.AsyncClient

    def patched_client(*args, **kwargs):
        kwargs["transport"] = transport
        kwargs["base_url"] = "http://mpesa-mock"
        # Override the URL the client builds — we patch base_url() too.
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr("app.integrations.mpesa_client.base_url", lambda: "http://mpesa-mock")
    monkeypatch.setattr("httpx.AsyncClient", patched_client)

    # Allow rate-limit always
    async def _allowed(_msisdn): return True
    monkeypatch.setattr("app.integrations.mpesa_client.mpesa_stk_allowed", _allowed)

    # Provide creds
    monkeypatch.setenv("MPESA_CONSUMER_KEY", "k")
    monkeypatch.setenv("MPESA_CONSUMER_SECRET", "s")
    # Re-build settings cache:
    from app.core.config import get_settings
    get_settings.cache_clear()
    yield mpesa_mock


@pytest.mark.asyncio
async def test_stk_push_returns_checkout_id(mock_mpesa, fake_redis):
    from app.integrations import mpesa_client
    res = await mpesa_client.stk_push(
        msisdn="+254700000001", amount=100, reference="ORDER1", description="test",
    )
    assert res["ResponseCode"] == "0"
    assert res["CheckoutRequestID"].startswith("ws_CO_")
