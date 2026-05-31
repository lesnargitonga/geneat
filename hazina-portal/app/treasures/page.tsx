import type { Metadata } from "next";
import Link from "next/link";
import { ALL_CATEGORIES, CATEGORY_LABELS, TREASURES } from "@/lib/treasures";
import { TreasureCard } from "@/components/TreasureCard";

export const metadata: Metadata = {
  title: "Treasures · Hazina Nomads",
  description:
    "Browse individual Kenyan treasures — coffee, beadwork, leather, carvings, textiles — and build your own gift box.",
};

export default function TreasuresPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const cat = searchParams.category;
  const items =
    cat && ALL_CATEGORIES.includes(cat as (typeof ALL_CATEGORIES)[number])
      ? TREASURES.filter((t) => t.category === cat)
      : TREASURES;

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

      <div className="container-page mb-8">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/treasures"
            className={`chip ${!cat ? "bg-obsidian text-sand" : "border border-border text-ink-mute hover:border-obsidian"}`}
          >
            All
          </Link>
          {ALL_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/treasures?category=${c}`}
              className={`chip ${
                cat === c ? "bg-obsidian text-sand" : "border border-border text-ink-mute hover:border-obsidian"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
        </div>
      </div>

      <div className="container-page pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {items.map((item, i) => (
            <TreasureCard key={item.id} item={item} priority={i < 3} />
          ))}
        </div>
      </div>
    </>
  );
}
