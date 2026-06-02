from __future__ import annotations

import inspect
import pytest

from app.channels import base as channel_base
from app.services import gift_automation as ga


def test_ai_timeout_enclosure_contract() -> None:
    """
    CONTRACT: open-ended AI turn execution is enclosed by asyncio.wait_for.
    """
    source = inspect.getsource(channel_base.handle_inbound)
    assert "asyncio.wait_for" in source


def test_ai_input_budgeting_contract() -> None:
    """
    CONTRACT: long user input is bounded before AI/RAG execution.
    """
    long_text = "word " * 1500
    bounded = channel_base._bounded_ai_input(long_text, max_chars=2000)
    assert len(bounded) <= 2004  # includes optional " ..."
    assert bounded.endswith(" ...")


def test_checkout_state_sanity_prerequisites_before_confirm() -> None:
    """
    CONTRACT: checkout state must satisfy prerequisites before confirmation.
    """
    checkout = {"product_id": "kenya-edit"}
    # Missing name means we cannot proceed to confirmation/finalization.
    assert ga._checkout_next_step(checkout) == "name"
    checkout["customer_name"] = "Lesnar"
    assert ga._checkout_next_step(checkout) == "delivery_type"
    checkout["delivery_type"] = "Hotel delivery"
    assert ga._checkout_next_step(checkout) == "location"

