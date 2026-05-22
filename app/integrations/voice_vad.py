"""Voice Activity Detection for Twilio Media Streams (\u03bc-law 8 kHz).

Twilio streams 20 ms G.711 \u03bc-law frames (160 bytes each, decoded to
16-bit PCM at 8 kHz). The previous implementation counted "silent" bytes
(0x7F / 0xFF) which is fragile in noisy environments: a passing matatu,
wind buffeting the microphone, or carrier-side comfort noise all defeat
it and either chop the user off mid-sentence or never trigger end-of-turn.

This module uses the WebRTC VAD (the same one used by Chrome's WebRTC
stack) which has been battle-tested across billions of calls. It is a
pure-C extension that processes a 30 ms PCM16 frame in a few microseconds,
so we can run it inline in the audio receive loop without affecting RTT.

Usage::

    vad = FrameVAD(aggressiveness=2)
    is_speech = vad.is_speech(ulaw_chunk)   # any chunk size; buffer-aware
    ended     = vad.utterance_ended()       # silence run reached threshold

Fallback: if ``webrtcvad`` is not importable (e.g. the wheel isn't
available on the running architecture) we degrade gracefully to the old
amplitude heuristic so the service still works \u2014 just less precisely.
"""
from __future__ import annotations

import audioop  # stdlib: \u03bc-law \u2194 PCM16 conversion

try:
    import webrtcvad  # type: ignore
    _WEBRTC_OK = True
except Exception:  # pragma: no cover
    _WEBRTC_OK = False

# Twilio Media Streams: 8 kHz, mono, G.711 \u03bc-law, 20 ms frames (160 bytes).
SAMPLE_RATE = 8000
ULAW_FRAME_MS = 20
ULAW_FRAME_BYTES = 160          # 8000 * 0.02
VAD_FRAME_MS = 30               # WebRTC VAD supports 10/20/30 ms
VAD_FRAME_BYTES_PCM = int(SAMPLE_RATE * (VAD_FRAME_MS / 1000.0) * 2)  # 480 bytes PCM16

# Trailing silence required to consider the utterance ended. 700 ms is the
# sweet spot for conversational turn-taking in Kenyan English / Swahili
# (matches typical inter-utterance pause + dialer jitter).
END_OF_UTTERANCE_SILENCE_MS = 700
SILENCE_RUN_FRAMES = END_OF_UTTERANCE_SILENCE_MS // VAD_FRAME_MS


class FrameVAD:
    """Stateful VAD wrapper. Not thread-safe; one per WebSocket session."""

    __slots__ = ("_vad", "_buf", "_silence_run", "_speech_seen", "_aggressiveness")

    def __init__(self, aggressiveness: int = 2) -> None:
        # 0 = least aggressive (more speech, more false positives)
        # 3 = most aggressive (cleaner cuts, may clip soft consonants)
        # 2 is the production default \u2014 errs slightly toward "speech"
        # which is the right bias for an AI agent that must hear the customer.
        self._aggressiveness = max(0, min(3, int(aggressiveness)))
        self._vad = webrtcvad.Vad(self._aggressiveness) if _WEBRTC_OK else None
        self._buf = bytearray()      # PCM16 buffer (post \u03bc-law decode)
        self._silence_run = 0        # consecutive non-speech frames
        self._speech_seen = False    # True once we've observed any speech

    @property
    def webrtc_available(self) -> bool:
        return _WEBRTC_OK

    def reset(self) -> None:
        self._buf.clear()
        self._silence_run = 0
        self._speech_seen = False

    def feed(self, ulaw_chunk: bytes) -> bool:
        """Feed a \u03bc-law chunk of any size. Returns True iff this chunk
        contained any speech (post-VAD). Updates internal silence run.
        """
        if not ulaw_chunk:
            return False
        # \u03bc-law \u2192 PCM16
        pcm = audioop.ulaw2lin(ulaw_chunk, 2)
        self._buf.extend(pcm)

        any_speech = False
        # Drain full 30 ms PCM frames.
        while len(self._buf) >= VAD_FRAME_BYTES_PCM:
            frame = bytes(self._buf[:VAD_FRAME_BYTES_PCM])
            del self._buf[:VAD_FRAME_BYTES_PCM]
            is_speech = self._classify(frame)
            if is_speech:
                any_speech = True
                self._speech_seen = True
                self._silence_run = 0
            else:
                self._silence_run += 1
        return any_speech

    # Convenience for callers that prefer a positive boolean per chunk.
    is_speech = feed

    def _classify(self, pcm16_frame: bytes) -> bool:
        if self._vad is not None:
            try:
                return self._vad.is_speech(pcm16_frame, SAMPLE_RATE)
            except Exception:
                pass
        # Fallback: RMS energy threshold on PCM16.
        rms = audioop.rms(pcm16_frame, 2)
        return rms > 350   # empirically ~ ambient room tone on phone audio

    def utterance_ended(self) -> bool:
        """True iff we have seen speech and then `SILENCE_RUN_FRAMES`
        consecutive silent frames \u2014 i.e. the customer paused long enough
        for the AI to take the turn.
        """
        return self._speech_seen and self._silence_run >= SILENCE_RUN_FRAMES

    @property
    def saw_speech(self) -> bool:
        return self._speech_seen
