"""Local fake for Africa's Talking SMS + Voice API.

Run standalone for manual dev:
    uvicorn tests.mocks.africastalking_mock:app --port 9001

Or import `app` into your own test fixtures. It records every received call
in `app.state.recorded` for assertions.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import FastAPI, Form, Request
from fastapi.responses import JSONResponse, Response

app = FastAPI(title="Mock Africa's Talking")
app.state.recorded = []  # type: ignore[attr-defined]


@app.post("/version1/messaging")
async def send_sms(
    request: Request,
    username: str = Form(...),
    to: str = Form(...),
    message: str = Form(...),
    from_: str | None = Form(None, alias="from"),
):
    rec = {"kind": "sms", "username": username, "to": to, "from": from_,
           "message": message, "at": datetime.utcnow().isoformat()}
    app.state.recorded.append(rec)
    return {
        "SMSMessageData": {
            "Message": "Sent to 1/1 Total Cost: KES 0.8000",
            "Recipients": [{
                "statusCode": 101, "number": to, "status": "Success",
                "cost": "KES 0.8000", "messageId": f"ATXid_{uuid.uuid4().hex[:10]}",
            }],
        }
    }


@app.post("/voice/call")
async def make_call(request: Request):
    payload = dict(await request.form())
    rec = {"kind": "voice_call", "payload": payload, "at": datetime.utcnow().isoformat()}
    app.state.recorded.append(rec)
    return JSONResponse({"entries": [{"phoneNumber": payload.get("to"),
                                       "status": "Queued",
                                       "sessionId": uuid.uuid4().hex}]})


@app.get("/__recorded__")
async def recorded():
    return {"items": app.state.recorded}


@app.post("/__reset__")
async def reset():
    app.state.recorded.clear()
    return Response(status_code=204)
