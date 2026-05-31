import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import type { GiftBox } from "@/lib/products";
import { getTreasuresByIds } from "@/lib/treasures";
import { formatDualPrice, formatUSD } from "@/lib/format";

type Props = {
  box: GiftBox;
  className?: string;
  priority?: boolean;
};

export function CollectionCard({ box, className = "", priority }: Props) {
  const itemCount = box.itemIds?.length ?? 0;

  return (
    <article
      className={`group flex flex-col card-luxury overflow-hidden ${className}`}
    >
      <Link href={`/collections/${box.id}`} className="block">
        <div className="relative">
          <CatalogImage
            src={box.image}
            alt={box.imageAlt || box.name}
            className="aspect-[5/4] sm:aspect-[4/5]"
            imageClassName="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
            priority={priority}
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className="chip-dark">{box.lead_time_hours}h lead</span>
            {box.jkia_only && <span className="chip-bronze bg-sand/90">JKIA express</span>}
          </div>
          {itemCount > 0 && (
            <div className="absolute bottom-4 left-4">
              <span className="chip-dark bg-black/70">{itemCount} treasures inside</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col flex-1 p-5 md:p-6">
        <div className="flex items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <Link href={`/collections/${box.id}`}>
              <h2 className="font-serif text-2xl md:text-3xl text-obsidian leading-tight hover:text-bronze transition-colors">
                {box.name}
              </h2>
            </Link>
            <p className="label-mono mt-1">{box.sku}</p>
          </div>
          <div className="text-right shrink-0 rounded-sm border border-border bg-sand-dark/60 px-3 py-2">
            <div className="font-mono text-base md:text-lg font-semibold text-obsidian">{formatUSD(box.price_usd)}</div>
            <div className="font-mono text-sm text-ink-soft">KES {box.price_kes.toLocaleString("en-KE")}</div>
          </div>
        </div>

        <p className="text-ink-soft text-sm mt-4 leading-relaxed line-clamp-2">{box.contents}</p>

        {box.personalization && (
          <p className="label-mono text-bronze mt-2">
            {box.personalization_note || "Personalisation available"}
          </p>
        )}

        <div className="flex flex-wrap gap-3 mt-6">
          <Link href={`/collections/${box.id}`} className="btn-outline">
            View details
          </Link>
          <Link href={`/collections/${box.id}#checkout`} className="btn-ghost">
            Start checkout
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CollectionItemsPreview({ box }: { box: GiftBox }) {
  const items = getTreasuresByIds(box.itemIds ?? []);
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {items.map((item) => (
        <Link key={item.id} href={`/treasures/${item.id}`} className="group">
          <CatalogImage
            src={item.image}
            alt={item.imageAlt || item.name}
            className="aspect-square mb-3"
            imageClassName="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="200px"
          />
          <p className="font-serif text-base leading-tight text-obsidian">{item.name}</p>
          <p className="font-mono text-sm text-ink-mute mt-1">{formatDualPrice(item.price_usd, item.price_kes)}</p>
        </Link>
      ))}
    </div>
  );
}
