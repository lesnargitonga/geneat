"""Lightweight language / register detection for inbound turns.

Returns one of:
  - "sheng" : Nairobi street slang (greetings + slang markers)
  - "sw"    : Kiswahili (formal Swahili words)
  - "en"    : English (or unknown — safe default)

Heuristic, not ML. Designed to be fast, deterministic, and good enough to
drive a "REPLY-IN: <lang>" prompt directive. Mixed messages favour Sheng if
slang markers are present, otherwise Kiswahili if Swahili content words are
dense, otherwise English.
"""
from __future__ import annotations

import re

# Strong Sheng markers — if any of these appear, force "sheng" register.
_SHENG_MARKERS = {
    "niaje", "mambo", "vipi", "sasa", "poa", "fiti", "freshi", "manze",
    "mse", "boss", "buda", "fala", "noma", "mzuka", "form", "doh", "mbao",
    "soja", "msee", "shida", "kuita",
}

# Common Swahili function/content words. Dense presence → "sw".
_SWAHILI_WORDS = {
    "ni", "na", "ya", "wa", "kwa", "katika", "ndani", "nje", "lakini",
    "kama", "ama", "au", "bei", "ngapi", "leo", "kesho", "jana", "asante",
    "karibu", "habari", "salaam", "rafiki", "nataka", "ninaweza", "unaweza",
    "tunaweza", "nita", "kuna", "iko", "uko", "tuko", "mko", "wako",
    "yangu", "yako", "yake", "yenu", "wetu", "mimi", "wewe", "yeye", "sisi",
    "ninyi", "wao", "saa", "siku", "wiki", "mwezi", "mwaka", "mtu", "watu",
    "kitu", "vitu", "mahali", "nyumba", "kazi", "shule", "soko", "duka",
    "chakula", "maji", "chai", "kahawa", "fungua", "funga", "mnafunga",
    "tafadhali", "samahani", "pole", "vizuri", "mzuri", "mbaya",
}

_WORD_RE = re.compile(r"[a-zA-ZÀ-ÿ']+", re.UNICODE)


def detect_language(text: str | None) -> str:
    """Classify the customer's register. Returns 'sheng' | 'sw' | 'en'."""
    if not text:
        return "en"
    tokens = [t.lower() for t in _WORD_RE.findall(text)]
    if not tokens:
        return "en"

    sheng_hits = sum(1 for t in tokens if t in _SHENG_MARKERS)
    sw_hits    = sum(1 for t in tokens if t in _SWAHILI_WORDS)

    # Sheng wins if ANY strong slang marker present (very high precision).
    if sheng_hits >= 1:
        return "sheng"
    # Otherwise look at Kiswahili density. 2+ Swahili words OR >=30% of
    # tokens being Swahili → Kiswahili.
    if sw_hits >= 2 or (sw_hits / max(len(tokens), 1)) >= 0.30:
        return "sw"
    return "en"


_LANG_INSTRUCTION = {
    "sheng": (
        "REPLY-IN: SHENG / KISWAHILI. The customer wrote in Sheng. "
        "HARD RULE: reply ENTIRELY in Sheng / Kiswahili. ZERO standalone "
        "English sentences. ZERO English bullet labels. Brand names and "
        "feature words (Penthouse, jacuzzi, balcony, breakfast, mini-bar, "
        "STK push, KES) may stay in English ONLY as nouns embedded in a "
        "Swahili sentence. Closing CTA in Sheng/Swahili (e.g. "
        "'Nikuwekee booking sasa?'). If you find yourself writing 'The X is…' "
        "or 'It features…', STOP and rewrite as 'X ni…' / 'Ina…' / 'Inajumuisha…'."
    ),
    "sw": (
        "REPLY-IN: KISWAHILI. The customer wrote in Kiswahili. "
        "HARD RULE: reply ENTIRELY in clean Kiswahili. ZERO standalone "
        "English sentences. ZERO English bullet labels. Brand / feature "
        "nouns (Penthouse, jacuzzi, KES) may stay in English ONLY as nouns "
        "inside a Swahili sentence. Numerals and KES are fine. If you find "
        "yourself writing 'The X is…' or 'It features…', STOP and rewrite "
        "as 'X ni…' / 'Ina…' / 'Inajumuisha…'."
    ),
    "en": (
        "REPLY-IN: ENGLISH (Kenyan business register). HARD RULE: stay in "
        "English the entire reply unless the customer code-switches first. "
        "Do not sprinkle in Swahili words. Closing CTA in English."
    ),
}


def language_instruction(lang: str | None) -> str:
    """Return the HARD reply-language directive to inject into the prompt."""
    return _LANG_INSTRUCTION.get((lang or "en").lower(), _LANG_INSTRUCTION["en"])
