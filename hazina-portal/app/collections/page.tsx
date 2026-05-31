import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, GIFT_BOXES } from "@/lib/products";
import { TREASURES } from "@/lib/treasures";
import { whatsappLink } from "@/lib/format";
import { CollectionCard } from "@/components/CollectionCard";
import { SmartBackLink } from "@/components/SmartBackLink";
import { StickyWhatsAppCTA } from "@/components/StickyWhatsAppCTA";
import { TrustRow } from "@/components/TrustRow";

export const metadata: Metadata = {
  title: "Gift Collections · Hazina Nomads",
  description:
    "Five curated Kenyan gift boxes for travellers — from safari keepsakes to JKIA departure drops.",
};

export default function CollectionsPage() {
  const orderMessage = "Hello Hazina Nomads — I'd like to order a gift collection.";
  const wa = whatsappLink(BRAND.whatsapp, orderMessage);

  return (
    <>
      <header className="container-page pt-10 md:pt-16 mb-14 md:mb-20">
        <span className="label-mono">Five signature collections · {TREASURES.length} individual treasures</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Collections</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Start from a curator&apos;s assembly — or{" "}
          <Link href="/build" className="text-bronze hover:text-obsidian underline-offset-4 hover:underline">
            compose your own
          </Link>{" "}
          from the atelier. Tap any collection to see exactly what&apos;s inside.
        </p>
        <TrustRow className="mt-8 max-w-3xl" />
      </header>

      <div className="container-page">
        <div className="grid grid-cols-12 gap-x-6 gap-y-16 md:gap-y-20">
          <div className="col-span-12 lg:col-span-7">
            <CollectionCard box={GIFT_BOXES[0]} priority />
          </div>
          <div className="col-span-12 lg:col-span-5 lg:mt-24">
            <CollectionCard box={GIFT_BOXES[1]} />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <CollectionCard box={GIFT_BOXES[2]} />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-7 lg:-mt-12">
            <CollectionCard box={GIFT_BOXES[3]} />
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-4">
            <CollectionCard box={GIFT_BOXES[4]} />
          </div>
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

      <p className="container-page text-center py-10">
        <SmartBackLink
          fallbackHref="/"
          className="font-mono text-sm uppercase tracking-[0.1em] text-bronze hover:text-bronze-dark transition-colors"
        >
          ← Back to browsing
        </SmartBackLink>
      </p>
      <StickyWhatsAppCTA message={orderMessage} />
    </>
  );
}
