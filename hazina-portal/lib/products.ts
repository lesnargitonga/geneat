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
  express_departure?: boolean;
  emoji: string;
  image: string | null;
  imageAlt?: string;
  sourceImage?: string;
};

/** Brand / atmosphere imagery (not tied to a single SKU). */
export const BRAND_IMAGES = {
  atelierRoom: "/treasures/afrohemian-room.webp",
  artisanMarket: "/treasures/african-market-shop.webp",
  safariSunset: "/brand/safari-sunset.webp",
} as const;

export const BRAND = {
  name: "Hazina Nomads",
  tagline: "Bespoke Kenyan treasures, curated for your journey.",
  triad: "Bespoke Curation · Seamless Logistics · Global Export",
  pillars: ["Bespoke Curation", "Seamless Logistics", "Global Export"],
  meaning: "Hazina = treasure (Swahili)",
  whatsapp: process.env.NEXT_PUBLIC_HAZINA_WHATSAPP || "",
  phone: process.env.NEXT_PUBLIC_HAZINA_PHONE || "",
  email: "concierge@hazina-nomads.com",
};

export const FULFILLMENT_PILLARS = ["Bespoke Curation", "Seamless Logistics", "Global Export"] as const;

export const GIFT_BOXES: GiftBox[] = [
  {
    id: "kenya-edit",
    sku: "HN-KE-001",
    name: "The Kenya Edit",
    price_usd: 249,
    price_kes: 32400,
    target: "Bespoke Curation for travellers seeking a refined Kenyan edit",
    contents:
      "Premium Kenyan coffee (250g), Maasai beaded bracelet, soapstone Big Five carving, premium gift box with brand story card",
    itemIds: ["premium-coffee-250g", "maasai-bracelet", "soapstone-big-five", "premium-packaging"],
    lead_time_hours: 24,
    emoji: "🎁",
    image: "/treasures/kenya-edit-hero.webp",
    imageAlt: "Open Hazina collection with Kenyan coffee, beadwork, story card, and heritage carving",
    sourceImage: "kenya-edit-hero.jpg",
  },
  {
    id: "highland-treasure",
    sku: "HN-HT-002",
    name: "The Highland Treasure",
    price_usd: 199,
    price_kes: 25900,
    target: "Bespoke Curation for thoughtful premium gifting",
    contents:
      "Export-grade Kenyan coffee, premium Kenyan loose-leaf tea with carved wooden tasting spoon, local raw honey, premium gift box",
    itemIds: ["premium-coffee-250g", "loose-leaf-tea", "raw-honey", "premium-packaging"],
    lead_time_hours: 24,
    emoji: "☕",
    image: "/treasures/highland-treasure-hero.webp",
    imageAlt: "Hazina Highland Treasure gift box with coffee, tea, honey, and carved spoon",
    sourceImage: "highland-treasure-hero.jpg",
  },
  {
    id: "nomad-leather-set",
    sku: "HN-NL-003",
    name: "The Nomad Leather Set",
    price_usd: 329,
    price_kes: 42800,
    target: "Bespoke Curation for executive travel and personalisation",
    contents:
      "Handmade leather passport holder and luggage tag in a premium gift box (optional embossing)",
    itemIds: ["leather-passport", "leather-luggage-tag", "premium-packaging"],
    lead_time_hours: 24,
    personalization: true,
    personalization_note: "Engraving requires 24-hour notice",
    emoji: "🧳",
    image: "/treasures/nomad-leather-set-hero.webp",
    imageAlt: "Hazina leather passport holder, luggage tag, and travel journal on a timber table",
    sourceImage: "nomad-leather-set-hero.jpg",
  },
  {
    id: "safari-romance-box",
    sku: "HN-SR-004",
    name: "The Safari Romance Box",
    price_usd: 449,
    price_kes: 58400,
    target: "Bespoke Curation for romantic journeys and milestone stays",
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
    image: "/treasures/safari-romance-box-hero.webp",
    imageAlt: "Safari Romance gift box with beadwork, leather tag, and keepsakes at sunset",
    sourceImage: "safari-romance-box-hero.jpg",
  },
  {
    id: "departure-drop",
    sku: "HN-DD-005",
    name: "The Departure Drop",
    price_usd: 349,
    price_kes: 45400,
    target: "Seamless Logistics for departure-sensitive gifting",
    contents: "Pre-packed fast-moving items: coffee, tea, un-personalized leather, beadwork",
    itemIds: ["premium-coffee-250g", "loose-leaf-tea", "leather-passport", "maasai-bracelet", "premium-packaging"],
    lead_time_hours: 4,
    express_departure: true,
    emoji: "✈️",
    image: "/treasures/departure-drop-hero.webp",
    imageAlt: "Hazina Departure Drop box with leather, tea, coffee, honey, and travel gifts",
    sourceImage: "departure-drop-hero.jpg",
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
