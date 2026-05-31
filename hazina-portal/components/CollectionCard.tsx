import Image from "next/image";
import Link from "next/link";
import type { GiftBox } from "@/lib/products";
import { BRAND } from "@/lib/products";
import { getTreasuresByIds } from "@/lib/treasures";
import { formatKES, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
  className?: string;
  priority?: boolean;
};

export function CollectionCard({ box, className = "", priority }: Props) {
  const wa = whatsappLink(BRAND.whatsapp, `Hi — I'd like to reserve ${box.name}`);
  const itemCount = box.itemIds?.length ?? 0;

  return (
    <article
      className={`group flex flex-col card-luxury overflow-hidden ${className}`}
    >
      <Link href={`/collections/${box.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-sand-dark">
          <Image
            src={box.image}
            alt={box.imageAlt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
            priority={priority}
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className="chip-dark">{box.lead_time_hours}h lead</span>
            {box.jkia_only && <span className="chip-bronze bg-sand/90">JKIA express</span>}
          </div>
          {itemCount > 0 && (
            <div className="absolute bottom-4 left-4">
              <span className="chip-dark bg-obsidian/70">{itemCount} treasures inside</span>
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
          <div className="text-right shrink-0">
            <div className="font-mono text-sm text-obsidian">{formatKES(box.price_kes)}</div>
            <div className="font-mono text-xs text-ink-mute">USD {box.price_usd}</div>
          </div>
        </div>

        <p className="text-ink-mute text-sm mt-4 leading-relaxed line-clamp-2">{box.contents}</p>

        {box.personalization && (
          <p className="label-mono text-bronze mt-2">
            {box.personalization_note || "Personalisation available"}
          </p>
        )}

        <div className="flex flex-wrap gap-3 mt-6">
          <Link href={`/collections/${box.id}`} className="btn-outline">
            See inside
          </Link>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            Reserve as-is
          </a>
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
          <div className="relative aspect-square overflow-hidden bg-sand-dark mb-3">
            <Image
              src={item.image}
              alt={item.imageAlt}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="200px"
            />
          </div>
          <p className="font-serif text-sm text-obsidian">{item.name}</p>
          <p className="font-mono text-[10px] text-ink-mute mt-0.5">{formatKES(item.price_kes)}</p>
        </Link>
      ))}
    </div>
  );
}
