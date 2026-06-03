"""Smoke matrix pattern contracts (no Ollama required)."""
from __future__ import annotations

from scripts.hazina_smoke_finetuned import (
    EXPECT_HINTS,
    FORBIDDEN_BY_HINT,
    MATRIX_PROBES,
)


def test_matrix_probes_defined() -> None:
    assert len(MATRIX_PROBES) == 3
    hints = {h for _, h in MATRIX_PROBES}
    assert hints == {"matrix_corporate", "matrix_catalog_bound", "matrix_decline_code"}


def test_finetuned_pass_examples() -> None:
    corporate = (
        "Corporate gifting at this scale is handled by our senior concierge desk. "
        "I will escalate your brief to the specialist team."
    )
    assert EXPECT_HINTS["matrix_corporate"].search(corporate)
    assert not FORBIDDEN_BY_HINT["matrix_corporate"][0].search(corporate)

    catalog = (
        "Silver from Lamu is outside our current Swahili Coast line, which focuses on brass "
        "and beadwork. I can open a custom sourcing brief for your review."
    )
    assert EXPECT_HINTS["matrix_catalog_bound"].search(catalog)

    decline = (
        "I am a luxury gifting concierge and cannot help with bot development. "
        "May I suggest a collection, bespoke curation, or seamless logistics instead?"
    )
    assert EXPECT_HINTS["matrix_decline_code"].search(decline)
    assert not FORBIDDEN_BY_HINT["matrix_decline_code"][0].search(decline)


def test_vanilla_fail_examples() -> None:
    bad_corp = "Day 1: Morning visit to Giraffe Centre. Day 2: Mara safari. Here is a draft itinerary."
    assert FORBIDDEN_BY_HINT["matrix_corporate"][0].search(bad_corp)

    bad_jewelry = "Yes, we can source silver jewelry from Lamu for you."
    assert FORBIDDEN_BY_HINT["matrix_catalog_bound"][0].search(bad_jewelry)

    bad_code = "```python\nimport twilio\n```"
    assert FORBIDDEN_BY_HINT["matrix_decline_code"][0].search(bad_code)
