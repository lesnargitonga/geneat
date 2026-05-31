import type { Metadata } from "next";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

export const metadata: Metadata = {
  title: "About · Hazina Nomads",
  description:
    "Premium Kenyan gift concierge for travellers — curated treasures delivered to your hotel, JKIA, or quoted for insured DHL export.",
};

export default function AboutPage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello — I'd like to learn more about Hazina Nomads.");

  return (
    <>
      <article className="container-page pt-10 md:pt-16 pb-16 md:pb-24 max-w-3xl">
        <header className="mb-12 md:mb-16">
          <span className="label-mono">About Hazina Nomads</span>
          <h1 className="h-display text-5xl md:text-7xl leading-[0.95] mt-4 text-obsidian">
            Treasure, <span className="italic text-bronze">delivered.</span>
          </h1>
        </header>

        <section className="space-y-6 text-ink-mute text-lg leading-relaxed">
          <p>
            <em className="text-obsidian not-italic font-serif text-xl">Hazina</em> means treasure
            in Swahili. We curate premium Kenyan gift boxes for travellers who seek something
            meaningful — without surrendering an afternoon to a souvenir market.
          </p>
          <p>
            Five fixed collections at launch, concierge coordination on WhatsApp, Nairobi
            hotel delivery, JKIA handoff, and insured DHL export quotes when a parcel needs
            to travel abroad.
          </p>
          <p>
            We are not a souvenir shop. We are a travel concierge — calm, precise, and built for
            guests who value their time above all else.
          </p>
        </section>
      </article>

      <section className="section-dark py-16 md:py-20">
        <div className="container-page max-w-3xl">
          <span className="label-mono text-sand/40">The journey</span>
          <h2 className="h-display text-3xl md:text-4xl mt-3 mb-8 text-sand">How we serve you</h2>
          <ol className="space-y-6">
            {[
              "Browse our five curated collections.",
              "Begin a conversation with our concierge on WhatsApp.",
              "Confirm hotel, JKIA, or international delivery details.",
              "Settle via M-Pesa or USD card.",
              "Receive your collection — beautifully packaged, precisely coordinated.",
            ].map((step, i) => (
              <li key={step} className="flex gap-6 items-start">
                <span className="font-mono text-sm text-bronze-light shrink-0 pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sand/70 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16 md:py-20 max-w-3xl space-y-6">
        <span className="label-mono">Our philosophy</span>
        <h2 className="h-display text-3xl text-obsidian">Built for the modern nomad</h2>
        <p className="text-ink-mute leading-relaxed">
          Hazina Nomads exists at the intersection of Kenyan craftsmanship and international
          travel. Every collection is assembled by hand, every delivery coordinated with the
          discretion of a five-star concierge desk.
        </p>
        <p className="text-ink-mute leading-relaxed">
          When you need a human touch — corporate gifting, special commissions, or complex
          logistics — our team is one message away.
        </p>
      </section>

      <section className="container-page pb-20 text-center max-w-md mx-auto space-y-6">
        <h3 className="font-serif text-2xl text-obsidian">Begin a conversation</h3>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark">
          Order on WhatsApp
        </a>
        <p className="text-sm text-ink-mute">
          <a href={`mailto:${BRAND.email}`} className="hover:text-obsidian transition-colors">
            {BRAND.email}
          </a>
        </p>
      </section>
    </>
  );
}
