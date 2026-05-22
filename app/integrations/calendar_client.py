"""Google Calendar integration.

Auth model: service account (preferred for SME single-tenant) OR a stored
OAuth refresh token. For dev we accept GOOGLE_SERVICE_ACCOUNT_JSON (path) or
GOOGLE_REFRESH_TOKEN. If neither is configured, calls fall back to a dry-run
that returns a stub event id (so the agent loop still works).

Operations:
  - freebusy(start, end) → list of busy intervals
  - create_event(...)    → returns event id + html link
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from google.auth.transport.requests import Request as GAuthRequest
from google.oauth2.credentials import Credentials
from google.oauth2.service_account import Credentials as SACredentials
from googleapiclient.discovery import build

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("gcal")
settings = get_settings()

SCOPES = ["https://www.googleapis.com/auth/calendar"]
NAIROBI = timezone(timedelta(hours=3))


@dataclass
class BookingResult:
    ok: bool
    event_id: str | None = None
    html_link: str | None = None
    dry_run: bool = False
    error: str | None = None


@lru_cache
def _service():
    """Build an authenticated Calendar service or return None for dry-run."""
    sa_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_path and os.path.exists(sa_path):
        creds = SACredentials.from_service_account_file(sa_path, scopes=SCOPES)
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    rt = os.getenv("GOOGLE_REFRESH_TOKEN")
    client_id = settings.google_oauth_client_id
    client_secret = settings.google_oauth_client_secret.get_secret_value()
    if rt and client_id and client_secret:
        creds = Credentials(
            None, refresh_token=rt, token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id, client_secret=client_secret, scopes=SCOPES,
        )
        creds.refresh(GAuthRequest())
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    return None


def _ensure_tz(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=NAIROBI)


def freebusy(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    svc = _service()
    if not svc:
        return []
    body = {
        "timeMin": _ensure_tz(start).isoformat(),
        "timeMax": _ensure_tz(end).isoformat(),
        "items": [{"id": settings.google_calendar_id}],
    }
    resp = svc.freebusy().query(body=body).execute()
    busy = resp["calendars"][settings.google_calendar_id]["busy"]
    return [(datetime.fromisoformat(b["start"].replace("Z", "+00:00")),
             datetime.fromisoformat(b["end"].replace("Z", "+00:00"))) for b in busy]


def create_event(
    *, title: str, start: datetime, duration_minutes: int = 30,
    description: str | None = None, attendees: list[str] | None = None,
) -> BookingResult:
    svc = _service()
    start = _ensure_tz(start)
    end = start + timedelta(minutes=duration_minutes)

    if not svc:
        log.info("gcal_dry_run", title=title)
        return BookingResult(ok=True, event_id=f"dryrun-{int(start.timestamp())}", dry_run=True)

    # Conflict check — don't double-book.
    if freebusy(start, end):
        return BookingResult(ok=False, error="slot already booked")

    body = {
        "summary": title,
        "description": description or "",
        "start": {"dateTime": start.isoformat()},
        "end":   {"dateTime": end.isoformat()},
    }
    if attendees:
        body["attendees"] = [{"email": e} for e in attendees]

    try:
        ev = svc.events().insert(calendarId=settings.google_calendar_id, body=body).execute()
        return BookingResult(ok=True, event_id=ev["id"], html_link=ev.get("htmlLink"))
    except Exception as e:
        log.exception("gcal_create_failed", error=str(e))
        return BookingResult(ok=False, error=str(e))
