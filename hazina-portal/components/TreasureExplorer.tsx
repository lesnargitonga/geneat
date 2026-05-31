"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CatalogImage } from "@/components/CatalogImage";
import { BRAND } from "@/lib/products";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  TREASURES,
  type Treasure,
  type TreasureCategory,
} from "@/lib/treasures";
import { formatDualPrice, whatsappLink } from "@/lib/format";

type SortMode = "curated" | "price-low" | "price-high" | "fastest";

export function TreasureExplorer({
  initialCategory,
  initialQuery,
}: {
  initialCategory?: string;
  initialQuery?: string;
}) {
  const validInitialCategory =
    initialCategory && ALL_CATEGORIES.includes(initialCategory as TreasureCategory)
      ? (initialCategory as TreasureCategory)
      : "all";
  const [query, setQuery] = useState(initialQuery || "");
  const [category, setCategory] = useState<TreasureCategory | "all">(validInitialCategory);
  const [sort, setSort] = useState<SortMode>("curated");
  const [readyToday, setReadyToday] = useState(false);
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = TREASURES.map((item, index) => ({ item, index })).filter(({ item }) => {
      if (category !== "all" && item.category !== category) return false;
      if (readyToday && (item.lead_time_hours || 48) > 24) return false;
      if (withPhotosOnly && !item.image) return false;
      if (!q) return true;
      const haystack = [
        item.name,
        item.sku,
        item.description,
        item.origin || "",
        CATEGORY_LABELS[item.category],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    return scored
      .sort((a, b) => {
        if (sort === "price-low") return a.item.price_kes - b.item.price_kes;
        if (sort === "price-high") return b.item.price_kes - a.item.price_kes;
        if (sort === "fastest") return (a.item.lead_time_hours || 99) - (b.item.lead_time_hours || 99);
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [category, query, readyToday, sort, withPhotosOnly]);

  return (
    <div className="space-y-8">
      <section className="panel-luxury p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr,180px,160px] md:items-center">
          <label className="block">
            <span className="sr-only">Search treasures</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-luxury"
              placeholder="Search coffee, leather, JKIA..."
            />
          </label>
          <label className="block">
            <span className="sr-only">Sort treasures</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="input-luxury"
            >
              <option value="curated">Curated order</option>
              <option value="price-low">Price low to high</option>
              <option value="price-high">Price high to low</option>
              <option value="fastest">Fastest lead time</option>
            </select>
          </label>
          <Link href="/build" className="btn-dark w-full">
            Build box
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")} label="All" />
          {ALL_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={CATEGORY_LABELS[c]}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Toggle
              checked={readyToday}
              onClick={() => setReadyToday((v) => !v)}
              label="Ready in 24h"
            />
            <Toggle
              checked={withPhotosOnly}
              onClick={() => setWithPhotosOnly((v) => !v)}
              label="With photos"
            />
          </div>
          <p className="label-mono">{results.length} matching treasures</p>
        </div>
      </section>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {results.map((item, i) => (
            <TreasureResult key={item.id} item={item} priority={i < 3} />
          ))}
        </div>
      ) : (
        <div className="panel-luxury p-8 text-center">
          <h2 className="font-serif text-3xl text-obsidian">No exact match yet</h2>
          <p className="text-ink-mute mt-2">
            Try a broader search or ask the concierge to source it for you.
          </p>
          <a
            href={whatsappLink(BRAND.whatsapp, `Hello Hazina Nomads — can you source ${query || "a specific Kenyan gift"} for me?`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-dark mt-5"
          >
            Ask concierge
          </a>
        </div>
      )}
    </div>
  );
}

function TreasureResult({ item, priority }: { item: Treasure; priority?: boolean }) {
  const wa = whatsappLink(
    BRAND.whatsapp,
    `Hi Hazina Nomads — I'd like to ask about ${item.name} (${item.sku}).`,
  );

  return (
    <article className="group card-luxury overflow-hidden flex flex-col">
      <Link href={`/treasures/${item.id}`} className="block">
        <CatalogImage
          src={item.image}
          alt={item.imageAlt || item.name}
          className="aspect-[4/3] sm:aspect-[4/5]"
          imageClassName="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={priority}
        />
      </Link>
      <div className="p-5 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/treasures/${item.id}`} className="font-serif text-xl text-obsidian hover:text-bronze transition-colors">
              {item.name}
            </Link>
            <p className="label-mono mt-1">{CATEGORY_LABELS[item.category]} · {item.sku}</p>
          </div>
          <span className="font-mono text-sm text-bronze shrink-0 pt-1 text-right leading-relaxed">
            {formatDualPrice(item.price_usd, item.price_kes)}
          </span>
        </div>
        <p className="text-sm text-ink-mute leading-relaxed mt-4 line-clamp-2">{item.description}</p>
        <div className="mt-auto pt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Link href={`/build?add=${item.id}`} className="btn-dark !px-4 !py-2 w-full">
            Add to box
          </Link>
          <Link href={`/treasures/${item.id}`} className="btn-outline !px-4 !py-2 w-full">
            View details
          </Link>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-4 !py-2 w-full">
            Ask concierge
          </a>
        </div>
      </div>
    </article>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip transition-colors ${
        active ? "bg-obsidian text-sand" : "border border-border text-ink-mute hover:border-obsidian"
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip border transition-colors ${
        checked
          ? "border-obsidian bg-obsidian text-sand"
          : "border-border text-ink-mute hover:border-obsidian"
      }`}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}
