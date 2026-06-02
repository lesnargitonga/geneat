"""Canonical fulfillment-state contract for Hazina order operations."""
from __future__ import annotations

from typing import Final

PENDING_PAYMENT: Final[str] = "pending_payment"
BRIEF_RECEIVED: Final[str] = "brief_received"
AWAITING_CONFIRMATION: Final[str] = "awaiting_confirmation"
SOURCING_APPROVED: Final[str] = "sourcing_approved"
RUNNER_ASSIGNED: Final[str] = "runner_assigned"
SOURCING_IN_PROGRESS: Final[str] = "sourcing_in_progress"
QUALITY_CHECK: Final[str] = "quality_check"
PACKING: Final[str] = "packing"
READY_FOR_DISPATCH: Final[str] = "ready_for_dispatch"
OUT_FOR_DELIVERY: Final[str] = "out_for_delivery"
DELIVERED: Final[str] = "delivered"
ISSUE_PENDING: Final[str] = "issue_pending"
CANCELLED: Final[str] = "cancelled"

ALL_FULFILLMENT_STATUSES: Final[set[str]] = {
    PENDING_PAYMENT,
    BRIEF_RECEIVED,
    AWAITING_CONFIRMATION,
    SOURCING_APPROVED,
    RUNNER_ASSIGNED,
    SOURCING_IN_PROGRESS,
    QUALITY_CHECK,
    PACKING,
    READY_FOR_DISPATCH,
    OUT_FOR_DELIVERY,
    DELIVERED,
    ISSUE_PENDING,
    CANCELLED,
}


def normalize_fulfillment_status(value: object, *, default: str = PENDING_PAYMENT) -> str:
    raw = str(value or "").strip().lower()
    if raw in ALL_FULFILLMENT_STATUSES:
        return raw
    return default
