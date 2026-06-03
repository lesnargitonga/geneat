from __future__ import annotations

import json

from scripts.hazina_generate_finetune_dataset import generate_dataset


def _assistant_text(rows: list[dict]) -> str:
    return "\n".join(
        str(message.get("content") or "")
        for row in rows
        for message in row.get("messages") or []
        if message.get("role") == "assistant"
    )


def test_hazina_training_generator_includes_visual_sourcing_case() -> None:
    rows = generate_dataset(target_count=120, seed=7, golden_multiplier=1)
    blob = json.dumps(rows, ensure_ascii=False)
    replies = _assistant_text(rows).lower()

    assert "silver filigree earrings" in blob
    assert "reference photo" in blob or "reference image" in blob
    assert "custom visual sourcing brief" in replies
    assert "cannot promise stock" in replies
    assert "tomorrow delivery yet" in replies
    assert "alfajiri villas" in blob.lower()
    assert "ukunda airstrip" in blob.lower()
    assert "mkeka chest" in blob.lower()
    assert "cannot promise the exact piece" in replies
