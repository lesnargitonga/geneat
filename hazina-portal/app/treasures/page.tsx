import type { Metadata } from "next";
import Link from "next/link";
import { TreasureExplorer } from "@/components/TreasureExplorer";
import { TREASURES } from "@/lib/treasures";

export const metadata: Metadata = {
  title: "Treasures · Hazina Nomads",
  description:
    "Browse individual Kenyan treasures — coffee, beadwork, leather, carvings, textiles — and build your own gift box.",
};

export default function TreasuresPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  return (
    <>
      <header className="container-page pt-10 md:pt-16 mb-10 md:mb-14">
        <span className="label-mono">{TREASURES.length} individual treasures</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">The Atelier</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Every piece is photographed as we source it — not stock imagery. Tap any treasure to
          see its story, then add it to a custom box or start from a curated collection.
        </p>
        <div className="mt-8">
          <Link href="/build" className="btn-dark">
            Build your box
          </Link>
        </div>
      </header>

      <div className="container-page pb-20">
        <TreasureExplorer initialCategory={searchParams.category} initialQuery={searchParams.q} />
      </div>
    </>
  );
}
