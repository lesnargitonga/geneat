"use client";

import { useState } from "react";
import { openConciergeChat } from "@/components/ChatWidget";
import type { GiftBox } from "@/lib/products";
import { BRAND } from "@/lib/products";
import { formatDualPrice, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
};

type DeliveryMode = "hotel" | "jkia" | "international";

export function CollectionCheckout({ box }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(box.express_departure ? "jkia" : "hotel");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "KES">("USD");

  const totalUsd = box.price_usd * quantity;
  const totalKes = box.price_kes * quantity;

  const message = buildCollectionCheckoutMessage({
    box,
    quantity,
    totalUsd,
    totalKes,
    deliveryMode,
    paymentCurrency,
  });

  const startAutomatedCheckout = () => {
    openConciergeChat();
    window.dispatchEvent(
      new CustomEvent("hazina:chat-prompt", {
        detail: {
          checkout: {
            kind: "collection",
            collectionId: box.id,
            quantity,
            deliveryMode,
            paymentCurrency,
          },
        },
      }),
    );
  };

  return (
    <section id="checkout" className="border border-border bg-sand p-5 md:p-6 space-y-5 lg:max-h-[80vh] lg:overflow-y-auto local-scroll local-scroll--subtle">
      <div>
        <span className="label-mono">Automated checkout</span>
        <h2 className="font-serif text-2xl md:text-3xl text-obsidian mt-2">Reserve {box.name}</h2>
        <p className="text-sm text-ink-mute mt-2 leading-relaxed">
          Start a guided checkout. Hazina will ask for one detail at a time before creating the order.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-y border-border py-3">
        <span className="text-sm text-ink-mute">{box.sku}</span>
        <span className="font-mono text-sm text-bronze text-right">{formatDualPrice(totalUsd, totalKes)}</span>
      </div>

      <div className="flex items-center justify-between gap-4 border border-border bg-sand-dark/40 px-3 py-2">
        <div>
          <p className="label-mono">Collection quantity</p>
          <p className="text-sm text-ink-mute">Choose how many full boxes you need.</p>
        </div>
        <div className="inline-flex items-center border border-border rounded overflow-hidden">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 bg-sand text-obsidian"
            aria-label="Decrease collection quantity"
          >
            −
          </button>
          <span className="px-3 py-2 font-mono text-base min-w-[44px] text-center">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-2 bg-sand text-obsidian"
            aria-label="Increase collection quantity"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setDeliveryMode("hotel")}
          className={`chip justify-center border ${deliveryMode === "hotel" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
        >
          Local handoff
        </button>
        <button
          type="button"
          onClick={() => setDeliveryMode("jkia")}
          className={`chip justify-center border ${deliveryMode === "jkia" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
        >
          Departure
        </button>
        <button
          type="button"
          onClick={() => setDeliveryMode("international")}
          className={`chip justify-center border ${deliveryMode === "international" ? "bg-obsidian text-sand border-obsidian" : "border-border text-ink-mute"}`}
        >
          Global export
        </button>
      </div>

      <div className="grid gap-2 border border-border bg-sand-dark/40 p-3 text-sm text-ink-mute">
        <p className="text-obsidian">Checkout will collect:</p>
        <p>1. Guest name</p>
        <p>2. Exact delivery point</p>
        <p>3. Timing, contact, and payment confirmation</p>
      </div>

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

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={startAutomatedCheckout}
          className="btn-dark"
        >
          Start guided checkout
        </button>
        <a
          href={whatsappLink(BRAND.whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline"
        >
          Speak with Concierge
        </a>
      </div>
    </section>
  );
}

function buildCollectionCheckoutMessage({
  box,
  quantity,
  totalUsd,
  totalKes,
  deliveryMode,
  paymentCurrency,
}: {
  box: GiftBox;
  quantity: number;
  totalUsd: number;
  totalKes: number;
  deliveryMode: DeliveryMode;
  paymentCurrency: "USD" | "KES";
}): string {
  return [
    "Hello Hazina Nomads — I would like to reserve a collection.",
    "",
    `Collection: ${quantity}× ${box.name} (${box.sku})`,
    `Unit price: USD ${box.price_usd.toLocaleString("en-US")} / KES ${box.price_kes.toLocaleString("en-KE")}`,
    `Estimated total: USD ${totalUsd.toLocaleString("en-US")} / KES ${totalKes.toLocaleString("en-KE")}`,
    `Delivery type: ${deliveryTypeLabel(deliveryMode)}`,
    `Preferred payment: ${paymentCurrency === "USD" ? "USD card link" : "KES M-Pesa STK"}`,
    "",
    "Please guide me step by step before creating the order.",
  ].join("\n");
}

function deliveryTypeLabel(mode: DeliveryMode): string {
  if (mode === "jkia") return "Seamless logistics - departure handoff";
  if (mode === "international") return "Global export - insured courier quote";
  return "Seamless logistics - local handoff";
}
