"use client";

import { useState } from "react";
import type { GiftBox } from "@/lib/products";
import { BRAND } from "@/lib/products";
import { formatDualPrice, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
};

type DeliveryMode = "hotel" | "jkia" | "international";

export function CollectionCheckout({ box }: Props) {
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(box.jkia_only ? "jkia" : "hotel");
  const [customerName, setCustomerName] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [contact, setContact] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "KES">("USD");

  const canCheckout =
    customerName.trim().length >= 2 &&
    deliveryLocation.trim().length >= 6 &&
    deliveryWindow.trim().length >= 3 &&
    contact.trim().length >= 5;

  const message = buildCollectionCheckoutMessage({
    box,
    deliveryMode,
    customerName,
    deliveryLocation,
    deliveryWindow,
    contact,
    paymentCurrency,
  });

  const startAutomatedCheckout = () => {
    if (!canCheckout) return;
    window.dispatchEvent(new CustomEvent("hazina:chat-prompt", { detail: { prompt: message } }));
    window.location.hash = "chat";
  };

  return (
    <section id="checkout" className="border border-border bg-sand p-5 md:p-6 space-y-5">
      <div>
        <span className="label-mono">Automated checkout</span>
        <h2 className="font-serif text-2xl md:text-3xl text-obsidian mt-2">Reserve {box.name}</h2>
        <p className="text-sm text-ink-mute mt-2 leading-relaxed">
          Complete the details here and Hazina will create the order and start payment in chat.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-y border-border py-3">
        <span className="text-sm text-ink-mute">{box.sku}</span>
        <span className="font-mono text-sm text-bronze text-right">{formatDualPrice(box.price_usd, box.price_kes)}</span>
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

      <div className="grid gap-3">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="input-luxury"
          placeholder="Guest name"
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
          placeholder={paymentCurrency === "USD" ? "Email for card checkout link" : "M-Pesa phone number"}
        />
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
          disabled={!canCheckout}
          className="btn-dark disabled:opacity-40"
        >
          Start checkout
        </button>
        <a
          href={whatsappLink(BRAND.whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline"
        >
          Continue in WhatsApp
        </a>
      </div>
    </section>
  );
}

function buildCollectionCheckoutMessage({
  box,
  deliveryMode,
  customerName,
  deliveryLocation,
  deliveryWindow,
  contact,
  paymentCurrency,
}: {
  box: GiftBox;
  deliveryMode: DeliveryMode;
  customerName: string;
  deliveryLocation: string;
  deliveryWindow: string;
  contact: string;
  paymentCurrency: "USD" | "KES";
}): string {
  return [
    "Hello Hazina Nomads — automated collection checkout:",
    "",
    `Collection: ${box.name} (${box.sku})`,
    `Price: USD ${box.price_usd.toLocaleString("en-US")} / KES ${box.price_kes.toLocaleString("en-KE")}`,
    `Guest: ${customerName.trim()}`,
    `Delivery type: ${deliveryTypeLabel(deliveryMode)}`,
    `Delivery location: ${deliveryLocation.trim()}`,
    `Delivery window: ${deliveryWindow.trim()}`,
    `Contact/payment detail: ${contact.trim()}`,
    `Preferred payment: ${paymentCurrency === "USD" ? "USD card link" : "KES M-Pesa STK"}`,
    "",
    deliveryMode === "international"
      ? "Please confirm availability, quote insured DHL/export shipping before payment, then start checkout."
      : "Please create the order, confirm availability, and start payment.",
  ].join("\n");
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
