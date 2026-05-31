import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, GIFT_BOXES } from "@/lib/products";
import { formatKES, whatsappLink } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

export const metadata: Metadata = {
  title: "Gift Collections · Hazina Nomads",
  description: "Five curated Kenyan gift boxes for travellers — from safari keepsakes to JKIA departure drops.",
};

export default function CollectionsPage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello — I'd like help choosing a gift collection.");
  return (
    <>
      <header className="mb-10">
        <span className="chip-mute">Five curated boxes</span>
        <h1 className="h-display text-4xl md:text-5xl mt-3 mb-3">Collections</h1>
        <p className="text-ink-soft max-w-2xl">
          Premium Kenyan treasures, beautifully packaged. Each box is fixed at launch —
          no custom contents unless you need corporate gifting (ask our concierge).
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {GIFT_BOXES.map((box) => (
          <article key={box.id} className="card p-0 overflow-hidden flex flex-col">
            <ProductImage box={box} className="rounded-none aspect-[16/10]" sizes="(max-width: 768px) 100vw, 50vw" />
            <div className="p-6 md:p-8 flex flex-col gap-4 flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="h-display text-2xl">{box.name}</h2>
                  <p className="text-sm text-ink-mute mt-1">{box.target}</p>
                </div>
                <span className="text-xs text-ink-mute font-mono shrink-0">{box.sku}</span>
              </div>
              <p className="text-ink-soft text-sm">{box.contents}</p>
              <ul className="text-xs text-ink-mute space-y-1">
                <li>Lead time: {box.lead_time_hours}h{box.jkia_only ? " (JKIA-optimised)" : ""}</li>
                {box.personalization && (
                  <li>{box.personalization_note || "Personalisation available"}</li>
                )}
              </ul>
              <div className="flex items-center justify-between pt-4 border-t border-ink/5 mt-auto">
                <div>
                  <div className="h-display text-xl">{formatKES(box.price_kes)}</div>
                  <div className="text-sm text-ink-mute">USD {box.price_usd}</div>
                </div>
                <a
                  href={whatsappLink(BRAND.whatsapp, `Hi — I'd like to order ${box.name}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm py-2 px-4"
                >
                  Order via WhatsApp
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-16 card p-8 text-center">
        <h2 className="h-display text-2xl mb-2">Not sure which box?</h2>
        <p className="text-ink-soft mb-4 max-w-lg mx-auto">
          Our AI concierge will recommend based on your trip, budget, and delivery timeline.
        </p>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Talk to concierge →
        </a>
        <p className="text-xs text-ink-mute mt-4">
          Corporate gifting? Mention it in chat — we&apos;ll connect you with a human.
        </p>
      </section>

      <p className="text-center mt-8">
        <Link href="/" className="text-sm text-brand font-semibold hover:underline">← Back home</Link>
      </p>
    </>
  );
}
