"""Local fake for Safaricom Daraja (M-Pesa) API.

Implements:
  POST /oauth/v1/generate?grant_type=client_credentials → {access_token}
  POST /mpesa/stkpush/v1/processrequest                 → STK push
The mock will, after a short delay, POST a synthetic callback to the URL
provided in the STK request — simulating Safaricom's behaviour end-to-end.

Run:
    uvicorn tests.mocks.mpesa_mock:app --port 9002
"""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, Request
from fastapi.responses import Response

app = FastAPI(title="Mock M-Pesa Daraja")
app.state.recorded = []  # type: ignore[attr-defined]
app.state.simulate_outcome = "paid"  # paid | cancelled | timeout


@app.get("/oauth/v1/generate")
async def token(authorization: str | None = Header(None)):
    return {"access_token": "mock-" + uuid.uuid4().hex, "expires_in": "3599"}


async def _fire_callback(callback_url: str, checkout_id: str, msisdn: str, amount: float):
    await asyncio.sleep(random.uniform(0.5, 1.5))
    outcome = app.state.simulate_outcome
    if outcome == "timeout":
        return
    if outcome == "cancelled":
        body = {
            "Body": {"stkCallback": {
                "MerchantRequestID": "mock-merch", "CheckoutRequestID": checkout_id,
                "ResultCode": 1032, "ResultDesc": "Request cancelled by user",
            }}
        }
    else:  # paid
        body = {
            "Body": {"stkCallback": {
                "MerchantRequestID": "mock-merch", "CheckoutRequestID": checkout_id,
                "ResultCode": 0, "ResultDesc": "Success",
                "CallbackMetadata": {"Item": [
                    {"Name": "Amount", "Value": amount},
                    {"Name": "MpesaReceiptNumber", "Value": "MOCK" + uuid.uuid4().hex[:8].upper()},
                    {"Name": "PhoneNumber", "Value": int(msisdn.lstrip("+"))},
                ]},
            }}
        }
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(callback_url, json=body)
    except Exception:
        pass


@app.post("/mpesa/stkpush/v1/processrequest")
async def stk_push(req: Request, bg: BackgroundTasks):
    body = await req.json()
    checkout_id = "ws_CO_" + uuid.uuid4().hex[:14]
    rec = {"kind": "stk_push", "body": body, "checkout_id": checkout_id,
           "at": datetime.utcnow().isoformat()}
    app.state.recorded.append(rec)

    msisdn = "+" + str(body.get("PartyA") or body.get("PhoneNumber") or "254700000000")
    amount = float(body.get("Amount", 0))
    cb_url = body.get("CallBackURL", "")
    if cb_url:
        bg.add_task(_fire_callback, cb_url, checkout_id, msisdn, amount)

    return {
        "MerchantRequestID": "mock-merch",
        "CheckoutRequestID": checkout_id,
        "ResponseCode": "0",
        "ResponseDescription": "Success. Request accepted for processing",
        "CustomerMessage": "Success. Request accepted for processing",
    }


@app.post("/__set_outcome__/{outcome}")
async def set_outcome(outcome: str):
    if outcome not in {"paid", "cancelled", "timeout"}:
        return Response(status_code=400)
    app.state.simulate_outcome = outcome
    return {"outcome": outcome}


@app.get("/__recorded__")
async def recorded():
    return {"items": app.state.recorded}
