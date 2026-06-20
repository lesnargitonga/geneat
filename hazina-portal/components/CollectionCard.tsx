"use client";

import Link from "next/link";
import { useState } from "react";
import { CatalogImage } from "@/components/CatalogImage";
import { CollectionQuickView } from "@/components/CollectionQuickView";
import type { GiftBox } from "@/lib/products";
import { BRAND, getCollectionPackaging, getCollectionTreasureItems } from "@/lib/products";
import { TREASURES, type Treasure } from "@/lib/treasures";
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
  className?: string;
  priority?: boolean;
  brandPhone?: string;
  treasures?: Treasure[];
};

function treasureItemsForBox(box: GiftBox, treasures: Treasure[] = TREASURES) {
  const ids = new Set(box.itemIds || []);
  return treasures.filter((item) => ids.has(item.id) && item.category !== "packaging");
}

function packagingForBox(box: GiftBox, treasures: Treasure[] = TREASURES) {
  const ids = new Set(box.itemIds || []);
  return treasures.find((item) => ids.has(item.id) && item.category === "packaging");
}

export function CollectionCard({ box, className = "", priority, brandPhone = BRAND.whatsapp, treasures }: Props) {
  const items = treasures ? treasureItemsForBox(box, treasures) : getCollectionTreasureItems(box);
  const itemCount = items.length;
  const fallbackImage = items.find((t) => t.image)?.image ?? null;
  const heroBackground = fallbackImage
    ? `url("${box.image}"), url("${fallbackImage}")`
    : `url("${box.image}")`;
  const waUrl = whatsappLink(
    brandPhone,
    `Hello Hazina Nomads — I'd like to reserve the ${box.name} collection.`,
  );
  const packaging = treasures ? packagingForBox(box, treasures) : getCollectionPackaging(box);
  const packagingNote = packaging ? `${packaging.name} — ${packaging.description}` : null;
  const [contentsOpen, setContentsOpen] = useState(false);

  return (
    <article
      className={`collection-exhibit group flex flex-col overflow-hidden ${className}`}
      data-cursor="magnetic"
      data-cursor-pull="0.14"
    >
      <button
        type="button"
        onClick={() => setContentsOpen(true)}
        className="collection-exhibit__display block w-full text-left"
        data-cursor="magnetic"
        aria-label={`See what's inside ${box.name}`}
      >
        <div
          className="collection-exhibit__frame relative aspect-[4/3] overflow-hidden bg-sand-dark"
          role="img"
          aria-label={box.imageAlt || box.name}
        >
          <div
            className="collection-exhibit__image-plane absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.035]"
            style={{ backgroundImage: heroBackground }}
            data-priority={priority ? "true" : undefined}
          />
          <span className="collection-exhibit__spotlight" aria-hidden="true" />
          <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
            <span className="chip-dark">{box.lead_time_hours}h lead</span>
            {box.express_departure && <span className="chip-bronze bg-sand/90">Departure ready</span>}
          </div>
          {itemCount > 0 && (
            <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
              <span className="chip-dark bg-black/70">
                {itemCount} treasure{itemCount === 1 ? "" : "s"} inside
              </span>
            </div>
          )}
          <span className="collection-exhibit__peek pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1.5 bg-gradient-to-t from-obsidian/70 to-transparent pb-3 pt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Tap to see what&apos;s inside
          </span>
        </div>
      </button>

      <div className="collection-exhibit__label flex flex-1 flex-col p-5 md:p-6">
        <Link href={`/collections/${box.id}`} data-cursor="magnetic">
          <h2 className="font-serif text-2xl md:text-3xl text-obsidian leading-tight hover:text-bronze transition-colors">
            {box.name}
          </h2>
        </Link>
        <p className="label-mono mt-1">{box.sku}</p>

        <div className="mt-3 pb-4 border-b border-border">
          <p className="font-serif text-2xl md:text-[1.75rem] text-obsidian leading-none">
            {formatUSD(box.price_usd)}
          </p>
          <p className="font-mono text-sm text-ink-mute mt-1 leading-relaxed">
            {formatKES(box.price_kes)}
          </p>
        </div>

        {box.personalization && (
          <p className="label-mono text-bronze mt-2">
            {box.personalization_note || "Personalisation available"}
          </p>
        )}

        <div className="mt-auto pt-5 grid gap-2">
          <Link href={`/collections/${box.id}`} className="btn-dark w-full !px-4 !py-2.5" data-cursor="magnetic">
            View details
          </Link>
          <Link
            href={`/collections/${box.id}#checkout`}
            className="btn-outline w-full !px-4 !py-2.5"
            data-cursor="magnetic"
          >
            Add to box
          </Link>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost w-full !px-4 !py-2.5"
            data-cursor="magnetic"
          >
            Continue on WhatsApp
          </a>
        </div>
      </div>

      <CollectionQuickView
        box={box}
        items={items}
        packagingNote={packagingNote}
        waUrl={waUrl}
        open={contentsOpen}
        onClose={() => setContentsOpen(false)}
      />
    </article>
  );
}

export function CollectionItemsPreview({ box, treasures: liveTreasures }: { box: GiftBox; treasures?: Treasure[] }) {
  const treasures = liveTreasures ? treasureItemsForBox(box, liveTreasures) : getCollectionTreasureItems(box);
  const packaging = liveTreasures ? packagingForBox(box, liveTreasures) : getCollectionPackaging(box);
  if (!treasures.length) return null;

  return (
    <div className="inventory-room space-y-8">
      <div className="inventory-tray">
        {treasures.map((item) => (
          <Link key={item.id} href={`/treasures/${item.id}`} className="inventory-tray__item group">
            <span className="inventory-tray__image">
              <CatalogImage
                src={item.image}
                alt={item.imageAlt || item.name}
                tone="warm"
                fit="contain"
                className="aspect-square"
                sizes="200px"
              />
            </span>
            <span className="inventory-tray__label">
              <span className="font-serif text-base leading-tight text-obsidian">{item.name}</span>
              <span className="mt-1 block font-serif text-base text-obsidian">{formatUSD(item.price_usd)}</span>
              <span className="mt-0.5 block font-mono text-sm text-ink-mute">
                {formatKES(item.price_kes)}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {packaging && (
        <p className="inventory-room__packaging max-w-2xl border-t border-border pt-6 text-sm leading-relaxed text-ink-mute">
          <span className="label-mono text-ink-soft block mb-1">Also included</span>
          {packaging.name} — {packaging.description}
        </p>
      )}
    </div>
  );
}
