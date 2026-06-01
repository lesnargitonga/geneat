from app.services.menu_photos import find_photo


def test_custom_menu_photos_override_demo_fallback() -> None:
    matched, url = find_photo(
        "lily-pond-cafe",
        "show me the flat white",
        {"flat white": "https://cdn.example.com/lily-pond/flat-white.jpg"},
    )
    assert matched == "flat white"
    assert url == "https://cdn.example.com/lily-pond/flat-white.jpg"


def test_fallback_menu_photos_still_work_without_custom_map() -> None:
    matched, url = find_photo("lily-pond-cafe", "demo espresso")
    assert matched == "demo espresso"
    assert url is not None


def test_photo_lookup_ignores_filler_words_for_hazina_collections() -> None:
    photos = {
        "the kenya edit": "https://hazina.example/kenya.png",
        "the safari romance box": "https://hazina.example/romance.png",
        "menu": "https://hazina.example/menu.png",
    }
    matched, url = find_photo("hazina-nomads", "Send me a picture of The Kenya Edit", photos)
    assert matched == "the kenya edit"
    assert url == "https://hazina.example/kenya.png"


def test_photo_lookup_does_not_substitute_unrelated_product() -> None:
    photos = {
        "the kenya edit": "https://hazina.example/kenya.png",
        "the safari romance box": "https://hazina.example/romance.png",
        "menu": "https://hazina.example/menu.png",
    }
    matched, url = find_photo("hazina-nomads", "Send me a picture of the necklace", photos)
    assert matched is None
    assert url is None


def test_generic_photo_lookup_can_use_menu_image() -> None:
    photos = {"menu": "https://hazina.example/menu.png"}
    matched, url = find_photo("hazina-nomads", "show me your collections", photos)
    assert matched == "menu"
    assert url == "https://hazina.example/menu.png"
