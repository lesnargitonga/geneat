import type { Metadata } from "next";
import { PackBuilder } from "@/components/PackBuilder";
import { TrustRow } from "@/components/TrustRow";

export const metadata: Metadata = {
  title: "Build Your Box · Hazina Nomads",
  description: "Compose a custom Kenyan gift box from our treasure atelier — we wrap, deliver locally, or quote insured DHL export.",
};

export default function BuildPage({
  searchParams,
}: {
  searchParams: { add?: string };
}) {
  const initialAddIds = searchParams.add ? [searchParams.add] : [];

  return (
    <>
      <header className="container-page pt-10 md:pt-16 mb-10 md:mb-14">
        <span className="label-mono">Custom composition</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Build your box</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Select the treasures that speak to your journey. We handle assembly, premium packaging,
          hotel delivery, JKIA handoff, and insured export quotes — with the discretion of a boutique concierge.
        </p>
        <TrustRow className="mt-8 max-w-3xl" />
      </header>
      <div className="container-page pb-20">
        <PackBuilder initialAddIds={initialAddIds} />
      </div>
    </>
  );
}
