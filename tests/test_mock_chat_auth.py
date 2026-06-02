"""Production guard on /mock/message — portal must present ADMIN_API_TOKEN."""
from __future__ import annotations

import os
import secrets

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


@pytest.fixture
def prod_mock_client(monkeypatch):
    token = secrets.token_urlsafe(32)
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("ADMIN_API_TOKEN", token)
    get_settings.cache_clear()
    client = TestClient(app)
    yield client, token
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", os.environ.get("APP_ENV", "test"))


def test_mock_message_rejects_unauthenticated_in_prod(prod_mock_client):
    client, _token = prod_mock_client
    r = client.post(
        "/mock/message",
        json={"phone": "+254700000001", "text": "menu", "business_slug": "hazina-nomads"},
    )
    assert r.status_code == 401


def test_mock_message_accepts_admin_token_in_prod(prod_mock_client, monkeypatch):
    client, token = prod_mock_client

    async def _handle_inbound(db, turn):
        from app.channels.base import TurnResult

        return TurnResult(reply="ok", conversation_id=__import__("uuid").uuid4(), escalated=False)

    monkeypatch.setattr("app.api.mock.handle_inbound", _handle_inbound)
    r = client.post(
        "/mock/message",
        json={"phone": "+254700000001", "text": "menu", "business_slug": "hazina-nomads"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["reply"] == "ok"
