from __future__ import annotations

from app.services.fulfillment_status import ALL_FULFILLMENT_STATUSES, normalize_fulfillment_status
from app.services.ops_automation import _ALLOWED_TRANSITIONS


def test_allowed_transition_statuses_are_canonical() -> None:
    """
    CONTRACT: all transition states must come from canonical fulfillment set.
    """
    for target, allowed_from in _ALLOWED_TRANSITIONS.items():
        assert target in ALL_FULFILLMENT_STATUSES, f"unknown target status: {target}"
        unknown = sorted(set(allowed_from) - ALL_FULFILLMENT_STATUSES)
        assert not unknown, f"unknown source status(es) for {target}: {unknown}"


def test_normalize_fulfillment_status_falls_back_for_unknown_values() -> None:
    assert normalize_fulfillment_status("quality_check") == "quality_check"
    assert normalize_fulfillment_status(" QUALITY_CHECK ") == "quality_check"
    assert normalize_fulfillment_status("legacy_preparing") == "pending_payment"
    assert normalize_fulfillment_status(None) == "pending_payment"
