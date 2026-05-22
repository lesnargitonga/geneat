"""ElevenLabs streaming TTS via WebSocket.

Uses `eleven_turbo_v2_5` with `optimize_streaming_latency=4`. First audio
chunk typically lands in ~200-400 ms after the first text chunk.

`stream_tts(text_iter)` accepts an async iterator of text fragments (so we can
pipe LLM tokens straight in) and yields raw audio chunks (mu-law 8 kHz when
`output_format="ulaw_8000"` — the format Twilio Media Streams expects on a
phone call leg).
"""
from __future__ import annotations

import asyncio
import base64
import json
from typing import AsyncIterator

import websockets

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("elevenlabs")
settings = get_settings()

WS_URL = (
    "wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input"
    "?model_id={model}&optimize_streaming_latency=4&output_format={fmt}"
)


async def stream_tts(
    text_chunks: AsyncIterator[str],
    *,
    voice_id: str | None = None,
    output_format: str = "ulaw_8000",
) -> AsyncIterator[bytes]:
    """Yield audio bytes as ElevenLabs streams them back.

    text_chunks: async iterator of partial strings (LLM tokens / sentences).
    output_format: 'ulaw_8000' for Twilio, 'mp3_44100_128' for general use.
    """
    voice = voice_id or settings.elevenlabs_voice_id
    url = WS_URL.format(voice_id=voice, model=settings.elevenlabs_model, fmt=output_format)
    headers = {"xi-api-key": settings.elevenlabs_api_key.get_secret_value()}

    async with websockets.connect(url, additional_headers=headers, max_size=2**24) as ws:
        # 1. BOS — aggressive small-chunk schedule for <1.5s interactive latency.
        # Lower values trigger TTS generation sooner at the cost of slightly
        # less prosody. Sweet spot for voice-call use:
        await ws.send(json.dumps({
            "text": " ",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8,
                               "style": 0.0, "use_speaker_boost": True},
            "generation_config": {"chunk_length_schedule": [50, 90, 120, 150]},
        }))

        async def _sender():
            try:
                async for chunk in text_chunks:
                    if not chunk:
                        continue
                    await ws.send(json.dumps({"text": chunk, "try_trigger_generation": True}))
                # EOS
                await ws.send(json.dumps({"text": ""}))
            except Exception as e:  # pragma: no cover
                log.warning("eleven_sender_error", error=str(e))

        send_task = asyncio.create_task(_sender())
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                if msg.get("audio"):
                    yield base64.b64decode(msg["audio"])
                if msg.get("isFinal"):
                    break
        finally:
            send_task.cancel()
