import Link from "next/link";
import type { Metadata } from "next";
import { PackBuilder } from "@/components/PackBuilder";
import { RevealText } from "@/components/three-d/RevealText";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { getStorefrontCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Curate a Private Collection · Hazina Nomads",
  description:
    "Build a private sourcing brief from premium Kenyan gifts, travel keepsakes, and heritage pieces, with concierge-guided handoff and export by quote.",
};

export const revalidate = 300;

export default async function BuildPage({
  searchParams,
}: {
  searchParams: { add?: string; category?: string; q?: string };
}) {
  const initialAddIds = searchParams.add ? [searchParams.add] : [];
  const catalog = await getStorefrontCatalog();

  return (
    <SpatialPage className="private-studio">
      <header className="private-studio__intro container-page pt-10 md:pt-16 mb-10 md:mb-14">
        <RevealText>
          <span className="label-mono">Private sourcing brief</span>
        </RevealText>
        <RevealText delay={0.07}>
          <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Curate a Private Collection</h1>
        </RevealText>
        <RevealText delay={0.14}>
          <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
            Choose from premium Kenyan treasures or describe something specific for our concierge to source.
            Your selection becomes a private brief with packaging, handoff, payment, and delivery details confirmed before preparation.
            Prefer a finished edit?{" "}
            <Link href="/collections" className="text-bronze hover:text-obsidian underline-offset-4 hover:underline">
              Explore Collections
            </Link>
            .
          </p>
        </RevealText>
      </header>
      <div className="private-studio__floor container-page pb-20">
        <PackBuilder
          initialAddIds={initialAddIds}
          initialCategory={searchParams.category}
          initialQuery={searchParams.q}
          treasures={catalog.treasures}
        />
      </div>
    </SpatialPage>
  );
}
