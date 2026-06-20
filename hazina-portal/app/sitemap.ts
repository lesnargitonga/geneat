import type { MetadataRoute } from "next";
import { GIFT_BOXES } from "@/lib/products";
import { TREASURES } from "@/lib/treasures";

const SITE_URL = process.env.PUBLIC_HAZINA_PORTAL_URL || "https://hazina.lesnarai.co.ke";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/collections", priority: 0.9, changeFrequency: "weekly" },
    { path: "/build", priority: 0.8, changeFrequency: "monthly" },
    { path: "/premium-safari-souvenirs-nairobi", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/hosts-guides", priority: 0.5, changeFrequency: "monthly" },
    { path: "/last-minute-kenya-gifts-jkia", priority: 0.6, changeFrequency: "monthly" },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  for (const box of GIFT_BOXES) {
    entries.push({
      url: `${SITE_URL}/collections/${box.id}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const treasure of TREASURES) {
    entries.push({
      url: `${SITE_URL}/treasures/${treasure.id}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
