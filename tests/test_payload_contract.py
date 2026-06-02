from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.whatsapp import normalize_msisdn
from app.schemas.webhooks import MetaWebhookPayload


def test_meta_webhook_schema_rejection() -> None:
    """
    CONTRACT: malformed nested webhook shapes fail with ValidationError,
    not runtime KeyError/TypeError from raw dict drilling.
    """
    malformed_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                # Missing required changes array
                "id": "123456789",
            }
        ],
    }
    with pytest.raises(ValidationError) as exc_info:
        MetaWebhookPayload(**malformed_payload)
    assert "changes" in str(exc_info.value)


def test_defensive_payload_drilling() -> None:
    """
    CONTRACT: None in deeply nested webhook arrays is tolerated safely.
    """
    tricky_payload = {
        "object": "whatsapp_business_account",
        "entry": [{"id": "1", "changes": [{"value": {"messages": None}}]}],
    }
    # Should validate, then safely default to empty messages list.
    payload = MetaWebhookPayload.model_validate(tricky_payload).model_dump()
    entries = payload.get("entry", []) or []
    changes = entries[0].get("changes", []) if entries else []
    value = changes[0].get("value", {}) if changes else {}
    messages = value.get("messages") or []
    assert messages == []


@pytest.mark.parametrize(
    "raw_input,expected_normalized",
    [
        ("0700000000", "+254700000000"),
        ("254700000000", "+254700000000"),
        ("+254700000000", "+254700000000"),
        (" +254 700 000 000 ", "+254700000000"),
    ],
)
def test_msisdn_ingress_normalization(raw_input: str, expected_normalized: str) -> None:
    """
    CONTRACT: identities are normalized at ingress before cache/db/tool routing.
    """
    assert normalize_msisdn(raw_input) == expected_normalized

