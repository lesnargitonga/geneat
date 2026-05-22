"""Public image URLs for menu items per business.

Used by the `send_menu_photo` agent tool so the AI can deliver real
pictures over WhatsApp instead of replying "I don't have pictures".

Keys are lower-cased, punctuation-stripped item names. The lookup is
fuzzy: any item name that contains a key substring matches. Keep the
keys short and distinctive.

Mirror this file with `gen-eat-portal/lib/cafes.ts` menu images.
"""
from __future__ import annotations

from collections.abc import Mapping
import re

# slug -> { item_keyword: public_image_url }
MENU_PHOTOS: dict[str, dict[str, str]] = {
    "lily-pond-cafe": {
        "demo espresso":    "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1080&auto=format&fit=crop&q=80",
        "demo order":       "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1080&auto=format&fit=crop&q=80",
        "10 bob":           "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1080&auto=format&fit=crop&q=80",
        "espresso":         "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1080&auto=format&fit=crop&q=80",
        "double espresso":  "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1080&auto=format&fit=crop&q=80",
        "macchiato":        "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=1080&auto=format&fit=crop&q=80",
        "cortado":          "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=1080&auto=format&fit=crop&q=80",
        "flat white":       "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=1080&auto=format&fit=crop&q=80",
        "cappuccino":       "https://images.unsplash.com/photo-1572286258217-215cf8e7ea5a?w=1080&auto=format&fit=crop&q=80",
        "latte":            "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=1080&auto=format&fit=crop&q=80",
        "cold brew":        "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=1080&auto=format&fit=crop&q=80",
        "pour-over":        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1080&auto=format&fit=crop&q=80",
        "mocha":            "https://images.unsplash.com/photo-1542990253-0b8be3a9e6f7?w=1080&auto=format&fit=crop&q=80",
        "avocado toast":    "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=1080&auto=format&fit=crop&q=80",
        "mandazi":          "https://images.unsplash.com/photo-1571069090147-fc0e84f9d8d2?w=1080&auto=format&fit=crop&q=80",
        "masala chai":      "https://images.unsplash.com/photo-1571069090147-fc0e84f9d8d2?w=1080&auto=format&fit=crop&q=80",
        "big pond plate":   "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1080&auto=format&fit=crop&q=80",
        "granola":          "https://images.unsplash.com/photo-1517022812141-23620dba5c23?w=1080&auto=format&fit=crop&q=80",
        "pancake":          "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1080&auto=format&fit=crop&q=80",
        "caesar":           "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1080&auto=format&fit=crop&q=80",
        "halloumi":         "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080&auto=format&fit=crop&q=80",
        "sukuma":           "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1080&auto=format&fit=crop&q=80",
        "sweet potato":     "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=1080&auto=format&fit=crop&q=80",
        "croissant":        "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1080&auto=format&fit=crop&q=80",
        "pain au chocolat": "https://images.unsplash.com/photo-1623334044303-241021148842?w=1080&auto=format&fit=crop&q=80",
        "almond":           "https://images.unsplash.com/photo-1581375321224-79da6fd32f6e?w=1080&auto=format&fit=crop&q=80",
        "lemon tart":       "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=1080&auto=format&fit=crop&q=80",
        # Hero / generic / cafe vibe
        "menu":             "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=1200&auto=format&fit=crop&q=80",
        "cafe":             "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=1200&auto=format&fit=crop&q=80",
        "coffee":           "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=1080&auto=format&fit=crop&q=80",
        "breakfast":        "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1080&auto=format&fit=crop&q=80",
        "pastry":           "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1080&auto=format&fit=crop&q=80",
    },
    "library-bites": {
        "sandwich":     "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=1080&auto=format&fit=crop&q=80",
        "wrap":         "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1080&auto=format&fit=crop&q=80",
        "samosa":       "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1080&auto=format&fit=crop&q=80",
        "brain fuel":   "https://images.unsplash.com/photo-1565299543923-37dd37887442?w=1080&auto=format&fit=crop&q=80",
        "latte":        "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=1080&auto=format&fit=crop&q=80",
        "coffee":       "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1080&auto=format&fit=crop&q=80",
        "energy drink": "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=1080&auto=format&fit=crop&q=80",
        "menu":         "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=1200&auto=format&fit=crop&q=80",
    },
    "pavilion-grill": {
        "burger":       "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1080&auto=format&fit=crop&q=80",
        "smash":        "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1080&auto=format&fit=crop&q=80",
        "nyama choma":  "https://images.unsplash.com/photo-1544025162-d76694265947?w=1080&auto=format&fit=crop&q=80",
        "tikka":        "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=1080&auto=format&fit=crop&q=80",
        "tilapia":      "https://images.unsplash.com/photo-1535399831218-d4db1f8b4c75?w=1080&auto=format&fit=crop&q=80",
        "ribs":         "https://images.unsplash.com/photo-1544025162-d76694265947?w=1080&auto=format&fit=crop&q=80",
        "fries":        "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=1080&auto=format&fit=crop&q=80",
        "shake":        "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=1080&auto=format&fit=crop&q=80",
        "menu":         "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80",
    },
    "block-a-express": {
        "espresso":     "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1080&auto=format&fit=crop&q=80",
        "cappuccino":   "https://images.unsplash.com/photo-1572286258217-215cf8e7ea5a?w=1080&auto=format&fit=crop&q=80",
        "americano":    "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1080&auto=format&fit=crop&q=80",
        "chai":         "https://images.unsplash.com/photo-1571069090147-fc0e84f9d8d2?w=1080&auto=format&fit=crop&q=80",
        "croissant":    "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1080&auto=format&fit=crop&q=80",
        "cinnamon":     "https://images.unsplash.com/photo-1559620192-032c4bc4674e?w=1080&auto=format&fit=crop&q=80",
        "pain au chocolat": "https://images.unsplash.com/photo-1623334044303-241021148842?w=1080&auto=format&fit=crop&q=80",
        "brownie":      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=1080&auto=format&fit=crop&q=80",
        "menu":         "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=1200&auto=format&fit=crop&q=80",
    },
}


_NORMALIZE_RE = re.compile(r"[^a-z0-9 ]+")


def _normalize(s: str) -> str:
    return _NORMALIZE_RE.sub(" ", (s or "").lower()).strip()


def _normalize_photo_map(raw: Mapping[str, str] | None) -> dict[str, str]:
    if not raw:
        return {}
    normalized: dict[str, str] = {}
    for key, value in raw.items():
        norm_key = _normalize(str(key))
        url = str(value or "").strip()
        if not norm_key or not url:
            continue
        normalized[norm_key] = url
    return normalized


def _lookup_photo(table: Mapping[str, str] | None, item_query: str) -> tuple[str | None, str | None]:
    if not table:
        return None, None
    q = _normalize(item_query)
    if not q:
        return ("menu", table.get("menu")) if "menu" in table else (None, None)

    # Exact key, then word-overlap, then fall back to 'menu' hero.
    if q in table:
        return q, table[q]
    # Token overlap — prefer longer key matches first.
    tokens = set(q.split())
    candidates = sorted(table.keys(), key=len, reverse=True)
    for key in candidates:
        key_tokens = set(key.split())
        if key in q or key_tokens & tokens:
            return key, table[key]
    if "menu" in table:
        return "menu", table["menu"]
    # Any image is better than none.
    first_key = next(iter(table))
    return first_key, table[first_key]


def find_photo(
    business_slug: str,
    item_query: str,
    custom_photos: Mapping[str, str] | None = None,
) -> tuple[str | None, str | None]:
    """Resolve a public image URL for the given item query within this business.

    Resolution order:
      1. Tenant-owned photos stored in `Business.profile["menu_photos"]`
      2. Static demo fallback images in `MENU_PHOTOS`

    Returns (matched_keyword, image_url). Falls back to the business `menu`
    hero image if no item keyword matched. Returns (None, None) if nothing
    is registered for the business.
    """
    custom = _normalize_photo_map(custom_photos)
    matched, url = _lookup_photo(custom, item_query)
    if url:
        return matched, url
    return _lookup_photo(MENU_PHOTOS.get(business_slug), item_query)
