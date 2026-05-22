"""Twilio WhatsApp Sandbox + Business webhook (Phase 3.5).

Endpoint:
    POST /webhooks/whatsapp/twilio/inbound

Twilio posts `application/x-www-form-urlencoded` with fields:
    MessageSid, From=whatsapp:+E164, To=whatsapp:+E164, Body,
    ProfileName, WaId, NumMedia, MediaUrl0, MediaContentType0, ...

We verify `X-Twilio-Signature` (HMAC-SHA1 of url + sorted params, base64),
hand off to `handle_inbound`, and return a synchronous TwiML `<Message>`
response. Twilio's messaging webhook timeout is ~15s — plenty for our LLM.

If TwiML synchronous reply fails or the reply is empty, we return an empty
`<Response/>`. The outbound REST sender in
`app.integrations.twilio_whatsapp` is the fallback for proactive sends.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.channels.base import InboundTurn, handle_inbound
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import verify_twilio_signature
from app.db.models import Channel

log = get_logger("wa.twilio")
router = APIRouter(prefix="/webhooks/whatsapp/twilio", tags=["whatsapp", "twilio"])

_TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>'


def _xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _twiml_message(text: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Message>{_xml_escape(text)}</Message></Response>"
    )


def _public_url(request: Request) -> str:
    """Reconstruct the public URL Twilio used to sign the request.

    When running behind Cloudflare Tunnel / nginx, FastAPI sees the proxied
    URL. Twilio signs the original public URL. We trust X-Forwarded-Proto /
    X-Forwarded-Host so the HMAC matches.
    """
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}{request.url.path}"


@router.post("/inbound")
@limiter.limit("600/minute")
async def inbound(
    request: Request,
    db: AsyncSession = Depends(db_session),
    x_twilio_signature: str | None = Header(None, alias="X-Twilio-Signature"),
):
    settings = get_settings()
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}

    auth_token = settings.twilio_auth_token.get_secret_value()
    if auth_token:
        url = _public_url(request)
        if not verify_twilio_signature(auth_token, url, params, x_twilio_signature):
            log.warning(
                "twilio_wa_signature_invalid",
                url=url,
                got=(x_twilio_signature or "")[:12],
                keys=sorted(params.keys()),
            )
            raise HTTPException(status_code=401, detail="signature invalid")

    from_ = params.get("From", "").replace("whatsapp:", "").strip()
    body = (params.get("Body") or "").strip()
    message_sid = params.get("MessageSid") or None
    profile_name = params.get("ProfileName") or None

    if not from_ or not body:
        # Status callbacks / empty media-only messages get a quiet ack.
        return Response(content=_TWIML_EMPTY, media_type="application/xml")

    turn = InboundTurn(
        msisdn_raw=from_,
        text=body,
        channel=Channel.whatsapp,
        customer_name=profile_name,
        provider_message_id=message_sid,
    )

    try:
        result = await handle_inbound(db, turn)
    except Exception as e:
        log.exception("twilio_wa_inbound_failed", error=str(e))
        return Response(content=_TWIML_EMPTY, media_type="application/xml")

    if result.duplicate or not result.reply:
        return Response(content=_TWIML_EMPTY, media_type="application/xml")

    return Response(content=_twiml_message(result.reply), media_type="application/xml")


@router.post("/status")
async def status_callback(request: Request) -> Response:
    """Twilio delivery-status webhook (optional; logs and ACKs)."""
    try:
        form = await request.form()
        log.info(
            "twilio_wa_status",
            sid=form.get("MessageSid"),
            status=form.get("MessageStatus"),
            error_code=form.get("ErrorCode"),
        )
    except Exception:
        pass
    return Response(content=_TWIML_EMPTY, media_type="application/xml")
