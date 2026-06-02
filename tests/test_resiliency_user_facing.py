from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def test_zero_trace_global_exception_leakage(client: TestClient) -> None:
    """
    CONTRACT: internal exceptions are sanitized by global exception handler.
    """

    @app.get("/__test_force_500__", include_in_schema=False)
    async def _force_500():
        raise RuntimeError("boom: internal stack detail")

    response = client.get("/__test_force_500__")
    assert response.status_code == 500
    data = response.json()
    assert "detail" in data
    assert "An internal error occurred" in data["detail"]
    assert "File " not in response.text
    assert "line " not in response.text
    assert "RuntimeError" not in response.text


def test_tracking_shield_rejection(client: TestClient) -> None:
    """
    CONTRACT: public tracking endpoint rejects requests without token.
    """
    response = client.get("/api/public/orders/HN-ORD-12345")
    assert response.status_code in [401, 403, 404, 422]
    if response.status_code in [401, 403]:
        assert "unauthorized" in response.json().get("detail", "").lower()
