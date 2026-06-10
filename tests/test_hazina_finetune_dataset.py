"""Hazina fine-tune dataset generator smoke tests."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys

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
    assert "Hazina Private Concierge" in joined or "Certainly" in joined
    assert "Highland Treasure" in joined or "Kenya Edit" in joined
    assert "café" in joined.lower() or "cafe" in joined.lower() or "coffee" in joined.lower()
    assert "bespoke" in joined.lower()
    assert "order_creation_ready" in joined
    assert "hazina-private-concierge-v1.0" in joined


def test_hazina_dataset_cli_prints_sample(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            "scripts/hazina_generate_finetune_dataset.py",
            "--target-count",
            "20",
            "--out",
            str(tmp_path),
            "--sample",
            "1",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert (tmp_path / "train.jsonl").is_file()
    assert (tmp_path / "val.jsonl").is_file()
    assert (tmp_path / "dataset_meta.json").is_file()
    assert "--- sample 1 ---" in result.stdout
    assert "messages" in result.stdout
