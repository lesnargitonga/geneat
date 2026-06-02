from __future__ import annotations

from app.services.whatsapp_menus import (
    CMD_HAZINA_BRIEF,
    CMD_HAZINA_COLLECTIONS,
    ID_HAZINA_BRIEF,
    ID_HAZINA_COLLECTIONS,
    command_for_interactive_id,
    main_menu_payload,
    product_list_payload,
)


def test_hazina_main_menu_sections() -> None:
    payload = main_menu_payload(
        business_name="Hazina Nomads",
        language="en",
        business_slug="hazina-nomads",
    )
    assert payload["type"] == "list"
    assert payload["button_text"] == "Concierge Services"
    assert len(payload["sections"]) == 3
    row_ids = {
        row["id"]
        for section in payload["sections"]
        for row in section["rows"]
    }
    assert ID_HAZINA_COLLECTIONS in row_ids
    assert ID_HAZINA_BRIEF in row_ids


def test_hazina_interactive_id_routing() -> None:
    assert command_for_interactive_id(ID_HAZINA_COLLECTIONS) == CMD_HAZINA_COLLECTIONS
    assert command_for_interactive_id(ID_HAZINA_BRIEF) == CMD_HAZINA_BRIEF


def test_hazina_product_list_from_catalog() -> None:
    payload = product_list_payload(language="en")
    rows = payload["sections"][0]["rows"]
    product_rows = [r for r in rows if r["id"].startswith("lp:prod:")]
    assert len(product_rows) >= 5
    assert any("USD" in (r.get("description") or "") for r in product_rows)
