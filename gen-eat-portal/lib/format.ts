export function formatKES(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export function whatsappLink(phoneE164DigitsOnly: string, text?: string): string {
  const base = `https://wa.me/${phoneE164DigitsOnly}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
