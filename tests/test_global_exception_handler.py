"""Global Exception handler — sanitized 500 responses."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def test_unhandled_exception_returns_sanitized_500(client, monkeypatch):
    monkeypatch.setattr("sentry_sdk.capture_exception", MagicMock())

    @app.get("/__test_boom__", include_in_schema=False)
    async def _boom():
        raise RuntimeError("secret internal detail")

    r = client.get("/__test_boom__")
    assert r.status_code == 500
    assert r.json()["detail"] == (
        "An internal error occurred. Our engineering team has been notified."
    )
    assert "secret" not in r.text
