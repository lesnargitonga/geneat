"""Mock channel — drives the AI engine end-to-end with no provider keys.

Used by tests and by humans poking at the API during development.
"""
from __future__ import annotations

from app.db.models import Channel
from app.channels.base import InboundTurn, TurnResult, handle_inbound

# Re-exported for convenience.
__all__ = ["Channel", "InboundTurn", "TurnResult", "handle_inbound"]
