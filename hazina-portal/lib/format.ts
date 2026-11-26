export function formatKES(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export function formatUSD(n: number): string {
  return `USD ${n.toLocaleString("en-US")}`;
}

export function formatDualPrice(usd: number, kes: number): string {
  return `${formatUSD(usd)} / ${formatKES(kes)}`;
}

/** Strip +, spaces, dashes, brackets — wa.me expects digits-only international format. */
export function whatsappDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Whether the public can reach this WhatsApp number: not empty, not the placeholder, and not in
 * Meta's +1 555 test range (Cloud API test numbers cannot receive messages from the public).
 */
export function whatsappUsable(phone: string): boolean {
  const d = whatsappDigits(phone);
  return d.length >= 10 && d !== "254700000000" && !d.startsWith("1555");
}

/** Links to an unreachable number point here instead, and globals.css hides them. */
export const WHATSAPP_UNAVAILABLE = "#whatsapp-unavailable";

export function whatsappLink(phone: string, text?: string): string {
  if (!whatsappUsable(phone)) return WHATSAPP_UNAVAILABLE;
  const base = `https://wa.me/${whatsappDigits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
