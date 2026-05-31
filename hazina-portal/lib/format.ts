export function formatKES(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export function formatUSD(n: number): string {
  return `USD ${n.toLocaleString("en-US")}`;
}

export function formatDualPrice(usd: number, kes: number): string {
  return `${formatUSD(usd)} / ${formatKES(kes)}`;
}

export function whatsappLink(phoneE164DigitsOnly: string, text?: string): string {
  const base = `https://wa.me/${phoneE164DigitsOnly}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
