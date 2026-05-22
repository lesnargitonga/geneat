"""Africa's Talking Voice channel.

AT uses a request/response XML model (not Twilio's streaming WS):
  1. Caller dials your AT number.
  2. AT POSTs a form to /webhooks/at/voice with `isActive=1`, `sessionId`,
     `callerNumber`, and (after a <Record>) `recordingUrl` / `dtmfDigits`.
  3. We respond with an XML <Response> containing AT directives:
       <Say>...</Say>           free built-in TTS
       <Record .../>            captures the customer's reply, posts back
       <Redirect>url</Redirect> next turn → same endpoint
       <Hangup/>                end call
  4. On call end AT POSTs `isActive=0` so we can log final state.

This is turn-based (one-shot per recording) so latency is ~2-4 s per turn,
but free with the AT sandbox and production-ready. ElevenLabs streaming
remains the path for Twilio (premium). Free tier = AT + AT TTS + Whisper STT.
"""
from __future__ import annotations

from typing import Optional
from xml.sax.saxutils import escape as xml_escape

import httpx
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.channels.base import InboundTurn, handle_inbound
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import normalize_msisdn
from app.db.models import Channel
from app.integrations.transcription import transcribe

log = get_logger("voice.at")
settings = get_settings()
router = APIRouter(prefix="/webhooks/at", tags=["voice-at"])


def _xml(body: str) -> Response:
    return Response(
        content=f'<?xml version="1.0" encoding="UTF-8"?>\n<Response>{body}</Response>',
        media_type="application/xml",
    )


def _say(text: str, *, voice: str | None = None) -> str:
    voice = voice or settings.at_voice_say_voice
    safe = xml_escape(text[:1500]) if text else ""
    return f'<Say voice="{voice}">{safe}</Say>'


def _record_and_redirect(callback_path: str) -> str:
    """AT records until silence (or max), POSTs recordingUrl to callback."""
    return (
        '<Record finishOnKey="#" maxLength="20" trimSilence="true" '
        'playBeep="true" '
        f'callbackUrl="{xml_escape(callback_path)}"/>'
    )


def _hangup(farewell: str | None = None) -> str:
    s = _say(farewell) if farewell else ""
    return s + "<Hangup/>"


@router.post("/voice")
async def voice_callback(
    request: Request,
    db: AsyncSession = Depends(db_session),
    isActive: str = Form("1"),
    sessionId: Optional[str] = Form(None),
    callerNumber: Optional[str] = Form(None),
    destinationNumber: Optional[str] = Form(None),
    direction: Optional[str] = Form(None),
    recordingUrl: Optional[str] = Form(None),
    durationInSeconds: Optional[str] = Form(None),
    dtmfDigits: Optional[str] = Form(None),
    hangupCause: Optional[str] = Form(None),
):
    """Single endpoint that handles every step of an AT voice call.

    Flow per turn:
      • If `recordingUrl` is present → download, transcribe, run agent,
        speak reply, then loop back to record next utterance.
      • If no recording yet (first hit) → greet + start recording.
      • If `isActive=0` → end of call, return empty Response.
    """
    if isActive == "0":
        log.info("at_voice_call_ended", session=sessionId, cause=hangupCause)
        return _xml("")

    if not callerNumber:
        return _xml(_hangup("Sorry, we could not identify your number."))

    msisdn = normalize_msisdn(callerNumber)
    callback_path = f"{request.url.scheme}://{request.url.netloc}/webhooks/at/voice"

    # ── First turn: greet and start recording ───────────────────────
    if not recordingUrl:
        greeting = (
            "Karibu! You are connected to our assistant. "
            "After the beep, please say how we can help. Press hash when done."
        )
        return _xml(_say(greeting) + _record_and_redirect(callback_path))

    # ── Subsequent turn: transcribe the recording and respond ───────
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(recordingUrl)
            r.raise_for_status()
            audio = r.content
            mime = r.headers.get("content-type", "audio/wav")
        text = await transcribe(audio, mime_type=mime)
    except Exception as e:
        log.warning("at_voice_transcribe_failed", error=str(e))
        return _xml(_say(
            "Sorry, I did not catch that. Please try again."
        ) + _record_and_redirect(callback_path))

    text = (text or "").strip()
    if not text:
        return _xml(_say(
            "I did not hear anything. Please speak after the beep."
        ) + _record_and_redirect(callback_path))

    log.info("at_voice_utterance", session=sessionId, chars=len(text))

    # Run the AI turn through the shared pipeline.
    try:
        result = await handle_inbound(db, InboundTurn(
            msisdn_raw=msisdn, text=text, channel=Channel.voice,
            provider_message_id=f"at-voice:{sessionId}:{durationInSeconds}",
        ))
        reply = result.reply or "Sorry, I am having trouble responding right now."
    except Exception as e:
        log.exception("at_voice_handle_failed", error=str(e))
        reply = "Sorry, our system hit a snag. A human agent will call you back."
        return _xml(_say(reply) + "<Hangup/>")

    # If escalated, speak the reply and hang up so a human can call back.
    if result.escalated:
        return _xml(_say(reply) + "<Hangup/>")

    # Otherwise: speak reply and loop back for next customer utterance.
    return _xml(_say(reply) + _record_and_redirect(callback_path))


@router.post("/voice/events")
async def voice_events(
    request: Request,
    sessionId: Optional[str] = Form(None),
    callerNumber: Optional[str] = Form(None),
    isActive: str = Form("0"),
    hangupCause: Optional[str] = Form(None),
    durationInSeconds: Optional[str] = Form(None),
):
    """Optional events callback — AT pings this when a call state changes
    (ringing, in-progress, completed). We just log it; the main voice loop
    handles the conversation itself."""
    log.info(
        "at_voice_event", session=sessionId, active=isActive,
        cause=hangupCause, duration=durationInSeconds,
    )
    return Response(status_code=200)
