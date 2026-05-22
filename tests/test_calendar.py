"""Phase 6 — calendar dry-run booking (no creds = stubbed event id)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.integrations import calendar_client


def test_create_event_dry_run(monkeypatch):
    # No service-account file, no refresh token → dry run path.
    monkeypatch.delenv("GOOGLE_SERVICE_ACCOUNT_JSON", raising=False)
    monkeypatch.delenv("GOOGLE_REFRESH_TOKEN", raising=False)
    calendar_client._service.cache_clear()  # type: ignore[attr-defined]

    start = datetime.now(timezone.utc) + timedelta(days=1)
    res = calendar_client.create_event(title="Trim", start=start, duration_minutes=30)
    assert res.ok is True
    assert res.dry_run is True
    assert res.event_id and res.event_id.startswith("dryrun-")
