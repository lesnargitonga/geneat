import { NextResponse } from "next/server";
import { backendBase, catalogCacheSeconds } from "@/lib/backend";
import { BRAND, GIFT_BOXES } from "@/lib/products";
import { ALL_CATEGORIES, CATEGORY_LABELS, TREASURES } from "@/lib/treasures";

export const revalidate = 300;

export async function GET() {
  const base = backendBase();

  try {
    const res = await fetch(`${base}/catalog/businesses/hazina-nomads/hazina`, {
      next: { revalidate: catalogCacheSeconds() },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const photos = body?.photos || {};
      const categories = Array.isArray(body?.categories)
        ? body.categories.map((id: string) => ({ id, label: CATEGORY_LABELS[id as keyof typeof CATEGORY_LABELS] || id }))
        : ALL_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] }));
      return NextResponse.json({
        brand: { ...BRAND, ...(body?.brand || {}) },
        collections: body?.collections || GIFT_BOXES,
        treasures: body?.treasures || TREASURES,
        categories,
        backend: {
          base,
          source: body?.source || "backend",
          livePhotoKeys: photos && typeof photos === "object" ? Object.keys(photos).length : 0,
          backendTruth: Boolean(body?.backend_truth),
        },
      }, {
        headers: { "Cache-Control": `public, max-age=60, stale-while-revalidate=${catalogCacheSeconds()}` },
      });
    }
  } catch {
    // Static fallback below keeps the storefront resilient during backend deploys.
  }

  return NextResponse.json({
    brand: BRAND,
    collections: GIFT_BOXES,
    treasures: TREASURES,
    categories: ALL_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
    backend: {
      base,
      source: "static_fallback",
      livePhotoKeys: 0,
      backendTruth: false,
    },
  }, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
  });
}
