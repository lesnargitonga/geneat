export type TreasureCategory =
  | "coffee-tea"
  | "beadwork"
  | "leather"
  | "wood-carving"
  | "textiles"
  | "art-sculpture"
  | "food"
  | "baskets"
  | "packaging";

export type Treasure = {
  id: string;
  sku: string;
  name: string;
  category: TreasureCategory;
  price_usd: number;
  price_kes: number;
  image: string;
  imageAlt: string;
  description: string;
  origin?: string;
  lead_time_hours?: number;
  personalization?: boolean;
};

export const CATEGORY_LABELS: Record<TreasureCategory, string> = {
  "coffee-tea": "Coffee & Tea",
  beadwork: "Beadwork & Jewellery",
  leather: "Leather & Travel",
  "wood-carving": "Wood & Carvings",
  textiles: "Textiles & Kitenge",
  "art-sculpture": "Art & Sculpture",
  food: "Honey & Pantry",
  baskets: "Baskets & Weaving",
  packaging: "Gift Presentation",
};

export const PACKAGING_FEE_USD = 25;
export const PACKAGING_FEE_KES = 3200;
export const MIN_CUSTOM_ITEMS = 2;

/** Individual treasures — mix and match in /build or browse in /treasures */
export const TREASURES: Treasure[] = [
  {
    id: "premium-coffee-250g",
    sku: "HN-T-001",
    name: "Premium Kenyan Coffee",
    category: "coffee-tea",
    price_usd: 18,
    price_kes: 2300,
    image: "/treasures/coffee-beans-variety.jpg",
    imageAlt: "Single-origin Kenyan coffee beans, export grade",
    description: "250g of single-origin Kenyan AA, roasted for export. Berry notes from the highlands.",
    origin: "Nyeri & Kiambu highlands",
    lead_time_hours: 12,
  },
  {
    id: "loose-leaf-tea",
    sku: "HN-T-002",
    name: "Highland Loose-Leaf Tea",
    category: "coffee-tea",
    price_usd: 14,
    price_kes: 1800,
    image: "/treasures/premium-tea-spoons.jpg",
    imageAlt: "Grade A Kenyan tea with carved wooden tasting spoon",
    description: "Export-grade purple tea and black tea blend with a carved wooden tasting spoon.",
    origin: "Kericho highlands",
    lead_time_hours: 12,
  },
  {
    id: "raw-honey",
    sku: "HN-T-003",
    name: "Local Raw Honey",
    category: "food",
    price_usd: 16,
    price_kes: 2100,
    image: "/treasures/coffee-sack.jpg",
    imageAlt: "Small-batch Kenyan raw honey",
    description: "Unfiltered acacia honey from smallholder beekeepers. 200g jar.",
    origin: "Rift Valley",
    lead_time_hours: 24,
  },
  {
    id: "maasai-bracelet",
    sku: "HN-T-010",
    name: "Maasai Beaded Bracelet",
    category: "beadwork",
    price_usd: 22,
    price_kes: 2800,
    image: "/treasures/beaded-bracelet.jpg",
    imageAlt: "Handmade Maasai beaded bracelet",
    description: "Hand-strung glass bead bracelet from a fixed Maasai Market vendor we trust.",
    origin: "Maasai Market, Nairobi",
    lead_time_hours: 12,
  },
  {
    id: "maasai-necklace",
    sku: "HN-T-011",
    name: "Maasai Beaded Necklace",
    category: "beadwork",
    price_usd: 38,
    price_kes: 4900,
    image: "/treasures/beaded-circle.png",
    imageAlt: "Maasai beaded necklace circle arrangement",
    description: "Statement collar or layered necklace — colours chosen for contemporary wardrobes.",
    origin: "Maasai Market, Nairobi",
    lead_time_hours: 24,
  },
  {
    id: "maasai-earrings",
    sku: "HN-T-012",
    name: "Maasai Earrings",
    category: "beadwork",
    price_usd: 18,
    price_kes: 2300,
    image: "/treasures/maasai-earrings.jpg",
    imageAlt: "Handmade Maasai earrings",
    description: "Lightweight beaded drop earrings — a discreet safari keepsake.",
    lead_time_hours: 12,
  },
  {
    id: "leather-passport",
    sku: "HN-T-020",
    name: "Leather Passport Holder",
    category: "leather",
    price_usd: 45,
    price_kes: 5800,
    image: "/treasures/leather-passport-open.jpg",
    imageAlt: "Handmade Kenyan leather passport holder open",
    description: "Full-grain leather passport sleeve from a Kariokor workshop. Optional embossing.",
    origin: "Kariokor, Nairobi",
    lead_time_hours: 24,
    personalization: true,
  },
  {
    id: "leather-luggage-tag",
    sku: "HN-T-021",
    name: "Leather Luggage Tag",
    category: "leather",
    price_usd: 15,
    price_kes: 1900,
    image: "/treasures/leather-passport-closed.jpg",
    imageAlt: "Handmade leather luggage tag",
    description: "Embossed leather tag with secure buckle strap.",
    lead_time_hours: 24,
    personalization: true,
  },
  {
    id: "soapstone-big-five",
    sku: "HN-T-030",
    name: "Soapstone Big Five Carving",
    category: "art-sculpture",
    price_usd: 32,
    price_kes: 4100,
    image: "/treasures/big-five-sculpture.jpg",
    imageAlt: "Soapstone carving of Kenya's Big Five animals",
    description: "Compact soapstone sculpture — elephant, rhino, lion, leopard, buffalo.",
    origin: "Kisii soapstone artisans",
    lead_time_hours: 24,
  },
  {
    id: "antelope-carving",
    sku: "HN-T-031",
    name: "Antelope Wood Carving",
    category: "wood-carving",
    price_usd: 36,
    price_kes: 4600,
    image: "/treasures/antelope-wood-carving.jpg",
    imageAlt: "Hand-carved antelope from African hardwood",
    description: "Hand-carved antelope figure in rich African hardwood.",
    lead_time_hours: 24,
  },
  {
    id: "wood-carving-set",
    sku: "HN-T-032",
    name: "Artisan Wood Carving",
    category: "wood-carving",
    price_usd: 28,
    price_kes: 3600,
    image: "/treasures/handmade-woodcarvings.jpg",
    imageAlt: "Assorted handmade Kenyan wood carvings",
    description: "Selected piece from our woodcarving partners — animal or abstract form.",
    lead_time_hours: 24,
  },
  {
    id: "swahili-drums",
    sku: "HN-T-033",
    name: "Swahili Drum Set (3)",
    category: "wood-carving",
    price_usd: 55,
    price_kes: 7100,
    image: "/treasures/swahili-drums-set.jpg",
    imageAlt: "Set of three Swahili hand drums",
    description: "Decorative hand drums — coastal Swahili craft tradition.",
    lead_time_hours: 48,
  },
  {
    id: "rungu-clubs",
    sku: "HN-T-034",
    name: "Beaded Rungu Club Set",
    category: "wood-carving",
    price_usd: 42,
    price_kes: 5400,
    image: "/treasures/wooden-clubs-beaded.jpg",
    imageAlt: "Set of three beaded wooden rungu clubs",
    description: "Traditional Maasai rungu with beadwork — set of three display pieces.",
    lead_time_hours: 24,
  },
  {
    id: "woven-basket",
    sku: "HN-T-040",
    name: "Hand-Woven Basket",
    category: "baskets",
    price_usd: 34,
    price_kes: 4400,
    image: "/treasures/women-weaving-baskets.jpg",
    imageAlt: "Women weaving traditional Kenyan baskets",
    description: "Sisal or banana-fibre basket — medium size, ideal for bread or fruit at home.",
    origin: "Western Kenya cooperatives",
    lead_time_hours: 48,
  },
  {
    id: "sisal-basket-small",
    sku: "HN-T-041",
    name: "Small Woven Keepsake Basket",
    category: "baskets",
    price_usd: 22,
    price_kes: 2800,
    image: "/treasures/basket-weaving-hands.jpg",
    imageAlt: "Elder hands weaving a small basket",
    description: "Compact woven basket — fits inside a gift box as a nested surprise.",
    lead_time_hours: 48,
  },
  {
    id: "kitenge-fabric",
    sku: "HN-T-050",
    name: "Kitenge Fabric Length",
    category: "textiles",
    price_usd: 28,
    price_kes: 3600,
    image: "/treasures/kitenge-textiles.jpg",
    imageAlt: "Decorative African kitenge textiles being made",
    description: "1.5m premium kitenge — wearable or frameable. Patterns vary by availability.",
    lead_time_hours: 24,
  },
  {
    id: "beaded-market-bag",
    sku: "HN-T-051",
    name: "Beaded Market Bag",
    category: "textiles",
    price_usd: 40,
    price_kes: 5100,
    image: "/treasures/beaded-market-bag.jpg",
    imageAlt: "Unique African bag with beadwork design",
    description: "Statement tote with beadwork panel — functional souvenir.",
    lead_time_hours: 24,
  },
  {
    id: "maasai-sandals",
    sku: "HN-T-052",
    name: "Maasai Leather Sandals",
    category: "leather",
    price_usd: 35,
    price_kes: 4500,
    image: "/treasures/maasai-sandals.jpg",
    imageAlt: "Handmade Maasai leather sandals",
    description: "Beaded leather sandals — sizes confirmed via WhatsApp before dispatch.",
    lead_time_hours: 48,
  },
  {
    id: "wooden-combs",
    sku: "HN-T-053",
    name: "Carved Wooden Combs",
    category: "wood-carving",
    price_usd: 16,
    price_kes: 2100,
    image: "/treasures/wooden-combs.jpg",
    imageAlt: "Hand-carved wooden combs in assorted designs",
    description: "Set of two carved combs — lightweight travel gift.",
    lead_time_hours: 12,
  },
  {
    id: "african-wall-art",
    sku: "HN-T-060",
    name: "Contemporary African Art Print",
    category: "art-sculpture",
    price_usd: 48,
    price_kes: 6200,
    image: "/treasures/african-art.jpg",
    imageAlt: "Contemporary African art piece",
    description: "Framed or unframed — contemporary Kenyan art selected by our curators.",
    lead_time_hours: 48,
  },
  {
    id: "sculpture-piece",
    sku: "HN-T-061",
    name: "Africa-Inspired Sculpture",
    category: "art-sculpture",
    price_usd: 52,
    price_kes: 6700,
    image: "/treasures/africa-sculptures.jpg",
    imageAlt: "Africa-inspired sculptural art",
    description: "Single sculptural piece — stone or mixed media.",
    lead_time_hours: 48,
  },
  {
    id: "kitenge-umbrella",
    sku: "HN-T-062",
    name: "Kitenge Umbrella",
    category: "textiles",
    price_usd: 30,
    price_kes: 3900,
    image: "/treasures/kitenge-umbrellas.jpg",
    imageAlt: "Colourful kitenge-pattern umbrellas",
    description: "Vibrant kitenge canopy — practical and photogenic.",
    lead_time_hours: 24,
  },
  {
    id: "pottery-vessel",
    sku: "HN-T-063",
    name: "Hand-Thrown Pottery",
    category: "art-sculpture",
    price_usd: 38,
    price_kes: 4900,
    image: "/treasures/pottery-hands.jpg",
    imageAlt: "Artisan hands shaping pottery",
    description: "Small vessel or bowl — each piece unique.",
    lead_time_hours: 48,
  },
  {
    id: "big-five-print",
    sku: "HN-T-064",
    name: "Big Five Safari Print",
    category: "art-sculpture",
    price_usd: 24,
    price_kes: 3100,
    image: "/treasures/big-five-art.jpg",
    imageAlt: "Big Five safari artwork",
    description: "Minimalist safari route or wildlife print — ready to frame.",
    lead_time_hours: 24,
  },
  {
    id: "maasai-market-tote",
    sku: "HN-T-065",
    name: "Maasai Market Tote",
    category: "textiles",
    price_usd: 26,
    price_kes: 3300,
    image: "/treasures/maasai-market-bags.jpg",
    imageAlt: "Maasai market handbags and totes",
    description: "Leather or canvas market bag from our fixed vendor.",
    lead_time_hours: 24,
  },
  {
    id: "premium-packaging",
    sku: "HN-T-070",
    name: "Premium Gift Box & Tissue",
    category: "packaging",
    price_usd: 25,
    price_kes: 3200,
    image: "/treasures/gift-box-light.jpg",
    imageAlt: "Premium light brown rigid gift box",
    description: "Matte rigid box, cream tissue, wax seal, and brand story card.",
    lead_time_hours: 12,
  },
];

export function getTreasure(id: string): Treasure | undefined {
  return TREASURES.find((t) => t.id === id);
}

export function getTreasuresByCategory(category: TreasureCategory): Treasure[] {
  return TREASURES.filter((t) => t.category === category);
}

export function getTreasuresByIds(ids: string[]): Treasure[] {
  return ids.map((id) => getTreasure(id)).filter(Boolean) as Treasure[];
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as TreasureCategory[];
