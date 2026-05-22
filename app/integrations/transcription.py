"""OpenAI Whisper transcription for WhatsApp voice notes and short voice clips.

For streaming voice calls (Phase 5) we use the realtime/streaming Whisper
endpoint — that lives in app/channels/voice.py.
"""
from __future__ import annotations

import io

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.exceptions import UpstreamError
from app.core.logging import get_logger

log = get_logger("stt")
settings = get_settings()

_client: AsyncOpenAI | None = None


def _oa() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key.get_secret_value())
    return _client


async def transcribe(audio_bytes: bytes, *, mime_type: str = "audio/ogg",
                     language: str | None = None) -> str:
    """Transcribe bytes via Whisper. `language` is an ISO-639-1 hint or None
    for autodetect (recommended for our multilingual users)."""
    if not audio_bytes:
        return ""
    suffix = {
        "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg",
        "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav",
        "audio/webm": "webm", "audio/amr": "amr",
    }.get(mime_type.split(";")[0].strip(), "ogg")
    file_tuple = (f"audio.{suffix}", io.BytesIO(audio_bytes), mime_type)
    try:
        result = await _oa().audio.transcriptions.create(
            model="whisper-1", file=file_tuple, language=language,
            response_format="text", temperature=0,
        )
        text = result if isinstance(result, str) else getattr(result, "text", "")
        log.info("stt_ok", chars=len(text))
        return text.strip()
    except Exception as e:
        log.exception("stt_failed", error=str(e))
        raise UpstreamError("transcription failed")
