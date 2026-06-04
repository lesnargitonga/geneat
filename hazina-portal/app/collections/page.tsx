import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, GIFT_BOXES } from "@/lib/products";
import { whatsappLink } from "@/lib/format";
import { CollectionCard } from "@/components/CollectionCard";
import { StickyWhatsAppCTA } from "@/components/StickyWhatsAppCTA";

export const metadata: Metadata = {
  title: "Gift Collections · Hazina Nomads",
  description:
    "Five curated Kenyan heritage collections for travellers, backed by bespoke curation, seamless logistics, and global export.",
};

export default function CollectionsPage() {
  const orderMessage = "Hello Hazina Nomads — I'd like to order a gift collection.";
  const wa = whatsappLink(BRAND.whatsapp, orderMessage);

  return (
    <>
      <header className="container-page pt-10 md:pt-16 mb-10 md:mb-12">
        <span className="label-mono">Five ready-to-order collections</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Choose a collection</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Pick a finished collection, or{" "}
          <Link href="/build" className="text-bronze hover:text-obsidian underline-offset-4 hover:underline">
            choose individual treasures
          </Link>{" "}
          instead. Each card shows price, lead time, and what is inside, with fulfillment
          guided by the Hazina Triad.
        </p>
      </header>

      <div className="container-page">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
          {GIFT_BOXES.map((box, index) => (
            <CollectionCard key={box.id} box={box} priority={index === 0} />
          ))}
        </div>
      </div>

      <section className="section-dark mt-20 md:mt-28 py-16 md:py-20">
        <div className="container-page text-center max-w-xl mx-auto space-y-6">
          <span className="label-mono text-sand/40">Personal guidance</span>
          <h2 className="h-display text-3xl md:text-4xl text-sand">Unsure which collection?</h2>
          <p className="text-sand/60 leading-relaxed">
            Our concierge will recommend based on your journey, budget, and delivery timeline —
            with the discretion of a five-star hotel desk.
          </p>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline border-sand/30 text-sand hover:bg-sand hover:text-obsidian">
            Order on WhatsApp
          </a>
          <p className="label-mono text-sand/30">
            Corporate gifting? Mention it in chat — we&apos;ll connect you with a senior host.
          </p>
        </div>
      </section>

      <StickyWhatsAppCTA message={orderMessage} />
    </>
  );
}
