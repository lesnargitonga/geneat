"""Per-business config helpers — timezone, business hours, currency, escalation.

All config lives in `Business.profile` JSONB so we don't need a schema
migration to add new fields. Stored shape:

    {
      "timezone": "Africa/Nairobi",          # IANA
      "currency": "KES",                     # ISO 4217
      "currency_symbol": "KES",              # rendered to customer
      "escalation_phone": "+254...",         # override owner_alert_phone
      "fallback_reply": "Custom message...", # override generic LLM-down msg
      "business_hours": {
          "mon": {"open": "08:00", "close": "20:00"},
          "tue": {"open": "08:00", "close": "20:00"},
          ...
          "sun": {"closed": true}
      },
      "holidays": ["2025-12-25", "2026-01-01"]  # ISO dates
    }
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import TYPE_CHECKING

from app.core.logging import get_logger

if TYPE_CHECKING:
    from app.services.business_service import BusinessProfile

log = get_logger("biz_config")

_DEFAULT_TZ_NAME = "Africa/Nairobi"
_NAIROBI_OFFSET = timezone(timedelta(hours=3))
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _get(prof: "BusinessProfile | None", key: str, default=None):
    if prof is None:
        return default
    return (prof.profile or {}).get(key, default)


def get_timezone(prof: "BusinessProfile | None") -> timezone:
    """Resolve the business tz. Falls back to Africa/Nairobi.

    We try zoneinfo first (handles DST regions like Africa/Casablanca correctly)
    and fall back to a fixed offset for tz-less environments.
    """
    tz_name = _get(prof, "timezone", _DEFAULT_TZ_NAME) or _DEFAULT_TZ_NAME
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(tz_name)  # type: ignore[return-value]
    except Exception:
        log.warning("invalid_timezone", tz=tz_name)
        return _NAIROBI_OFFSET


def get_currency(prof: "BusinessProfile | None") -> str:
    return (_get(prof, "currency", "KES") or "KES").upper()


def get_currency_symbol(prof: "BusinessProfile | None") -> str:
    return _get(prof, "currency_symbol", get_currency(prof))


def get_escalation_phone(prof: "BusinessProfile | None") -> str:
    return _get(prof, "escalation_phone", "") or (prof.contact_phone if prof else "") or ""


def get_fallback_reply(prof: "BusinessProfile | None") -> str | None:
    return _get(prof, "fallback_reply", None)


def now_local(prof: "BusinessProfile | None") -> datetime:
    return datetime.now(get_timezone(prof))


@dataclass(frozen=True)
class HoursDecision:
    open_now: bool
    weekday: str
    today_open: str | None   # "08:00" if today has hours
    today_close: str | None
    next_open: str | None    # e.g. "Mon 08:00" for next opening
    holiday: bool


def _parse_hhmm(value: str | None) -> time | None:
    if not value or not isinstance(value, str):
        return None
    try:
        hh, mm = value.split(":", 1)
        return time(int(hh), int(mm))
    except Exception:
        return None


def evaluate_hours(prof: "BusinessProfile | None", *, at: datetime | None = None) -> HoursDecision:
    """Decide whether the business is open now. When `business_hours` is not
    configured, the business is treated as always-open (open_now=True)."""
    tz = get_timezone(prof)
    now = (at.astimezone(tz) if at else datetime.now(tz))
    today_key = _WEEKDAYS[now.weekday()]
    iso_date = now.date().isoformat()

    hours = _get(prof, "business_hours", {}) or {}
    holidays = set(_get(prof, "holidays", []) or [])

    if iso_date in holidays:
        return HoursDecision(False, today_key, None, None, _next_open(hours, holidays, now, tz), True)

    if not hours:
        return HoursDecision(True, today_key, None, None, None, False)

    today = hours.get(today_key) or {}
    if today.get("closed"):
        return HoursDecision(False, today_key, None, None, _next_open(hours, holidays, now, tz), False)
    open_t = _parse_hhmm(today.get("open"))
    close_t = _parse_hhmm(today.get("close"))
    if not open_t or not close_t:
        # malformed → assume open to avoid blocking legitimate traffic
        return HoursDecision(True, today_key, None, None, None, False)
    open_now = open_t <= now.time() < close_t
    return HoursDecision(
        open_now=open_now,
        weekday=today_key,
        today_open=today.get("open"),
        today_close=today.get("close"),
        next_open=None if open_now else _next_open(hours, holidays, now, tz),
        holiday=False,
    )


def _next_open(hours: dict, holidays: set[str], now: datetime, tz: timezone) -> str | None:
    """Return human-readable next opening, e.g. 'Mon 08:00' or 'today 14:00'."""
    for delta in range(0, 7):
        candidate = now + timedelta(days=delta)
        key = _WEEKDAYS[candidate.weekday()]
        if candidate.date().isoformat() in holidays:
            continue
        block = hours.get(key) or {}
        if block.get("closed"):
            continue
        open_t = _parse_hhmm(block.get("open"))
        if not open_t:
            continue
        if delta == 0 and now.time() >= open_t:
            continue  # already past today's opening
        label = "today" if delta == 0 else ("tomorrow" if delta == 1 else candidate.strftime("%a"))
        return f"{label} {block.get('open')}"
    return None


def business_hours_block(prof: "BusinessProfile | None") -> str:
    """Render a short snippet for the system prompt CONTEXT section."""
    decision = evaluate_hours(prof)
    tz = get_timezone(prof)
    local_str = datetime.now(tz).strftime("%A %H:%M")
    if decision.holiday:
        nxt = decision.next_open or "next business day"
        return f"Status: CLOSED for public holiday. Reopens {nxt}. Local time: {local_str}."
    if decision.open_now:
        if decision.today_close:
            return (
                f"Status: OPEN now (closes {decision.today_close}). "
                f"Local time: {local_str}."
            )
        return f"Status: OPEN (24/7). Local time: {local_str}."
    nxt = decision.next_open or "next business day"
    return (
        f"Status: CLOSED. Reopens {nxt}. Local time: {local_str}. "
        "Be transparent that the business is currently closed; you can still "
        "take messages and bookings for the next available slot."
    )
