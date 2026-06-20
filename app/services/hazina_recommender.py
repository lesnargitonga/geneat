"""Deterministic Hazina gift recommender.

Lets the concierge answer open-ended "what should I gift?" questions WITHOUT an
LLM, by filtering the live catalog on category + budget. This keeps the WhatsApp
concierge fully functional while the fine-tuned model is unavailable.
"""
from __future__ import annotations

import re
from typing import Any

# Intent — only fire on a clear ask for a suggestion, so we never hijack
# checkout, status, or catalog-browse turns.
_RECOMMEND_INTENT_RE = re.compile(
    r"\b(recommend|recommendation|suggest|suggestion|ideas?|"
    r"what (?:should|do you think) i (?:get|buy|gift|send)|"
    r"help me (?:pick|choose|find|decide)|"
    r"looking for (?:a |an )?(?:gift|present|something)|"
    r"(?:gift|present) (?:for|idea)|something for|best (?:gift|option|pick)|"
    r"which (?:gift|box|collection|one))\b",
    re.IGNORECASE,
)

# Map free-text to the treasure categories used in the catalog.
_CATEGORY_KEYWORDS: dict[str, str] = {
    "coffee-tea": r"\b(coffee|tea|chai|roast|brew|caffeine)\b",
    "beadwork": r"\b(bead|beaded|jewel|jewell?ery|necklace|bracelet|earrings?|maa?sai)\b",
    "leather": r"\b(leather|wallet|bag|passport|luggage|journal|notebook)\b",
    "wood-carving": r"\b(wood|carv|sculpt|animal|big.?five|soapstone|figurine)\b",
    "food": r"\b(honey|pantry|snack|jam|spice|gourmet|edible|sweet)\b",
    "textiles": r"\b(kitenge|fabric|textile|scarf|cloth|kanga|shawl|wrap)\b",
    "baskets": r"\b(basket|woven|kiondo|weav)\b",
    "swahili-coast": r"\b(coast|swahili|kikoi|lamu|mombasa)\b",
    "art-sculpture": r"\b(art|painting|sculpture|decor|ornament)\b",
    "homeware": r"\b(homeware|candle|mug|kitchen)\b",
}
_COMPILED_CATEGORIES = {k: re.compile(v, re.IGNORECASE) for k, v in _CATEGORY_KEYWORDS.items()}

_BUDGET_USD_RE = re.compile(
    r"\$\s*(\d{1,5})|\b(\d{1,5})\s*(?:usd|dollars?|bucks?)\b",
    re.IGNORECASE,
)
_BUDGET_KES_RE = re.compile(
    r"\b(?:ksh|kes|sh)\s*([\d,]{3,7})|\b([\d,]{3,7})\s*(?:ksh|kes|bob|shillings?)\b",
    re.IGNORECASE,
)


def looks_like_recommendation(text: str) -> bool:
    return bool(_RECOMMEND_INTENT_RE.search(text or ""))


def detect_categories(text: str) -> list[str]:
    t = text or ""
    return [cat for cat, rx in _COMPILED_CATEGORIES.items() if rx.search(t)]


def parse_budget(text: str) -> tuple[float | None, str | None]:
    """Return (amount, currency) where currency is 'USD' or 'KES'."""
    t = text or ""
    m = _BUDGET_KES_RE.search(t)
    if m:
        raw = (m.group(1) or m.group(2) or "").replace(",", "")
        if raw.isdigit():
            return float(raw), "KES"
    m = _BUDGET_USD_RE.search(t)
    if m:
        raw = m.group(1) or m.group(2) or ""
        if raw.isdigit():
            return float(raw), "USD"
    return None, None


def _within_budget(row: dict, amount: float | None, currency: str | None) -> bool:
    if amount is None:
        return True
    key = "price_kes" if currency == "KES" else "price_usd"
    price = row.get(key)
    try:
        return price is not None and float(price) <= amount
    except (TypeError, ValueError):
        return True


def _matches_category(treasure: dict, categories: list[str]) -> bool:
    if not categories:
        return True
    return str(treasure.get("category") or "") in categories


def recommend(payload: dict[str, Any], text: str, *, is_sw: bool = False) -> dict | None:
    """Return a recommendation dict, or None if we can't make a useful suggestion.

    Shape: {reply, collection_ids, treasure_ids, categories, budget, currency}
    """
    if not looks_like_recommendation(text):
        return None

    categories = detect_categories(text)
    amount, currency = parse_budget(text)
    collections = payload.get("collections") or []
    treasures = payload.get("treasures") or []

    # Treasures matching the requested category (and budget if any).
    matched_treasures = [
        t for t in treasures
        if _matches_category(t, categories) and _within_budget(t, amount, currency)
    ]
    matched_treasure_ids = {t["id"] for t in matched_treasures}

    # Collections that fit the budget AND (if a category was named) contain a
    # matching treasure; otherwise any in-budget collection.
    def _collection_ok(c: dict) -> bool:
        if not _within_budget(c, amount, currency):
            return False
        if not categories:
            return True
        return bool(set(c.get("item_ids") or []) & matched_treasure_ids)

    matched_collections = [c for c in collections if _collection_ok(c)]
    matched_collections.sort(key=lambda c: c.get("price_usd") or 0)
    matched_treasures.sort(key=lambda t: t.get("price_usd") or 0)

    money = lambda r: f"USD {r.get('price_usd')}" + (
        f" / KES {int(r.get('price_kes')):,}" if r.get("price_kes") else ""
    )

    lead = "Hapa kuna mapendekezo: " if is_sw else "Here's what I'd recommend"
    if categories or amount:
        bits = []
        if categories:
            bits.append(", ".join(c.replace("-", " ") for c in categories))
        if amount:
            bits.append(f"under {currency or 'USD'} {int(amount):,}")
        lead = ("Kwa " if is_sw else "For ") + " ".join(bits) + (": " if is_sw else ", here's my pick")

    lines: list[str] = []
    collection_ids: list[str] = []
    treasure_ids: list[str] = []

    if matched_collections:
        for c in matched_collections[:2]:
            collection_ids.append(c["id"])
            contents = str(c.get("contents") or "").strip()
            tail = f" — {contents}" if contents else ""
            lines.append(f"• {c['name']} ({money(c)}){tail}")
        if matched_treasures:
            extra = matched_treasures[0]
            treasure_ids.append(extra["id"])
            lines.append(
                (f"• Au kipande kimoja: {extra['name']} ({money(extra)})")
                if is_sw else
                f"• Or a single piece: {extra['name']} ({money(extra)})"
            )
    elif matched_treasures:
        for t in matched_treasures[:3]:
            treasure_ids.append(t["id"])
            lines.append(f"• {t['name']} ({money(t)})")
        lines.append(
            "Naweza kuzipanga kwenye gift box moja na packaging."
            if is_sw else
            "I can bundle these into one gift box with premium packaging."
        )
    else:
        # Nothing fit — guide to a custom brief rather than inventing stock.
        cats = sorted({str(t.get("category") or "").replace("-", " ") for t in treasures if t.get("category")})
        listed = ", ".join(cats[:6])
        return {
            "reply": (
                f"Sina kipande kinacholingana moja kwa moja, lakini portfolio yetu inajumuisha: {listed}. "
                "Naweza kufungua custom sourcing brief kwa timu yetu."
                if is_sw else
                f"I don't have an exact match in that range, but our portfolio covers: {listed}. "
                "I can open a custom sourcing brief with our field team for something specific."
            ),
            "collection_ids": [],
            "treasure_ids": [],
            "categories": categories,
            "budget": amount,
            "currency": currency,
        }

    closer = (
        "Nikuanzishie checkout au nikuonyeshe kilichomo?"
        if is_sw else
        "Want me to start a checkout, or show you what's inside?"
    )
    reply = f"{lead}:\n" + "\n".join(lines) + f"\n\n{closer}"
    return {
        "reply": reply,
        "collection_ids": collection_ids,
        "treasure_ids": treasure_ids,
        "categories": categories,
        "budget": amount,
        "currency": currency,
    }
