// Hazina Nomads gift catalog — mirrors app/catalog/hazina_catalog.py PRODUCTS.

import { getTreasuresByIds, type Treasure } from "@/lib/treasures";

export type GiftBox = {
  id: string;
  sku: string;
  name: string;
  price_usd: number;
  price_kes: number;
  target: string;
  contents: string;
  /** Treasure IDs included in this curated collection */
  itemIds: string[];
  lead_time_hours: number;
  personalization?: boolean;
  personalization_note?: string;
  jkia_only?: boolean;
  emoji: string;
  image: string | null;
  imageAlt?: string;
  sourceImage?: string;
};

/** Brand / atmosphere imagery (not tied to a single SKU). */
export const BRAND_IMAGES = {
  atelierRoom: "/treasures/afrohemian-room.jpg",
  artisanMarket: "/treasures/african-market-shop.jpg",
  safariSunset: "/brand/safari-sunset.jpg",
} as const;

export const BRAND = {
  name: "Hazina Nomads",
  tagline: "Curated treasures for the modern nomad.",
  meaning: "Hazina = treasure (Swahili)",
  whatsapp: process.env.NEXT_PUBLIC_HAZINA_WHATSAPP || "15556578220",
  phone: process.env.NEXT_PUBLIC_HAZINA_PHONE || "+1 555 657 8220",
  email: "concierge@hazina-nomads.com",
};

export const DELIVERY_ZONES = ["Westlands", "Kilimani", "Karen", "JKIA", "DHL export quote"] as const;

export const GIFT_BOXES: GiftBox[] = [
  {
    id: "kenya-edit",
    sku: "HN-KE-001",
    name: "The Kenya Edit",
    price_usd: 249,
    price_kes: 32400,
    target: "Safari tourists, European/US visitors",
    contents:
      "Premium Kenyan coffee (250g), Maasai beaded bracelet, soapstone Big Five carving, premium gift box with brand story card",
    itemIds: ["premium-coffee-250g", "maasai-bracelet", "soapstone-big-five", "premium-packaging"],
    lead_time_hours: 24,
    emoji: "🎁",
    image: "/treasures/coffee-beans-variety.jpg",
    imageAlt: "Premium Kenyan coffee beans, one of the primary treasures in The Kenya Edit",
    sourceImage: "coffee-beans-variety.jpg",
  },
  {
    id: "highland-treasure",
    sku: "HN-HT-002",
    name: "The Highland Treasure",
    price_usd: 199,
    price_kes: 25900,
    target: "General gifting, diaspora, colleagues",
    contents:
      "Export-grade Kenyan coffee, premium Kenyan loose-leaf tea with carved wooden tasting spoon, local raw honey, premium gift box",
    itemIds: ["premium-coffee-250g", "loose-leaf-tea", "raw-honey", "premium-packaging"],
    lead_time_hours: 24,
    emoji: "☕",
    image: "/treasures/premium-tea-spoons.jpg",
    imageAlt: "Highland loose-leaf tea, one of the primary treasures in The Highland Treasure",
    sourceImage: "premium-tea-spoons.jpg",
  },
  {
    id: "nomad-leather-set",
    sku: "HN-NL-003",
    name: "The Nomad Leather Set",
    price_usd: 329,
    price_kes: 42800,
    target: "Business travellers, wealthy tourists",
    contents:
      "Handmade leather passport holder and luggage tag in a premium gift box (optional embossing)",
    itemIds: ["leather-passport", "leather-luggage-tag", "premium-packaging"],
    lead_time_hours: 24,
    personalization: true,
    personalization_note: "Engraving requires 24-hour notice",
    emoji: "🧳",
    image: "/treasures/leather-passport-open.jpg",
    imageAlt: "Open leather passport holder, one of the pieces in The Nomad Leather Set",
    sourceImage: "leather-passport-open.jpg",
  },
  {
    id: "safari-romance-box",
    sku: "HN-SR-004",
    name: "The Safari Romance Box",
    price_usd: 449,
    price_kes: 58400,
    target: "Honeymooners, anniversary trips",
    contents:
      "Maasai beaded necklace and bracelet, premium Kenyan coffee, Big Five safari print, leather luggage tag, premium gift box",
    itemIds: [
      "maasai-necklace",
      "maasai-bracelet",
      "premium-coffee-250g",
      "big-five-print",
      "leather-luggage-tag",
      "premium-packaging",
    ],
    lead_time_hours: 48,
    personalization: true,
    emoji: "💝",
    image: "/treasures/maasai-necklace-worn.png",
    imageAlt: "Maasai beaded necklace, one of the signature treasures in The Safari Romance Box",
    sourceImage: "maasai-necklace-worn.png",
  },
  {
    id: "departure-drop",
    sku: "HN-DD-005",
    name: "The Departure Drop",
    price_usd: 349,
    price_kes: 45400,
    target: "Last-minute JKIA departures",
    contents: "Pre-packed fast-moving items: coffee, tea, un-personalized leather, beadwork",
    itemIds: ["premium-coffee-250g", "loose-leaf-tea", "leather-passport", "maasai-bracelet", "premium-packaging"],
    lead_time_hours: 4,
    jkia_only: true,
    emoji: "✈️",
    image: "/treasures/leather-passport-closed.jpg",
    imageAlt: "Closed leather passport holder, one of the travel pieces in The Departure Drop",
    sourceImage: "leather-passport-closed.jpg",
  },
];

export function getGiftBox(id: string): GiftBox | undefined {
  return GIFT_BOXES.find((b) => b.id === id);
}

/** Treasures inside a curated box (excludes packaging SKU — shown separately). */
export function getCollectionTreasureItems(box: GiftBox): Treasure[] {
  return getTreasuresByIds(box.itemIds ?? []).filter((t) => t.category !== "packaging");
}

export function getCollectionPackaging(box: GiftBox): Treasure | undefined {
  return getTreasuresByIds(box.itemIds ?? []).find((t) => t.category === "packaging");
}
