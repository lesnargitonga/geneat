import type { MetadataRoute } from "next";

const SITE_URL = process.env.PUBLIC_HAZINA_PORTAL_URL || "https://hazina.lesnarai.co.ke";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / transactional surfaces should stay out of the index.
      disallow: ["/api/", "/orders", "/orders/", "/partners/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
