"""Output sanitiser for customer-facing replies.

Models occasionally leak internal reasoning, raw tool-call JSON, fake
multi-turn roleplay, or unsupported markdown. This module is the last line
of defence: it strips that noise BEFORE the reply leaves the system to a
customer's WhatsApp / voice / SMS.

Three goals:
  1. Never let chain-of-thought or tool-call syntax reach a customer.
  2. Normalise markdown to per-channel safe form (WhatsApp markdown vs voice
     plain prose).
  3. Provide a non-empty, brand-safe fallback when sanitising leaves a blank.

Performance: pure regex, runs in O(n) over reply length (typically <1 KB).
"""
from __future__ import annotations

import json
import re
from typing import Literal

import structlog

_log = structlog.get_logger(__name__)

Channel = Literal["whatsapp", "voice", "mock", "sms"]

# ── Patterns that indicate model "leakage" (CoT / tool-call / meta) ──────

# Lines starting with these phrases are almost always model reasoning that
# should not reach a customer. Case-insensitive prefix match.
_LEAK_PREFIXES = (
    "since the customer",
    "since the user",
    "since you",
    "here is the corrected",
    "here is my corrected",
    "here is the response",
    "here's the corrected",
    "here's my response",
    "i'll respond",
    "i will respond",
    "i should respond",
    "i should not",
    "i cannot call",
    "i cannot escalate",
    "i can't escalate",
    "you are correct,",
    "you're correct,",
    "as an ai",
    "as a language model",
    "as an assistant",
    "i'm an ai",
    "i am an ai",
    "let me think",
    "let me check the knowledge",
    "thinking:",
    "thought:",
    "reasoning:",
    "plan:",
    "step 1:",
    "note —",
    "note:",
    "note that ",
    "this response acknowledges",
    "system:",
    "<thinking>",
    "</thinking>",
)

# Fake-roleplay multi-turn blocks. When the model emits "Customer:" or "You:"
# on a new line, drop that line and everything after it.
_ROLEPLAY_CUTOFF = re.compile(
    r"(?im)^\s*(?:customer|user|client|guest|you|assistant|agent|bot)\s*:\s*",
)

# Raw tool-call patterns (XML-like, JSON-like, function-call literal).
_TOOL_CALL_PATTERNS = (
    re.compile(r"<\s*(?:tool_call|function_call|tool|function)\s*>.*?<\s*/\s*(?:tool_call|function_call|tool|function)\s*>", re.DOTALL | re.IGNORECASE),
    re.compile(r"<\s*(?:escalate_to_human|knowledge_lookup|create_order|book_appointment|request_mpesa_payment|send_location_pin|send_menu_photo|send_image)[^>]*>.*?(?:<\s*/[^>]+>|$)", re.DOTALL | re.IGNORECASE),
    # Llama-style "function=name>{json}</function>" shorthand.
    re.compile(r"function\s*=\s*\w+\s*>\s*\{.*?\}\s*</?\s*function\s*>?", re.DOTALL | re.IGNORECASE),
    re.compile(r'\{\s*"name"\s*:\s*"(?:escalate_to_human|knowledge_lookup|create_order|book_appointment|request_mpesa_payment|send_location_pin|send_menu_photo|send_image)".*?\}', re.DOTALL),
    re.compile(r"\b(?:knowledge_lookup|create_order|request_mpesa_payment|send_menu_photo|send_location_pin|escalate_to_human)\s*\([^)]*\)", re.DOTALL | re.IGNORECASE),
    re.compile(r"```(?:json|tool|python|function)?[^`]*```", re.DOTALL),
)

# Markdown patterns we want to normalize for WhatsApp.
_MD_HEADER = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_MD_BOLD_DOUBLE = re.compile(r"\*\*(.+?)\*\*", re.DOTALL)
_MD_BOLD_UNDER = re.compile(r"__(.+?)__", re.DOTALL)
_MD_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^\)]+)\)")
_MD_CODE_INLINE = re.compile(r"`([^`]+)`")
_MD_CODE_BLOCK = re.compile(r"```[a-zA-Z]*\n([\s\S]*?)```")

_WHITESPACE_RUNS = re.compile(r"[ \t]{2,}")
_BLANK_LINES = re.compile(r"\n{3,}")

# Hard "this whole reply is corrupted, replace with fallback" detectors.
# When ANY of these match, we discard the model output entirely and emit
# the channel fallback. These are catastrophic leakage signals.
_CORRUPT_SIGNALS = (
    re.compile(r"\bI'?ll respond with a JSON\b", re.IGNORECASE),
    re.compile(r"\brespond with a JSON for a function call\b", re.IGNORECASE),
    re.compile(r"\bHere is an example of how\b", re.IGNORECASE),
    re.compile(r"\bHere'?s an example of how\b", re.IGNORECASE),
    re.compile(r"\bI can'?t (?:provide|help you with) (?:a |this )?(?:complete |)code\b", re.IGNORECASE),
    re.compile(r"\bin your codebase\b", re.IGNORECASE),
    re.compile(r"\breview the function definition\b", re.IGNORECASE),
    re.compile(r"\bdefine the tools?\b", re.IGNORECASE),
    re.compile(r"\bDEMO FLOW\b", re.IGNORECASE),
    re.compile(r"\bfor live Lily Pond demos\b", re.IGNORECASE),
    re.compile(r"\btiny proof item\b", re.IGNORECASE),
    re.compile(r"\bM-?Pesa STK demos\b", re.IGNORECASE),
    re.compile(r"\btreat it as Demo Espresso\b", re.IGNORECASE),
    re.compile(r"\bif a customer asks\b", re.IGNORECASE),
    re.compile(r'^\s*\{[\s\S]*"(?:tool_calls|function|arguments|role|assistant|action|query|item)"[\s\S]*\}\s*$', re.IGNORECASE),
    re.compile(r'^\s*\[[\s\S]*"(?:role|tool_calls|function|arguments)"[\s\S]*\]\s*$', re.IGNORECASE),
    re.compile(r'\b"role"\s*:\s*"(?:assistant|tool|user|system)"', re.IGNORECASE),
    re.compile(r'\b"tool_calls"\s*:', re.IGNORECASE),
    re.compile(r'\b"arguments"\s*:\s*"\{', re.IGNORECASE),
    re.compile(r"\bclass\s+\w+\s*[:\(]", re.MULTILINE),
    re.compile(r"^\s*def\s+\w+\s*\(", re.MULTILINE),
    re.compile(r"^\s*import\s+\w+", re.MULTILINE),
    re.compile(r"^\s*from\s+\w+\s+import\b", re.MULTILINE),
    # Multi-Q&A simulation (training-data style).
    re.compile(r'(?:^|\n)\s*\d+\.\s+"[^"\n]{5,}"\s*\n\s*Response\s*:', re.IGNORECASE),
    re.compile(r"(?:^|\n)\s*Response\s*:\s*\".+?\".*?(?:\n.*?){0,3}\n\s*\d+\.", re.IGNORECASE | re.DOTALL),
)

_JSON_LEAK_KEYS = {
    "tool_calls",
    "function",
    "arguments",
    "role",
    "messages",
    "action",
    "query",
    "item",
    "reply",
    "response",
}


def _looks_like_json_leak(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate or candidate[0] not in "[{":
        return False
    try:
        parsed = json.loads(candidate)
    except Exception:
        return False

    def keys(obj) -> set[str]:
        if isinstance(obj, dict):
            found = {str(k) for k in obj.keys()}
            for value in obj.values():
                found |= keys(value)
            return found
        if isinstance(obj, list):
            found: set[str] = set()
            for value in obj:
                found |= keys(value)
            return found
        return set()

    found_keys = {key.lower() for key in keys(parsed)}
    return bool(found_keys & _JSON_LEAK_KEYS)

# Unclosed code-fence: cut everything from the first ``` onwards.
_UNCLOSED_FENCE = re.compile(r"```[\s\S]*$")

# Final fallback reply per channel when sanitising removes everything.
_FALLBACK = {
    "whatsapp": "I hit a formatting hiccup before I could finish that. Please resend that last message once.",
    "voice":    "I hit a formatting hiccup before I could finish that. Please say that once more.",
    "mock":     "I hit a formatting hiccup before I could finish that. Please resend that last message once.",
    "sms":      "I hit a formatting hiccup before I could finish that. Please resend that last message once.",
}


def _strip_leak_lines(text: str) -> str:
    """Drop lines that are pure model meta-reasoning."""
    out: list[str] = []
    for line in text.splitlines():
        stripped = line.strip().lower()
        if not stripped:
            out.append(line)
            continue
        if any(stripped.startswith(p) for p in _LEAK_PREFIXES):
            continue
        # Drop bare "</tool_call>" closers and similar.
        if stripped.startswith("</") and stripped.endswith(">"):
            continue
        out.append(line)
    return "\n".join(out)


def _strip_roleplay(text: str) -> str:
    """If the model fabricates a multi-turn dialogue, cut at the first
    'Customer:' / 'You:' label on its own line."""
    m = _ROLEPLAY_CUTOFF.search(text)
    if m is None:
        return text
    return text[: m.start()].rstrip()


def _strip_tool_calls(text: str) -> str:
    for pat in _TOOL_CALL_PATTERNS:
        text = pat.sub("", text)
    return text


def _normalize_markdown_whatsapp(text: str) -> str:
    """WhatsApp uses *single asterisk* for bold and _underscore_ for italic.
    Convert generic-markdown patterns to WhatsApp-safe form. Preserve
    bullets ('- ', '* ') as-is."""
    text = _MD_HEADER.sub("", text)
    # Convert **bold** → *bold* (single asterisk = WA bold). But avoid touching
    # list bullets at line-start: we already require the inner group to be
    # non-empty.
    text = _MD_BOLD_DOUBLE.sub(r"*\1*", text)
    text = _MD_BOLD_UNDER.sub(r"*\1*", text)
    # Markdown links → "label (url)" so the URL stays clickable on WA.
    text = _MD_LINK.sub(r"\1 (\2)", text)
    # Inline code → strip backticks.
    text = _MD_CODE_INLINE.sub(r"\1", text)
    text = _MD_CODE_BLOCK.sub(r"\1", text)
    return text


def _normalize_for_voice(text: str) -> str:
    """Voice channel: strip ALL markdown / URLs / emoji-heavy patterns and
    make it readable when spoken aloud."""
    text = _MD_HEADER.sub("", text)
    text = _MD_BOLD_DOUBLE.sub(r"\1", text)
    text = _MD_BOLD_UNDER.sub(r"\1", text)
    text = _MD_LINK.sub(r"\1", text)              # drop URL on voice
    text = _MD_CODE_INLINE.sub(r"\1", text)
    text = _MD_CODE_BLOCK.sub(r"\1", text)
    # Replace markdown bullets at line-start with a sentence break.
    text = re.sub(r"^[\-\*\u2022]\s+", "", text, flags=re.MULTILINE)
    # Strip standalone asterisks left over.
    text = text.replace("*", "")
    return text


def _final_cleanup(text: str) -> str:
    text = _WHITESPACE_RUNS.sub(" ", text)
    text = _BLANK_LINES.sub("\n\n", text)
    # Trim leading/trailing blank lines & whitespace
    return text.strip()


def sanitize_reply(reply: str, *, channel: str = "whatsapp") -> str:
    """Apply the full sanitisation pipeline. Returns a customer-safe string.

    Pipeline order matters:
      1. Strip tool-call XML/JSON blobs (otherwise their JSON braces could
         confuse later regex).
      2. Drop CoT prefixes.
      3. Cut at fake-roleplay marker.
      4. Normalise markdown per channel.
      5. Whitespace cleanup.
      6. Fallback if empty.
    """
    if not reply:
        return _FALLBACK.get(channel, _FALLBACK["whatsapp"])

    # Catastrophic-leak short-circuit: if the model is clearly emitting code
    # or training-data Q&A simulation, throw the whole thing out.
    if _looks_like_json_leak(reply):
        _log.warning(
            "sanitizer_json_leak",
            reply_preview=reply[:300],
            reply_len=len(reply),
        )
        return _FALLBACK.get(channel, _FALLBACK["whatsapp"])

    for pat in _CORRUPT_SIGNALS:
        if pat.search(reply):
            _log.warning(
                "sanitizer_corrupt_signal",
                pattern=pat.pattern,
                reply_preview=reply[:300],
                reply_len=len(reply),
            )
            return _FALLBACK.get(channel, _FALLBACK["whatsapp"])

    text = reply
    text = _strip_tool_calls(text)
    # Drop any unclosed code-fence tail.
    text = _UNCLOSED_FENCE.sub("", text)
    text = _strip_leak_lines(text)
    text = _strip_roleplay(text)

    if channel == "voice":
        text = _normalize_for_voice(text)
    else:
        text = _normalize_markdown_whatsapp(text)

    text = _final_cleanup(text)
    if not text or len(text) < 3:
        return _FALLBACK.get(channel, _FALLBACK["whatsapp"])
    return text
