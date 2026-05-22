"""Unit tests for the outbound webhook dispatcher.

We isolate the deterministic helpers (signing, retry logic, dedup lock)
and stub the HTTP / DB / Redis side-effects. No service containers
required.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services import webhook_dispatcher as wd


def _client_with(transport: httpx.MockTransport):
    """Factory used to swap ``httpx.AsyncClient`` inside the dispatcher
    module so every request is served by our MockTransport. We bind to
    the real class via the kwarg, so no recursion."""
    _real = httpx.AsyncClient

    def factory(*args, **kwargs):
        # Strip any caller-supplied transport so ours wins.
        kwargs.pop("transport", None)
        return _real(transport=transport, **kwargs)

    return factory


# ── _sign ────────────────────────────────────────────────────────────

class TestSign:
    def test_signature_format(self) -> None:
        sig = wd._sign("secret", b"hello")
        assert sig.startswith("sha256=")
        # Length: prefix (7) + hex digest (64) = 71
        assert len(sig) == 71

    def test_signature_matches_hmac(self) -> None:
        body = b'{"event":"payment.completed"}'
        expected = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
        assert wd._sign("s3cret", body) == expected

    def test_different_secrets_produce_different_sigs(self) -> None:
        body = b"abc"
        assert wd._sign("a", body) != wd._sign("b", body)


# ── _extract_business_id ─────────────────────────────────────────────

class TestExtractBusinessId:
    def test_extracts_from_payload(self) -> None:
        evt = {"type": "x", "payload": {"business_id": "biz-123"}}
        assert wd._extract_business_id(evt) == "biz-123"

    def test_missing_returns_none(self) -> None:
        assert wd._extract_business_id({"type": "x", "payload": {}}) is None

    def test_no_payload_returns_none(self) -> None:
        assert wd._extract_business_id({"type": "x"}) is None

    def test_coerces_uuid_to_str(self) -> None:
        import uuid
        u = uuid.uuid4()
        assert wd._extract_business_id({"payload": {"business_id": u}}) == str(u)


# ── _post_with_retries ───────────────────────────────────────────────

class _FakeEndpoint:
    """Stand-in for a WebhookEndpoint row — only needs the fields the
    dispatcher reads. Avoids spinning up SQLAlchemy for these tests."""

    def __init__(self, url: str = "https://example.test/hook") -> None:
        self.url = url
        self.secret = "secret"


@pytest.mark.asyncio
class TestPostWithRetries:
    async def test_2xx_returns_immediately(self) -> None:
        ep = _FakeEndpoint()
        calls = {"n": 0}

        async def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            return httpx.Response(200)

        transport = httpx.MockTransport(handler)
        with patch.object(wd.httpx, "AsyncClient", _client_with(transport)):
            status, err = await wd._post_with_retries(ep, b"{}", "sig")
        assert status == 200
        assert err is None
        assert calls["n"] == 1

    async def test_4xx_not_retried(self) -> None:
        ep = _FakeEndpoint()
        calls = {"n": 0}

        async def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            return httpx.Response(400)

        transport = httpx.MockTransport(handler)
        with patch.object(wd.httpx, "AsyncClient", _client_with(transport)):
            status, err = await wd._post_with_retries(ep, b"{}", "sig")
        assert status == 400
        assert err == "http_400"
        assert calls["n"] == 1  # no retry on permanent 4xx

    async def test_429_is_retried(self, monkeypatch) -> None:
        ep = _FakeEndpoint()
        calls = {"n": 0}

        async def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            return httpx.Response(429)

        transport = httpx.MockTransport(handler)
        async def _no_sleep(*_a, **_kw): return None
        monkeypatch.setattr("asyncio.sleep", _no_sleep)
        with patch.object(wd.httpx, "AsyncClient", _client_with(transport)):
            status, err = await wd._post_with_retries(ep, b"{}", "sig")
        assert status == 429
        assert calls["n"] == 3  # all 3 attempts used

    async def test_5xx_retried_until_success(self, monkeypatch) -> None:
        ep = _FakeEndpoint()
        calls = {"n": 0}

        async def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            return httpx.Response(500 if calls["n"] < 2 else 200)

        transport = httpx.MockTransport(handler)
        async def _no_sleep(*_a, **_kw): return None
        monkeypatch.setattr("asyncio.sleep", _no_sleep)
        with patch.object(wd.httpx, "AsyncClient", _client_with(transport)):
            status, err = await wd._post_with_retries(ep, b"{}", "sig")
        assert status == 200
        assert err is None
        assert calls["n"] == 2

    async def test_connection_error_retried_then_fails(self, monkeypatch) -> None:
        ep = _FakeEndpoint()
        calls = {"n": 0}

        async def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            raise httpx.ConnectError("nope", request=request)

        transport = httpx.MockTransport(handler)
        async def _no_sleep(*_a, **_kw): return None
        monkeypatch.setattr("asyncio.sleep", _no_sleep)
        with patch.object(wd.httpx, "AsyncClient", _client_with(transport)):
            status, err = await wd._post_with_retries(ep, b"{}", "sig")
        assert status is None
        assert err == "ConnectError"
        assert calls["n"] == 3


# ── _claim_dispatch (cross-worker dedup) ────────────────────────────

@pytest.mark.asyncio
class TestClaimDispatch:
    async def test_first_call_wins(self) -> None:
        fake = MagicMock()
        fake.set = AsyncMock(return_value=True)
        with patch("app.services.webhook_dispatcher.get_redis", AsyncMock(return_value=fake)):
            won = await wd._claim_dispatch({
                "type": "payment.completed", "target": "t",
                "ts": "2025-01-01", "origin": "w1",
            })
        assert won is True
        fake.set.assert_awaited_once()
        # Must use NX semantics — otherwise dedup is broken across workers.
        kwargs = fake.set.await_args.kwargs
        assert kwargs.get("nx") is True
        assert kwargs.get("ex") == wd._DISPATCH_LOCK_TTL

    async def test_second_call_loses(self) -> None:
        fake = MagicMock()
        fake.set = AsyncMock(return_value=None)  # NX failed
        with patch("app.services.webhook_dispatcher.get_redis", AsyncMock(return_value=fake)):
            won = await wd._claim_dispatch({"type": "x", "target": "", "ts": "", "origin": ""})
        assert won is False

    async def test_redis_failure_fails_open(self) -> None:
        """If Redis is unreachable we'd rather deliver than swallow."""
        async def boom():
            raise RuntimeError("redis down")
        with patch("app.services.webhook_dispatcher.get_redis", boom):
            won = await wd._claim_dispatch({"type": "x"})
        assert won is True


# ── Event subscription wiring ────────────────────────────────────────

class TestSubscriptions:
    def test_all_dispatchable_events_have_handlers(self) -> None:
        from app.core.event_bus import _handlers
        for et in wd._DISPATCHABLE:
            assert et in _handlers, f"no handler registered for {et}"
            assert wd._handle in _handlers[et]

    def test_voice_events_not_dispatched(self) -> None:
        """Voice events are inter-worker control messages, not customer
        events. They must NEVER be sent to outbound webhooks."""
        from app.core.event_bus import EVT_VOICE_HANGUP, EVT_VOICE_SAY
        assert EVT_VOICE_HANGUP not in wd._DISPATCHABLE
        assert EVT_VOICE_SAY not in wd._DISPATCHABLE


# ── _handle integration (event → empty endpoint list short-circuit) ─

@pytest.mark.asyncio
class TestHandle:
    async def test_event_with_no_business_id_ignored(self) -> None:
        # Should bail early — no DB hit.
        with patch("app.services.webhook_dispatcher._claim_dispatch") as claim:
            await wd._handle({"type": "payment.completed", "payload": {}})
        claim.assert_not_called()

    async def test_event_not_in_allowlist_ignored(self) -> None:
        with patch("app.services.webhook_dispatcher._claim_dispatch") as claim:
            await wd._handle({"type": "voice.hangup", "payload": {"business_id": "x"}})
        claim.assert_not_called()
