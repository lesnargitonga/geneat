from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

from app.ai.rag import RetrievedChunk, retrieve
from app.ai.safety import extract_kes_amounts
from app.services.business_service import BusinessProfile

_PHOTO_REQUEST_RE = re.compile(
    r"\b("
    r"photo|picture|pic|image|picha|show me|send me|let me see|lemme see|how does .* look"
    r")\b",
    re.IGNORECASE,
)
_PRICE_REQUEST_RE = re.compile(
    r"\b("
    r"how much|price|cost|bei|kes ngapi|ni how much|how much is|how much for|price of|price for"
    r")\b",
    re.IGNORECASE,
)
_HOURS_REQUEST_RE = re.compile(
    r"\b("
    r"open|opening|close|closing|hours|what time do you open|what time do you close|when do you open|when do you close"
    r")\b",
    re.IGNORECASE,
)
_RECOMMENDATION_REQUEST_RE = re.compile(
    r"\b("
    r"recommend|suggest|what'?s good|what is good|best|good for|menu|options|what do you have|what have you|under\s+(?:kes|ksh|\d)|budget"
    r")\b",
    re.IGNORECASE,
)
_NORMALIZE_RE = re.compile(r"[^a-z0-9 ]+")
_PRICE_SEGMENT_RE = re.compile(
    r"(?:KES|KSh|Ksh|ksh|kes)\s?(\d[\d,]{1,7})|(\d[\d,]{1,7})\s?(?:KES|KSh|Ksh|/=|/-|bob|shillings?)",
    re.IGNORECASE,
)
_PRICE_STOPWORDS = {
    "how", "much", "is", "for", "the", "a", "an", "of", "price", "cost", "bei",
    "ni", "kes", "ksh", "bob", "please", "me", "show", "tell", "what", "whats",
}
_CATEGORY_HINTS: dict[str, set[str]] = {
    "breakfast": {"breakfast", "morning", "chai", "mandazi", "toast", "pancake", "granola", "egg", "croissant"},
    "lunch": {"lunch", "wrap", "bowl", "curry", "caesar", "plate", "burger", "grill"},
    "coffee": {"coffee", "espresso", "latte", "flat white", "cappuccino", "macchiato", "cortado", "mocha", "brew"},
    "pastry": {"pastry", "pastries", "croissant", "brownie", "tart", "loaf", "pain au chocolat", "almond"},
    "snack": {"snack", "snacks", "bites", "cookie", "cookies", "samosa", "fries"},
    "drink": {"drink", "drinks", "juice", "soda", "water", "tea", "chai", "coffee"},
}


@dataclass(frozen=True)
class MenuOption:
    label: str
    price: int
    segment: str
    normalized: str


def _normalize(text: str) -> str:
    return _NORMALIZE_RE.sub(" ", (text or "").lower()).strip()


def looks_like_photo_request(text: str) -> bool:
    candidate = (text or "").strip()
    return bool(candidate and _PHOTO_REQUEST_RE.search(candidate))


def looks_like_price_request(text: str) -> bool:
    candidate = (text or "").strip()
    return bool(candidate and _PRICE_REQUEST_RE.search(candidate))


def looks_like_hours_request(text: str) -> bool:
    candidate = (text or "").strip()
    return bool(candidate and _HOURS_REQUEST_RE.search(candidate))


def looks_like_recommendation_request(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate:
        return False
    if looks_like_photo_request(candidate) or looks_like_price_request(candidate):
        return False
    lowered = candidate.lower()
    if any(token in lowered for token in ("breakfast", "lunch", "dinner", "coffee", "pastr", "snack", "drink", "menu")):
        return True
    return bool(_RECOMMENDATION_REQUEST_RE.search(candidate))


def photo_item_query(text: str) -> str:
    candidate = (text or "").strip()
    if not candidate:
        return "menu"
    lowered = candidate.lower()
    if any(token in lowered for token in ("whole menu", "full menu", "entire menu", "menu pictures", "menu photo")):
        return "menu"
    return candidate


def price_item_query(text: str) -> str:
    lowered = _normalize(text)
    for phrase in (
        "how much is", "how much for", "how much", "price of", "price for", "price", "cost of", "cost",
        "bei ya", "bei", "kes ngapi", "ni how much",
    ):
        lowered = lowered.replace(phrase, " ")
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered or (text or "").strip()


def price_reply_from_chunks(query: str, chunks: Sequence[RetrievedChunk]) -> str | None:
    item_query = price_item_query(query)
    query_norm = _normalize(item_query)
    query_tokens = {
        token for token in query_norm.split()
        if token and token not in _PRICE_STOPWORDS and len(token) >= 3
    }
    if not query_tokens and query_norm:
        query_tokens = {query_norm}

    best_segment: str | None = None
    best_score = -1
    best_price: int | None = None
    for chunk in chunks:
        for raw_segment in re.split(r"[\n•]+", chunk.content or ""):
            segment = raw_segment.strip(" -:\t")
            if not segment:
                continue
            seg_norm = _normalize(segment)
            score = 0
            if query_norm and query_norm in seg_norm:
                score += 3
            score += sum(1 for token in query_tokens if token in seg_norm)
            if score <= 0:
                continue
            amounts = sorted(extract_kes_amounts(segment))
            if not amounts:
                continue
            if score > best_score:
                best_score = score
                best_segment = segment
                best_price = amounts[0]

    if best_price is None:
        return None

    label = item_query.strip(" ?.!").title() if item_query.strip() else "That item"
    if "demo espresso" in query_norm or "demo order" in query_norm or "10 bob" in query_norm or "ten bob" in query_norm:
        return "Demo Espresso is KES 10. Want me to set one up for pickup?"
    if best_segment and "/" in best_segment and best_score < 4:
        return f"The listed price there is KES {best_price}. Want me to pull the exact item for you?"
    return f"{label} is KES {best_price}. Want me to sort one for pickup?"


def _segments(chunks: Sequence[RetrievedChunk]) -> list[str]:
    items: list[str] = []
    for chunk in chunks:
        for piece in re.split(r"\n|(?<=\.)\s+", chunk.content or ""):
            segment = piece.strip(" \t-•")
            if not segment or "KES" not in segment.upper():
                continue
            items.append(segment)
    return items


def _segment_label(segment: str) -> str | None:
    segment = segment.strip(" \t-•")
    match = _PRICE_SEGMENT_RE.search(segment)
    if not match:
        return None
    label = segment[:match.start()].strip(" :-—–/\t")
    label = re.sub(r"^[A-Z ]+—\s*", "", label)
    label = re.sub(r"\s{2,}", " ", label).strip(" .")
    if not label:
        return None
    return label


def _first_price(segment: str) -> int | None:
    match = _PRICE_SEGMENT_RE.search(segment or "")
    if not match:
        return None
    raw = (match.group(1) or match.group(2) or "").replace(",", "")
    try:
        return int(raw)
    except ValueError:
        return None


def _extract_options(chunks: Sequence[RetrievedChunk]) -> list[MenuOption]:
    options: list[MenuOption] = []
    seen: set[tuple[str, int]] = set()
    for segment in _segments(chunks):
        label = _segment_label(segment)
        primary_price = _first_price(segment)
        if not label or primary_price is None:
            continue
        key = (_normalize(label), primary_price)
        if key in seen:
            continue
        seen.add(key)
        options.append(MenuOption(label=label, price=primary_price, segment=segment, normalized=_normalize(segment)))
    return options


def hours_reply_from_profile(profile: BusinessProfile | None) -> str | None:
    if profile is None:
        return None
    summary = str((profile.profile or {}).get("hours_summary") or "").strip()
    if summary:
        return f"We’re open {summary}."
    return None


def recommendation_reply_from_chunks(query: str, chunks: Sequence[RetrievedChunk]) -> str | None:
    options = _extract_options(chunks)
    if not options:
        return None

    query_norm = _normalize(query)
    budget_values = sorted(v for v in extract_kes_amounts(query) if 20 <= v <= 20000)
    budget = budget_values[0] if budget_values else None
    active_hints = {
        category
        for category, hints in _CATEGORY_HINTS.items()
        if any(hint in query_norm for hint in hints)
    }
    hinted_options = [
        option for option in options
        if any(
            hint in option.normalized
            for category in active_hints
            for hint in _CATEGORY_HINTS[category]
        )
    ]
    candidate_options = hinted_options or options

    ranked: list[tuple[int, MenuOption]] = []
    for option in candidate_options:
        score = 0
        if budget is not None and option.price <= budget:
            score += 3
        if budget is not None and option.price > budget:
            score -= 2
        if active_hints and any(
            hint in option.normalized
            for category in active_hints
            for hint in _CATEGORY_HINTS[category]
        ):
            score += 3
        if any(token in option.normalized for token in query_norm.split() if len(token) >= 4):
            score += 1
        ranked.append((score, option))

    ranked.sort(key=lambda row: (-row[0], row[1].price))
    chosen: list[MenuOption] = []
    for score, option in ranked:
        if budget is not None and option.price > budget and any(item.price <= budget for _, item in ranked):
            continue
        if score < 0 and chosen:
            continue
        chosen.append(option)
        if len(chosen) == 3:
            break

    if not chosen:
        chosen = [option for _, option in ranked[:3]]
    if not chosen:
        return None

    if active_hints and len(chosen) < 2:
        supplemental = sorted(
            options,
            key=lambda option: option.price,
        )
        for option in supplemental:
            if any(existing.label == option.label and existing.price == option.price for existing in chosen):
                continue
            if budget is not None and option.price > budget and any(item.price <= budget for item in options):
                continue
            chosen.append(option)
            if len(chosen) == 3:
                break

    if budget is not None:
        intro = f"Good picks under KES {budget}:"
    elif "breakfast" in query_norm:
        intro = "For breakfast, I’d go with:"
    elif "coffee" in query_norm:
        intro = "For coffee, I’d go with:"
    elif "pastr" in query_norm:
        intro = "For pastries, I’d go with:"
    else:
        intro = "Good picks:"

    body = ", ".join(f"{option.label} - KES {option.price}" for option in chosen)
    if len(chosen) == 1:
        closing = f" Want me to sort {chosen[0].label} for you?"
    elif len(chosen) == 2:
        closing = f" Want the {chosen[0].label} or the {chosen[1].label}?"
    else:
        closing = f" Want the {chosen[0].label}, {chosen[1].label}, or {chosen[2].label}?"
    return f"{intro} {body}.{closing}"


async def maybe_build_quick_reply(
    db,
    *,
    business_id,
    profile: BusinessProfile | None,
    text: str,
) -> str | None:
    if not text or looks_like_photo_request(text):
        return None

    if looks_like_hours_request(text):
        return hours_reply_from_profile(profile)

    if looks_like_price_request(text):
        chunks = await retrieve(db, text, business_id=business_id, k=3)
        return price_reply_from_chunks(text, chunks)

    if looks_like_recommendation_request(text):
        chunks = await retrieve(db, text, business_id=business_id, k=5)
        return recommendation_reply_from_chunks(text, chunks)

    return None
