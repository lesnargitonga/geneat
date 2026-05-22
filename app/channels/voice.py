"""Voice channel — Phase 5 placeholder.

Phase 5 will replace these stubs with:
  • Twilio Media Streams (or Africa's Talking Voice) WebSocket handler
  • OpenAI Whisper streaming STT
  • LangGraph turn (re-using app.ai.graph.run_turn)
  • ElevenLabs *streaming* WebSocket TTS:
        wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input
        ?model_id=eleven_turbo_v2_5&optimize_streaming_latency=4
    Audio is forwarded back to the call leg as it arrives → <1.5s perceived
    latency.
"""
from __future__ import annotations

from app.core.logging import get_logger

log = get_logger("voice")


async def synthesize_stub(text: str) -> bytes:  # pragma: no cover
    log.info("voice_tts_stub", chars=len(text))
    return b""
