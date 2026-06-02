from __future__ import annotations

import re
from pathlib import Path

from app.catalog.hazina_catalog import HAZINA_COLLECTIONS, HAZINA_TREASURES


def _extract_gift_box_object_blocks(ts_text: str) -> list[str]:
    marker = "export const GIFT_BOXES: GiftBox[] = ["
    start = ts_text.find(marker)
    if start < 0:
        raise AssertionError("GIFT_BOXES export not found in hazina-portal/lib/products.ts")
    body_start = ts_text.find("[", start)
    body_end = ts_text.find("];", body_start)
    if body_start < 0 or body_end < 0:
        raise AssertionError("GIFT_BOXES array boundaries not found")
    body = ts_text[body_start + 1 : body_end]

    blocks: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in body:
        if ch == "{":
            depth += 1
        if depth > 0:
            current.append(ch)
        if ch == "}":
            depth -= 1
            if depth == 0 and current:
                blocks.append("".join(current))
                current = []
    return blocks


def _extract_field(block: str, key: str) -> str:
    m = re.search(rf"{re.escape(key)}\s*:\s*\"([^\"]+)\"", block)
    if not m:
        raise AssertionError(f"missing string field '{key}' in TS gift box block")
    return m.group(1).strip()


def _extract_int_field(block: str, key: str) -> int:
    m = re.search(rf"{re.escape(key)}\s*:\s*(\d+)", block)
    if not m:
        raise AssertionError(f"missing int field '{key}' in TS gift box block")
    return int(m.group(1))


def _portal_gift_boxes_by_sku() -> dict[str, dict]:
    ts_path = Path("hazina-portal/lib/products.ts")
    text = ts_path.read_text(encoding="utf-8")
    out: dict[str, dict] = {}
    for block in _extract_gift_box_object_blocks(text):
        sku = _extract_field(block, "sku")
        out[sku] = {
            "id": _extract_field(block, "id"),
            "name": _extract_field(block, "name"),
            "price_usd": _extract_int_field(block, "price_usd"),
            "price_kes": _extract_int_field(block, "price_kes"),
            "lead_time_hours": _extract_int_field(block, "lead_time_hours"),
        }
    return out


def _backend_collections_by_sku() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for row in HAZINA_COLLECTIONS:
        out[str(row["sku"])] = {
            "id": str(row["id"]),
            "name": str(row["name"]),
            "price_usd": int(row["price_usd"]),
            "price_kes": int(row["price_kes"]),
            "lead_time_hours": int(row["lead_time_hours"]),
        }
    return out


def test_hazina_collection_catalog_contract() -> None:
    """
    CONTRACT: backend HAZINA_COLLECTIONS and portal GIFT_BOXES must match.
    """
    backend = _backend_collections_by_sku()
    portal = _portal_gift_boxes_by_sku()

    assert set(backend) == set(portal), "SKU set mismatch between backend and portal collections"
    for sku, b in backend.items():
        p = portal[sku]
        assert p["id"] == b["id"], f"id mismatch for {sku}"
        assert p["name"] == b["name"], f"name mismatch for {sku}"
        assert p["price_usd"] == b["price_usd"], f"USD price mismatch for {sku}"
        assert p["price_kes"] == b["price_kes"], f"KES price mismatch for {sku}"
        assert p["lead_time_hours"] == b["lead_time_hours"], f"lead time mismatch for {sku}"


def test_catalog_rows_include_operational_contract_fields() -> None:
    """
    CONTRACT: Hazina catalog rows expose required operational fields.
    """
    required = {
        "id",
        "sku",
        "name",
        "category",
        "price_usd",
        "price_kes",
        "lead_time_hours",
        "is_engravable",
        "is_jkia_allowed",
        "is_custom_allowed",
        "availability_mode",
        "substitution_allowed",
        "image_disclaimer",
        "source_type",
        "included_item_ids",
    }
    for row in [*HAZINA_COLLECTIONS, *HAZINA_TREASURES]:
        missing = sorted(required - set(row.keys()))
        assert not missing, f"{row.get('sku', row.get('id'))} missing fields: {missing}"
