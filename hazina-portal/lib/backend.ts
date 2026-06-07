/** FastAPI base URL for server-side portal proxies (chat, catalog, orders). */
export function backendBase(): string {
  const productionDefault = "https://hazina-api.onrender.com";
  const localDefault = "http://127.0.0.1:8000";
  const internalHostPort = process.env.BACKEND_INTERNAL_HOSTPORT?.trim();
  const internalUrl = process.env.BACKEND_INTERNAL_URL?.trim();

  return (
    internalUrl ||
    (internalHostPort ? `http://${internalHostPort}` : "") ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.VERCEL || process.env.RENDER || process.env.NODE_ENV === "production"
      ? productionDefault
      : localDefault)
  ).replace(/\/$/, "");
}

export function catalogCacheSeconds(): number {
  const raw = Number(process.env.HAZINA_CATALOG_CACHE_SECONDS || 300);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 300;
}

export function portalBase(): string {
  return (
    process.env.PUBLIC_HAZINA_PORTAL_URL ||
    process.env.NEXT_PUBLIC_HAZINA_PORTAL_URL ||
    (process.env.VERCEL ? "https://hazina.lesnarai.co.ke" : `http://127.0.0.1:${process.env.PORT || "3004"}`)
  ).replace(/\/$/, "");
}
