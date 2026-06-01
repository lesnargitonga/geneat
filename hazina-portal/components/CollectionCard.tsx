import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import type { GiftBox } from "@/lib/products";
import { BRAND } from "@/lib/products";
import { getTreasuresByIds } from "@/lib/treasures";
import { formatUSD, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
  className?: string;
  priority?: boolean;
};

export function CollectionCard({ box, className = "", priority }: Props) {
  const itemCount = box.itemIds?.length ?? 0;
  const waUrl = whatsappLink(
    BRAND.whatsapp,
    `Hello Hazina Nomads — I'd like to reserve the ${box.name} collection.`
  );

  return (
    <article
      className={`group flex flex-col card-luxury overflow-hidden ${className}`}
    >
      <Link href={`/collections/${box.id}`} className="block">
        <div className="relative">
          <CatalogImage
            src={box.image}
            alt={box.imageAlt || box.name}
            className="aspect-[4/3] bg-sand-dark"
            imageClassName="object-contain transition-transform duration-700 group-hover:scale-[1.02]"
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
        <Link href={`/collections/${box.id}`}>
          <h2 className="font-serif text-2xl md:text-3xl text-obsidian leading-tight hover:text-bronze transition-colors">
            {box.name}
          </h2>
        </Link>
        <p className="label-mono mt-1">{box.sku}</p>

        <div className="mt-3 pb-4 border-b border-border">
          <p className="font-serif text-2xl md:text-[1.75rem] text-obsidian leading-none">
            {formatUSD(box.price_usd)}
          </p>
          <p className="font-mono text-sm text-ink-mute mt-1">
            KES {box.price_kes.toLocaleString("en-KE")}
          </p>
        </div>

        {box.personalization && (
          <p className="label-mono text-bronze mt-2">
            {box.personalization_note || "Personalisation available"}
          </p>
        )}

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto pt-5 font-mono text-sm text-bronze underline-offset-4 hover:underline"
        >
          Reserve via WhatsApp
        </a>
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
          <p className="font-serif text-base text-obsidian mt-1">{formatUSD(item.price_usd)}</p>
          <p className="font-mono text-xs text-ink-mute mt-0.5">
            KES {item.price_kes.toLocaleString("en-KE")}
          </p>
        </Link>
      ))}
    </div>
  );
}
