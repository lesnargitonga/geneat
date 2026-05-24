from __future__ import annotations

import json

from scripts.generate_lily_pond_training import (
    ALLOWED_TOOL_NAMES,
    build_dataset,
    validate_example,
    write_jsonl,
)


def test_lily_training_generator_writes_valid_jsonl(tmp_path) -> None:
    dataset = build_dataset(examples=16, seed=123, include_tools=True)
    output = tmp_path / "lily_pond_training_v1.jsonl"

    write_jsonl(output, dataset)

    lines = output.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 16
    parsed = [json.loads(line) for line in lines]
    for entry in parsed:
        validate_example(entry)
        assert entry["messages"][0]["role"] == "system"
        assert entry["tools"]
        assert entry["parallel_tool_calls"] is False


def test_lily_training_generator_uses_real_tool_names_and_safe_payment_copy() -> None:
    dataset = build_dataset(examples=30, seed=456, include_tools=True)

    seen_tool_names: set[str] = set()
    final_copy = "\n".join(
        message.get("content") or ""
        for entry in dataset
        for message in entry["messages"]
        if message.get("role") == "assistant"
    ).lower()

    for entry in dataset:
        for message in entry["messages"]:
            for tool_call in message.get("tool_calls") or []:
                seen_tool_names.add(tool_call["function"]["name"])

    assert seen_tool_names <= ALLOWED_TOOL_NAMES
    assert "cancel_pending_order" not in seen_tool_names
    assert "enter your pin" in final_copy
    assert "once payment lands" in final_copy
    assert "pickup ready" not in final_copy
    assert "ready by" not in final_copy


def test_lily_training_generator_is_reproducible_except_generated_ids() -> None:
    first = build_dataset(examples=10, seed=999, include_tools=False)
    second = build_dataset(examples=10, seed=999, include_tools=False)

    first_user_turns = [entry["messages"][1]["content"] for entry in first]
    second_user_turns = [entry["messages"][1]["content"] for entry in second]
    assert first_user_turns == second_user_turns
