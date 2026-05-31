import type { Metadata } from "next";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

export const metadata: Metadata = {
  title: "About · Hazina Nomads",
  description: "Premium Kenyan gift concierge for travellers — curated treasures delivered to your hotel or JKIA.",
};

export default function AboutPage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello — I'd like to learn more about Hazina Nomads.");
  return (
    <article className="max-w-3xl mx-auto space-y-10 pb-16">
      <header>
        <span className="chip-mute mb-3">About Hazina Nomads</span>
        <h1 className="h-display text-5xl md:text-6xl leading-[0.95]">
          Treasure, <span className="text-brand">delivered.</span>
        </h1>
      </header>

      <section className="space-y-4 text-ink-soft text-lg">
        <p>
          <em>Hazina</em> means treasure in Swahili. We curate premium Kenyan gift boxes
          for travellers who want something meaningful — without losing an afternoon in
          a souvenir market.
        </p>
        <p>
          Five fixed collections at launch, concierge coordination on WhatsApp, and
          delivery to your hotel room or JKIA terminal before you depart Nairobi.
        </p>
        <p>
          We are not a souvenir shop. We are a travel concierge — calm, precise, and
          built for guests who value their time.
        </p>
      </section>

      <section id="how" className="card p-8 space-y-3">
        <h2 className="h-display text-2xl">How it works</h2>
        <ol className="list-decimal list-inside text-ink-soft space-y-1">
          <li>Browse our five curated collections.</li>
          <li>Chat with our AI concierge on WhatsApp.</li>
          <li>Confirm delivery location and departure time.</li>
          <li>Pay via M-Pesa or USD card.</li>
          <li>Receive your box — beautifully packaged, on schedule.</li>
        </ol>
      </section>

      <section className="card p-8 space-y-3">
        <h2 className="h-display text-2xl">Powered by Omni AI</h2>
        <p className="text-ink-soft">
          Hazina Nomads runs on Omni AI — a multi-tenant concierge platform with
          tenant-scoped knowledge, WhatsApp menus, and human escalation when you need it.
        </p>
      </section>

      <section className="card p-8 text-center">
        <h3 className="h-display text-xl mb-2">Talk to us</h3>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold">
          WhatsApp concierge →
        </a>
        <p className="text-sm text-ink-mute mt-2">
          <a href={`mailto:${BRAND.email}`} className="hover:text-ink">{BRAND.email}</a>
        </p>
      </section>
    </article>
  );
}
