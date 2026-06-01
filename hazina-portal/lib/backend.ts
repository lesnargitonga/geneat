/** FastAPI base URL for server-side portal proxies (chat, catalog, orders). */
export function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.VERCEL ? "https://api.lesnarai.co.ke" : "http://127.0.0.1:8000")
  ).replace(/\/$/, "");
}

export function portalBase(): string {
  return (
    process.env.PUBLIC_HAZINA_PORTAL_URL ||
    process.env.NEXT_PUBLIC_HAZINA_PORTAL_URL ||
    (process.env.VERCEL ? "https://hazina.lesnarai.co.ke" : `http://127.0.0.1:${process.env.PORT || "3004"}`)
  ).replace(/\/$/, "");
}
