import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import type { GiftBox } from "@/lib/products";
import { BRAND, getCollectionPackaging, getCollectionTreasureItems } from "@/lib/products";
import { formatUSD, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
  className?: string;
  priority?: boolean;
};

export function CollectionCard({ box, className = "", priority }: Props) {
  const treasures = getCollectionTreasureItems(box);
  const itemCount = treasures.length;
  const fallbackImage = treasures.find((t) => t.image)?.image ?? null;
  const waUrl = whatsappLink(
    BRAND.whatsapp,
    `Hello Hazina Nomads — I'd like to reserve the ${box.name} collection.`,
  );

  return (
    <article
      className={`group flex flex-col card-luxury overflow-hidden ${className}`}
    >
      <Link href={`/collections/${box.id}`} className="block">
        <div className="relative aspect-[4/3] catalog-photo-frame">
          <CatalogImage
            src={box.image}
            fallbackSrc={fallbackImage}
            alt={box.imageAlt || box.name}
            tone="warm"
            fit="contain"
            className="absolute inset-0"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
            priority={priority}
          />
          <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
            <span className="chip-dark">{box.lead_time_hours}h lead</span>
            {box.jkia_only && <span className="chip-bronze bg-sand/90">JKIA express</span>}
          </div>
          {itemCount > 0 && (
            <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
              <span className="chip-dark bg-black/70">
                {itemCount} treasure{itemCount === 1 ? "" : "s"} inside
              </span>
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
  const treasures = getCollectionTreasureItems(box);
  const packaging = getCollectionPackaging(box);
  if (!treasures.length) return null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {treasures.map((item) => (
          <Link key={item.id} href={`/treasures/${item.id}`} className="group">
            <CatalogImage
              src={item.image}
              alt={item.imageAlt || item.name}
              tone="warm"
              fit="contain"
              className="aspect-square mb-3"
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
      {packaging && (
        <p className="text-sm text-ink-mute border-t border-border pt-6 max-w-2xl leading-relaxed">
          <span className="label-mono text-ink-soft block mb-1">Also included</span>
          {packaging.name} — {packaging.description}
        </p>
      )}
    </div>
  );
}
