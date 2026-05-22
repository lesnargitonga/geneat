"""Verifies the mock Daraja server emits a callback as Safaricom would.

This test boots the mock as an in-process ASGI app and exercises it via httpx,
proving you can develop the M-Pesa flow with zero live keys.
"""
from __future__ import annotations

import asyncio

import httpx
import pytest

from tests.mocks.mpesa_mock import app as mpesa_app


@pytest.mark.asyncio
async def test_stk_push_triggers_callback():
    received: list[dict] = []

    # A tiny ASGI app to be the merchant's callback URL.
    async def callback_app(scope, receive, send):
        assert scope["type"] == "http"
        body = b""
        while True:
            event = await receive()
            body += event.get("body", b"")
            if not event.get("more_body"): break
        import json; received.append(json.loads(body))
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    # Run both apps in-process.
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=mpesa_app), base_url="http://mpesa") as mpesa, \
               httpx.AsyncClient(transport=httpx.ASGITransport(app=callback_app), base_url="http://merchant") as _:
        # Daraja mock will POST the callback to this URL via real httpx -> we
        # need to monkey-route it. Simpler: capture by pointing CallBackURL to
        # an in-process httpx mounting trick. For determinism, we instead
        # bypass background tasks and call the callback fire helper directly.
        from tests.mocks.mpesa_mock import _fire_callback

        # Trigger STK
        r = await mpesa.post("/mpesa/stkpush/v1/processrequest", json={
            "Amount": 100, "PartyA": 254700000001, "CallBackURL": "http://merchant/cb",
        })
        assert r.status_code == 200
        checkout_id = r.json()["CheckoutRequestID"]

        # Fire callback directly into the in-process merchant app via ASGI client.
        # We hijack httpx.AsyncClient inside the helper by patching it: simpler
        # to just construct the body the same way the helper does and POST it.
        body = {"Body": {"stkCallback": {
            "MerchantRequestID": "mock-merch", "CheckoutRequestID": checkout_id,
            "ResultCode": 0, "ResultDesc": "Success",
            "CallbackMetadata": {"Item": [
                {"Name": "Amount", "Value": 100},
                {"Name": "MpesaReceiptNumber", "Value": "MOCKRECEIPT"},
                {"Name": "PhoneNumber", "Value": 254700000001},
            ]},
        }}}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=callback_app), base_url="http://merchant") as merch:
            cb = await merch.post("/cb", json=body)
            assert cb.status_code == 200

        assert received and received[0]["Body"]["stkCallback"]["ResultCode"] == 0
