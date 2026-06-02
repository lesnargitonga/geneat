"""AI safety layer — runs **before** any LLM call (and once after).

The single most important property: every check here is **deterministic and
cheap**. The whole point is to short-circuit adversarial / abusive / off-topic
turns *before* they cost an LLM token or pollute the audit trail.

Threat model (USIU campus pilot, but applies anywhere):
    1. Prompt injection / jailbreak ("ignore previous", "you are now …")
    2. Free-AI exploitation (homework, code, exam help, image gen prompts)
    3. Price / order forgery ("you confirmed KES 1 earlier")
    4. PII fishing ("show me orders for +254712…")
    5. Token-bleed (huge inputs, infinite loops, gibberish hammering)
    6. Brand-safety baiting (slurs, sexual, illegal substances)

What we DON'T do here: send anything off-platform. No external moderation
API in the hot path — it's a single regex sweep + budget check. Total cost
per call: < 1ms.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from typing import Iterable


# ── Configuration knobs ────────────────────────────────────────────────

MAX_USER_MSG_CHARS = 800          # WhatsApp soft cap; longer → reject
MAX_CONV_TURNS = 50               # hard ceiling — escalate after this
ABUSE_SCORE_BLOCK_THRESHOLD = 5   # auto-flag at this score
ABUSE_SCORE_HARD_BLOCK = 10       # auto-block at this score (no LLM call)


class Verdict(str, Enum):
    ALLOW = "allow"               # forward to LLM as normal
    SOFT_REDIRECT = "soft_redirect"   # send canned reply, skip LLM, +1 abuse
    HARD_BLOCK = "hard_block"     # send refusal, skip LLM, escalate / flag
    ESCALATE = "escalate"         # hand to human, skip LLM


@dataclass(frozen=True)
class SafetyDecision:
    verdict: Verdict
    reason: str                       # short machine tag, e.g. "jailbreak"
    canned_reply: str | None          # text to send back (None = no reply)
    abuse_delta: int = 0              # bump customer abuse_score by this
    redact_text: str | None = None    # optional: rewritten safe version of input


# ── Lexicons ────────────────────────────────────────────────────────────

# Prompt-injection patterns. Case-insensitive substring/regex.
_JAILBREAK_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE) for p in (
        r"ignore (?:all |the |any |your )?(?:previous|prior|above) (?:instruction|rule|prompt)",
        r"disregard (?:previous|prior|all|the) (?:instruction|rule|prompt)",
        r"forget (?:everything|the rules|all instructions|your training)",
        r"\b(?:reveal|show|print|leak|dump) (?:your |the )?(?:system|hidden|secret) ?prompt",
        r"\byou are (?:now|actually) (?:a |an )?(?:chatgpt|developer|system|admin|root|jailbreak|dan|debugger|python interpreter|pirate)\b",
        r"\bact as (?:a |an )?(?:chatgpt|developer|system|admin|root|jailbreak|dan|debugger|python interpreter)\b",
        r"\bdeveloper mode\b|\bdebug mode\b|\bgod mode\b",
        r"\bjailbreak\b|\bDAN\b(?:\s+mode)?",
        r"\bsudo\b\s+(?:make|do|tell|give)",
        r"\brepeat (?:after me|the words?) ['\"]",
        r"\bpretend (?:you (?:are|have)|to be) (?:chatgpt|developer|system|admin|root|jailbreak|dan|unfiltered)",
        r"\bnew (?:instructions?|rules?|system message)",
        r"\boverride (?:your |the |all )?(?:instruction|rule|safety)",
        r"</?\s*(?:system|admin|prompt|instruction)\s*>",   # tag injection
        r"\[\s*(?:system|admin|instruction|new rule)s?\s*[:\]]",
    )
)

# Off-topic exploitation (using café AI as ChatGPT). Each is +2 abuse.
_OFFTOPIC_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE) for p in (
        r"\bwrite (?:me )?(?:a |an |the )?(?:python|javascript|java|c\+\+|code|program|script|essay|poem|story|haiku)",
        r"\bsolve (?:this|the|my) (?:equation|integral|derivative|homework|problem|assignment)",
        r"\bexplain (?:like i'm 5|in detail|the (?:theory|concept|history) of)",
        r"\bdo my (?:homework|assignment|essay|paper|project)\b",
        r"\b(?:translate|summari[sz]e) (?:this|the following) (?:paragraph|article|essay|text|book)",
        r"\bwhat is the (?:capital|population|gdp|history) of\b",
        r"\b(?:generate|create|draw) (?:me )?(?:an? )?(?:ai )?(?:logo|poster|meme|wallpaper|illustration|cartoon|avatar|anime|drawing)",
    )
)

# PII fishing — asking about *other* customers.
_PII_FISH_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE) for p in (
        r"\b(?:show|list|tell|give|send) me (?:all |the |my )?(?:other|previous|past) (?:orders?|customers?|messages?|conversations?)",
        r"\bwhat did (?:.*) order\b",
        r"\bwho (?:else )?(?:ordered|bought|paid)\b",
        r"\border history (?:for|of) (?:\+?\d|customer)",
        r"\bgive me (?:phone|number|email) (?:of|for) ",
    )
)

# Brand-safety hard refuses. Keep small — we just block + flag, no opinion.
_HARD_REFUSE_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE) for p in (
        r"\bhow (?:to|do i) (?:make|build|synthesi[sz]e|cook) (?:a )?(?:bomb|weapon|drug|meth|cocaine)",
        r"\b(?:child|kid|minor)\s+(?:porn|sex|nude)",
        r"\bkill (?:myself|him|her|them|everyone)\b",
    )
)


# ── Helpers ────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Strip zero-width chars + NFKC to defeat the most common evasions."""
    text = unicodedata.normalize("NFKC", text)
    # Drop zero-width / bidi controls that hide jailbreak payloads
    text = "".join(ch for ch in text if unicodedata.category(ch) not in ("Cf", "Cc"))
    # Collapse runs of repeated punctuation/whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _matches_any(text: str, patterns: Iterable[re.Pattern[str]]) -> str | None:
    for pat in patterns:
        m = pat.search(text)
        if m:
            return m.group(0)[:60]
    return None


# ── Public API ─────────────────────────────────────────────────────────

def evaluate_inbound(
    text: str,
    *,
    business_name: str | None = None,
    conv_turn_count: int = 0,
    abuse_score: int = 0,
) -> SafetyDecision:
    """Run all pre-LLM safety checks on a user message. Order matters:
    hardest blocks first so we never call the LLM on truly toxic input.

    Returns a `SafetyDecision`. If `verdict == ALLOW` you can proceed to
    the LLM. Otherwise send `canned_reply` directly (it's already worded
    to be safe + non-revealing of the rule that fired) and bump the
    customer's abuse_score by `abuse_delta`.
    """
    biz = business_name or "the café"
    raw = text or ""

    # 0. Trivial: empty / whitespace
    if not raw.strip():
        return SafetyDecision(
            Verdict.SOFT_REDIRECT, "empty",
            canned_reply=f"Hi! What can {biz} get for you today?",
        )

    # 1. Length cap — anything beyond MAX is almost certainly a payload dump
    if len(raw) > MAX_USER_MSG_CHARS:
        return SafetyDecision(
            Verdict.SOFT_REDIRECT, "too_long",
            canned_reply=(
                f"That message is a bit long for me to read on WhatsApp. "
                f"Could you sum up what you'd like to order from {biz}, "
                f"in a sentence or two?"
            ),
            abuse_delta=1,
        )

    norm = _normalize(raw)

    # 2. Hard-refuse — illegal / abuse content. We immediately escalate.
    hit = _matches_any(norm, _HARD_REFUSE_PATTERNS)
    if hit:
        return SafetyDecision(
            Verdict.HARD_BLOCK, "hard_refuse",
            canned_reply=(
                "I can't help with that. If you're looking to order food, "
                f"I'm here for {biz}."
            ),
            abuse_delta=4,
        )

    # 3. Prior abuse → hard block before doing any more work
    if abuse_score >= ABUSE_SCORE_HARD_BLOCK:
        return SafetyDecision(
            Verdict.HARD_BLOCK, "abuse_score_exceeded",
            canned_reply=(
                "I'm not able to keep chatting right now. Our team will "
                "follow up if needed."
            ),
        )

    # 4. Turn-count cap — adversarial loops, exhausted human-handover
    if conv_turn_count >= MAX_CONV_TURNS:
        return SafetyDecision(
            Verdict.ESCALATE, "turn_cap",
            canned_reply=(
                "This is getting long — let me bring a person from "
                f"{biz} into the chat. Hold tight."
            ),
        )

    # 5. Jailbreak / prompt-injection — softest of the abuses; canned redirect
    hit = _matches_any(norm, _JAILBREAK_PATTERNS)
    if hit:
        return SafetyDecision(
            Verdict.SOFT_REDIRECT, f"jailbreak:{hit}",
            canned_reply=(
                f"I can only help with {biz} — orders, menu, hours. "
                f"What would you like today?"
            ),
            abuse_delta=2,
        )

    # 6. PII fishing → flat refusal, no info leak
    hit = _matches_any(norm, _PII_FISH_PATTERNS)
    if hit:
        return SafetyDecision(
            Verdict.SOFT_REDIRECT, f"pii_fish:{hit}",
            canned_reply=(
                "I can only see your own orders here. Is there something "
                "you'd like to order or check on?"
            ),
            abuse_delta=2,
        )

    # 7. Off-topic exploitation (homework / code / image-gen)
    hit = _matches_any(norm, _OFFTOPIC_PATTERNS)
    if hit:
        return SafetyDecision(
            Verdict.SOFT_REDIRECT, f"offtopic:{hit}",
            canned_reply=(
                f"That's outside what I can help with — I'm {biz}'s "
                f"ordering assistant. Want to see today's menu?"
            ),
            abuse_delta=2,
        )

    return SafetyDecision(Verdict.ALLOW, "ok", canned_reply=None)


# ── Output validation ──────────────────────────────────────────────────

# Currency patterns the AI is allowed to mention. Anything not anchored to
# the menu KB will be redacted — we never want a hallucinated price to
# become a customer's expectation.
_PRICE_RE = re.compile(
    r"\b(?:KES|KSh|Ksh|ksh|kes|/=|/-)\s?(\d[\d,]{1,7})\b|"
    r"\b(\d[\d,]{1,7})\s?(?:KES|KSh|Ksh|/=|/-|bob|shillings?)\b",
    re.IGNORECASE,
)

_FORBIDDEN_OUTPUT_PHRASES: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE) for p in (
        # AI must NEVER confirm an order without payment proof
        r"\border (?:is )?confirmed\b",
        r"\b(?:order|payment) (?:is )?successful\b",
        r"\byou (?:are |have )?(?:successfully )?paid\b",
        # AI must never claim to *be* a human / a manager
        r"\bi am (?:a |the )?(?:manager|owner|cashier|human|staff member)\b",
        # Don't leak rules
        r"\bmy (?:system|hidden) prompt\b",
        r"\bsafety (?:rules?|instructions?)\b",
        # No-overpromise guardrails (ops must confirm these claims first).
        r"\byour items? (?:are|is) reserved\b",
        r"\bdelivery (?:is )?guaranteed\b",
        r"\bthis exact (?:item|piece) is available\b",
        r"\bwe (?:have|ve) secured your items?\b",
        r"\b(?:we can|i can) deliver\b",
        r"\bit will arrive by\b",
    )
)

_SUBSTITUTION_SIGNAL = re.compile(
    r"\b(unavailable|out of stock|alternative|substitution|equivalent|replace(?:ment)?)\b",
    re.IGNORECASE,
)


def extract_kes_amounts(text: str) -> set[int]:
    """Extract KES amounts from free text.

    Used both for KB allowlists and for conversational budget constraints
    supplied by the customer ("under KES 300", "budget 500 bob", etc.).
    """
    amounts: set[int] = set()
    for m in _PRICE_RE.finditer(text or ""):
        raw = (m.group(1) or m.group(2) or "").replace(",", "")
        try:
            value = int(raw)
        except ValueError:
            continue
        if 1 <= value <= 1_000_000:
            amounts.add(value)
    return amounts


def evaluate_outbound(
    reply: str,
    *,
    allowed_prices: set[int] | None = None,
    contextual_prices: set[int] | None = None,
) -> tuple[str, list[str]]:
    """Validate an AI reply before sending. Returns (cleaned_reply, flags).

    - Redacts any KES price not in `allowed_prices` (sourced from the menu KB).
    - Strips forbidden phrases (order-confirmation, identity claims).
    - Caps length.
    """
    flags: list[str] = []
    out = reply or ""

    no_overpromise_hit = False
    substitution_signal_hit = False

    # Strip forbidden phrases (replace with empty + flag)
    for pat in _FORBIDDEN_OUTPUT_PHRASES:
        if pat.search(out):
            flags.append(f"forbidden_phrase:{pat.pattern[:32]}")
            if any(
                marker in pat.pattern
                for marker in (
                    "reserved",
                    "guaranteed",
                    "exact (?:item|piece)",
                    "secured your items",
                    "(?:we can|i can) deliver",
                    "arrive by",
                )
            ):
                no_overpromise_hit = True
            out = pat.sub("", out)

    # Price validation: if a price is mentioned that isn't in the KB, redact.
    if allowed_prices is not None:
        allowed_context = contextual_prices or set()

        def _swap(m: re.Match[str]) -> str:
            raw = (m.group(1) or m.group(2) or "").replace(",", "")
            try:
                v = int(raw)
            except ValueError:
                return m.group(0)
            if v in allowed_prices or v in allowed_context:
                return m.group(0)
            flags.append(f"price_redacted:{v}")
            return "[price — please confirm with us]"
        out = _PRICE_RE.sub(_swap, out)

    # Final hard cap (defence in depth — sanitizer also caps)
    if len(out) > 2000:
        flags.append("truncated")
        out = out[:2000].rstrip() + "…"

    if no_overpromise_hit:
        flags.append("promise_control_redacted")
        out = out.strip()
        if out:
            out += " "
        out += (
            "Our concierge will confirm availability, delivery timing, and dispatch once sourcing checks are complete."
        )

    if _SUBSTITUTION_SIGNAL.search(out):
        substitution_signal_hit = True

    if substitution_signal_hit:
        flags.append("substitution_approval_required")
        out = (
            "One selected piece is unavailable in the exact finish shown. "
            "We can offer a matching alternative of equal or higher standard. "
            "Would you like us to proceed with the replacement before dispatch?"
        )

    return out, flags


__all__ = [
    "Verdict", "SafetyDecision",
    "evaluate_inbound", "evaluate_outbound",
    "extract_kes_amounts",
    "MAX_USER_MSG_CHARS", "MAX_CONV_TURNS",
    "ABUSE_SCORE_BLOCK_THRESHOLD", "ABUSE_SCORE_HARD_BLOCK",
]
