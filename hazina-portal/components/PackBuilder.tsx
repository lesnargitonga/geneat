"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  MIN_CUSTOM_ITEMS,
  PACKAGING_FEE_KES,
  PACKAGING_FEE_USD,
  TREASURES,
  type Treasure,
  type TreasureCategory,
} from "@/lib/treasures";
import { BRAND } from "@/lib/products";
import { formatKES, whatsappLink } from "@/lib/format";

export function PackBuilder({ initialAddIds = [] }: { initialAddIds?: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAddIds));
  const [category, setCategory] = useState<TreasureCategory | "all">("all");
  const [includePackaging, setIncludePackaging] = useState(true);

  const filtered = useMemo(
    () => (category === "all" ? TREASURES : TREASURES.filter((t) => t.category === category)),
    [category],
  );

  const selectedItems = useMemo(
    () => TREASURES.filter((t) => selected.has(t.id)),
    [selected],
  );

  const subtotalKes = selectedItems.reduce((s, t) => s + t.price_kes, 0);
  const packagingKes = includePackaging ? PACKAGING_FEE_KES : 0;
  const totalKes = subtotalKes + packagingKes;
  const totalUsd = selectedItems.reduce((s, t) => s + t.price_usd, 0) + (includePackaging ? PACKAGING_FEE_USD : 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const waMessage = buildWhatsAppMessage(selectedItems, includePackaging, totalKes, totalUsd);
  const canOrder = selected.size >= MIN_CUSTOM_ITEMS;

  return (
    <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
      <div className="lg:col-span-7 space-y-8">
        <div className="flex flex-wrap gap-2">
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
          {filtered.map((item) => (
            <SelectableTreasure
              key={item.id}
              item={item}
              checked={selected.has(item.id)}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </div>
      </div>

      <aside className="lg:col-span-5">
        <div className="sticky top-24 border border-border bg-sand p-6 md:p-8 space-y-6">
          <div>
            <span className="label-mono">Your composition</span>
            <h2 className="font-serif text-3xl text-obsidian mt-2">Build your box</h2>
            <p className="text-ink-mute text-sm mt-2 leading-relaxed">
              Select at least {MIN_CUSTOM_ITEMS} treasures. We assemble, wrap, and deliver — hotel or JKIA.
            </p>
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-ink-mute text-sm italic">Tap items to add them to your box.</p>
          ) : (
            <ul className="space-y-3 max-h-64 overflow-y-auto">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm border-b border-border pb-2">
                  <span className="text-obsidian">{item.name}</span>
                  <span className="font-mono text-xs text-ink-mute shrink-0">{formatKES(item.price_kes)}</span>
                </li>
              ))}
            </ul>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includePackaging}
              onChange={(e) => setIncludePackaging(e.target.checked)}
              className="accent-obsidian"
            />
            <span className="text-sm text-ink-mute">
              Premium packaging &amp; story card (+{formatKES(PACKAGING_FEE_KES)})
            </span>
          </label>

          <div className="border-t border-border pt-4 space-y-1">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-ink-mute">Estimated total</span>
              <span className="text-obsidian">{formatKES(totalKes)}</span>
            </div>
            <div className="flex justify-between font-mono text-xs text-ink-mute">
              <span>USD reference</span>
              <span>${totalUsd}</span>
            </div>
          </div>

          {canOrder ? (
            <a
              href={whatsappLink(BRAND.whatsapp, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-dark w-full"
            >
              Send to concierge
            </a>
          ) : (
            <button type="button" disabled className="btn-dark w-full opacity-40">
              Select {MIN_CUSTOM_ITEMS}+ items
            </button>
          )}

          <p className="label-mono text-center">
            Or{" "}
            <Link href="/collections" className="text-bronze hover:text-obsidian">
              start from a curated collection
            </Link>
          </p>
        </div>
      </aside>
    </div>
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

function SelectableTreasure({
  item,
  checked,
  onToggle,
}: {
  item: Treasure;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left card-luxury overflow-hidden transition-all ${
        checked ? "ring-2 ring-obsidian ring-offset-2 border-obsidian" : ""
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-sand-dark">
        <Image src={item.image} alt={item.imageAlt} fill className="object-cover" sizes="200px" />
        {checked && (
          <div className="absolute inset-0 bg-obsidian/30 flex items-center justify-center">
            <span className="chip-dark">Added</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-serif text-sm text-obsidian leading-tight">{item.name}</p>
        <p className="font-mono text-[10px] text-bronze mt-1">{formatKES(item.price_kes)}</p>
      </div>
    </button>
  );
}

function buildWhatsAppMessage(
  items: Treasure[],
  packaging: boolean,
  totalKes: number,
  totalUsd: number,
): string {
  const lines = [
    "Hello Hazina Nomads — I'd like to build a custom gift box:",
    "",
    ...items.map((t) => `• ${t.name} (${t.sku})`),
  ];
  if (packaging) lines.push("• Premium packaging & story card");
  lines.push("", `Estimated total: KES ${totalKes.toLocaleString("en-KE")} (~USD ${totalUsd})`);
  lines.push("", "Please confirm availability and delivery to my hotel / JKIA.");
  return lines.join("\n");
}
