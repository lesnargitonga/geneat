import Link from "next/link";
import type { Metadata } from "next";
import { getStorefrontCatalog } from "@/lib/catalog";
import { whatsappLink } from "@/lib/format";
import { CollectionCard } from "@/components/CollectionCard";
import { StickyWhatsAppCTA } from "@/components/StickyWhatsAppCTA";
import { LuxuryTilt } from "@/components/three-d/LuxuryTilt";
import { RevealGroup } from "@/components/three-d/RevealGroup";
import { RevealText } from "@/components/three-d/RevealText";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { SpatialSection } from "@/components/three-d/SpatialSection";

export const metadata: Metadata = {
  title: "Gift Collections · Hazina Nomads",
  description:
    "Five curated Kenyan heritage collections for travellers, backed by bespoke curation, seamless logistics, and global export.",
};

export const revalidate = 300;

export default async function CollectionsPage() {
  const catalog = await getStorefrontCatalog();
  const orderMessage = "Hello Hazina Nomads — I'd like to order a gift collection.";
  const wa = whatsappLink(catalog.brand.whatsapp, orderMessage);

  return (
    <SpatialPage className="collections-showroom">
      <SpatialSection className="collections-showroom__intro container-page pt-10 md:pt-16 mb-10 md:mb-12">
        <RevealText>
          <span className="label-mono">Signature Kenyan Collections</span>
        </RevealText>
        <RevealText delay={0.07}>
          <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Refined gifts, prepared for the journey.</h1>
        </RevealText>
        <RevealText delay={0.14}>
          <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
            Explore finished Kenyan collections prepared for travellers, hosts, and thoughtful gifting.
            Each edit includes visible pricing, lead time, contents, and concierge-guided handoff
            options. For something more personal,{" "}
            <Link href="/build" className="text-bronze hover:text-obsidian underline-offset-4 hover:underline">
              open a private sourcing brief
            </Link>
            .
          </p>
        </RevealText>
      </SpatialSection>

      <SpatialSection className="showroom-gallery container-page" delay={0.08}>
        <div className="showroom-gallery__rail" aria-hidden="true" />
        <RevealGroup className="showroom-gallery__grid">
          {catalog.collections.map((box, index) => (
            <LuxuryTilt key={box.id} className="h-full">
              <CollectionCard
                box={box}
                className="h-full"
                priority={index === 0}
                brandPhone={catalog.brand.whatsapp}
                treasures={catalog.treasures}
              />
            </LuxuryTilt>
          ))}
        </RevealGroup>
      </SpatialSection>

      <section className="section-dark showroom-band mt-20 md:mt-28 py-16 md:py-20">
        <SpatialSection className="container-page text-center max-w-xl mx-auto space-y-6">
          <span className="label-mono text-sand/40">Personal guidance</span>
          <h2 className="h-display text-3xl md:text-4xl text-sand">Unsure which collection?</h2>
          <p className="text-sand/60 leading-relaxed">
            Our concierge will recommend based on your journey, budget, and delivery timeline —
            with the discretion of a five-star hotel desk.
          </p>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline border-sand/30 text-sand hover:bg-sand hover:text-obsidian">
            Continue on WhatsApp
          </a>
          <p className="label-mono text-sand/30">
            Human concierge handoff · Corporate gifting? Mention it in your message.
          </p>
        </SpatialSection>
      </section>

      <StickyWhatsAppCTA message={orderMessage} phone={catalog.brand.whatsapp} />
    </SpatialPage>
  );
}
