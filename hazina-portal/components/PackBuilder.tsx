"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CatalogImage } from "@/components/CatalogImage";
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
import { formatDualPrice, whatsappLink } from "@/lib/format";

type DeliveryMode = "hotel" | "jkia" | "international";

export function PackBuilder({ initialAddIds = [] }: { initialAddIds?: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialAddIds.filter((id) => TREASURES.some((t) => t.id === id))),
  );
  const [category, setCategory] = useState<TreasureCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"curated" | "price-low" | "price-high" | "fastest">("curated");
  const [includePackaging, setIncludePackaging] = useState(true);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("hotel");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "KES">("USD");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TREASURES.map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (category !== "all" && item.category !== category) return false;
        if (!q) return true;
        return [
          item.name,
          item.sku,
          item.description,
          item.origin || "",
          CATEGORY_LABELS[item.category],
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (sort === "price-low") return a.item.price_kes - b.item.price_kes;
        if (sort === "price-high") return b.item.price_kes - a.item.price_kes;
        if (sort === "fastest") return (a.item.lead_time_hours || 99) - (b.item.lead_time_hours || 99);
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [category, query, sort]);

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

  const checkoutMessage = buildWhatsAppMessage({
    items: selectedItems,
    packaging: includePackaging,
    totalKes,
    totalUsd,
    deliveryMode,
    deliveryLocation,
    deliveryWindow,
    customerName,
    contact,
    paymentCurrency,
  });
  const canOrder = selected.size >= MIN_CUSTOM_ITEMS;
  const canCheckout =
    canOrder &&
    deliveryLocation.trim().length >= 6 &&
    deliveryWindow.trim().length >= 3 &&
    contact.trim().length >= 5;

  const startAutomatedCheckout = () => {
    if (!canCheckout) return;
    window.dispatchEvent(new CustomEvent("hazina:chat-prompt", { detail: { prompt: checkoutMessage } }));
    window.location.hash = "chat";
  };

  return (
    <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
      <div className="lg:col-span-7 space-y-8">
        <div className="panel-luxury p-4 md:p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,180px]">
            <label>
              <span className="sr-only">Search treasures for your custom box</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-luxury"
                placeholder="Search by item, SKU, material, origin..."
              />
            </label>
            <label>
              <span className="sr-only">Sort custom box items</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="input-luxury"
              >
                <option value="curated">Curated order</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="fastest">Fastest lead time</option>
              </select>
            </label>
          </div>

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

          <p className="label-mono">{filtered.length} available treasures · {selected.size} selected</p>
        </div>

        {filtered.length > 0 ? (
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
        ) : (
          <div className="panel-luxury p-8 text-center">
            <h2 className="font-serif text-2xl text-obsidian">Nothing matches that filter</h2>
            <p className="text-sm text-ink-mute mt-2">
              Clear your search or ask the concierge to source a special item.
            </p>
          </div>
        )}
      </div>

      <aside className="lg:col-span-5">
        <div className="lg:sticky lg:top-24 border border-border bg-sand p-6 md:p-8 space-y-6">
          <div>
            <span className="label-mono">Your composition</span>
            <h2 className="font-serif text-3xl text-obsidian mt-2">Build your box</h2>
            <p className="text-ink-mute text-sm mt-2 leading-relaxed">
              Select at least {MIN_CUSTOM_ITEMS} treasures. We assemble, wrap, and deliver — hotel, JKIA, or DHL export quote.
            </p>
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-ink-mute text-sm italic">Tap items to add them to your box.</p>
          ) : (
            <ul className="space-y-3 max-h-64 overflow-y-auto">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm border-b border-border pb-2">
                  <span className="text-obsidian">{item.name}</span>
                  <span className="font-mono text-sm text-ink-mute shrink-0 text-right">
                    {formatDualPrice(item.price_usd, item.price_kes)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {selectedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="label-mono text-left text-bronze hover:text-obsidian"
            >
              Clear selection
            </button>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includePackaging}
              onChange={(e) => setIncludePackaging(e.target.checked)}
              className="accent-obsidian"
            />
            <span className="text-sm text-ink-mute">
              Premium packaging &amp; story card (+{formatDualPrice(PACKAGING_FEE_USD, PACKAGING_FEE_KES)})
            </span>
          </label>

          <div className="border-t border-border pt-4 space-y-1">
            <div className="flex justify-between gap-4 font-mono text-sm">
              <span className="text-ink-mute">Estimated total</span>
              <span className="text-obsidian text-right">{formatDualPrice(totalUsd, totalKes)}</span>
            </div>
            <p className="text-xs text-ink-mute leading-relaxed">
              USD card is default for travellers; choose KES if you want M-Pesa STK.
            </p>
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <div>
              <span className="label-mono">Checkout workflow</span>
              <p className="text-sm text-ink-mute mt-1 leading-relaxed">
                Complete these details and the AI checkout will create the order instead of sending a vague handoff.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("hotel")}
                className={`chip justify-center border ${deliveryMode === "hotel" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
              >
                Hotel
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("jkia")}
                className={`chip justify-center border ${deliveryMode === "jkia" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
              >
                JKIA
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("international")}
                className={`chip justify-center border ${deliveryMode === "international" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
              >
                DHL
              </button>
            </div>

            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-luxury"
              placeholder="Your name"
            />
            <input
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="input-luxury"
              placeholder={deliveryLocationPlaceholder(deliveryMode)}
            />
            <input
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              className="input-luxury"
              placeholder={deliveryWindowPlaceholder(deliveryMode)}
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="input-luxury"
              placeholder={paymentCurrency === "USD" ? "Email or WhatsApp for checkout link" : "M-Pesa phone number"}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentCurrency("USD")}
                className={`chip justify-center border ${paymentCurrency === "USD" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
              >
                USD card
              </button>
              <button
                type="button"
                onClick={() => setPaymentCurrency("KES")}
                className={`chip justify-center border ${paymentCurrency === "KES" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
              >
                KES M-Pesa
              </button>
            </div>
          </div>

          {canCheckout ? (
            <button type="button" onClick={startAutomatedCheckout} className="btn-dark w-full">
              Start automated checkout
            </button>
          ) : (
            <button type="button" disabled className="btn-dark w-full opacity-40">
              {canOrder ? "Complete delivery details" : `Select ${MIN_CUSTOM_ITEMS}+ items`}
            </button>
          )}

          {canOrder ? (
            <a
              href={whatsappLink(BRAND.whatsapp, checkoutMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline w-full"
            >
              Continue in WhatsApp
            </a>
          ) : (
            <button type="button" disabled className="btn-outline w-full opacity-40">
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
      <div className="relative">
        <CatalogImage
          src={item.image}
          alt={item.imageAlt || item.name}
          className="aspect-square"
          sizes="200px"
        />
        {checked && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="chip-dark">Added</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-serif text-base text-obsidian leading-tight">{item.name}</p>
        <p className="font-mono text-sm text-bronze mt-1">{formatDualPrice(item.price_usd, item.price_kes)}</p>
      </div>
    </button>
  );
}

function buildWhatsAppMessage({
  items,
  packaging,
  totalKes,
  totalUsd,
  deliveryMode,
  deliveryLocation,
  deliveryWindow,
  customerName,
  contact,
  paymentCurrency,
}: {
  items: Treasure[];
  packaging: boolean;
  totalKes: number;
  totalUsd: number;
  deliveryMode: DeliveryMode;
  deliveryLocation: string;
  deliveryWindow: string;
  customerName: string;
  contact: string;
  paymentCurrency: "USD" | "KES";
}): string {
  const lines = [
    "Hello Hazina Nomads — automated custom gift box checkout:",
    "",
    ...items.map((t) => `• ${t.name} (${t.sku})`),
  ];
  if (packaging) lines.push("• Premium packaging & story card");
  lines.push("", `Estimated total: USD ${totalUsd.toLocaleString("en-US")} / KES ${totalKes.toLocaleString("en-KE")}`);
  if (customerName.trim()) lines.push(`Guest: ${customerName.trim()}`);
  lines.push(`Delivery type: ${deliveryTypeLabel(deliveryMode)}`);
  if (deliveryLocation.trim()) lines.push(`Delivery location: ${deliveryLocation.trim()}`);
  if (deliveryWindow.trim()) lines.push(`Delivery window: ${deliveryWindow.trim()}`);
  if (contact.trim()) lines.push(`Contact/payment detail: ${contact.trim()}`);
  lines.push(`Preferred payment: ${paymentCurrency === "USD" ? "USD card link" : "KES M-Pesa STK"}`);
  lines.push(
    "",
    deliveryMode === "international"
      ? "Please confirm availability, quote insured DHL/export shipping before payment, then start checkout."
      : "Please create the order, confirm availability, and start payment.",
  );
  return lines.join("\n");
}

function deliveryTypeLabel(mode: DeliveryMode): string {
  if (mode === "jkia") return "JKIA terminal handoff";
  if (mode === "international") return "DHL/export shipping quote";
  return "Hotel delivery";
}

function deliveryLocationPlaceholder(mode: DeliveryMode): string {
  if (mode === "jkia") return "Terminal + meeting point";
  if (mode === "international") return "Country, city, full delivery address";
  return "Hotel + room / front desk";
}

function deliveryWindowPlaceholder(mode: DeliveryMode): string {
  if (mode === "jkia") return "Flight / departure time";
  if (mode === "international") return "Needed by date + courier notes";
  return "Preferred delivery window";
}
