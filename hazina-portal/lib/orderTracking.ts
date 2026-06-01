import { backendBase } from "@/lib/backend";
import type { PublicOrder } from "@/lib/orderTracking.types";

export type {
  OrderLine,
  PublicOrder,
  TimelineStatus,
  TimelineStep,
} from "@/lib/orderTracking.types";

function normalizeOrderRef(id: string): string {
  const raw = id.trim();
  if (/^hn-ord-/i.test(raw)) {
    return `HN-ORD-${raw.slice(7).toUpperCase()}`;
  }
  return raw.toUpperCase();
}

/**
 * Load a magic-link order from FastAPI.
 * Server components call the API directly; the BFF route `/api/orders/[id]` mirrors this for tools.
 */
export async function fetchPublicOrder(
  orderId: string,
  token: string,
): Promise<PublicOrder | null> {
  const ref = normalizeOrderRef(orderId);
  const tok = token.trim();
  if (!ref || !tok) return null;

  const base = backendBase();
  const url = `${base}/api/public/orders/${encodeURIComponent(ref)}?token=${encodeURIComponent(tok)}`;

  try {
    const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicOrder;
  } catch {
    return null;
  }
}
