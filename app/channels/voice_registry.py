"""In-worker registry of active voice WebSocket sessions.

The Redis Pub/Sub event bus (``app.core.event_bus``) is global, but the
actual ``WebSocket`` object can only be written to by the worker process
that owns it. When a cross-worker event arrives for ``voice.hangup`` or
``voice.say``, the handler consults this registry; if the target session
lives in *this* worker it acts, otherwise it silently ignores the event
(the owning worker will receive the same broadcast and act there).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from fastapi import WebSocket

from app.core.logging import get_logger

log = get_logger("voice_registry")

SpeakFn = Callable[[str, str | None], Awaitable[None]]
"""speak(text, language) — pushes a synthesised line to the caller."""


@dataclass
class VoiceSession:
    conversation_id: str
    msisdn: str
    ws: WebSocket
    stream_sid: str | None = None
    speak: SpeakFn | None = None
    started_at: float = field(default_factory=lambda: 0.0)
    closed: bool = False


_sessions: dict[str, VoiceSession] = {}
_lock = asyncio.Lock()


async def register(session: VoiceSession) -> None:
    async with _lock:
        _sessions[session.conversation_id] = session
    log.info("voice_session_registered", conversation_id=session.conversation_id)


async def unregister(conversation_id: str) -> None:
    async with _lock:
        s = _sessions.pop(conversation_id, None)
        if s is not None:
            for key, session in list(_sessions.items()):
                if session is s:
                    _sessions.pop(key, None)
    if s:
        s.closed = True
        log.info("voice_session_unregistered", conversation_id=conversation_id)


async def alias(existing_id: str, alias_id: str) -> bool:
    async with _lock:
        s = _sessions.get(existing_id)
        if not s or s.closed:
            return False
        _sessions[alias_id] = s
    log.info("voice_session_alias_registered", conversation_id=alias_id, stream_sid=existing_id)
    return True


def get(conversation_id: str) -> VoiceSession | None:
    return _sessions.get(conversation_id)


def all_for_msisdn(msisdn: str) -> list[VoiceSession]:
    return [s for s in _sessions.values() if s.msisdn == msisdn and not s.closed]


async def close_stream(conversation_id: str, *, reason: str = "") -> bool:
    """Force-close a voice session owned by this worker. Returns True if found."""
    s = _sessions.get(conversation_id)
    if not s or s.closed:
        return False
    try:
        await s.ws.close(code=1000, reason=reason[:120] or "server-hangup")
    except Exception as e:  # pragma: no cover
        log.warning("voice_close_failed", conversation_id=conversation_id, error=str(e))
    await unregister(conversation_id)
    return True


async def inject_say(conversation_id: str, *, text: str, language: str | None = None) -> bool:
    """Synthesise+stream ``text`` into a session owned by this worker."""
    s = _sessions.get(conversation_id)
    if not s or s.closed or not s.speak or not text:
        return False
    try:
        await s.speak(text, language)
        return True
    except Exception as e:  # pragma: no cover
        log.warning("voice_inject_failed", conversation_id=conversation_id, error=str(e))
        return False
