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

export function whatsappLink(phone: string, text?: string): string {
  const base = `https://wa.me/${whatsappDigits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
