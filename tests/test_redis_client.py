from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest

from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailable
from app.core.redis_client import claim_idempotency, claim_with_result
from app.services.session_manager import acquire_session


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_idempotency_claim_fails_closed_in_prod(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    get_settings.cache_clear()

    async def _redis_down():
        raise OSError("redis down")

    monkeypatch.setattr("app.core.redis_client.get_redis", _redis_down)

    with pytest.raises(ServiceUnavailable):
        await claim_idempotency("payment:webhook:1")


@pytest.mark.asyncio
async def test_result_idempotency_claim_fails_closed_in_prod(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    get_settings.cache_clear()

    async def _redis_down():
        raise OSError("redis down")

    monkeypatch.setattr("app.core.redis_client.get_redis", _redis_down)

    with pytest.raises(ServiceUnavailable):
        await claim_with_result("tool:payment:1")


@pytest.mark.asyncio
async def test_session_lock_contention_does_not_use_pg_advisory(monkeypatch) -> None:
    @asynccontextmanager
    async def _contended_lock(*args, **kwargs):
        yield False

    monkeypatch.setattr("app.services.session_manager.msisdn_lock", _contended_lock)
    db = AsyncMock()

    async with acquire_session("+254700000001", db) as acquired:
        assert acquired is False

    db.execute.assert_not_awaited()
