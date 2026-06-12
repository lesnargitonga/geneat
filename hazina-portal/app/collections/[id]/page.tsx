import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GIFT_BOXES, getGiftBox } from "@/lib/products";
import { collectionTreasureItems, getStorefrontCatalog } from "@/lib/catalog";
import { CollectionItemsPreview } from "@/components/CollectionCard";
import { CollectionCheckout } from "@/components/CollectionCheckout";
import { formatDualPrice, formatUSD, whatsappLink } from "@/lib/format";
import { StickyWhatsAppCTA } from "@/components/StickyWhatsAppCTA";
import { SmartBackLink } from "@/components/SmartBackLink";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { MotionSafe } from "@/components/three-d/MotionSafe";
import { ProductTheater } from "@/components/three-d/ProductTheater";
import { RevealText } from "@/components/three-d/RevealText";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { SpatialSection } from "@/components/three-d/SpatialSection";

type Props = { params: { id: string } };

export const revalidate = 300;

export function generateStaticParams() {
  return GIFT_BOXES.map((box) => ({ id: box.id }));
}

const COLLECTION_SEO: Record<string, { title: string; description: string; keywords?: string[] }> = {
  "kenya-edit": {
    title: "The Kenya Edit · Bespoke Curation",
    description:
      "A signature Kenyan heritage collection with USD/KES pricing, bespoke curation, seamless logistics, and global export support.",
    keywords: ["Kenya travel gifts", "bespoke Kenyan curation", "The Kenya Edit"],
  },
  "departure-drop": {
    title: "The Departure Drop · Departure-Ready Collection",
    description:
      "A premium Kenyan collection for departure-sensitive handoffs. Coffee, beadwork, and leather with concierge-confirmed logistics.",
    keywords: ["departure gifts Kenya", "last minute Kenyan gifts", "premium travel gifts Kenya"],
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

export default async function CollectionDetailPage({ params }: Props) {
  const catalog = await getStorefrontCatalog();
  const box = catalog.collections.find((item) => item.id === params.id) || getGiftBox(params.id);
  if (!box) notFound();

  const items = collectionTreasureItems(box, catalog.treasures);
  const itemsSubtotalKes = items.reduce((s, t) => s + t.price_kes, 0);
  const itemsSubtotalUsd = items.reduce((s, t) => s + t.price_usd, 0);
  const fallbackImage = items.find((t) => t.category !== "packaging" && t.image)?.image ?? null;
  const theaterHighlights = [
    { label: `${box.lead_time_hours}h lead`, value: "Concierge confirmed" },
    ...items
      .filter((t) => t.category !== "packaging")
      .slice(0, 4)
      .map((item) => ({
        label: item.name,
        value: item.sku,
        href: `/treasures/${item.id}`,
      })),
  ];
  const orderMessage = `Hello Hazina Nomads — I'd like to order ${box.name}.`;
  const customizeWa = whatsappLink(
    catalog.brand.whatsapp,
    `Hi — I'm interested in ${box.name} but would like to swap a few items inside.`,
  );

  return (
    <SpatialPage className="product-room">
      <div className="product-room__shell container-page pt-10 md:pt-16 pb-16">
        <SmartBackLink fallbackHref="/collections" className="label-mono text-bronze hover:text-obsidian">
          ← Back to browsing
        </SmartBackLink>

        <SpatialSection className="product-room__stage grid lg:grid-cols-2 gap-12 lg:gap-16 mt-8 items-start">
          <ProductTheater
            image={box.image}
            fallbackImage={fallbackImage}
            alt={box.imageAlt || box.name}
            name={box.name}
            eyebrow={`${box.sku} · ${box.lead_time_hours}h lead`}
            highlights={theaterHighlights}
            className="lg:sticky lg:top-24"
          />

          <div className="product-room__desk space-y-8">
            <RevealText>
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
            </RevealText>

            <MotionSafe delay={0.08}>
              <div className="editorial-rule">
                <span className="label-mono block mb-2">Curator&apos;s note</span>
                <p className="text-ink-mute leading-relaxed">{box.contents}</p>
              </div>
            </MotionSafe>

            {box.personalization && (
              <MotionSafe delay={0.12}>
                <p className="label-mono text-bronze">{box.personalization_note}</p>
              </MotionSafe>
            )}

            <MotionSafe delay={0.16}>
              <div className="flex flex-wrap gap-4">
                <a href="#checkout" className="btn-dark" data-cursor="magnetic">
                  Order this box
                </a>
                <Link href="/build" className="btn-outline" data-cursor="magnetic">
                  Pick individual items
                </Link>
              </div>
            </MotionSafe>

            <FloatingSurface depth="strong">
              <CollectionCheckout box={box} />
            </FloatingSurface>
          </div>
        </SpatialSection>

        <SpatialSection className="product-room__inventory mt-20 pt-12 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span className="label-mono">What&apos;s inside</span>
              <h2 className="font-serif text-3xl text-obsidian mt-2">
                {items.length} treasure{items.length === 1 ? "" : "s"} in this box
              </h2>
            </div>
            <p className="text-sm text-ink-mute">
              Individual value ~{formatDualPrice(itemsSubtotalUsd, itemsSubtotalKes)} — collection price includes curation &amp; packaging
            </p>
          </div>
          <CollectionItemsPreview box={box} treasures={catalog.treasures} />
          <p className="text-ink-mute text-sm mt-10 max-w-xl leading-relaxed">
            Want to swap an item? Message us — we&apos;ll adjust your box while keeping the same delivery window.
          </p>
          <a
            href={customizeWa}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost mt-4 inline-flex"
            data-cursor="magnetic"
          >
            Customise on WhatsApp · Human concierge
          </a>
        </SpatialSection>
      </div>
      <StickyWhatsAppCTA message={orderMessage} phone={catalog.brand.whatsapp} />
    </SpatialPage>
  );
}
