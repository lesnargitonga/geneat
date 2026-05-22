"""Inbound slash-commands for testing / admin.

Currently supported:
  /biz <slug>   — switch the active tenant for the rest of this conversation.
                  Closes any open conversations for this customer against
                  other tenants, then opens a fresh one against <slug>.
                  Useful when you have a single tester MSISDN and need to
                  test how the agent behaves across multiple businesses.

  /reset        — close the current conversation so the next message starts
                  a fresh thread (history-free).

Returns:
  None     -> message is normal user text, fall through to AI.
  Command  -> structured command. The caller short-circuits the AI path
              and acks the user.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SlashCommand:
    name: str               # 'biz' | 'reset' | 'help'
    arg: str | None = None  # e.g. business slug


def parse_slash(text: str) -> SlashCommand | None:
    """Return a SlashCommand if text starts with a supported slash directive."""
    if not text:
        return None
    s = text.strip()
    if not s.startswith("/"):
        return None
    parts = s.split(None, 1)
    cmd = parts[0][1:].lower()
    arg = parts[1].strip() if len(parts) > 1 else None
    if cmd in {"biz", "switch", "tenant"}:
        return SlashCommand(name="biz", arg=arg)
    if cmd in {"reset", "new", "clear"}:
        return SlashCommand(name="reset")
    if cmd in {"help", "h", "?"}:
        return SlashCommand(name="help")
    return None
