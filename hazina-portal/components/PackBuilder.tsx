"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { CatalogImage } from "@/components/CatalogImage";
import { TreasureQuickView } from "@/components/TreasureQuickView";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { LuxuryTilt } from "@/components/three-d/LuxuryTilt";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  ENGRAVING_FEE_KES,
  ENGRAVING_FEE_USD,
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

export function PackBuilder({
  initialAddIds = [],
  initialCategory,
  initialQuery = "",
  treasures = TREASURES,
}: {
  initialAddIds?: string[];
  initialCategory?: string;
  initialQuery?: string;
  treasures?: Treasure[];
}) {
  const reduceMotion = useReducedMotion();
  const buildableTreasures = useMemo(
    () => treasures.filter((t) => t.category !== "packaging"),
    [treasures],
  );
  const validInitialCategory =
    initialCategory && ALL_CATEGORIES.includes(initialCategory as TreasureCategory)
      ? (initialCategory as TreasureCategory)
      : "all";

  const [cart, setCart] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const id of initialAddIds) {
      if (buildableTreasures.some((t) => t.id === id)) m.set(id, 1);
    }
    return m;
  });
  const [category, setCategory] = useState<TreasureCategory | "all">(validInitialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<"curated" | "price-low" | "price-high" | "fastest">("curated");
  const [includePackaging, setIncludePackaging] = useState(false);
  const [monograms, setMonograms] = useState<Map<string, string>>(() => new Map());
  const [bespokeRequest, setBespokeRequest] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"browse" | "delivery">("browse");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("hotel");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "KES">("USD");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buildableTreasures.map((item, index) => ({ item, index }))
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
  }, [buildableTreasures, category, query, sort]);

  const cartLines = useMemo(() => {
    return buildableTreasures.filter((t) => (cart.get(t.id) ?? 0) > 0).map((item) => ({
      item,
      qty: cart.get(item.id) ?? 0,
    }));
  }, [buildableTreasures, cart]);

  const totalUnits = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.qty, 0),
    [cartLines],
  );

  const subtotalUsd = cartLines.reduce((s, { item, qty }) => s + item.price_usd * qty, 0);
  const subtotalKes = cartLines.reduce((s, { item, qty }) => s + item.price_kes * qty, 0);
  const engravingLines = useMemo(
    () =>
      cartLines.filter(
        ({ item }) => item.isEngravable && (monograms.get(item.id)?.trim().length ?? 0) > 0,
      ),
    [cartLines, monograms],
  );
  const engravingUsd = engravingLines.length * ENGRAVING_FEE_USD;
  const engravingKes = engravingLines.length * ENGRAVING_FEE_KES;
  const packagingUsd = includePackaging ? PACKAGING_FEE_USD : 0;
  const packagingKes = includePackaging ? PACKAGING_FEE_KES : 0;
  const totalUsd = subtotalUsd + engravingUsd + packagingUsd;
  const totalKes = subtotalKes + engravingKes + packagingKes;

  const setQty = (id: string, qty: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(id);
        setMonograms((m) => {
          if (!m.has(id)) return m;
          const copy = new Map(m);
          copy.delete(id);
          return copy;
        });
      } else next.set(id, qty);
      return next;
    });
  };

  const setMonogram = (id: string, value: string) => {
    setMonograms((prev) => {
      const next = new Map(prev);
      const trimmed = value.trim();
      if (!trimmed) next.delete(id);
      else next.set(id, trimmed);
      return next;
    });
  };

  const boxRef = useRef<HTMLDivElement>(null);
  const [quickView, setQuickView] = useState<Treasure | null>(null);

  const increment = (id: string) => setQty(id, (cart.get(id) ?? 0) + 1);
  const decrement = (id: string) => setQty(id, (cart.get(id) ?? 0) - 1);

  const checkoutMessage = buildWhatsAppMessage({
    items: cartLines,
    monograms,
    bespokeRequest,
    packaging: includePackaging,
    totalKes,
    totalUsd,
    deliveryMode,
    paymentCurrency,
  });

  const canOrder = totalUnits >= MIN_CUSTOM_ITEMS;

  const startAutomatedCheckout = () => {
    window.dispatchEvent(
      new CustomEvent("hazina:chat-prompt", {
        detail: {
          checkout: {
            kind: "custom",
            items: cartLines.map(({ item, qty }) => ({
              id: item.id,
              sku: item.sku,
              name: item.name,
              qty,
              price_usd: item.price_usd,
              price_kes: item.price_kes,
              monogram: monograms.get(item.id)?.trim() || undefined,
            })),
            bespokeRequest: bespokeRequest.trim() || undefined,
            includePackaging,
            totalUsd,
            totalKes,
            deliveryMode,
            paymentCurrency,
          },
        },
      }),
    );
  };

  const validationHints: string[] = [];
  if (!canOrder) validationHints.push(`Choose ${MIN_CUSTOM_ITEMS} or more treasures`);
  if (checkoutStep === "delivery" && canOrder) {
    validationHints.push("Hazina chat will collect name, exact location, time, and contact one at a time.");
  }

  return (
    <div className="studio-workspace grid min-w-0 lg:grid-cols-12 gap-10 lg:gap-14">
      <div className="min-w-0 lg:col-span-7 space-y-8">
        <FloatingSurface className="studio-control-deck p-4 md:p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,180px]">
            <label>
              <span className="sr-only">Search pieces for your private collection</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-soft"
                placeholder="Search item, SKU, origin..."
              />
            </label>
            <label>
              <span className="sr-only">Sort private collection pieces</span>
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

          <div className="flex items-start gap-3">
            <span className="label-mono shrink-0 pt-1 text-ink-mute">Category</span>
            <div className="-mx-1 min-w-0 flex-1 overflow-visible pb-1 sm:overflow-x-auto sm:local-scroll-x">
              <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 sm:min-w-max sm:flex-nowrap sm:gap-5">
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
            {filtered.length} available · {totalUnits} in your private collection
            {cartLines.length > 0 ? ` (${cartLines.length} treasures)` : ""}
          </p>
        </FloatingSurface>

        {filtered.length > 0 ? (
          // Grid is visible immediately — pieces should never wait for a scroll
          // to appear (a client would think there are no photos).
          <div className="studio-shelf-grid grid min-w-0 grid-cols-1 gap-x-4 gap-y-8 min-[430px]:grid-cols-2 md:grid-cols-3">
            {filtered.map((item, index) => (
              <LuxuryTilt key={item.id} className="h-full">
                <SelectableTreasure
                  item={item}
                  qty={cart.get(item.id) ?? 0}
                  onOpen={() => setQuickView(item)}
                  priority={index < 6}
                />
              </LuxuryTilt>
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

      <aside className="min-w-0 lg:col-span-5">
        <FloatingSurface className="concierge-studio-panel lg:sticky lg:top-24" depth="strong">
        <div ref={boxRef} className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto local-scroll local-scroll--subtle border border-border bg-sand p-6 md:p-8 space-y-6">
          <div>
            <span className="label-mono">Your private collection</span>
            <h2 className="font-serif text-3xl text-obsidian mt-2">
              {checkoutStep === "browse" ? "Select pieces" : "Prepare handoff"}
            </h2>
            <p className="text-ink-mute text-sm mt-2 leading-relaxed">
              {checkoutStep === "browse"
                ? "Select the pieces you want, then prepare the handoff."
                : "Choose delivery and payment preference. Chat will collect the remaining details carefully."}
            </p>
          </div>

          {checkoutStep === "browse" && (
            <motion.div
              key="browse"
              className="space-y-6"
              initial={reduceMotion ? false : { opacity: 0, x: -12 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {cartLines.length === 0 ? (
                <p className="text-ink-mute text-sm italic">Tap pieces to add them to your private collection.</p>
              ) : (
                <ul className="studio-staging-tray space-y-3 max-h-[22rem] overflow-y-auto local-scroll local-scroll--subtle">
                  {cartLines.map(({ item, qty }) => (
                    <motion.li
                      layout
                      key={item.id}
                      className="studio-staging-tray__item space-y-2"
                      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="studio-staging-tray__image">
                            <CatalogImage
                              src={item.image}
                              alt=""
                              tone="warm"
                              fit="contain"
                              className="h-full w-full"
                              sizes="48px"
                            />
                          </span>
                          <span className="min-w-0 truncate text-obsidian">{item.name}</span>
                          <div className="inline-flex items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => decrement(item.id)}
                              className="px-2 py-1 font-mono text-sm text-ink-mute transition-transform hover:text-obsidian active:scale-75"
                              aria-label={`Decrease quantity for ${item.name}`}
                            >
                              −
                            </button>
                            <motion.span
                              key={qty}
                              initial={{ scale: 0.6 }}
                              animate={{ scale: [0.6, 1.3, 1] }}
                              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                              className="px-2 py-1 font-mono text-sm min-w-[2ch] text-center inline-block text-obsidian"
                            >
                              {qty}
                            </motion.span>
                            <button
                              type="button"
                              onClick={() => increment(item.id)}
                              className="px-2 py-1 font-mono text-sm text-ink-mute transition-transform hover:text-obsidian active:scale-75"
                              aria-label={`Increase quantity for ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <span className="font-mono text-sm text-ink-mute shrink-0 text-right leading-relaxed">
                          {formatUSD(item.price_usd * qty)}
                          <br />
                          {formatKES(item.price_kes * qty)}
                        </span>
                      </div>
                      {item.isEngravable && (
                        <label className="block">
                          <span className="sr-only">Monogram or engraving for {item.name}</span>
                          <input
                            type="text"
                            value={monograms.get(item.id) ?? ""}
                            onChange={(e) => setMonogram(item.id, e.target.value)}
                            className="input-bespoke w-full"
                            placeholder={`Add Monogram / Engraving (+${formatUSD(ENGRAVING_FEE_USD)})`}
                          />
                        </label>
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}

              <div className="space-y-3 border-t border-border/60 pt-4">
                <div>
                  <h3 className="font-serif text-lg text-obsidian">Bespoke Requests</h3>
                  <p className="text-ink-mute text-xs mt-1 leading-relaxed">
                    Unlisted pieces, stones, or special commissions — describe what you are sourcing.
                  </p>
                </div>
                <label className="block">
                  <span className="sr-only">Bespoke sourcing requests</span>
                  <textarea
                    value={bespokeRequest}
                    onChange={(e) => setBespokeRequest(e.target.value)}
                    rows={3}
                    className="input-bespoke resize-y min-h-[4.5rem]"
                    placeholder="e.g. I am looking for a specific type of green malachite stone…"
                  />
                </label>
                <p className="text-sm text-ink-mute/90 italic leading-relaxed">
                  Have a reference photo? Submit this brief and send your images directly to our concierge via
                  WhatsApp.
                </p>
              </div>

              {cartLines.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart(new Map());
                    setMonograms(new Map());
                    setBespokeRequest("");
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
                  <span className="block font-mono text-sm text-ink-mute/80 mt-0.5">
                    {formatKES(PACKAGING_FEE_KES)}
                  </span>
                </span>
              </label>

              <div className="border-t border-border/60 pt-4 space-y-1">
                {engravingLines.length > 0 && (
                  <p className="text-xs text-ink-mute font-mono mb-2">
                    Includes {engravingLines.length} bespoke engraving
                    {engravingLines.length > 1 ? "s" : ""} ({formatUSD(engravingUsd)} / {formatKES(engravingKes)})
                  </p>
                )}
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
                {canOrder ? "Prepare Handoff" : `Select ${MIN_CUSTOM_ITEMS}+ treasures`}
              </button>

              {canOrder && (
                <a
                  href={whatsappLink(BRAND.whatsapp, checkoutMessage)}
                  target="_blank"
                rel="noopener noreferrer"
                className="block text-center font-mono text-sm text-bronze underline-offset-4 hover:underline"
              >
                  Or continue on WhatsApp with a human concierge
                </a>
              )}
            </motion.div>
          )}

          {checkoutStep === "delivery" && (
            <motion.div
              key="delivery"
              className="space-y-6"
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="studio-delivery-desk space-y-2 p-4 text-sm">
                <p className="label-mono text-ink-mute">Order summary</p>
                <p className="font-serif text-xl text-obsidian">{formatUSD(totalUsd)}</p>
                <p className="font-mono text-sm text-ink-mute">{formatKES(totalKes)}</p>
                <p className="text-ink-mute text-sm mt-1">
                  {totalUnits} treasures
                  {engravingLines.length > 0 ? ` · ${engravingLines.length} engraving(s)` : ""}
                  {includePackaging ? " · premium packaging" : ""}
                  {bespokeRequest.trim() ? " · bespoke note" : ""}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  {(["hotel", "jkia", "international"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDeliveryMode(mode)}
                      className={`font-mono text-sm uppercase pb-1 border-b-2 transition-colors ${
                        deliveryMode === mode
                          ? "border-obsidian text-obsidian"
                          : "border-transparent text-ink-mute hover:text-obsidian"
                      }`}
                    >
                      {mode === "hotel"
                        ? "Local handoff"
                        : mode === "jkia"
                          ? "Departure"
                          : "Global export"}
                    </button>
                  ))}
                </div>

                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => setPaymentCurrency("USD")}
                    className={`font-mono text-sm uppercase pb-1 border-b-2 transition-colors ${
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
                    className={`font-mono text-sm uppercase pb-1 border-b-2 transition-colors ${
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
                disabled={!canOrder}
                className="btn-dark w-full disabled:opacity-40"
              >
                Start guided checkout
              </button>

              <a
                href={whatsappLink(BRAND.whatsapp, checkoutMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full flex-col gap-0.5"
              >
                <span>Continue on WhatsApp</span>
                <span className="text-[10px] normal-case tracking-normal opacity-70">Human concierge handoff</span>
              </a>

              {validationHints.length > 0 && (
                <ul className="text-sm text-ink-mute list-disc list-inside space-y-1">
                  {validationHints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          <p className="label-mono text-center">
            Or{" "}
            <Link href="/collections" className="text-bronze hover:text-obsidian">
              start from a signature collection
            </Link>
          </p>
        </div>
        </FloatingSurface>
      </aside>

      <TreasureQuickView
        item={quickView}
        qty={quickView ? cart.get(quickView.id) ?? 0 : 0}
        onSetQty={setQty}
        onClose={() => setQuickView(null)}
        boxRef={boxRef}
      />
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
      className={`shrink-0 font-mono text-sm uppercase whitespace-nowrap pb-1 border-b transition-colors ${
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
  onOpen,
  priority = false,
}: {
  item: Treasure;
  qty: number;
  onOpen: () => void;
  priority?: boolean;
}) {
  const inCart = qty > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`studio-piece w-full min-w-0 overflow-hidden text-left transition-all duration-200 active:scale-[0.97] ${
        inCart ? "studio-piece--selected" : ""
      }`}
    >
      <div className="relative catalog-tile-image">
        <CatalogImage
          src={item.image}
          alt={item.imageAlt || item.name}
          tone="warm"
          fit="contain"
          className="aspect-square"
          sizes="200px"
          priority={priority}
        />
        {inCart && (
          <div className="absolute top-3 right-3">
            <motion.span
              key={qty}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.18, 1], opacity: 1 }}
              transition={{ duration: 0.34, ease: [0.34, 1.56, 0.64, 1] }}
              className="chip-dark text-sm inline-block"
            >
              {qty > 1 ? `×${qty}` : "Added"}
            </motion.span>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border/60">
        <p className="font-serif text-base text-obsidian leading-tight">{item.name}</p>
        <p className="font-serif text-sm text-obsidian mt-1">{formatUSD(item.price_usd)}</p>
        <p className="font-mono text-sm text-ink-mute">{formatKES(item.price_kes)}</p>
      </div>
    </button>
  );
}

function formatItemLine({
  item,
  qty,
  monogram,
}: {
  item: Treasure;
  qty: number;
  monogram?: string;
}): string {
  const base = `• ${qty > 1 ? `${qty}× ` : ""}${item.name} (${item.sku})`;
  const trimmed = monogram?.trim();
  return trimmed ? `${base} — Monogram: ${trimmed}` : base;
}

function buildWhatsAppMessage({
  items,
  monograms,
  bespokeRequest,
  packaging,
  totalKes,
  totalUsd,
  deliveryMode,
  paymentCurrency,
}: {
  items: { item: Treasure; qty: number }[];
  monograms: Map<string, string>;
  bespokeRequest: string;
  packaging: boolean;
  totalKes: number;
  totalUsd: number;
  deliveryMode: DeliveryMode;
  paymentCurrency: "USD" | "KES";
}): string {
  const lines = [
    "Hello Hazina Nomads — private sourcing brief:",
    "",
    ...items.map(({ item, qty }) =>
      formatItemLine({ item, qty, monogram: monograms.get(item.id) }),
    ),
  ];
  if (packaging) lines.push("• Premium packaging & story card");
  const bespoke = bespokeRequest.trim();
  if (bespoke) {
    lines.push("", "Bespoke requests:", bespoke);
  }
  lines.push("", `Estimated total: ${formatUSD(totalUsd)} / ${formatKES(totalKes)}`);
  lines.push(`Delivery type: ${deliveryTypeLabel(deliveryMode)}`);
  lines.push(`Preferred payment: ${paymentCurrency === "USD" ? "USD card link" : "KES M-Pesa STK"}`);
  lines.push(
    "",
    "Please guide me step by step before creating the order.",
  );
  return lines.join("\n");
}

function deliveryTypeLabel(mode: DeliveryMode): string {
  if (mode === "jkia") return "Seamless logistics - departure handoff";
  if (mode === "international") return "Global export - insured courier quote";
  return "Seamless logistics - local handoff";
}
