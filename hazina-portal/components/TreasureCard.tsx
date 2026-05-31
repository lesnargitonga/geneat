import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import type { Treasure } from "@/lib/treasures";
import { CATEGORY_LABELS } from "@/lib/treasures";
import { formatKES } from "@/lib/format";

type Props = {
  item: Treasure;
  priority?: boolean;
  compact?: boolean;
  featured?: boolean;
};

export function TreasureCard({ item, priority, compact, featured }: Props) {
  return (
    <Link href={`/treasures/${item.id}`} className="group block card-luxury overflow-hidden">
      <div className="relative">
        <CatalogImage
          src={item.image}
          alt={item.imageAlt || item.name}
          className={`${
            featured ? "aspect-[3/4]" : compact ? "aspect-[4/5]" : "aspect-[4/5]"
          }`}
          imageClassName="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          sizes={featured ? "(max-width: 768px) 100vw, 40vw" : "(max-width: 768px) 50vw, 25vw"}
          priority={priority}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute top-4 left-4">
          <span className="chip-dark">{CATEGORY_LABELS[item.category]}</span>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <h3
            className={`font-serif text-obsidian leading-tight group-hover:text-bronze transition-colors ${
              featured ? "text-2xl md:text-3xl" : compact ? "text-lg" : "text-xl md:text-2xl"
            }`}
          >
            {item.name}
          </h3>
          <span className="font-mono text-xs font-medium text-bronze shrink-0 pt-1">{formatKES(item.price_kes)}</span>
        </div>
        {!compact && (
          <p className="text-ink-soft text-sm mt-4 leading-relaxed line-clamp-2">{item.description}</p>
        )}
        <span className="label-mono text-bronze mt-4 inline-block">Inspect treasure →</span>
      </div>
    </Link>
  );
}
