"""Hazina Nomads catalog — single Python source for seed, RAG, and WhatsApp automation.

Mirrors hazina-portal/lib/treasures.ts and lib/products.ts. Update both when prices change.
"""
from __future__ import annotations

from typing import Any

PACKAGING_FEE_USD = 45
PACKAGING_FEE_KES = 5800
MIN_CUSTOM_ITEMS = 2

HAZINA_COLLECTIONS: list[dict[str, Any]] = [
    {
        "id": "kenya-edit",
        "sku": "HN-KE-001",
        "name": "The Kenya Edit",
        "price_usd": 249,
        "price_kes": 32400,
        "target": "Safari tourists, European/US visitors",
        "contents": (
            "Premium Kenyan coffee (250g), handmade Maasai beadwork "
            "(bracelet or necklace), small artisan soapstone carving, printed brand story card"
        ),
        "lead_time_hours": 24,
        "personalization": False,
        "item_ids": ["premium-coffee-250g", "maasai-bracelet", "soapstone-big-five", "premium-packaging"],
    },
    {
        "id": "highland-treasure",
        "sku": "HN-HT-002",
        "name": "The Highland Treasure",
        "price_usd": 199,
        "price_kes": 25900,
        "target": "General gifting, diaspora, colleagues",
        "contents": (
            "Export-grade Kenyan coffee, premium Kenyan loose-leaf tea, "
            "local raw honey, carved wooden tasting spoon"
        ),
        "lead_time_hours": 24,
        "personalization": False,
        "item_ids": ["premium-coffee-250g", "loose-leaf-tea", "raw-honey", "wooden-combs", "premium-packaging"],
    },
    {
        "id": "nomad-leather-set",
        "sku": "HN-NL-003",
        "name": "The Nomad Leather Set",
        "price_usd": 329,
        "price_kes": 42800,
        "target": "Business travellers, wealthy tourists",
        "contents": "Handmade leather passport holder, luggage tag, and travel notebook",
        "lead_time_hours": 24,
        "personalization": True,
        "personalization_note": "Engraving requires 24-hour notice",
        "item_ids": ["leather-passport", "leather-luggage-tag", "premium-packaging"],
    },
    {
        "id": "safari-romance-box",
        "sku": "HN-SR-004",
        "name": "The Safari Romance Box",
        "price_usd": 449,
        "price_kes": 58400,
        "target": "Honeymooners, anniversary trips",
        "contents": (
            "Matching couple's beadwork, premium treats (chocolate/coffee), "
            "framed minimalist safari route map, leather luggage tags"
        ),
        "lead_time_hours": 48,
        "personalization": True,
        "item_ids": [
            "maasai-necklace",
            "maasai-bracelet",
            "premium-coffee-250g",
            "big-five-print",
            "leather-luggage-tag",
        ],
    },
    {
        "id": "departure-drop",
        "sku": "HN-DD-005",
        "name": "The Departure Drop",
        "price_usd": 349,
        "price_kes": 45400,
        "target": "Last-minute JKIA departures",
        "contents": "Pre-packed fast-moving items: coffee, tea, un-personalized leather, beadwork",
        "lead_time_hours": 4,
        "personalization": False,
        "jkia_only": True,
        "item_ids": [
            "premium-coffee-250g",
            "loose-leaf-tea",
            "leather-passport",
            "maasai-bracelet",
            "premium-packaging",
        ],
    },
]

HAZINA_TREASURES: list[dict[str, Any]] = [
    {"id": "premium-coffee-250g", "sku": "HN-T-001", "name": "Premium Kenyan Coffee", "category": "coffee-tea", "price_usd": 35, "price_kes": 4600, "description": "250g single-origin Kenyan AA, export grade.", "lead_time_hours": 12},
    {"id": "loose-leaf-tea", "sku": "HN-T-002", "name": "Highland Loose-Leaf Tea", "category": "coffee-tea", "price_usd": 28, "price_kes": 3600, "description": "Export-grade purple and black tea blend with tasting spoon.", "lead_time_hours": 12},
    {"id": "raw-honey", "sku": "HN-T-003", "name": "Local Raw Honey", "category": "food", "price_usd": 30, "price_kes": 3900, "description": "Unfiltered acacia honey, 200g jar.", "lead_time_hours": 24},
    {"id": "maasai-bracelet", "sku": "HN-T-010", "name": "Maasai Beaded Bracelet", "category": "beadwork", "price_usd": 45, "price_kes": 5900, "description": "Hand-strung glass bead bracelet from Maasai Market.", "lead_time_hours": 12},
    {"id": "maasai-necklace", "sku": "HN-T-011", "name": "Maasai Beaded Necklace", "category": "beadwork", "price_usd": 85, "price_kes": 11000, "description": "Statement collar or layered necklace.", "lead_time_hours": 24},
    {"id": "maasai-earrings", "sku": "HN-T-012", "name": "Maasai Earrings", "category": "beadwork", "price_usd": 42, "price_kes": 5500, "description": "Lightweight beaded drop earrings.", "lead_time_hours": 12},
    {"id": "leather-passport", "sku": "HN-T-020", "name": "Leather Passport Holder", "category": "leather", "price_usd": 95, "price_kes": 12300, "description": "Full-grain leather passport sleeve. Optional embossing.", "lead_time_hours": 24, "personalization": True},
    {"id": "leather-luggage-tag", "sku": "HN-T-021", "name": "Leather Luggage Tag", "category": "leather", "price_usd": 45, "price_kes": 5900, "description": "Embossed leather tag with buckle strap.", "lead_time_hours": 24, "personalization": True},
    {"id": "soapstone-big-five", "sku": "HN-T-030", "name": "Soapstone Big Five Carving", "category": "art-sculpture", "price_usd": 75, "price_kes": 9700, "description": "Compact soapstone Big Five sculpture.", "lead_time_hours": 24},
    {"id": "antelope-carving", "sku": "HN-T-031", "name": "Antelope Wood Carving", "category": "wood-carving", "price_usd": 85, "price_kes": 11000, "description": "Hand-carved antelope in African hardwood.", "lead_time_hours": 24},
    {"id": "wood-carving-set", "sku": "HN-T-032", "name": "Artisan Wood Carving", "category": "wood-carving", "price_usd": 75, "price_kes": 9700, "description": "Selected woodcarving piece.", "lead_time_hours": 24},
    {"id": "swahili-drums", "sku": "HN-T-033", "name": "Swahili Drum Set (3)", "category": "wood-carving", "price_usd": 120, "price_kes": 15600, "description": "Decorative coastal Swahili hand drums, set of three.", "lead_time_hours": 48},
    {"id": "rungu-clubs", "sku": "HN-T-034", "name": "Beaded Rungu Club Set", "category": "wood-carving", "price_usd": 110, "price_kes": 14300, "description": "Traditional Maasai rungu with beadwork, set of three.", "lead_time_hours": 24},
    {"id": "woven-basket", "sku": "HN-T-040", "name": "Hand-Woven Basket", "category": "baskets", "price_usd": 95, "price_kes": 12300, "description": "Medium sisal or banana-fibre basket.", "lead_time_hours": 48},
    {"id": "sisal-basket-small", "sku": "HN-T-041", "name": "Small Woven Keepsake Basket", "category": "baskets", "price_usd": 60, "price_kes": 7800, "description": "Compact woven basket for nested gifting.", "lead_time_hours": 48},
    {"id": "kitenge-fabric", "sku": "HN-T-050", "name": "Kitenge Fabric Length", "category": "textiles", "price_usd": 70, "price_kes": 9100, "description": "1.5m premium kitenge length.", "lead_time_hours": 24},
    {"id": "beaded-market-bag", "sku": "HN-T-051", "name": "Beaded Market Bag", "category": "textiles", "price_usd": 120, "price_kes": 15600, "description": "Statement tote with beadwork panel.", "lead_time_hours": 24},
    {"id": "maasai-sandals", "sku": "HN-T-052", "name": "Maasai Leather Sandals", "category": "leather", "price_usd": 85, "price_kes": 11000, "description": "Beaded leather sandals — size confirmed before dispatch.", "lead_time_hours": 48},
    {"id": "wooden-combs", "sku": "HN-T-053", "name": "Carved Wooden Combs", "category": "wood-carving", "price_usd": 38, "price_kes": 4900, "description": "Set of two carved combs.", "lead_time_hours": 12},
    {"id": "african-wall-art", "sku": "HN-T-060", "name": "Contemporary African Art Print", "category": "art-sculpture", "price_usd": 150, "price_kes": 19500, "description": "Framed or unframed contemporary Kenyan art.", "lead_time_hours": 48},
    {"id": "sculpture-piece", "sku": "HN-T-061", "name": "Africa-Inspired Sculpture", "category": "art-sculpture", "price_usd": 180, "price_kes": 23400, "description": "Single sculptural piece.", "lead_time_hours": 48},
    {"id": "kitenge-umbrella", "sku": "HN-T-062", "name": "Kitenge Umbrella", "category": "textiles", "price_usd": 85, "price_kes": 11000, "description": "Vibrant kitenge canopy umbrella.", "lead_time_hours": 24},
    {"id": "pottery-vessel", "sku": "HN-T-063", "name": "Hand-Thrown Pottery", "category": "art-sculpture", "price_usd": 95, "price_kes": 12300, "description": "Small vessel or bowl — each unique.", "lead_time_hours": 48},
    {"id": "big-five-print", "sku": "HN-T-064", "name": "Big Five Safari Print", "category": "art-sculpture", "price_usd": 85, "price_kes": 11000, "description": "Minimalist safari wildlife print.", "lead_time_hours": 24},
    {"id": "maasai-market-tote", "sku": "HN-T-065", "name": "Maasai Market Tote", "category": "textiles", "price_usd": 110, "price_kes": 14300, "description": "Leather or canvas market bag.", "lead_time_hours": 24},
    {"id": "african-woven-mat", "sku": "HN-T-066", "name": "African Woven Mat", "category": "homeware", "price_usd": 85, "price_kes": 11000, "description": "Decorative woven mat for table, wall, or shelf styling.", "lead_time_hours": 24},
    {"id": "african-hand-broom", "sku": "HN-T-067", "name": "African Hand Broom", "category": "homeware", "price_usd": 45, "price_kes": 5900, "description": "Minimal hand broom made from natural fibres.", "lead_time_hours": 24},
    {"id": "beaded-wood-containers", "sku": "HN-T-068", "name": "Beaded Wood Container Set", "category": "wood-carving", "price_usd": 140, "price_kes": 18200, "description": "Decorative beaded wooden containers, selected as a set.", "lead_time_hours": 48},
    {"id": "coconut-shell-plates-spoons", "sku": "HN-T-069", "name": "Coconut Shell Plate & Spoon Set", "category": "homeware", "price_usd": 90, "price_kes": 11700, "description": "Set of three coconut shell plates with wooden spoons.", "lead_time_hours": 24},
    {"id": "premium-packaging", "sku": "HN-T-070", "name": "Premium Gift Box & Tissue", "category": "packaging", "price_usd": 45, "price_kes": 5800, "description": "Matte rigid box, cream tissue, wax seal, brand story card.", "lead_time_hours": 12},
]


def hazina_collection_by_id(product_id: str) -> dict[str, Any] | None:
    for row in HAZINA_COLLECTIONS:
        if row["id"] == product_id:
            return row
    return None


def hazina_treasure_by_sku(sku: str) -> dict[str, Any] | None:
    sku_up = (sku or "").strip().upper()
    for row in HAZINA_TREASURES:
        if row["sku"].upper() == sku_up:
            return row
    return None


def hazina_treasure_by_id(treasure_id: str) -> dict[str, Any] | None:
    for row in HAZINA_TREASURES:
        if row["id"] == treasure_id:
            return row
    return None


def all_hazina_skus() -> dict[str, dict[str, Any]]:
    """Lookup by collection id, treasure id, or SKU."""
    out: dict[str, dict[str, Any]] = {}
    for row in HAZINA_COLLECTIONS:
        out[row["id"]] = {**row, "kind": "collection"}
        out[row["sku"].upper()] = {**row, "kind": "collection"}
    for row in HAZINA_TREASURES:
        out[row["id"]] = {**row, "kind": "treasure"}
        out[row["sku"].upper()] = {**row, "kind": "treasure"}
    return out


def build_hazina_kb_catalog() -> list[str]:
    chunks: list[str] = []
    for row in HAZINA_COLLECTIONS:
        extra = ""
        if row.get("jkia_only"):
            extra = " JKIA-optimised 4-hour delivery window."
        if row.get("personalization_note"):
            extra += f" {row['personalization_note']}"
        chunks.append(
            f"{row['name'].upper()} (SKU {row['sku']}) — USD {row['price_usd']} / KES {row['price_kes']:,}. "
            f"Target: {row['target']}. Includes: {row['contents']}. "
            f"Lead time: {row['lead_time_hours']}h.{extra}"
        )
    chunks.append(
        "CUSTOM BOX BUILDER — Guests may compose their own box from individual treasures "
        f"(minimum {MIN_CUSTOM_ITEMS} items plus optional premium packaging USD {PACKAGING_FEE_USD}). "
        "Confirm each SKU, delivery location, delivery mode (hotel, JKIA, or DHL/export quote), "
        "and payment method (M-Pesa or USD card)."
    )
    chunks.append(
        "INTERNATIONAL SHIPPING — Hazina can quote DHL Express or an equivalent insured courier "
        "for guests outside Kenya or missed-flight parcels. Collect country, city, full address, "
        "recipient contact, and deadline, then quote courier cost before payment."
    )
    for row in HAZINA_TREASURES:
        pers = " Personalisation available." if row.get("personalization") else ""
        chunks.append(
            f"TREASURE: {row['name']} (SKU {row['sku']}, id {row['id']}) — "
            f"USD {row['price_usd']} / KES {row['price_kes']:,}. "
            f"Category: {row['category']}. {row['description']} "
            f"Lead time: {row.get('lead_time_hours', 24)}h.{pers}"
        )
    return chunks


HAZINA_KB_POLICIES: list[str] = [
    (
        "DELIVERY ZONES — We deliver to Westlands, Kilimani, Karen, and JKIA "
        "(all terminals). We do not dispatch to other Nairobi neighbourhoods at MVP launch."
    ),
    (
        "JKIA DELIVERIES — Require at least 4 hours lead time before the guest's "
        "departure, the customer's terminal number (e.g. 1A, 1E), and a reachable "
        "phone number. The Departure Drop is optimised for this use case."
    ),
    (
        "HOTEL DELIVERIES — Collect hotel name, room number (or front-desk hold), "
        "and preferred delivery window. Confirm the guest's name on the order."
    ),
    (
        "LATE DISPATCH — Deliveries requested after 20:00 East Africa Time incur a "
        "USD 15 late-dispatch fee. Same-day JKIA requests before 20:00 follow the "
        "4-hour window rule without the late fee if feasible."
    ),
    (
        "INTERNATIONAL SHIPPING — If a traveller has already left Kenya or needs "
        "delivery outside the country, offer a DHL Express or equivalent insured "
        "courier quote. Collect destination country, city, full address, recipient "
        "name, phone/email, and deadline. Quote courier, customs risk, and ETA "
        "before taking payment."
    ),
    (
        "CUSTOM BOXES — Guests may compose their own gift box from individual treasures "
        f"(minimum {MIN_CUSTOM_ITEMS} items). Premium packaging (SKU HN-T-070) is optional. "
        "Confirm each SKU, delivery location, and payment method before dispatch."
    ),
    (
        "PAYMENTS — Local guests: M-Pesa STK push via IntaSend (KES). "
        "International cards: USD checkout link via Paystack (Visa, Mastercard, Apple Pay). "
        "Ask which method the guest prefers before initiating payment."
    ),
    (
        "BRAND POSITIONING — Hazina Nomads is a premium travel concierge, not a "
        "souvenir shop. Emphasise curation, packaging quality, and reliable last-mile delivery."
    ),
    (
        "CONTACT — WhatsApp concierge: +1 555 657 8220. Email: concierge@hazina-nomads.com. "
        "Operating hours for dispatch coordination: 08:00–20:00 EAT daily."
    ),
]


# Portal image paths — mirrors hazina-portal/lib/products.ts and lib/treasures.ts
HAZINA_COLLECTION_IMAGES: dict[str, str] = {
    "kenya-edit": "/treasures/kenya-edit-hero.png",
    "highland-treasure": "/treasures/highland-treasure-hero.png",
    "nomad-leather-set": "/treasures/nomad-leather-set-hero.png",
    "safari-romance-box": "/treasures/safari-romance-box-hero.png",
    "departure-drop": "/treasures/departure-drop-hero.png",
}

HAZINA_TREASURE_IMAGES: dict[str, str] = {
    "premium-coffee-250g": "/treasures/coffee-beans-variety.jpg",
    "loose-leaf-tea": "/treasures/premium-tea-spoons.jpg",
    "raw-honey": "/treasures/raw-honey-jars.jpg",
    "maasai-bracelet": "/treasures/beaded-bracelet.jpg",
    "maasai-necklace": "/treasures/maasai-necklace-worn.png",
    "maasai-earrings": "/treasures/maasai-earrings.jpg",
    "leather-passport": "/treasures/leather-passport-open.jpg",
    "leather-luggage-tag": "/treasures/leather-luggage-tag-lifestyle.png",
    "soapstone-big-five": "/treasures/big-five-sculpture.jpg",
    "antelope-carving": "/treasures/antelope-wood-carving.jpg",
    "wood-carving-set": "/treasures/handmade-woodcarvings.jpg",
    "swahili-drums": "/treasures/swahili-drums-set.jpg",
    "rungu-clubs": "/treasures/wooden-clubs-beaded.jpg",
    "woven-basket": "/treasures/basket-variety.jpg",
    "sisal-basket-small": "/treasures/basket-weaving-hands.jpg",
    "kitenge-fabric": "/treasures/kitenge-textiles.jpg",
    "beaded-market-bag": "/treasures/beaded-market-bag.jpg",
    "maasai-sandals": "/treasures/maasai-sandals.jpg",
    "wooden-combs": "/treasures/wooden-combs.jpg",
    "african-wall-art": "/treasures/african-art.jpg",
    "sculpture-piece": "/treasures/africa-sculptures.jpg",
    "kitenge-umbrella": "/treasures/kitenge-umbrellas.jpg",
    "pottery-vessel": "/treasures/pottery-hands.jpg",
    "big-five-print": "/treasures/big-five-art.jpg",
    "maasai-market-tote": "/treasures/maasai-market-bags.jpg",
    "african-woven-mat": "/treasures/african-woven-mats.jpg",
    "african-hand-broom": "/treasures/african-hand-broom.jpg",
    "beaded-wood-containers": "/treasures/beaded-wood-containers.jpg",
    "coconut-shell-plates-spoons": "/treasures/coconut-shell-plates-spoons.jpg",
    "premium-packaging": "/treasures/gift-box-light.jpg",
}


def build_hazina_menu_photos(portal_base_url: str = "https://hazina.lesnarai.co.ke") -> dict[str, str]:
    """Map collection/treasure ids and fuzzy names → absolute portal image URLs."""
    base = (portal_base_url or "https://hazina.lesnarai.co.ke").rstrip("/")
    out: dict[str, str] = {
        "menu": f"{base}/treasures/kenya-edit-hero.png",
        "collections": f"{base}/treasures/kenya-edit-hero.png",
        "safari": f"{base}/brand/safari-sunset.jpg",
    }
    for row in HAZINA_COLLECTIONS:
        path = HAZINA_COLLECTION_IMAGES.get(row["id"])
        if not path:
            continue
        url = f"{base}{path}"
        out[row["id"]] = url
        out[row["name"].lower()] = url
        out[row["sku"].lower()] = url
    for row in HAZINA_TREASURES:
        path = HAZINA_TREASURE_IMAGES.get(row["id"])
        if not path:
            continue
        url = f"{base}{path}"
        out[row["id"]] = url
        out[row["name"].lower()] = url
        out[row["sku"].lower()] = url
    return out
