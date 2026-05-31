// Hazina Nomads gift catalog — mirrors scripts/seed_hazina_nomads.py PRODUCTS.

export type GiftBox = {
  id: string;
  sku: string;
  name: string;
  price_usd: number;
  price_kes: number;
  target: string;
  contents: string;
  lead_time_hours: number;
  personalization?: boolean;
  personalization_note?: string;
  jkia_only?: boolean;
  emoji: string;
  image: string;
  imageAlt: string;
};

/** Brand / atmosphere imagery (not tied to a single SKU). */
export const BRAND_IMAGES = {
  heroGiftBox: "/brand/hero-gift-box.png",
  heroBg: "/brand/hero-bg.jpg",
  safariSunset: "/brand/safari-sunset.jpg",
} as const;

export const BRAND = {
  name: "Hazina Nomads",
  tagline: "Curated treasures for the modern nomad.",
  meaning: "Hazina = treasure (Swahili)",
  whatsapp: process.env.NEXT_PUBLIC_HAZINA_WHATSAPP || "254700000001",
  phone: process.env.NEXT_PUBLIC_HAZINA_PHONE || "+254 700 000 001",
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
    lead_time_hours: 24,
    emoji: "🎁",
    image: "/products/kenya-edit.png",
    imageAlt: "The Kenya Edit — premium Kenyan coffee, Maasai beadwork, and artisan soapstone in a curated gift box",
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
    lead_time_hours: 24,
    emoji: "☕",
    image: "/products/highland-treasure.jpg",
    imageAlt: "The Highland Treasure — export-grade Kenyan tea, coffee, and honey with a carved wooden spoon",
  },
  {
    id: "nomad-leather-set",
    sku: "HN-NL-003",
    name: "The Nomad Leather Set",
    price_usd: 129,
    price_kes: 16600,
    target: "Business travellers, wealthy tourists",
    contents: "Handmade leather passport holder, luggage tag, and travel notebook",
    lead_time_hours: 24,
    personalization: true,
    personalization_note: "Engraving requires 24-hour notice",
    emoji: "🧳",
    image: "/products/nomad-leather-set.jpg",
    imageAlt: "The Nomad Leather Set — handmade Kenyan leather passport holder, luggage tag, and travel notebook",
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
    lead_time_hours: 48,
    personalization: true,
    emoji: "💝",
    image: "/products/safari-romance-box.png",
    imageAlt: "The Safari Romance Box — matching Maasai beadwork and curated treats for couples on safari",
  },
  {
    id: "departure-drop",
    sku: "HN-DD-005",
    name: "The Departure Drop",
    price_usd: 149,
    price_kes: 19200,
    target: "Last-minute JKIA departures",
    contents: "Pre-packed fast-moving items: coffee, tea, un-personalized leather, beadwork",
    lead_time_hours: 4,
    jkia_only: true,
    emoji: "✈️",
    image: "/products/departure-drop.png",
    imageAlt: "The Departure Drop — pre-packed Kenyan coffee, tea, leather, and beadwork for JKIA departures",
  },
];

export function getGiftBox(id: string): GiftBox | undefined {
  return GIFT_BOXES.find((b) => b.id === id);
}
