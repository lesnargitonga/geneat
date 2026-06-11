"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRAND, GIFT_BOXES, getGiftBox, type GiftBox } from "@/lib/products";
import { ENGRAVING_FEE_KES, ENGRAVING_FEE_USD } from "@/lib/treasures";
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";

type Msg = { id: string; role: "user" | "ai" | "system"; text: string; ts: number };
type MsgWithMedia = Msg & { imageUrl?: string | null; imageAlt?: string | null };

type DeliveryMode = "hotel" | "jkia" | "international";
type PaymentCurrency = "USD" | "KES";
type CheckoutStep =
  | "name"
  | "delivery_mode"
  | "location"
  | "window"
  | "payment"
  | "contact"
  | "confirm";

type CheckoutItem = {
  id?: string;
  sku: string;
  name: string;
  qty: number;
  price_usd: number;
  price_kes: number;
  monogram?: string;
};

type CheckoutStart =
  | {
      kind: "collection";
      collectionId: string;
      quantity?: number;
      deliveryMode?: DeliveryMode;
      paymentCurrency?: PaymentCurrency;
      customerName?: string;
      deliveryLocation?: string;
      deliveryWindow?: string;
      contact?: string;
    }
  | {
      kind: "custom";
      items: CheckoutItem[];
      bespokeRequest?: string;
      includePackaging?: boolean;
      totalUsd?: number;
      totalKes?: number;
      deliveryMode?: DeliveryMode;
      paymentCurrency?: PaymentCurrency;
      customerName?: string;
      deliveryLocation?: string;
      deliveryWindow?: string;
      contact?: string;
    };

type CheckoutFlow = {
  kind: "collection" | "custom";
  step: CheckoutStep;
  collectionId?: string;
  collectionName: string;
  collectionSku?: string;
  quantity: number;
  items: CheckoutItem[];
  bespokeRequest?: string;
  includePackaging?: boolean;
  totalUsd: number;
  totalKes: number;
  deliveryMode?: DeliveryMode;
  paymentCurrency?: PaymentCurrency;
  customerName?: string;
  deliveryLocation?: string;
  deliveryWindow?: string;
  contact?: string;
};

type RecommendationStep = "recipient" | "occasion" | "budget" | "delivery" | "recommend";
type RecommendationFlow = {
  step: RecommendationStep;
  recipient?: string;
  occasion?: string;
  budget?: string;
  deliveryContext?: string;
  sourceText?: string;
};

type ChatAction = { label: string; value?: string; href?: string; primary?: boolean };
type ChatPromptDetail = { prompt?: string; checkout?: CheckoutStart };
type ApiChatAction = { label: string; value: string; primary?: boolean; interactive_id?: string | null };
type ApiChatResponse = {
  reply?: string;
  image_url?: string | null;
  photo_item?: string | null;
  actions?: ApiChatAction[];
};
type PortalCatalogResponse = {
  collections?: GiftBox[];
};

const TOP_MENU_TEXT = `Welcome to Hazina Nomads.

How may we assist you today?

1. Explore ready collections
2. Build a private gift brief
3. Need a gift recommendation
4. Safari / hotel / JKIA delivery
5. Corporate gifting
6. Speak to Concierge`;

const MAIN_MENU_ACTIONS: ChatAction[] = [
  { label: "Explore ready collections", value: "Explore ready collections", primary: true },
  { label: "Build a private gift brief", value: "Build a private gift brief" },
  { label: "Need a gift recommendation", value: "Need a gift recommendation" },
  { label: "Safari / hotel / JKIA delivery", value: "Safari / hotel / JKIA delivery" },
  { label: "Corporate gifting", value: "Corporate gifting" },
  { label: "Speak to Concierge", value: "Speak to Concierge" },
];

const BUSINESS_SLUG = "hazina-nomads";
const PHONE_KEY = "hazina.phone";
const CHAT_TIMEOUT_MS = 30_000;
const CHAT_OPEN_EVENT = "hazina:chat-open";
const CHAT_CLOSE_EVENT = "hazina:chat-close";

export function openConciergeChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT));
}

export function closeConciergeChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_CLOSE_EVENT));
}

function mapApiActions(raw: ApiChatAction[] | undefined): ChatAction[] {
  if (!raw?.length) return [];
  return raw.map((action, index) => ({
    label: action.label,
    value: action.value,
    primary: action.primary ?? index === 0,
  }));
}

function getOrCreatePhone(): string {
  if (typeof window === "undefined") return "+254700000000";
  let v = window.localStorage.getItem(PHONE_KEY);
  if (!v) {
    const tail = Math.floor(100000 + Math.random() * 899999);
    v = `+2547${String(tail).padStart(8, "0").slice(0, 8)}`;
    window.localStorage.setItem(PHONE_KEY, v);
  }
  return v;
}

function normalizeAssistantReply(reply: string, imageUrl?: string | null, imageAlt?: string | null) {
  if (!imageUrl) return reply;
  const trimmed = (reply || "").trim();
  if (/^photo ready for .+:?$/i.test(trimmed)) {
    return imageAlt ? `Here you go for ${imageAlt}.` : "Here you go.";
  }
  return trimmed;
}

function messageId() {
  return crypto.randomUUID();
}

function isYes(text: string) {
  return /\b(yes|yep|yeah|ok(?:ay)?|okay|confirm|confirmed|go ahead|proceed|start|create|checkout|sawa|ndio|fine|looks good|all good|sounds good)\b/i.test(text);
}

function isNo(text: string) {
  return /\b(no|not yet|cancel|stop|abort|wait)\b/i.test(text);
}

function isGreeting(text: string) {
  return /^(hi|hey|hello|sasa|niaje|mambo|habari|good\s+(morning|afternoon|evening))\b/i.test(text.trim());
}

function isMainMenuRequest(text: string) {
  return /^(menu|main menu|start|start over|restart|home|help|0)$/i.test(text.trim());
}

function isCatalogRequest(text: string) {
  return /\b(explore ready collections|ready collections|collections?|gift boxes?|catalog(?:ue)?|what do you sell|show me|browse|shop)\b/i.test(text);
}

function isCustomBoxRequest(text: string) {
  return /\b(build a private gift brief|private gift brief|private brief|custom|build|compose|pick individual|individual treasures)\b/i.test(text);
}

function isRecommendationRequest(text: string) {
  return /\b(recommend|recommendation|suggest|help me choose|best gift|gift for|something for|adjust budget|romantic|wife|husband|boss|client|parents?|anniversary|birthday|departure|leaving|tomorrow|classy|premium)\b/i.test(text);
}

function isLogisticsRequest(text: string) {
  return /\b(safari|hotel|jkia|airport|delivery|deliver|handoff|ship|dhl|export|international|abroad|villa|lodge)\b/i.test(text);
}

function isCorporateRequest(text: string) {
  return /\b(corporate|bulk|team|client gifts?|event|company|branded|branding|staff gifts?)\b/i.test(text);
}

function isConciergeRequest(text: string) {
  return /\b(speak to concierge|human|agent|concierge|talk to someone|call me)\b/i.test(text);
}

function parseDeliveryMode(text: string): DeliveryMode | undefined {
  const lower = text.toLowerCase();
  if (/\b(jkia|airport|terminal|flight|departure)\b/.test(lower)) return "jkia";
  if (/\b(dhl|export|international|abroad|overseas|ship)\b/.test(lower)) return "international";
  if (/\b(hotel|room|lodge|camp|villa|front desk|nairobi|local handoff|seamless logistics)\b/.test(lower)) return "hotel";
  return undefined;
}

function parsePayment(text: string): PaymentCurrency | undefined {
  const lower = text.toLowerCase();
  if (/\b(kes|ksh|m-?pesa|mpesa|stk|paybill|till)\b/.test(lower)) return "KES";
  if (/\b(usd|dollar|\$|card|visa|mastercard|paystack|apple pay|international)\b/.test(lower)) return "USD";
  return undefined;
}

function contactLooksOk(text: string, paymentCurrency?: PaymentCurrency) {
  const clean = text.trim();
  if (clean.length < 5) return false;
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(clean)) return true;
  const digits = clean.replace(/\D/g, "");
  if (paymentCurrency === "KES") return digits.length >= 9;
  return digits.length >= 7 || clean.includes("@");
}

function resolveBoxFromText(text: string, boxes: GiftBox[] = GIFT_BOXES): GiftBox | undefined {
  const lower = text.toLowerCase();
  return boxes.find((box) => {
    const tokens = [box.id, box.sku, box.name, box.name.replace(/^The\s+/i, "")];
    return tokens.some((token) => lower.includes(token.toLowerCase()));
  });
}

const STEP_ORDER: CheckoutStep[] = [
  "name",
  "delivery_mode",
  "location",
  "window",
  "payment",
  "contact",
  "confirm",
];

function prevStepKey(step: CheckoutStep): CheckoutStep {
  const i = STEP_ORDER.indexOf(step);
  if (i <= 0) return "name";
  return STEP_ORDER[i - 1];
}

function parseEditFieldCommand(text: string): CheckoutStep | null {
  const t = (text || "").toLowerCase();
  if (/\b(edit|change|update)\b.*\b(name|guest name|customer name)\b/.test(t)) return "name";
  if (/\b(edit|change|update)\b.*\b(deliv|delivery|mode)\b/.test(t)) return "delivery_mode";
  if (/\b(edit|change|update)\b.*\b(location|address|hotel|room)\b/.test(t)) return "location";
  if (/\b(edit|change|update)\b.*\b(time|timing|window|flight|departure)\b/.test(t)) return "window";
  if (/\b(edit|change|update)\b.*\b(payment|pay|mpesa|card|usd|kes)\b/.test(t)) return "payment";
  if (/\b(edit|change|update)\b.*\b(contact|phone|email|whatsapp|number)\b/.test(t)) return "contact";
  // Short forms like "edit name"
  if (/^edit\s+name$/i.test(text) || /^change\s+name$/i.test(text)) return "name";
  if (/^edit\s+delivery/i.test(text) || /^change\s+delivery/i.test(text)) return "delivery_mode";
  if (/^edit\s+location/i.test(text) || /^change\s+location/i.test(text)) return "location";
  if (/^edit\s+time/i.test(text) || /^change\s+time/i.test(text) || /^edit\s+timing/i.test(text)) return "window";
  if (/^edit\s+payment/i.test(text) || /^change\s+payment/i.test(text)) return "payment";
  if (/^edit\s+contact/i.test(text) || /^change\s+contact/i.test(text)) return "contact";
  return null;
}

function parseNavigationCommand(text: string): { action: "back" | "start_over" | "edit"; field?: CheckoutStep } | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(go back|back|previous|previous step|go to previous)\b/.test(t)) return { action: "back" };
  if (/\b(start over|restart|reset|clear all)\b/.test(t)) return { action: "start_over" };
  if (/\bedit details\b/.test(t) || /\bchange details\b/.test(t)) return { action: "edit" };
  const f = parseEditFieldCommand(text);
  if (f) return { action: "edit", field: f };
  return null;
}

function totalForItems(items: CheckoutItem[]) {
  const subtotalUsd = items.reduce((sum, item) => sum + item.price_usd * item.qty, 0);
  const subtotalKes = items.reduce((sum, item) => sum + item.price_kes * item.qty, 0);
  const engravingCount = items.filter((item) => item.monogram?.trim()).length;
  return {
    totalUsd: subtotalUsd + engravingCount * ENGRAVING_FEE_USD,
    totalKes: subtotalKes + engravingCount * ENGRAVING_FEE_KES,
  };
}

function formatCheckoutItemLine(item: CheckoutItem): string {
  const base = `• ${item.qty > 1 ? `${item.qty}x ` : ""}${item.name} (${item.sku})`;
  const monogram = item.monogram?.trim();
  return monogram ? `${base} — Monogram: ${monogram}` : base;
}

function nextStep(flow: CheckoutFlow): CheckoutStep {
  if (!flow.customerName || flow.customerName.trim().length < 2) return "name";
  if (!flow.deliveryMode) return "delivery_mode";
  if (!flow.deliveryLocation || flow.deliveryLocation.trim().length < 5) return "location";
  if (!flow.deliveryWindow || flow.deliveryWindow.trim().length < 3) return "window";
  if (!flow.paymentCurrency) return "payment";
  if (!flow.contact || !contactLooksOk(flow.contact, flow.paymentCurrency)) return "contact";
  return "confirm";
}

function flowIntro(flow: CheckoutFlow) {
  if (flow.kind === "custom") {
    return `Good. Your private collection has ${flow.items.reduce((sum, item) => sum + item.qty, 0)} treasure${
      flow.items.reduce((sum, item) => sum + item.qty, 0) === 1 ? "" : "s"
    } at ${formatUSD(flow.totalUsd)} / ${formatKES(flow.totalKes)}.`;
  }
  return `Good choice: ${flow.quantity} x ${flow.collectionName} at ${formatUSD(flow.totalUsd)} / ${formatKES(flow.totalKes)}.`;
}

function questionForStep(flow: CheckoutFlow): { text: string; actions?: ChatAction[] } {
  switch (flow.step) {
    case "name":
      return { text: "First, what name should I put on the order?" };
    case "delivery_mode":
      return {
        text: "Which fulfillment pillar should we use?",
        actions: [
          { label: "Local handoff", value: "Seamless logistics - local handoff / hotel delivery", primary: true },
          { label: "Departure handoff", value: "Seamless logistics - JKIA departure handoff" },
          { label: "Global export", value: "Global export - DHL export shipping quote" },
        ],
      };
    case "location":
      if (flow.deliveryMode === "jkia") {
        return { text: "Which terminal or airport meeting point should the concierge use?" };
      }
      if (flow.deliveryMode === "international") {
        return { text: "Which country, city, and delivery address should we quote for global export?" };
      }
      return { text: "Which property, room, front desk, villa, or residence should we deliver to?" };
    case "window":
      if (flow.deliveryMode === "jkia") {
        return { text: "What flight or departure time should we work around?" };
      }
      if (flow.deliveryMode === "international") {
        return { text: "When do you need the parcel delivered or dispatched?" };
      }
      return { text: "What delivery window works best?" };
    case "payment":
      return {
        text: "How would you like to start payment?",
        actions: [
          { label: "USD card link", value: "USD card link", primary: true },
          { label: "KES M-Pesa", value: "KES M-Pesa" },
        ],
      };
    case "contact":
      return {
        text:
          flow.paymentCurrency === "KES"
            ? "What M-Pesa phone number should receive the STK prompt?"
            : "What email or WhatsApp number should receive the secure card checkout link?",
      };
    case "confirm":
      return {
        text: checkoutSummary(flow),
        actions: [
          { label: "Confirm checkout", value: "Confirm checkout", primary: true },
          { label: "Edit details", value: "Edit details" },
        ],
      };
  }
}

function deliveryLabel(mode?: DeliveryMode) {
  if (mode === "jkia") return "Seamless logistics - departure handoff";
  if (mode === "international") return "Global export - insured courier quote";
  return "Seamless logistics - local handoff";
}

function checkoutSummary(flow: CheckoutFlow) {
  const lines = [
    "Please confirm these details:",
    `${flow.kind === "custom" ? "Custom box" : flow.collectionName}: ${formatUSD(flow.totalUsd)} / ${formatKES(flow.totalKes)}`,
    `Name: ${flow.customerName}`,
    `Delivery: ${deliveryLabel(flow.deliveryMode)}`,
    `Location: ${flow.deliveryLocation}`,
    `Timing: ${flow.deliveryWindow}`,
    `Payment: ${flow.paymentCurrency === "KES" ? "KES M-Pesa" : "USD card link"}`,
  ];
  return `${lines.join("\n")}\n\nIf this is correct, tap Confirm checkout.`;
}

function nextRecommendationStep(flow: RecommendationFlow): RecommendationStep {
  if (!flow.recipient || flow.recipient.trim().length < 2) return "recipient";
  if (!flow.occasion || flow.occasion.trim().length < 3) return "occasion";
  if (!flow.budget || flow.budget.trim().length < 2) return "budget";
  if (!flow.deliveryContext || flow.deliveryContext.trim().length < 3) return "delivery";
  return "recommend";
}

function questionForRecommendationStep(flow: RecommendationFlow): { text: string; actions?: ChatAction[] } {
  switch (flow.step) {
    case "recipient":
      return { text: "Who is the gift for?" };
    case "occasion":
      return { text: "What is the occasion or tone? For example: romantic, executive, family, departure, thank-you." };
    case "budget":
      return {
        text: "What budget range should I respect?",
        actions: [
          { label: "USD 150-250", value: "USD 150-250", primary: true },
          { label: "USD 250-400", value: "USD 250-400" },
          { label: "USD 400+", value: "USD 400+" },
          { label: "Flexible", value: "Flexible budget" },
        ],
      };
    case "delivery":
      return { text: "Where and when do you need the handoff? Hotel, residence, safari lodge, JKIA, or global export is enough for now." };
    case "recommend":
      return { text: "I have enough context to recommend a collection." };
  }
}

function extractBudgetNumber(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\b(?:usd|\$)?\s*(\d{2,5})\b/i);
  return match ? Number(match[1]) : null;
}

function inferRecommendationBox(flow: RecommendationFlow, boxes: GiftBox[] = GIFT_BOXES): GiftBox {
  const haystack = `${flow.sourceText || ""} ${flow.recipient || ""} ${flow.occasion || ""} ${flow.budget || ""} ${flow.deliveryContext || ""}`.toLowerCase();
  const byId = (id: string) => boxes.find((box) => box.id === id) || getGiftBox(id) || boxes[0];
  const budget = extractBudgetNumber(haystack);

  if (/\b(romantic|wife|husband|partner|anniversary|honeymoon|proposal|couple)\b/.test(haystack)) {
    return byId("safari-romance-box");
  }
  if (/\b(jkia|airport|flight|departure|leaving|tonight|today|last minute|urgent)\b/.test(haystack)) {
    return byId("departure-drop");
  }
  if (/\b(boss|executive|client|director|corporate|board|vip)\b/.test(haystack)) {
    return byId("kenya-edit");
  }
  if (/\b(leather|passport|travel set|monogram|initials)\b/.test(haystack)) {
    return byId("nomad-leather-set");
  }
  if ((budget && budget <= 220) || /\b(tea|honey|calm|highland|parents?|family)\b/.test(haystack)) {
    return byId("highland-treasure");
  }
  return byId("kenya-edit");
}

function seedRecommendationFromText(text: string): RecommendationFlow {
  const flow: RecommendationFlow = { step: "recipient", sourceText: text };
  if (/\b(wife|husband|partner|boss|client|mother|mum|mom|father|dad|parents?|team|colleague|friend|girlfriend|boyfriend)\b/i.test(text)) {
    flow.recipient = text;
  }
  if (/\b(romantic|anniversary|birthday|departure|leaving|thank|executive|corporate|safari|honeymoon|classy|premium)\b/i.test(text)) {
    flow.occasion = text;
  }
  if (/\b(usd|\$|kes|ksh|budget|under|around|flexible|\d{2,5})\b/i.test(text)) {
    flow.budget = text;
  }
  if (isLogisticsRequest(text) || /\b(today|tomorrow|tonight|morning|afternoon|evening|weekend)\b/i.test(text)) {
    flow.deliveryContext = text;
  }
  flow.step = nextRecommendationStep(flow);
  return flow;
}

function buildBackendCheckoutMessage(flow: CheckoutFlow) {
  const lines =
    flow.kind === "custom"
      ? [
          "Hello Hazina Nomads — private sourcing brief:",
          "",
          ...flow.items.map((item) => formatCheckoutItemLine(item)),
          ...(flow.includePackaging ? ["• Premium packaging & story card"] : []),
          ...(flow.bespokeRequest?.trim()
            ? ["", "Bespoke requests:", flow.bespokeRequest.trim()]
            : []),
          "",
          `Estimated total: ${formatUSD(flow.totalUsd)} / ${formatKES(flow.totalKes)}`,
        ]
      : [
          "Hello Hazina Nomads - automated collection checkout:",
          "",
          `Collection: ${flow.quantity}x ${flow.collectionName} (${flow.collectionSku})`,
          `Estimated total: ${formatUSD(flow.totalUsd)} / ${formatKES(flow.totalKes)}`,
        ];

  lines.push(
    `Guest: ${flow.customerName}`,
    `Delivery type: ${deliveryLabel(flow.deliveryMode)}`,
    `Delivery location: ${flow.deliveryLocation}`,
    `Delivery window: ${flow.deliveryWindow}`,
    `Contact/payment detail: ${flow.contact}`,
    `Preferred payment: ${flow.paymentCurrency === "KES" ? "KES M-Pesa STK" : "USD card link"}`,
    "",
    flow.deliveryMode === "international"
      ? "Please confirm availability, quote insured global export before payment, then start checkout."
      : "Please create the order, confirm availability, and start payment.",
  );
  return lines.join("\n");
}

function createCollectionFlow(
  payload: Extract<CheckoutStart, { kind: "collection" }>,
  boxes: GiftBox[] = GIFT_BOXES,
): CheckoutFlow | null {
  const box = boxes.find((candidate) => candidate.id === payload.collectionId) || getGiftBox(payload.collectionId);
  if (!box) return null;
  const quantity = Math.max(1, Math.min(20, Number(payload.quantity || 1)));
  const flow: CheckoutFlow = {
    kind: "collection",
    step: "name",
    collectionId: box.id,
    collectionName: box.name,
    collectionSku: box.sku,
    quantity,
    items: [],
    totalUsd: box.price_usd * quantity,
    totalKes: box.price_kes * quantity,
    deliveryMode: payload.deliveryMode,
    paymentCurrency: payload.paymentCurrency,
    customerName: payload.customerName,
    deliveryLocation: payload.deliveryLocation,
    deliveryWindow: payload.deliveryWindow,
    contact: payload.contact,
  };
  flow.step = nextStep(flow);
  return flow;
}

function createCustomFlow(payload: Extract<CheckoutStart, { kind: "custom" }>): CheckoutFlow | null {
  if (!payload.items.length) return null;
  const totals =
    typeof payload.totalUsd === "number" && typeof payload.totalKes === "number"
      ? { totalUsd: payload.totalUsd, totalKes: payload.totalKes }
      : totalForItems(payload.items);
  const flow: CheckoutFlow = {
    kind: "custom",
    step: "name",
    collectionName: "Private sourcing brief",
    quantity: payload.items.reduce((sum, item) => sum + item.qty, 0),
    items: payload.items,
    bespokeRequest: payload.bespokeRequest,
    includePackaging: payload.includePackaging,
    totalUsd: totals.totalUsd,
    totalKes: totals.totalKes,
    deliveryMode: payload.deliveryMode,
    paymentCurrency: payload.paymentCurrency,
    customerName: payload.customerName,
    deliveryLocation: payload.deliveryLocation,
    deliveryWindow: payload.deliveryWindow,
    contact: payload.contact,
  };
  flow.step = nextStep(flow);
  return flow;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MsgWithMedia[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actions, setActions] = useState<ChatAction[]>([]);
  const [flow, setFlow] = useState<CheckoutFlow | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationFlow | null>(null);
  const [collections, setCollections] = useState<GiftBox[]>(GIFT_BOXES);
  const phone = useMemo(() => getOrCreatePhone(), []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const automationBootstrapped = useRef(false);

  const setChatOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (typeof document !== "undefined") {
      if (next) document.body.dataset.chatOpen = "true";
      else delete document.body.dataset.chatOpen;
    }
    if (typeof window === "undefined") return;
    const base = `${window.location.pathname}${window.location.search}`;
    if (next) {
      if (window.location.hash !== "#chat") {
        window.history.pushState(null, "", `${base}#chat`);
      }
      return;
    }
    if (window.location.hash === "#chat") {
      window.history.replaceState(null, "", base);
    }
  }, []);

  const append = useCallback((role: Msg["role"], text: string, media?: Partial<MsgWithMedia>) => {
    setMessages((m) => [
      ...m,
      { id: messageId(), role, text, ts: Date.now(), ...media },
    ]);
  }, []);

  const showMainMenu = useCallback(() => {
    setFlow(null);
    setRecommendation(null);
    setActions(MAIN_MENU_ACTIONS);
    append("ai", TOP_MENU_TEXT);
  }, [append]);

  const showCollections = useCallback(() => {
    const lines = [
      "Ready collections:",
      ...collections.map((box) => `- ${box.name} — ${formatUSD(box.price_usd)} / ${formatKES(box.price_kes)}`),
      "",
      "Select one to view contents, price, and checkout options.",
    ];
    setActions([
      ...collections.slice(0, 5).map((box, index) => ({
        label: box.name,
        value: `View ${box.name}`,
        primary: index === 0,
      })),
      { label: "Back to main menu", value: "Main menu" },
    ]);
    append("ai", lines.join("\n"));
  }, [append, collections]);

  const showPrivateBrief = useCallback(() => {
    setActions([
      { label: "Open builder", href: "/build", primary: true },
      { label: "Need recommendation", value: "Need a gift recommendation" },
      { label: "Speak to Concierge", value: "Speak to Concierge" },
    ]);
    append(
      "ai",
      "For bespoke curation, open a private brief and choose the pieces or describe the item you want sourced. I will collect handoff and payment details only after the brief is clear.",
    );
  }, [append]);

  const showLogistics = useCallback(() => {
    setActions([
      { label: "Local handoff", value: "Seamless logistics - local handoff / hotel delivery", primary: true },
      { label: "Departure handoff", value: "Seamless logistics - JKIA departure handoff" },
      { label: "Global export", value: "Global export - DHL export shipping quote" },
      { label: "Back to main menu", value: "Main menu" },
    ]);
    append(
      "ai",
      "Seamless logistics covers local hotel or residence handoff, JKIA departure handoff, safari lodge coordination, and global export quotes. I confirm exact location and timing before promising dispatch.",
    );
  }, [append]);

  const showCorporate = useCallback(() => {
    setActions([
      { label: "Speak to Concierge", value: "Speak to Concierge", primary: true },
      { label: "Explore collections", value: "Explore ready collections" },
    ]);
    append(
      "ai",
      "Corporate gifting needs senior concierge handling. Please share quantity, budget per gift, branding needs, and deadline; I will prepare a clean handoff rather than negotiate rates in chat.",
    );
  }, [append]);

  const showHumanConcierge = useCallback(() => {
    setActions([
      {
        label: "Open WhatsApp",
        href: whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads - I'd like to speak with the concierge."),
        primary: true,
      },
      { label: "Back to main menu", value: "Main menu" },
    ]);
    append(
      "ai",
      "Certainly. You can continue here, or open WhatsApp for a direct concierge handoff to the personal line.",
    );
  }, [append]);

  const beginFlow = useCallback(
    (nextFlow: CheckoutFlow) => {
      const step = nextStep(nextFlow);
      const ready = { ...nextFlow, step };
      setRecommendation(null);
      const question = questionForStep(ready);
      setFlow(ready);
      setActions(question.actions || []);
      setChatOpen(true);
      setMessages((current) => [
        ...current,
        { id: messageId(), role: "ai", text: flowIntro(ready), ts: Date.now() },
        { id: messageId(), role: "ai", text: question.text, ts: Date.now() },
      ]);
    },
    [setChatOpen],
  );

  const presentRecommendation = useCallback(
    (ready: RecommendationFlow) => {
      const box = inferRecommendationBox(ready, collections);
      setRecommendation(null);
      setActions([
        { label: `View ${box.name}`, value: `View ${box.name}`, primary: true },
        { label: "Confirm delivery details", value: `Order ${box.name}` },
        { label: "Adjust budget", value: "Need a gift recommendation" },
        { label: "Speak to Concierge", value: "Speak to Concierge" },
      ]);
      append(
        "ai",
        `Best fit: ${box.name} — ${formatUSD(box.price_usd)} / ${formatKES(box.price_kes)}.\n\n${box.contents}\n\nI can show details, start the delivery questions, or adjust the brief.`,
      );
    },
    [append, collections],
  );

  const beginRecommendation = useCallback(
    (seed?: RecommendationFlow) => {
      const initial = seed || { step: "recipient" as RecommendationStep };
      const ready = { ...initial, step: nextRecommendationStep(initial) };
      setFlow(null);
      setRecommendation(ready);
      setChatOpen(true);
      if (ready.step === "recommend") {
        presentRecommendation(ready);
        return;
      }
      const question = questionForRecommendationStep(ready);
      setActions(question.actions || []);
      append(
        "ai",
        seed?.sourceText
          ? "I can help with that. I’ll collect only the missing details, one step at a time."
          : "I’ll recommend a collection once I understand the guest, occasion, budget, and handoff timing.",
      );
      append("ai", question.text);
    },
    [append, presentRecommendation, setChatOpen],
  );

  const advanceRecommendation = useCallback(
    async (rawText: string, current: RecommendationFlow) => {
      const text = rawText.trim();
      let updated: RecommendationFlow = { ...current };
      setActions([]);
      if (isMainMenuRequest(text)) {
        setRecommendation(null);
        showMainMenu();
        return;
      }
      if (isConciergeRequest(text)) {
        setRecommendation(null);
        showHumanConcierge();
        return;
      }
      if (current.step === "recipient") updated.recipient = text;
      else if (current.step === "occasion") updated.occasion = text;
      else if (current.step === "budget") updated.budget = text;
      else if (current.step === "delivery") updated.deliveryContext = text;

      updated.step = nextRecommendationStep(updated);
      if (updated.step === "recommend") {
        presentRecommendation(updated);
        return;
      }
      setRecommendation(updated);
      const question = questionForRecommendationStep(updated);
      setActions(question.actions || []);
      append("ai", question.text);
    },
    [append, presentRecommendation, showHumanConcierge, showMainMenu],
  );

  const postBackend = useCallback(
    async (text: string): Promise<ApiChatResponse | null> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            text,
            business_slug: BUSINESS_SLUG,
            language: "en",
          }),
          signal: controller.signal,
        });
        const ok = r.ok;
        const body = (await r.json().catch(() => ({}))) as ApiChatResponse & { detail?: string };
        const reply = ok
          ? normalizeAssistantReply(
              body.reply || "(no reply)",
              typeof body?.image_url === "string" ? body.image_url : null,
              typeof body?.photo_item === "string" ? body.photo_item : null,
            )
          : `Couldn't reach the concierge right now - ${body?.detail || r.statusText}`;
        append("ai", reply, {
          imageUrl: typeof body?.image_url === "string" ? body.image_url : null,
          imageAlt: typeof body?.photo_item === "string" ? body.photo_item : null,
        });
        if (ok) {
          setActions(mapApiActions(body.actions));
          return body;
        }
        setActions([]);
        return null;
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        const timedOut = err?.name === "AbortError";
        append(
          "system",
          timedOut
            ? "The concierge line is taking longer than usual. You can continue here, or use WhatsApp for the fastest handoff."
            : `The concierge line is temporarily unreachable: ${err?.message || "unknown"}`,
        );
        setActions([]);
        return null;
      } finally {
        window.clearTimeout(timeout);
      }
    },
    [append, phone],
  );

  const submitFlow = useCallback(
    async (ready: CheckoutFlow) => {
      setBusy(true);
      setActions([]);
      append("ai", "Perfect. I am creating the order now and will return the payment step here.");
      await postBackend(buildBackendCheckoutMessage(ready));
      setFlow(null);
      setBusy(false);
    },
    [append, postBackend],
  );

  const advanceFlow = useCallback(
    async (rawText: string, current: CheckoutFlow) => {
      const text = rawText.trim();
      let updated: CheckoutFlow = { ...current };
      setActions([]);
      // Handle explicit navigation/edit commands first
      const nav = parseNavigationCommand(text);
      if (nav) {
        if (nav.action === "back") {
          const prev = prevStepKey(current.step);
          updated = { ...current, step: prev };
          const question = questionForStep(updated);
          setFlow(updated);
          setActions(question.actions || []);
          append("ai", `Okay — going back. ${question.text}`);
          return;
        }
        if (nav.action === "start_over") {
          // reset editable fields but keep items/totals
          updated = {
            ...current,
            step: "name",
            customerName: undefined,
            deliveryMode: undefined,
            deliveryLocation: undefined,
            deliveryWindow: undefined,
            paymentCurrency: undefined,
            contact: undefined,
          };
          const question = questionForStep(updated);
          setFlow(updated);
          setActions(question.actions || []);
          append("ai", "Okay — starting over. " + question.text);
          return;
        }
        if (nav.action === "edit") {
          if (nav.field) {
            updated = { ...current, step: nav.field };
            const question = questionForStep(updated);
            setFlow(updated);
            setActions(question.actions || []);
            append("ai", `Sure — let's update that detail.`);
            append("ai", question.text);
            return;
          }
          const editActions: ChatAction[] = [
            { label: "Edit name", value: "Edit name" },
            { label: "Edit delivery", value: "Edit delivery" },
            { label: "Edit location", value: "Edit location" },
            { label: "Edit timing", value: "Edit timing" },
            { label: "Edit payment", value: "Edit payment" },
            { label: "Edit contact", value: "Edit contact" },
          ];
          setActions(editActions);
          append("ai", "Sure — which detail would you like to change? (Name, Delivery, Location, Timing, Payment, Contact)");
          return;
        }
      }

      if (current.step === "confirm") {
        // If user responds negatively, offer targeted edit options rather than resetting everything
        const editActions: ChatAction[] = [
          { label: "Edit name", value: "Edit name" },
          { label: "Edit delivery", value: "Edit delivery" },
          { label: "Edit location", value: "Edit location" },
          { label: "Edit timing", value: "Edit timing" },
          { label: "Edit payment", value: "Edit payment" },
          { label: "Edit contact", value: "Edit contact" },
        ];
        if (isNo(text)) {
          setActions(editActions);
          append("ai", "No problem. Tell me which detail to edit or tap one of the options.");
          return;
        }
        if (!isYes(text)) {
          const question = questionForStep(current);
          setActions(question.actions || []);
          append("ai", "Please confirm before I create the order, or tell me what to edit.");
          return;
        }
        await submitFlow(current);
        return;
      }

      if (current.step === "name") {
        if (text.length < 2) {
          append("ai", "Please send the guest name for the order.");
          return;
        }
        updated.customerName = text;
      } else if (current.step === "delivery_mode") {
        const mode = parseDeliveryMode(text);
        if (!mode) {
          const question = questionForStep(current);
          setActions(question.actions || []);
          append("ai", "Choose seamless nationwide logistics or global export; I will collect the exact handoff details step by step.");
          return;
        }
        updated.deliveryMode = mode;
      } else if (current.step === "location") {
        if (text.length < 5) {
          append("ai", questionForStep(current).text);
          return;
        }
        updated.deliveryLocation = text;
      } else if (current.step === "window") {
        if (text.length < 3) {
          append("ai", questionForStep(current).text);
          return;
        }
        updated.deliveryWindow = text;
      } else if (current.step === "payment") {
        const payment = parsePayment(text);
        if (!payment) {
          const question = questionForStep(current);
          setActions(question.actions || []);
          append("ai", "Choose USD card link or KES M-Pesa.");
          return;
        }
        updated.paymentCurrency = payment;
      } else if (current.step === "contact") {
        if (!contactLooksOk(text, current.paymentCurrency)) {
          append("ai", questionForStep(current).text);
          return;
        }
        updated.contact = text;
      }

      updated.step = nextStep(updated);
      const question = questionForStep(updated);
      setFlow(updated);
      setActions(question.actions || []);
      append("ai", question.text);
    },
    [append, submitFlow],
  );

  const handleLocalIntent = useCallback(
    (text: string) => {
      if (isMainMenuRequest(text) || isGreeting(text)) {
        showMainMenu();
        return true;
      }

      if (isCatalogRequest(text)) {
        showCollections();
        return true;
      }

      if (isCustomBoxRequest(text)) {
        showPrivateBrief();
        return true;
      }

      if (isCorporateRequest(text)) {
        showCorporate();
        return true;
      }

      if (isLogisticsRequest(text) && !resolveBoxFromText(text, collections)) {
        showLogistics();
        return true;
      }

      if (isConciergeRequest(text)) {
        showHumanConcierge();
        return true;
      }

      if (isRecommendationRequest(text)) {
        beginRecommendation(seedRecommendationFromText(text));
        return true;
      }

      const box = resolveBoxFromText(text, collections);
      if (box && /\b(order|buy|get|reserve|checkout|want|need|yes)\b/i.test(text)) {
        const started = createCollectionFlow({ kind: "collection", collectionId: box.id }, collections);
        if (started) beginFlow(started);
        return true;
      }

      if (box) {
        setActions([
          { label: `Order ${box.name}`, value: `Order ${box.name}`, primary: true },
          { label: "Show all collections", value: "Show me your gift collections" },
        ]);
        append(
          "ai",
          `${box.name} is ${formatUSD(box.price_usd)} / ${formatKES(box.price_kes)}. ${box.contents} Lead time: ${box.lead_time_hours}h.`,
        );
        return true;
      }

      return false;
    },
    [
      append,
      beginFlow,
      beginRecommendation,
      collections,
      showCollections,
      showCorporate,
      showHumanConcierge,
      showLogistics,
      showMainMenu,
      showPrivateBrief,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const res = await fetch("/api/catalog");
        if (!res.ok) return;
        const body = (await res.json()) as PortalCatalogResponse;
        if (!cancelled && Array.isArray(body.collections) && body.collections.length) {
          setCollections(body.collections);
        }
      } catch {
        // Static catalog remains as a safe client fallback.
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? draft).trim();
      if (!text || busy) return;
      append("user", text);
      setDraft("");
      setActions([]);

      if (flow) {
        await advanceFlow(text, flow);
        return;
      }
      if (recommendation) {
        await advanceRecommendation(text, recommendation);
        return;
      }
      if (handleLocalIntent(text)) return;

      setBusy(true);
      await postBackend(text);
      setBusy(false);
    },
    [advanceFlow, advanceRecommendation, append, busy, draft, flow, handleLocalIntent, postBackend, recommendation],
  );

  useEffect(() => {
    if (window.location.hash === "#chat") setChatOpen(true);
    const onHash = () => setChatOpen(window.location.hash === "#chat");
    const onOpen = () => setChatOpen(true);
    const onClose = () => setChatOpen(false);
    window.addEventListener("hashchange", onHash);
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    window.addEventListener(CHAT_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
      window.removeEventListener(CHAT_CLOSE_EVENT, onClose);
      delete document.body.dataset.chatOpen;
    };
  }, [setChatOpen]);

  useEffect(() => {
    if (!open) {
      automationBootstrapped.current = false;
      return;
    }
    if (messages.length === 0 && !automationBootstrapped.current && !flow && !recommendation) {
      automationBootstrapped.current = true;
      showMainMenu();
    }
  }, [flow, messages.length, open, recommendation, showMainMenu]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const custom = event as CustomEvent<ChatPromptDetail>;
      setChatOpen(true);
      if (custom.detail?.checkout?.kind === "collection") {
        const started = createCollectionFlow(custom.detail.checkout, collections);
        if (started) beginFlow(started);
        return;
      }
      if (custom.detail?.checkout?.kind === "custom") {
        const started = createCustomFlow(custom.detail.checkout);
        if (started) beginFlow(started);
        return;
      }
      const prompt = custom.detail?.prompt?.trim();
      if (prompt) {
        append("user", prompt);
        setBusy(true);
        void postBackend(prompt).finally(() => setBusy(false));
      }
    };
    window.addEventListener("hazina:chat-prompt", onPrompt as EventListener);
    return () => window.removeEventListener("hazina:chat-prompt", onPrompt as EventListener);
  }, [append, beginFlow, collections, postBackend, setChatOpen]);

  const hasUserMessages = messages.some((m) => m.role === "user");
  const visibleActions = actions.length > 0 ? actions : !hasUserMessages && !busy ? MAIN_MENU_ACTIONS : [];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open private concierge chat"
          className="fixed bottom-[4.75rem] right-4 z-[100] inline-flex min-h-[50px] items-center gap-2 rounded-full border border-[#caa777]/35 bg-[#101010]/92 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white shadow-editorial backdrop-blur-md transition hover:bg-[#181818] active:scale-[0.98] md:bottom-6"
        >
          <span className="font-serif text-sm normal-case tracking-normal text-[#e8d4b4]">Concierge</span>
        </button>
      )}

      {open && (
        <div
          className="concierge-shell fixed inset-x-3 bottom-[4.75rem] z-[100] flex max-h-[min(72svh,640px)] flex-col md:inset-x-auto md:bottom-auto md:right-6 md:top-24 md:max-h-[calc(100svh-7rem)] md:w-[min(440px,calc(100vw-2rem))]"
          role="dialog"
          aria-label="Hazina private concierge"
        >
          <div className="concierge-header flex items-start justify-between gap-3 px-4 py-4 text-white">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#caa777]">
                Private sourcing desk
              </div>
              <div className="mt-1 font-serif text-2xl leading-tight tracking-[-0.02em] text-white">
                Hazina Private Concierge
              </div>
              <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-white/62">
                Curated collections, delivery windows, and secure checkout — one step at a time.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close concierge chat"
                className="inline-flex h-9 w-9 items-center justify-center border border-white/20 text-lg text-white/85 hover:border-[#caa777]/50 hover:text-white"
              >
                ×
              </button>
              <a
                href={whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads - I'd like concierge help.")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#d6b387] hover:text-white"
              >
                WhatsApp
              </a>
            </div>
          </div>

          <div ref={scrollerRef} className="concierge-canvas flex-1 space-y-3 overflow-auto p-4 local-scroll local-scroll--subtle">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-1 pl-2 py-1" aria-label="typing">
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink/30" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink/30" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink/30" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            {!busy && visibleActions.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[#d8cfc0]/70 pt-3">
                {visibleActions.map((p) =>
                  p.href ? (
                    <a
                      key={`${p.label}-${p.href}`}
                      href={p.href}
                      className={`min-h-[36px] rounded-[4px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.13em] transition-colors ${
                        p.primary
                          ? "concierge-action-primary bg-[#121212] text-[#f4efe6] hover:bg-black"
                          : "concierge-action-secondary border border-[#c8c0b2] bg-sand/70 text-[#2a2622] hover:border-[#121212]"
                      }`}
                    >
                      {p.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      key={`${p.label}-${p.value || ""}`}
                      onClick={() => send(p.value || p.label)}
                      className={`min-h-[36px] rounded-[4px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.13em] transition-colors ${
                        p.primary
                          ? "concierge-action-primary bg-[#121212] text-[#f4efe6] hover:bg-black"
                          : "concierge-action-secondary border border-[#c8c0b2] bg-sand/70 text-[#2a2622] hover:border-[#121212]"
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div className="concierge-composer flex items-end gap-2 p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={flow ? "Detail one requirement..." : "Message your concierge..."}
              className="concierge-textarea min-h-[44px] flex-1 resize-none rounded-[4px] border border-transparent bg-sand/75 px-3 py-2.5 text-[15px] leading-relaxed text-[#1a1815] placeholder:font-serif placeholder:text-[#7a7268] placeholder:italic outline-none focus:border-[#b4966f]/70 focus:bg-sand"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !draft.trim()}
              className="min-h-[44px] rounded-[4px] bg-[#101010] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function triggerConciergePrompt(prompt: string) {
  if (typeof window === "undefined") return;
  openConciergeChat();
  window.dispatchEvent(new CustomEvent("hazina:chat-prompt", { detail: { prompt } }));
}

function Bubble({ m }: { m: MsgWithMedia }) {
  if (m.role === "system") {
    return (
      <div className="py-1 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-[#7a7268]">
        {m.text}
      </div>
    );
  }
  const mine = m.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[88%] px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap " +
          (mine ? "concierge-bubble-user" : "concierge-bubble-ai")
        }
      >
        {!mine && m.imageUrl && (
          <Image
            src={m.imageUrl}
            alt={m.imageAlt || "Product photo"}
            width={240}
            height={160}
            className="mb-2 w-full max-w-[240px] rounded-md object-cover"
            unoptimized
          />
        )}
        {m.text}
      </div>
    </div>
  );
}
