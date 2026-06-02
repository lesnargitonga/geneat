"""Industry-specific playbooks.

A playbook is the *vertical-specific* slice of the system prompt: the
tool-firing rules, the required-fields catalogue, and the voice notes that
only make sense for one kind of business. It is layered ON TOP of the
shared LANGUAGE / VOICE / SMALLTALK / GROUNDING / SAFETY rules.

Why split this out?
  - A hospitality concierge should fire `create_order` + `request_mpesa_payment`
    aggressively when the guest names a suite + date + asks for STK push.
  - A salon agent should fire `book_appointment` (no payment), never push
    deposits, and treat "treatment" not as "room".
  - A restaurant agent should distinguish "reservation" from "order ahead".
  - A retail agent should ALWAYS check stock before creating an order.

Mixing these rules in one global prompt blurs the lines and the model
confuses verticals (e.g. offering hair services to someone asking about
a penthouse). Per-vertical playbooks fix this.
"""
from __future__ import annotations

from .general import GENERAL_PLAYBOOK
from .gift_concierge import GIFT_CONCIERGE_PLAYBOOK
from .hospitality import HOSPITALITY_PLAYBOOK
from .restaurant import RESTAURANT_PLAYBOOK
from .retail import RETAIL_PLAYBOOK
from .salon import SALON_PLAYBOOK


_PLAYBOOKS: dict[str, str] = {
    "hospitality": HOSPITALITY_PLAYBOOK,
    "restaurant":  RESTAURANT_PLAYBOOK,
    "retail":      RETAIL_PLAYBOOK,
    "salon":       SALON_PLAYBOOK,
    "gift-concierge": GIFT_CONCIERGE_PLAYBOOK,
    "gift_concierge": GIFT_CONCIERGE_PLAYBOOK,
    "general":     GENERAL_PLAYBOOK,
}


def get_playbook(vertical: str | None) -> str:
    """Return the playbook block for the given vertical, falling back to
    the general playbook for unknown / missing verticals."""
    if not vertical:
        return GENERAL_PLAYBOOK
    return _PLAYBOOKS.get(vertical.strip().lower(), GENERAL_PLAYBOOK)


__all__ = ["get_playbook"]
