from __future__ import annotations

from app.services.business_service import looks_like_hazina_tenant_hint


def test_hazina_tenant_hint_detects_site_and_sku_messages() -> None:
    assert looks_like_hazina_tenant_hint(
        "Hello Hazina Nomads — I'd like to build a custom gift box"
    )
    assert looks_like_hazina_tenant_hint("Add Premium Kenyan Coffee (HN-T-001)")
    assert looks_like_hazina_tenant_hint("I need JKIA gift delivery before my flight")


def test_hazina_tenant_hint_avoids_generic_cafe_language() -> None:
    assert not looks_like_hazina_tenant_hint("Do you sell espresso?")
    assert not looks_like_hazina_tenant_hint("Can I get a croissant and chai?")
