export type OrderLine = {
  name: string;
  quantity: number;
  price_usd: number;
};

export type TimelineStatus = "complete" | "active" | "upcoming";

export type TimelineStep = {
  id: string;
  label: string;
  status: TimelineStatus;
  courier_note?: string | null;
};

export type PublicOrder = {
  reference: string;
  placed_at: string;
  destination: string;
  delivery_window: string;
  lines: OrderLine[];
  total_usd: number;
  total_kes: number;
  payment_status: string;
  fulfillment_status: string;
  timeline: TimelineStep[];
};
