"""Voice channel — Phase 5.

Twilio voice flow:
  1. Customer calls our Twilio number.
  2. Twilio POSTs to `/webhooks/voice/inbound` for TwiML; we respond with a
     <Connect><Stream> that points to our WebSocket at `/webhooks/voice/stream`.
  3. Twilio opens a WebSocket and streams 8 kHz mu-law audio frames.
  4. We buffer the audio per utterance (silence-detection), transcribe with
     Whisper, run the LangGraph turn, and stream the LLM tokens into
     ElevenLabs → audio chunks → back into the same Twilio WebSocket
     (base64-encoded mu-law payloads).

Latency budget (warm path):
    Whisper short-clip   ≈ 250 ms
    LLM first token      ≈ 350 ms   (gpt-4o, no tools)
    ElevenLabs first byte ≈ 350 ms  (turbo_v2_5, latency=4)
    Network roundtrip     ≈ 100 ms
    -------------------------------
    Mouth-to-ear          ≈ 1.0 s
"""
from __future__ import annotations

import asyncio
import audioop
import base64
import io
import json
import time
import wave
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import APIRouter, Form, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse

from app.channels.base import handle_inbound
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import normalize_msisdn, verify_twilio_signature
from app.db.models import Channel
from app.db.session import SessionLocal
from app.integrations.elevenlabs_client import stream_tts
from app.integrations.transcription import transcribe

log = get_logger("voice")
router = APIRouter(prefix="/webhooks/voice", tags=["voice"])


# ── TwiML answer ─────────────────────────────────────────────────────

@router.post("/inbound")
async def inbound_twiml(
    request: Request,
    From: str = Form(...),
    To: str = Form(None),
    x_twilio_signature: str | None = Header(None, alias="X-Twilio-Signature"),
):
    """Respond with TwiML that opens a Media Stream to our WS."""
    auth_token = get_settings().twilio_auth_token.get_secret_value()
    if auth_token:
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        host_for_sig = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
        url = f"{proto}://{host_for_sig}{request.url.path}"
        form = await request.form()
        params = {k: str(v) for k, v in form.items()}
        if not verify_twilio_signature(auth_token, url, params, x_twilio_signature):
            log.warning("twilio_voice_signature_invalid", url=url)
            raise HTTPException(status_code=401, detail="signature invalid")
    host = request.headers.get("x-forwarded-host") or request.url.hostname
    proto = "wss"
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Hello, connecting you to our assistant.</Say>
  <Connect>
    <Stream url="{proto}://{host}/webhooks/voice/stream">
      <Parameter name="caller" value="{From}"/>
    </Stream>
  </Connect>
</Response>"""
    return PlainTextResponse(twiml, media_type="application/xml")


# ── WebSocket: bidirectional audio with Twilio ───────────────────────

@dataclass
class _Utterance:
    chunks: list[bytes]
    silent_frames: int = 0


# Hard ceiling on a single utterance: ~15 s @ 50 fps (20 ms μ-law frames).
# Mostly defends against a stuck-open mic feeding endless audio.
MAX_UTTERANCE_FRAMES = 750


@router.websocket("/stream")
async def media_stream(ws: WebSocket):
    await ws.accept()
    caller_msisdn: str | None = None
    stream_sid: str | None = None
    utt = _Utterance(chunks=[])
    # WebRTC VAD: aggressiveness 2 — biased toward "speech" so soft consonants
    # and quiet voices on a low-bitrate cellular link still register. Falls
    # back to an RMS-energy threshold if the webrtcvad wheel isn't installed.
    from app.integrations.voice_vad import FrameVAD
    vad = FrameVAD(aggressiveness=2)
    voice_session = None
    last_presence_refresh = 0.0
    utterance_lock = asyncio.Lock()

    try:
        while True:
            raw = await ws.receive_text()
            evt = json.loads(raw)
            event = evt.get("event")

            if event == "start":
                stream_sid = evt["start"]["streamSid"]
                params = {p["name"]: p["value"] for p in evt["start"].get("customParameters", [])}
                caller_msisdn = normalize_msisdn(params.get("caller", "+254700000000"))
                log.info("voice_stream_started", sid=stream_sid, vad=("webrtc" if vad.webrtc_available else "rms-fallback"))

                # Cross-channel interleaving guard: claim "voice" presence so
                # inbound WhatsApp/SMS for this MSISDN are deferred until the
                # call ends. Marker auto-expires within PRESENCE_TTL_SEC if
                # the WebSocket dies unclean.
                try:
                    from app.services.session_manager import mark_channel_active
                    await mark_channel_active(caller_msisdn, "voice")
                    last_presence_refresh = time.time()
                except Exception as e:
                    log.warning("presence_mark_failed", error=str(e))

                # Register this session for cross-worker control (hangup / inject_say).
                try:
                    from app.channels.voice_registry import VoiceSession, register
                    voice_session = VoiceSession(
                        conversation_id=stream_sid,  # stream_sid as ad-hoc id
                        msisdn=caller_msisdn,
                        ws=ws,
                        stream_sid=stream_sid,
                        speak=lambda text, _lang=None: _speak(ws, stream_sid, _aiter_text(text)),
                        started_at=time.time(),
                    )
                    await register(voice_session)
                except Exception as e:
                    log.warning("voice_registry_failed", error=str(e))

                # Greet the caller
                asyncio.create_task(_speak(ws, stream_sid, _aiter_text("Karibu! Naweza kukusaidiaje?")))
                continue

            if event == "media":
                payload_b64 = evt["media"]["payload"]
                chunk = base64.b64decode(payload_b64)
                # Always buffer the raw chunk; VAD decides when the
                # utterance has *ended*, not whether to keep individual frames.
                # Keeping silent edge frames preserves leading/trailing
                # phonemes Whisper needs for accurate transcription.
                utt.chunks.append(chunk)
                vad.feed(chunk)

                # Refresh presence marker every 30 s so a long call keeps
                # WhatsApp/SMS deferral in place across worker boundaries.
                now = time.time()
                if caller_msisdn and (now - last_presence_refresh) >= 30.0:
                    try:
                        from app.services.session_manager import mark_channel_active
                        await mark_channel_active(caller_msisdn, "voice")
                        last_presence_refresh = now
                    except Exception:
                        pass

                if vad.utterance_ended() or len(utt.chunks) >= MAX_UTTERANCE_FRAMES:
                    audio = b"".join(utt.chunks)
                    utt = _Utterance(chunks=[])
                    vad.reset()
                    asyncio.create_task(_process_utterance_serialized(
                        utterance_lock, ws, stream_sid, caller_msisdn, audio,
                    ))
                continue

            if event == "stop":
                log.info("voice_stream_stopped", sid=stream_sid)
                break
    except WebSocketDisconnect:
        log.info("voice_ws_disconnect")
    except Exception as e:
        log.exception("voice_ws_error", error=str(e))
    finally:
        # Release the cross-channel presence marker and the in-worker
        # registry entry so WhatsApp/SMS can resume immediately.
        if caller_msisdn:
            try:
                from app.services.session_manager import clear_channel
                await clear_channel(caller_msisdn, "voice")
            except Exception:
                pass
        if voice_session is not None:
            try:
                from app.channels.voice_registry import unregister
                await unregister(voice_session.conversation_id)
            except Exception:
                pass


# ── Per-utterance pipeline ───────────────────────────────────────────

async def _process_utterance_serialized(
    lock: asyncio.Lock,
    ws: WebSocket,
    stream_sid: str | None,
    msisdn: str | None,
    ulaw_audio: bytes,
) -> None:
    async with lock:
        await _process_utterance(ws, stream_sid, msisdn, ulaw_audio)


async def _process_utterance(ws: WebSocket, stream_sid: str | None, msisdn: str | None, ulaw_audio: bytes) -> None:
    if not msisdn or not ulaw_audio:
        return
    t0 = time.perf_counter()
    try:
        text = await transcribe(_ulaw_to_wav(ulaw_audio), mime_type="audio/wav")
    except Exception as e:
        log.warning("voice_stt_failed", error=str(e))
        return
    if not text.strip():
        return
    log.info("voice_utterance", chars=len(text), ms=int((time.perf_counter() - t0) * 1000))

    # Run the AI turn via the same shared handler.
    async with SessionLocal() as db:
        from app.channels.base import InboundTurn
        result = await handle_inbound(db, InboundTurn(
            msisdn_raw=msisdn, text=text, channel=Channel.voice,
        ))

    if stream_sid and result.conversation_id:
        try:
            from app.channels.voice_registry import alias
            await alias(stream_sid, str(result.conversation_id))
        except Exception:
            pass
    if not result.reply:
        return
    await _speak(ws, stream_sid, _aiter_text(result.reply))


def _ulaw_to_wav(ulaw_audio: bytes) -> bytes:
    pcm = audioop.ulaw2lin(ulaw_audio, 2)
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(pcm)
    return out.getvalue()


async def _aiter_text(s: str) -> AsyncIterator[str]:
    # Yield in modest chunks so ElevenLabs starts synthesizing fast.
    buf = ""
    for word in s.split(" "):
        buf += word + " "
        if len(buf) >= 24:
            yield buf; buf = ""
    if buf.strip():
        yield buf


async def _speak(ws: WebSocket, stream_sid: str | None, text_iter: AsyncIterator[str]) -> None:
    """Pipe ElevenLabs μ-law chunks into Twilio Media Stream."""
    if not stream_sid:
        return
    try:
        async for audio in stream_tts(text_iter, output_format="ulaw_8000"):
            payload = base64.b64encode(audio).decode()
            await ws.send_text(json.dumps({
                "event": "media", "streamSid": stream_sid,
                "media": {"payload": payload},
            }))
        # Tell Twilio we're done with this turn
        await ws.send_text(json.dumps({"event": "mark", "streamSid": stream_sid,
                                       "mark": {"name": "tts_done"}}))
    except Exception as e:
        log.warning("voice_speak_failed", error=str(e))
