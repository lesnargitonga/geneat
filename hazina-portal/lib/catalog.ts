import { backendBase } from "@/lib/backend";
import { BRAND, GIFT_BOXES, type GiftBox } from "@/lib/products";
import { TREASURES, type Treasure } from "@/lib/treasures";

type BackendCatalog = {
  brand?: Partial<typeof BRAND>;
  collections?: Array<Partial<GiftBox> & { item_ids?: string[]; jkia_only?: boolean }>;
  treasures?: Array<Partial<Treasure> & { is_engravable?: boolean }>;
  photos?: Record<string, string>;
  backend_truth?: boolean;
};

export type StorefrontCatalog = {
  brand: typeof BRAND;
  collections: GiftBox[];
  treasures: Treasure[];
  photos: Record<string, string>;
  source: "backend" | "static";
};

const STATIC_COLLECTION_BY_ID = new Map(GIFT_BOXES.map((box) => [box.id, box]));
const STATIC_TREASURE_BY_ID = new Map(TREASURES.map((item) => [item.id, item]));

function normalizeCollection(row: Partial<GiftBox> & { item_ids?: string[]; jkia_only?: boolean }): GiftBox | null {
  if (!row.id || !row.sku || !row.name || row.price_usd == null || row.price_kes == null) return null;
  const fallback = STATIC_COLLECTION_BY_ID.get(row.id);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    price_usd: Number(row.price_usd),
    price_kes: Number(row.price_kes),
    target: row.target || fallback?.target || "Bespoke Curation",
    contents: row.contents || fallback?.contents || "",
    itemIds: row.itemIds || row.item_ids || fallback?.itemIds || [],
    lead_time_hours: Number(row.lead_time_hours ?? fallback?.lead_time_hours ?? 24),
    personalization: Boolean(row.personalization ?? fallback?.personalization),
    personalization_note: row.personalization_note || fallback?.personalization_note,
    express_departure: Boolean(row.express_departure ?? row.jkia_only ?? fallback?.express_departure),
    emoji: fallback?.emoji || "",
    image: row.image || fallback?.image || null,
    imageAlt: row.imageAlt || fallback?.imageAlt || row.name,
    sourceImage: row.sourceImage || fallback?.sourceImage,
  };
}

function normalizeTreasure(row: Partial<Treasure> & { is_engravable?: boolean }): Treasure | null {
  if (!row.id || !row.sku || !row.name || !row.category || row.price_usd == null || row.price_kes == null) return null;
  const fallback = STATIC_TREASURE_BY_ID.get(row.id);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    price_usd: Number(row.price_usd),
    price_kes: Number(row.price_kes),
    image: row.image || fallback?.image || null,
    imageAlt: row.imageAlt || fallback?.imageAlt || row.name,
    sourceImage: row.sourceImage || fallback?.sourceImage,
    description: row.description || fallback?.description || "",
    origin: row.origin || fallback?.origin,
    lead_time_hours: row.lead_time_hours == null ? fallback?.lead_time_hours : Number(row.lead_time_hours),
    personalization: Boolean(row.personalization ?? fallback?.personalization),
    isEngravable: Boolean(row.isEngravable ?? row.is_engravable ?? fallback?.isEngravable),
  };
}

export async function getStorefrontCatalog(): Promise<StorefrontCatalog> {
  const fallback: StorefrontCatalog = {
    brand: BRAND,
    collections: GIFT_BOXES,
    treasures: TREASURES,
    photos: {},
    source: "static",
  };

  try {
    const res = await fetch(`${backendBase()}/catalog/businesses/hazina-nomads/hazina`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_500),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as BackendCatalog;
    const collections = (body.collections || []).map(normalizeCollection).filter(Boolean) as GiftBox[];
    const treasures = (body.treasures || []).map(normalizeTreasure).filter(Boolean) as Treasure[];
    if (!collections.length || !treasures.length) return fallback;
    return {
      brand: { ...BRAND, ...(body.brand || {}) },
      collections,
      treasures,
      photos: body.photos || {},
      source: body.backend_truth ? "backend" : "static",
    };
  } catch {
    return fallback;
  }
}

export function collectionTreasureItems(box: GiftBox, treasures: Treasure[]): Treasure[] {
  const ids = new Set(box.itemIds || []);
  return treasures.filter((item) => ids.has(item.id) && item.category !== "packaging");
}
