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
