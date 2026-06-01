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
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";

type DeliveryMode = "hotel" | "jkia" | "international";

const BUILDABLE_TREASURES = TREASURES.filter((t) => t.category !== "packaging");

export function PackBuilder({
  initialAddIds = [],
  initialCategory,
  initialQuery = "",
}: {
  initialAddIds?: string[];
  initialCategory?: string;
  initialQuery?: string;
}) {
  const validInitialCategory =
    initialCategory && ALL_CATEGORIES.includes(initialCategory as TreasureCategory)
      ? (initialCategory as TreasureCategory)
      : "all";

  const [cart, setCart] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const id of initialAddIds) {
      if (BUILDABLE_TREASURES.some((t) => t.id === id)) m.set(id, 1);
    }
    return m;
  });
  const [category, setCategory] = useState<TreasureCategory | "all">(validInitialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<"curated" | "price-low" | "price-high" | "fastest">("curated");
  const [includePackaging, setIncludePackaging] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"browse" | "delivery">("browse");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("hotel");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "KES">("USD");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILDABLE_TREASURES.map((item, index) => ({ item, index }))
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

  const cartLines = useMemo(() => {
    return BUILDABLE_TREASURES.filter((t) => (cart.get(t.id) ?? 0) > 0).map((item) => ({
      item,
      qty: cart.get(item.id) ?? 0,
    }));
  }, [cart]);

  const totalUnits = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.qty, 0),
    [cartLines],
  );

  const subtotalUsd = cartLines.reduce((s, { item, qty }) => s + item.price_usd * qty, 0);
  const subtotalKes = cartLines.reduce((s, { item, qty }) => s + item.price_kes * qty, 0);
  const packagingUsd = includePackaging ? PACKAGING_FEE_USD : 0;
  const packagingKes = includePackaging ? PACKAGING_FEE_KES : 0;
  const totalUsd = subtotalUsd + packagingUsd;
  const totalKes = subtotalKes + packagingKes;

  const setQty = (id: string, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
  };

  const toggle = (id: string) => {
    const qty = cart.get(id) ?? 0;
    setQty(id, qty > 0 ? 0 : 1);
  };

  const increment = (id: string) => setQty(id, (cart.get(id) ?? 0) + 1);
  const decrement = (id: string) => setQty(id, (cart.get(id) ?? 0) - 1);

  const checkoutMessage = buildWhatsAppMessage({
    items: cartLines,
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

  const canOrder = totalUnits >= MIN_CUSTOM_ITEMS;
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

  const validationHints: string[] = [];
  if (!canOrder) validationHints.push(`Choose ${MIN_CUSTOM_ITEMS} or more treasures`);
  if (checkoutStep === "delivery") {
    if (deliveryLocation.trim().length < 6) {
      validationHints.push(`Delivery location: ${deliveryLocationPlaceholder(deliveryMode)}`);
    }
    if (deliveryWindow.trim().length < 3) {
      validationHints.push(`Delivery window: ${deliveryWindowPlaceholder(deliveryMode)}`);
    }
    if (contact.trim().length < 5) {
      validationHints.push(
        paymentCurrency === "USD" ? "Contact: email or WhatsApp for checkout link" : "Contact: M-Pesa phone number",
      );
    }
  }

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
                className="input-soft"
                placeholder="Search by item, SKU, material, origin..."
              />
            </label>
            <label>
              <span className="sr-only">Sort custom box items</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="input-soft"
              >
                <option value="curated">Curated order</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="fastest">Fastest lead time</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="label-mono shrink-0 text-ink-mute">Category</span>
            <div className="-mx-1 flex-1 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-5 px-1">
                <CategoryLink active={category === "all"} onClick={() => setCategory("all")} label="All" />
                {ALL_CATEGORIES.filter((c) => c !== "packaging").map((c) => (
                  <CategoryLink
                    key={c}
                    active={category === c}
                    onClick={() => setCategory(c)}
                    label={CATEGORY_LABELS[c]}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="label-mono">
            {filtered.length} available · {totalUnits} in your box
            {cartLines.length > 0 ? ` (${cartLines.length} treasures)` : ""}
          </p>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
            {filtered.map((item) => (
              <SelectableTreasure
                key={item.id}
                item={item}
                qty={cart.get(item.id) ?? 0}
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
        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto border border-border bg-sand p-6 md:p-8 space-y-6">
          <div>
            <span className="label-mono">Your box</span>
            <h2 className="font-serif text-3xl text-obsidian mt-2">
              {checkoutStep === "browse" ? "Choose treasures" : "Delivery details"}
            </h2>
            <p className="text-ink-mute text-sm mt-2 leading-relaxed">
              {checkoutStep === "browse"
                ? "Add items until you meet the minimum, then proceed to delivery."
                : "Confirm where and when we should deliver, then checkout."}
            </p>
          </div>

          {checkoutStep === "browse" && (
            <>
              {cartLines.length === 0 ? (
                <p className="text-ink-mute text-sm italic">Tap items to add them to your box.</p>
              ) : (
                <ul className="space-y-3 max-h-64 overflow-y-auto local-scroll">
                  {cartLines.map(({ item, qty }) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/60 pb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-obsidian truncate">{item.name}</span>
                        <div className="inline-flex items-center shrink-0">
                          <button
                            type="button"
                            onClick={() => decrement(item.id)}
                            className="px-2 py-1 font-mono text-sm text-ink-mute hover:text-obsidian"
                            aria-label={`Decrease quantity for ${item.name}`}
                          >
                            −
                          </button>
                          <span className="px-2 py-1 font-mono text-sm min-w-[2ch] text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => increment(item.id)}
                            className="px-2 py-1 font-mono text-sm text-ink-mute hover:text-obsidian"
                            aria-label={`Increase quantity for ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-ink-mute shrink-0 text-right leading-relaxed">
                        {formatUSD(item.price_usd * qty)}
                        <br />
                        {formatKES(item.price_kes * qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {cartLines.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart(new Map());
                    setIncludePackaging(false);
                  }}
                  className="label-mono text-left text-bronze hover:text-obsidian"
                >
                  Clear selection
                </button>
              )}

              <label className="flex items-start gap-3 cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={includePackaging}
                  onChange={(e) => setIncludePackaging(e.target.checked)}
                  className="mt-1 accent-bronze"
                />
                <span className="text-sm text-ink-mute leading-relaxed">
                  Premium gift box &amp; story card — {formatUSD(PACKAGING_FEE_USD)}
                  <span className="block font-mono text-xs text-ink-mute/80 mt-0.5">
                    {formatKES(PACKAGING_FEE_KES)}
                  </span>
                </span>
              </label>

              <div className="border-t border-border/60 pt-4 space-y-1">
                <div className="flex justify-between gap-4 items-baseline">
                  <span className="label-mono text-ink-mute">Estimated total</span>
                  <div className="text-right">
                    <p className="font-serif text-2xl text-obsidian leading-none">{formatUSD(totalUsd)}</p>
                    <p className="font-mono text-sm text-ink-mute mt-1">{formatKES(totalKes)}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!canOrder}
                onClick={() => setCheckoutStep("delivery")}
                className="btn-dark w-full disabled:opacity-40"
              >
                {canOrder ? "Enter delivery details" : `Select ${MIN_CUSTOM_ITEMS}+ treasures`}
              </button>

              {canOrder && (
                <a
                  href={whatsappLink(BRAND.whatsapp, checkoutMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center font-mono text-sm text-bronze underline-offset-4 hover:underline"
                >
                  Or continue in WhatsApp
                </a>
              )}
            </>
          )}

          {checkoutStep === "delivery" && (
            <>
              <div className="rounded-sm bg-sand-dark/50 p-4 space-y-2 text-sm">
                <p className="label-mono text-ink-mute">Order summary</p>
                <p className="font-serif text-xl text-obsidian">{formatUSD(totalUsd)}</p>
                <p className="font-mono text-xs text-ink-mute">{formatKES(totalKes)}</p>
                <p className="text-ink-mute text-xs mt-1">
                  {totalUnits} treasures
                  {includePackaging ? " · premium packaging" : ""}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  {(["hotel", "jkia", "international"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDeliveryMode(mode)}
                      className={`font-mono text-xs uppercase tracking-[0.1em] pb-1 border-b-2 transition-colors ${
                        deliveryMode === mode
                          ? "border-obsidian text-obsidian"
                          : "border-transparent text-ink-mute hover:text-obsidian"
                      }`}
                    >
                      {mode === "hotel" ? "Hotel" : mode === "jkia" ? "JKIA" : "DHL"}
                    </button>
                  ))}
                </div>

                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input-soft"
                  placeholder="Your name"
                />
                <input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className="input-soft"
                  placeholder={deliveryLocationPlaceholder(deliveryMode)}
                />
                <input
                  value={deliveryWindow}
                  onChange={(e) => setDeliveryWindow(e.target.value)}
                  className="input-soft"
                  placeholder={deliveryWindowPlaceholder(deliveryMode)}
                />
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="input-soft"
                  placeholder={
                    paymentCurrency === "USD" ? "Email or WhatsApp for checkout link" : "M-Pesa phone number"
                  }
                />

                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => setPaymentCurrency("USD")}
                    className={`font-mono text-xs uppercase tracking-[0.1em] pb-1 border-b-2 transition-colors ${
                      paymentCurrency === "USD"
                        ? "border-obsidian text-obsidian"
                        : "border-transparent text-ink-mute hover:text-obsidian"
                    }`}
                  >
                    USD card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentCurrency("KES")}
                    className={`font-mono text-xs uppercase tracking-[0.1em] pb-1 border-b-2 transition-colors ${
                      paymentCurrency === "KES"
                        ? "border-obsidian text-obsidian"
                        : "border-transparent text-ink-mute hover:text-obsidian"
                    }`}
                  >
                    KES M-Pesa
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutStep("browse")}
                className="font-mono text-sm text-bronze hover:text-obsidian"
              >
                ← Edit selection
              </button>

              <button
                type="button"
                onClick={startAutomatedCheckout}
                disabled={!canCheckout}
                className="btn-dark w-full disabled:opacity-40"
              >
                Create order
              </button>

              <a
                href={whatsappLink(BRAND.whatsapp, checkoutMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full"
              >
                Continue in WhatsApp
              </a>

              {validationHints.length > 0 && (
                <ul className="text-sm text-ink-mute list-disc list-inside space-y-1">
                  {validationHints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </>
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

function CategoryLink({
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
      className={`shrink-0 font-mono text-xs uppercase tracking-[0.12em] whitespace-nowrap pb-1 border-b transition-colors ${
        active
          ? "text-obsidian border-obsidian"
          : "text-ink-mute border-transparent hover:text-obsidian"
      }`}
    >
      {label}
    </button>
  );
}

function SelectableTreasure({
  item,
  qty,
  onToggle,
}: {
  item: Treasure;
  qty: number;
  onToggle: () => void;
}) {
  const inCart = qty > 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left card-luxury overflow-hidden transition-all ${
        inCart ? "ring-1 ring-obsidian ring-offset-2 ring-offset-sand" : ""
      }`}
    >
      <div className="relative catalog-tile-image">
        <CatalogImage
          src={item.image}
          alt={item.imageAlt || item.name}
          className="aspect-square"
          imageClassName="object-contain object-center p-4"
          sizes="200px"
        />
        {inCart && (
          <div className="absolute top-3 right-3">
            <span className="chip-dark text-xs">{qty > 1 ? `×${qty}` : "Added"}</span>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border/60">
        <p className="font-serif text-base text-obsidian leading-tight">{item.name}</p>
        <p className="font-serif text-sm text-obsidian mt-1">{formatUSD(item.price_usd)}</p>
        <p className="font-mono text-xs text-ink-mute">{formatKES(item.price_kes)}</p>
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
  items: { item: Treasure; qty: number }[];
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
    ...items.map(({ item, qty }) => `• ${qty > 1 ? `${qty}× ` : ""}${item.name} (${item.sku})`),
  ];
  if (packaging) lines.push("• Premium packaging & story card");
  lines.push("", `Estimated total: ${formatUSD(totalUsd)} / ${formatKES(totalKes)}`);
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
