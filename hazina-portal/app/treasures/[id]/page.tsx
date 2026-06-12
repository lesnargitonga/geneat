import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogImage } from "@/components/CatalogImage";
import { SmartBackLink } from "@/components/SmartBackLink";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { LuxuryTilt } from "@/components/three-d/LuxuryTilt";
import { MotionSafe } from "@/components/three-d/MotionSafe";
import { RevealGroup } from "@/components/three-d/RevealGroup";
import { RevealText } from "@/components/three-d/RevealText";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { CATEGORY_LABELS, TREASURES, getTreasure } from "@/lib/treasures";
import { getStorefrontCatalog } from "@/lib/catalog";
import { formatDualPrice, whatsappLink } from "@/lib/format";

type Props = { params: { id: string } };

export const revalidate = 300;

export function generateStaticParams() {
  return TREASURES.map((item) => ({ id: item.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const item = getTreasure(params.id);
  if (!item) return { title: "Treasure not found" };
  return {
    title: `${item.name} · Hazina Nomads`,
    description: item.description,
  };
}

export default async function TreasureDetailPage({ params }: Props) {
  const catalog = await getStorefrontCatalog();
  const item = catalog.treasures.find((treasure) => treasure.id === params.id) || getTreasure(params.id);
  if (!item) notFound();

  const wa = whatsappLink(
    catalog.brand.whatsapp,
    `Hi — I'd like to add "${item.name}" (${item.sku}) to my gift box.`,
  );
  const related = catalog.treasures.filter((t) => t.category === item.category && t.id !== item.id).slice(0, 4);

  return (
    <SpatialPage>
      <div className="container-page pt-10 md:pt-16 pb-16">
        <SmartBackLink fallbackHref="/build" className="label-mono text-bronze hover:text-obsidian">
          ← Back to browsing
        </SmartBackLink>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mt-8">
          <FloatingSurface depth="strong">
            <CatalogImage
              src={item.image}
              alt={item.imageAlt || item.name}
              tone="warm"
              fit="contain"
              className="aspect-[4/5] shadow-editorial"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </FloatingSurface>

          <div className="space-y-6">
            <RevealText>
              <span className="label-mono">{CATEGORY_LABELS[item.category]} · {item.sku}</span>
            </RevealText>
            <RevealText delay={0.07}>
              <h1 className="h-display text-4xl md:text-5xl text-obsidian">{item.name}</h1>
            </RevealText>
            <RevealText delay={0.12}>
              <div className="font-mono text-lg text-bronze">
                {formatDualPrice(item.price_usd, item.price_kes)}
              </div>
            </RevealText>
            <MotionSafe delay={0.16}>
              <p className="text-ink-mute text-lg leading-relaxed">{item.description}</p>
            </MotionSafe>

            <MotionSafe className="editorial-rule space-y-3 text-sm text-ink-mute" delay={0.2}>
              {item.origin && (
                <p>
                  <span className="text-obsidian font-mono text-sm uppercase tracking-[0.1em] block mb-1">
                    Origin
                  </span>
                  {item.origin}
                </p>
              )}
              {item.lead_time_hours && (
                <p>
                  <span className="text-obsidian font-mono text-sm uppercase tracking-[0.1em] block mb-1">
                    Lead time
                  </span>
                  {item.lead_time_hours} hours
                </p>
              )}
              {item.personalization && (
                <p>
                  <span className="text-obsidian font-mono text-sm uppercase tracking-[0.1em] block mb-1">
                    Personalisation
                  </span>
                  Available — confirm details with concierge
                </p>
              )}
            </MotionSafe>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href={`/build?add=${item.id}`}
                className="btn-dark"
              >
                Add to private brief
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">
                Continue on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20 pt-12 border-t border-border">
            <h2 className="font-serif text-2xl text-obsidian mb-8">More in {CATEGORY_LABELS[item.category]}</h2>
            <RevealGroup className="grid grid-cols-2 md:grid-cols-4 gap-6" stagger={0.06}>
              {related.map((r) => (
                <LuxuryTilt key={r.id}>
                  <Link href={`/treasures/${r.id}`} className="group block">
                    <CatalogImage
                      src={r.image}
                      alt={r.imageAlt || r.name}
                      tone="warm"
                      fit="contain"
                      className="aspect-square mb-2"
                      sizes="200px"
                    />
                    <p className="font-serif text-base leading-tight text-obsidian">{r.name}</p>
                  </Link>
                </LuxuryTilt>
              ))}
            </RevealGroup>
          </section>
        )}
      </div>
    </SpatialPage>
  );
}
