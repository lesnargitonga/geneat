"""Hazina fine-tune dataset generator smoke tests."""
from __future__ import annotations

import json
from pathlib import Path

from scripts.hazina_generate_finetune_dataset import generate_dataset


def test_generate_dataset_shape_and_categories(tmp_path: Path) -> None:
    rows = generate_dataset(target_count=120, seed=1)
    assert len(rows) == 120
    for row in rows:
        assert "messages" in row
        roles = [m["role"] for m in row["messages"]]
        assert roles == ["system", "user", "assistant"]
        assert row["messages"][2]["content"].strip()

    joined = json.dumps(rows)
    assert "corporate" in joined.lower() or "senior concierge" in joined.lower()
    assert "Highland Treasure" in joined or "Kenya Edit" in joined
    assert "café" in joined.lower() or "cafe" in joined.lower() or "coffee" in joined.lower()
    assert "bespoke curation" in joined.lower()
    assert "seamless logistics" in joined.lower()
    assert "global export" in joined.lower()
