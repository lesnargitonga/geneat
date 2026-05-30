from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_meta_reply_buttons_payload(monkeypatch) -> None:
    from app.integrations import whatsapp_client

    captured = {}

    async def allowed():
        return True

    class Response:
        status_code = 200

        def json(self):
            return {"messages": [{"id": "wamid.ok"}]}

    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, url, json=None, headers=None):
            captured["url"] = url
            captured["json"] = json
            return Response()

    monkeypatch.setattr("app.integrations.whatsapp_client.wa_outbound_allowed", allowed)
    monkeypatch.setattr("app.integrations.whatsapp_client.settings.meta_wa_phone_number_id", "12345")
    monkeypatch.setattr("app.integrations.whatsapp_client.httpx.AsyncClient", Client)

    result = await whatsapp_client.send_reply_buttons(
        "+254700000001",
        body="What would you like?",
        buttons=[
            {"id": "lp:order", "title": "Order"},
            {"id": "lp:menu", "title": "Menu"},
            {"id": "lp:staff", "title": "Staff"},
        ],
    )

    assert result["messages"][0]["id"] == "wamid.ok"
    assert captured["json"]["type"] == "interactive"
    assert captured["json"]["interactive"]["type"] == "button"
    assert captured["json"]["interactive"]["action"]["buttons"][0]["reply"]["id"] == "lp:order"


@pytest.mark.asyncio
async def test_meta_list_payload_caps_rows(monkeypatch) -> None:
    from app.integrations import whatsapp_client

    captured = {}

    async def allowed():
        return True

    class Response:
        status_code = 200

        def json(self):
            return {"ok": True}

    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, url, json=None, headers=None):
            captured["json"] = json
            return Response()

    monkeypatch.setattr("app.integrations.whatsapp_client.wa_outbound_allowed", allowed)
    monkeypatch.setattr("app.integrations.whatsapp_client.settings.meta_wa_phone_number_id", "12345")
    monkeypatch.setattr("app.integrations.whatsapp_client.httpx.AsyncClient", Client)

    await whatsapp_client.send_list_message(
        "+254700000001",
        body="Pick coffee",
        button_text="Choose",
        sections=[
            {
                "title": "Coffee",
                "rows": [
                    {"id": f"lp:item:{i}", "title": f"Item {i}", "description": "KES 100"}
                    for i in range(12)
                ],
            }
        ],
    )

    rows = captured["json"]["interactive"]["action"]["sections"][0]["rows"]
    assert len(rows) == 10
    assert rows[0]["id"] == "lp:item:0"
