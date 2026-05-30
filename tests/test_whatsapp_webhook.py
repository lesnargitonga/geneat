"""Phase 3 — WhatsApp webhook verification + signature handling.

Uses FastAPI TestClient + a stub WhatsApp send so we don't hit the network.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time

import pytest
from fastapi.testclient import TestClient

TEST_META_WA_APP_SECRET = os.environ.setdefault("META_WA_APP_SECRET", secrets.token_urlsafe(48))
TEST_META_WA_VERIFY_TOKEN = os.environ.setdefault("META_WA_VERIFY_TOKEN", secrets.token_urlsafe(32))

from app.main import app  # noqa: E402


@pytest.fixture
def client(monkeypatch):
    # Stub Meta outbound send so nothing leaves the process.
    async def _send(to, text): return {"stub": True, "to": to, "chars": len(text)}
    monkeypatch.setattr("app.integrations.whatsapp_client.send_text", _send)
    monkeypatch.setattr("app.channels.whatsapp.send_text", _send)
    return TestClient(app)


def test_wa_verify_handshake(client):
    r = client.get("/webhooks/whatsapp", params={
        "hub.mode": "subscribe", "hub.challenge": "12345",
        "hub.verify_token": TEST_META_WA_VERIFY_TOKEN,
    })
    assert r.status_code == 200 and r.text == "12345"


def test_wa_verify_rejects_bad_token(client):
    r = client.get("/webhooks/whatsapp", params={
        "hub.mode": "subscribe", "hub.challenge": "x", "hub.verify_token": "wrong",
    })
    assert r.status_code == 403


def test_wa_signature_required_when_secret_set(client):
    body = b'{"hello":"world"}'
    r = client.post("/webhooks/whatsapp", content=body,
                    headers={"content-type": "application/json"})
    assert r.status_code == 401


def test_wa_signature_accepted(client):
    payload = {"entry": []}
    body = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(TEST_META_WA_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    r = client.post("/webhooks/whatsapp", content=body,
                    headers={"content-type": "application/json", "x-hub-signature-256": sig})
    assert r.status_code == 200


def test_stale_customer_message_detection():
    from app.api.whatsapp import _is_stale_customer_message

    assert _is_stale_customer_message({"timestamp": "0"}) is True
    assert _is_stale_customer_message({"timestamp": str(int(time.time()))}) is False
    assert _is_stale_customer_message({"timestamp": "not-a-timestamp"}) is False


@pytest.mark.asyncio
async def test_interactive_reply_keeps_title_and_id(monkeypatch):
    from app.api.whatsapp import _handle_one_message

    captured = {}

    class Session:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *_args):
            return False

    async def fake_business(*_args, **_kwargs):
        return None

    async def fake_handle(_db, turn):
        captured["text"] = turn.text
        return type("Result", (), {"duplicate": False, "reply": "ok", "conversation_id": "c", "escalated": False})()

    async def fake_send(*_args, **_kwargs):
        return {"ok": True}

    monkeypatch.setattr("app.services.business_service.get_business_for_turn", fake_business)
    monkeypatch.setattr("app.api.whatsapp.handle_inbound", fake_handle)
    monkeypatch.setattr("app.channels.whatsapp.send_text", fake_send)

    await _handle_one_message(
        lambda: Session(),
        {
            "from": "254700000001",
            "id": "wamid.test",
            "type": "interactive",
            "timestamp": str(int(time.time())),
            "interactive": {
                "button_reply": {
                    "title": "Order Coffee",
                    "id": "lp:order:coffee",
                }
            },
        },
        {},
        "12345",
    )

    assert captured["text"] == "Order Coffee [lp:order:coffee]"
