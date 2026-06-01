import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import type { Treasure } from "@/lib/treasures";
import { CATEGORY_LABELS } from "@/lib/treasures";
import { formatUSD } from "@/lib/format";

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
            featured ? "aspect-[3/4]" : compact ? "aspect-[4/3] sm:aspect-[4/5]" : "aspect-[4/3] sm:aspect-[4/5]"
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
        <h3
          className={`font-serif text-obsidian leading-tight group-hover:text-bronze transition-colors ${
            featured ? "text-2xl md:text-3xl" : compact ? "text-lg" : "text-xl md:text-2xl"
          }`}
        >
          {item.name}
        </h3>
        <div className="mt-3 pb-4 border-b border-border">
          <p
            className={`font-serif text-obsidian leading-none ${
              featured ? "text-2xl" : "text-xl"
            }`}
          >
            {formatUSD(item.price_usd)}
          </p>
          <p className="font-mono text-sm text-ink-mute mt-1">
            KES {item.price_kes.toLocaleString("en-KE")}
          </p>
        </div>
        {!compact && (
          <div className="mt-4 max-h-24 local-scroll">
            <p className="text-ink-soft text-sm leading-relaxed">{item.description}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
