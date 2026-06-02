"""Portal action chips mirror WhatsApp interactive menus."""
from app.services.hazina_portal_actions import (
    portal_actions_from_interactive,
    portal_send_text,
)
from app.services.whatsapp_menus import CMD_HAZINA_COLLECTIONS, ID_HAZINA_COLLECTIONS


def test_portal_send_text_formats_like_whatsapp_tap():
    assert portal_send_text("Signature Collections", ID_HAZINA_COLLECTIONS) == (
        f"Signature Collections [{ID_HAZINA_COLLECTIONS}]"
    )


def test_portal_actions_from_list_rows():
    interactive = {
        "type": "list",
        "sections": [
            {
                "title": "Ready-made",
                "rows": [
                    {
                        "id": ID_HAZINA_COLLECTIONS,
                        "title": "Signature Collections",
                        "description": "Premium gift boxes",
                    },
                ],
            },
        ],
    }
    actions = portal_actions_from_interactive(interactive)
    assert len(actions) == 1
    assert actions[0]["label"].startswith("Signature Collections")
    assert ID_HAZINA_COLLECTIONS in actions[0]["value"]
    assert actions[0]["interactive_id"] == ID_HAZINA_COLLECTIONS


def test_portal_actions_from_buttons():
    interactive = {
        "type": "buttons",
        "buttons": [
            {"id": "lp:hazina:brief", "title": "Start brief"},
            {"id": "lp:home", "title": "Main menu"},
        ],
    }
    actions = portal_actions_from_interactive(interactive)
    assert len(actions) == 2
    assert actions[0]["primary"] is True
    assert "Start brief" in actions[0]["value"]


def test_mock_main_menu_command_maps_to_collections_chip_value():
    """Chip values must carry [lp:...] so handle_inbound routes like WhatsApp."""
    from app.services.whatsapp_menus import command_for_interactive_id

    assert command_for_interactive_id(ID_HAZINA_COLLECTIONS) == CMD_HAZINA_COLLECTIONS
