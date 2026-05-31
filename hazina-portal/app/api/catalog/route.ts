import { NextResponse } from "next/server";
import { BRAND, GIFT_BOXES } from "@/lib/products";
import { ALL_CATEGORIES, CATEGORY_LABELS, TREASURES } from "@/lib/treasures";

function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.VERCEL ? "https://api.lesnarai.co.ke" : "http://localhost:8000")
  ).replace(/\/$/, "");
}

export async function GET() {
  const base = backendBase();
  let livePhotoKeys = 0;

  try {
    const res = await fetch(`${base}/catalog/businesses/hazina-nomads/menu-photos`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const photos = body?.menu_photos || body?.photos || {};
      if (photos && typeof photos === "object") livePhotoKeys = Object.keys(photos).length;
    }
  } catch {
    livePhotoKeys = 0;
  }

  return NextResponse.json({
    brand: BRAND,
    collections: GIFT_BOXES,
    treasures: TREASURES,
    categories: ALL_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
    backend: {
      base,
      livePhotoKeys,
    },
  });
}
