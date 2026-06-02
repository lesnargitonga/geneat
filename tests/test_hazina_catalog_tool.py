from __future__ import annotations

import pytest

from app.ai.tools import build_tools
from app.catalog.hazina_catalog import HAZINA_COLLECTIONS, HAZINA_TREASURES, hazina_catalog_search_payload


def test_catalog_search_payload_matches_source() -> None:
    payload = hazina_catalog_search_payload()
    assert payload["read_only"] is True
    assert len(payload["collections"]) == len(HAZINA_COLLECTIONS)
    assert len(payload["treasures"]) == len(HAZINA_TREASURES)
    assert payload["source"] == "HAZINA_COLLECTIONS+HAZINA_TREASURES"


@pytest.mark.asyncio
async def test_search_catalog_tool_hazina_only(db) -> None:
    tools = {t.name: t for t in build_tools(db, None, None, business_slug="hazina-nomads")}
    assert "search_catalog" in tools
    result = await tools["search_catalog"].ainvoke({"query": "kenya"})
    assert result["ok"] is True
    assert result["catalog"]["collections"]


@pytest.mark.asyncio
async def test_search_catalog_tool_other_tenant(db) -> None:
    tools = {t.name: t for t in build_tools(db, None, None, business_slug="lily-pond-cafe")}
    assert "search_catalog" not in tools
