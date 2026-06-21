"""Deterministic gift recommender — must answer common gift asks without an LLM."""
from app.catalog.hazina_catalog import hazina_catalog_search_payload
from app.services import hazina_recommender as rec


def test_intent_detection() -> None:
    assert rec.looks_like_recommendation("what coffee gift do you recommend?")
    assert rec.looks_like_recommendation("suggest something for my mum")
    assert rec.looks_like_recommendation("I'm looking for a gift for a client")
    assert not rec.looks_like_recommendation("cancel my order")
    assert not rec.looks_like_recommendation("what time do you deliver to JKIA?")


def test_category_and_budget_parsing() -> None:
    assert "coffee-tea" in rec.detect_categories("a nice coffee or tea set")
    assert "beadwork" in rec.detect_categories("a beaded maasai necklace")
    assert "leather" in rec.detect_categories("a leather passport wallet")
    assert rec.parse_budget("under $80") == (80.0, "USD")
    assert rec.parse_budget("budget of 5,000 ksh") == (5000.0, "KES")
    assert rec.parse_budget("a thoughtful gift") == (None, None)


def test_recommend_coffee_under_budget_returns_real_products() -> None:
    payload = hazina_catalog_search_payload()
    out = rec.recommend(payload, "what Kenyan coffee gift do you recommend under $80?")
    assert out is not None
    text = out["reply"].lower()
    assert "cafe" not in text  # never the old deflection
    # Should surface real catalog items (coffee/tea treasures are < $80)
    assert out["treasure_ids"] or out["collection_ids"]
    assert "usd" in text


def test_recommend_generous_budget_prefers_a_collection() -> None:
    payload = hazina_catalog_search_payload()
    out = rec.recommend(payload, "recommend a premium coffee gift around $300")
    assert out is not None
    assert out["collection_ids"], "a curated collection should be offered at this budget"


def test_specific_item_request_finds_real_product() -> None:
    payload = hazina_catalog_search_payload()
    # "i want a rungu" must surface the actual rungu product, not a fallback.
    out = rec.recommend(payload, "i want a rungu")
    assert out is not None
    assert "rungu-clubs" in out["treasure_ids"]
    assert "rungu" in out["reply"].lower()
    # "do you have ..." is also a product request.
    assert rec.looks_like_recommendation("do you have a kikoi?")
    assert "coastal-kikoi" in (rec.recommend(payload, "do you have a kikoi?") or {}).get("treasure_ids", [])


def test_conversational_turns_do_not_hijack_to_recommender() -> None:
    # Bare "my dad" should stay with the LLM, not trigger a deterministic pick.
    assert rec.looks_like_recommendation("my dad") is False
    assert rec.recommend(hazina_catalog_search_payload(), "my dad") is None


def test_occasion_requests_offer_collections() -> None:
    payload = hazina_catalog_search_payload()
    for q in ("do you have anything for a wedding", "a birthday gift for my dad",
              "something for an anniversary"):
        out = rec.recommend(payload, q)
        assert out is not None, q
        assert out["collection_ids"], q  # offer curated collections, never a dead end


def test_swahili_and_local_terms_match() -> None:
    payload = hazina_catalog_search_payload()
    # "mkeka" (mat) must resolve to the real African Woven Mat, not "Matte box".
    out = rec.recommend(payload, "i need a mkeka")
    assert out is not None and "african-woven-mat" in out["treasure_ids"]
    assert "matte" not in out["reply"].lower()
    # Swahili intent verbs ("nataka" = I want) trigger the recommender.
    assert rec.looks_like_recommendation("nataka kahawa")
    assert "coffee" in rec.recommend(payload, "nataka kahawa")["reply"].lower()
    assert "rungu-clubs" in (rec.recommend(payload, "nataka rungu") or {}).get("treasure_ids", [])


def test_no_recommendation_when_no_intent() -> None:
    payload = hazina_catalog_search_payload()
    assert rec.recommend(payload, "I want to pay with mpesa") is None
