import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogImage } from "@/components/CatalogImage";
import { GIFT_BOXES, getGiftBox, BRAND } from "@/lib/products";
import { getTreasuresByIds } from "@/lib/treasures";
import { CollectionItemsPreview } from "@/components/CollectionCard";
import { CollectionCheckout } from "@/components/CollectionCheckout";
import { formatDualPrice, formatUSD, whatsappLink } from "@/lib/format";
import { StickyWhatsAppCTA } from "@/components/StickyWhatsAppCTA";
import { SmartBackLink } from "@/components/SmartBackLink";

type Props = { params: { id: string } };

export function generateStaticParams() {
  return GIFT_BOXES.map((b) => ({ id: b.id }));
}

const COLLECTION_SEO: Record<string, { title: string; description: string; keywords?: string[] }> = {
  "kenya-edit": {
    title: "The Kenya Edit · Premium Safari Souvenirs Nairobi",
    description:
      "Curated Kenyan safari souvenirs for discerning travellers — coffee, Maasai beadwork, soapstone. Hotel delivery in Nairobi or insured DHL export quote.",
    keywords: ["safari souvenirs Nairobi", "Kenya travel gifts", "The Kenya Edit"],
  },
  "departure-drop": {
    title: "The Departure Drop · Last-Minute JKIA Gifts",
    description:
      "Premium Kenyan gift box delivered to JKIA in 4 hours. Coffee, beadwork, leather — curated for departing travellers, not airport trinkets.",
    keywords: ["JKIA gifts", "last minute souvenirs Nairobi", "airport gift delivery Kenya"],
  },
};

export function generateMetadata({ params }: Props): Metadata {
  const box = getGiftBox(params.id);
  if (!box) return { title: "Collection not found" };
  const seo = COLLECTION_SEO[params.id];
  return {
    title: seo?.title ?? `${box.name} · Hazina Nomads`,
    description: seo?.description ?? box.contents,
    keywords: seo?.keywords,
  };
}

export default function CollectionDetailPage({ params }: Props) {
  const box = getGiftBox(params.id);
  if (!box) notFound();

  const items = getTreasuresByIds(box.itemIds ?? []);
  const itemsSubtotalKes = items.reduce((s, t) => s + t.price_kes, 0);
  const itemsSubtotalUsd = items.reduce((s, t) => s + t.price_usd, 0);
  const orderMessage = `Hello Hazina Nomads — I'd like to order ${box.name}.`;
  const customizeWa = whatsappLink(
    BRAND.whatsapp,
    `Hi — I'm interested in ${box.name} but would like to swap a few items inside.`,
  );

  return (
    <>
      <div className="container-page pt-10 md:pt-16 pb-16">
        <SmartBackLink fallbackHref="/collections" className="label-mono text-bronze hover:text-obsidian">
          ← Back to browsing
        </SmartBackLink>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mt-8 items-start">
          <CatalogImage
            src={box.image}
            alt={box.imageAlt || box.name}
            className="aspect-[4/5] shadow-editorial sticky top-24"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />

          <div className="space-y-8">
            <div>
              <span className="label-mono">{box.sku} · {box.lead_time_hours}h lead</span>
              <h1 className="h-display text-4xl md:text-5xl text-obsidian mt-3">{box.name}</h1>
              <p className="text-ink-mute mt-2">{box.target}</p>
              <div className="mt-4">
                <p className="font-serif text-3xl md:text-4xl text-obsidian leading-none">
                  {formatUSD(box.price_usd)}
                </p>
                <p className="font-mono text-sm text-ink-mute mt-1">
                  KES {box.price_kes.toLocaleString("en-KE")}
                </p>
              </div>
            </div>

            <div className="editorial-rule">
              <span className="label-mono block mb-2">Curator&apos;s note</span>
              <p className="text-ink-mute leading-relaxed">{box.contents}</p>
            </div>

            {box.personalization && (
              <p className="label-mono text-bronze">{box.personalization_note}</p>
            )}

            <div className="flex flex-wrap gap-4">
              <a href="#checkout" className="btn-dark">
                Order this box
              </a>
              <Link href="/build" className="btn-outline">
                Pick individual items
              </Link>
            </div>

            <CollectionCheckout box={box} />
          </div>
        </div>

        <section className="mt-20 pt-12 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span className="label-mono">What&apos;s inside</span>
              <h2 className="font-serif text-3xl text-obsidian mt-2">
                {items.length} treasures in this box
              </h2>
            </div>
            <p className="text-sm text-ink-mute">
              Individual value ~{formatDualPrice(itemsSubtotalUsd, itemsSubtotalKes)} — collection price includes curation &amp; packaging
            </p>
          </div>
          <CollectionItemsPreview box={box} />
          <p className="text-ink-mute text-sm mt-10 max-w-xl leading-relaxed">
            Want to swap an item? Message us — we&apos;ll adjust your box while keeping the same delivery window.
          </p>
          <a href={customizeWa} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-4 inline-flex">
            Customise this collection
          </a>
        </section>
      </div>
      <StickyWhatsAppCTA message={orderMessage} />
    </>
  );
}
