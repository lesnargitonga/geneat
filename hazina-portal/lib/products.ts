// Hazina Nomads gift catalog — mirrors scripts/seed_hazina_nomads.py PRODUCTS.

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
  heroGiftBox: "/treasures/curated-gift-box.png",
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

export const DELIVERY_ZONES = ["Westlands", "Kilimani", "Karen", "JKIA"] as const;

export const GIFT_BOXES: GiftBox[] = [
  {
    id: "kenya-edit",
    sku: "HN-KE-001",
    name: "The Kenya Edit",
    price_usd: 89,
    price_kes: 11500,
    target: "Safari tourists, European/US visitors",
    contents:
      "Premium Kenyan coffee (250g), handmade Maasai beadwork (bracelet or necklace), small artisan soapstone carving, printed brand story card",
    itemIds: ["premium-coffee-250g", "maasai-bracelet", "soapstone-big-five", "premium-packaging"],
    lead_time_hours: 24,
    emoji: "🎁",
    image: "/treasures/curated-gift-box.png",
    imageAlt: "Gift box with coffee, rungu, earrings, and leather passport holder",
    sourceImage: "curated-gift-box.png",
  },
  {
    id: "highland-treasure",
    sku: "HN-HT-002",
    name: "The Highland Treasure",
    price_usd: 59,
    price_kes: 7600,
    target: "General gifting, diaspora, colleagues",
    contents:
      "Export-grade Kenyan coffee, premium Kenyan loose-leaf tea, local raw honey, carved wooden tasting spoon",
    itemIds: ["premium-coffee-250g", "loose-leaf-tea", "raw-honey", "wooden-combs"],
    lead_time_hours: 24,
    emoji: "☕",
    image: "/treasures/highland-treasure-hero.png",
    imageAlt: "The Highland Treasure — coffee, tea, honey, and wooden combs in a curated box",
    sourceImage: "highland-treasure-hero.png",
  },
  {
    id: "nomad-leather-set",
    sku: "HN-NL-003",
    name: "The Nomad Leather Set",
    price_usd: 129,
    price_kes: 16600,
    target: "Business travellers, wealthy tourists",
    contents: "Handmade leather passport holder, luggage tag, and travel notebook",
    itemIds: ["leather-passport", "leather-luggage-tag", "premium-packaging"],
    lead_time_hours: 24,
    personalization: true,
    personalization_note: "Engraving requires 24-hour notice",
    emoji: "🧳",
    image: "/treasures/nomad-leather-set-studio.png",
    imageAlt: "The Nomad Leather Set — passport holder and luggage tag on linen",
    sourceImage: "nomad-leather-set-studio.png",
  },
  {
    id: "safari-romance-box",
    sku: "HN-SR-004",
    name: "The Safari Romance Box",
    price_usd: 199,
    price_kes: 25600,
    target: "Honeymooners, anniversary trips",
    contents:
      "Matching couple's beadwork, premium treats (chocolate/coffee), framed minimalist safari route map, leather luggage tags",
    itemIds: ["maasai-necklace", "maasai-bracelet", "premium-coffee-250g", "big-five-print", "leather-luggage-tag"],
    lead_time_hours: 48,
    personalization: true,
    emoji: "💝",
    image: "/treasures/safari-romance-box-hero.png",
    imageAlt: "The Safari Romance Box — beadwork, coffee, and leather for couples",
    sourceImage: "safari-romance-box-hero.png",
  },
  {
    id: "departure-drop",
    sku: "HN-DD-005",
    name: "The Departure Drop",
    price_usd: 149,
    price_kes: 19200,
    target: "Last-minute JKIA departures",
    contents: "Pre-packed fast-moving items: coffee, tea, un-personalized leather, beadwork",
    itemIds: ["premium-coffee-250g", "loose-leaf-tea", "leather-passport", "maasai-bracelet", "premium-packaging"],
    lead_time_hours: 4,
    jkia_only: true,
    emoji: "✈️",
    image: "/treasures/departure-pack.png",
    imageAlt: "Gift package with coffee, leather passport holder, and beadwoven bracelet",
    sourceImage: "departure-pack.png",
  },
];

export function getGiftBox(id: string): GiftBox | undefined {
  return GIFT_BOXES.find((b) => b.id === id);
}
