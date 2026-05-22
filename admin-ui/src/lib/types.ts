export type AdminRole = "superadmin" | "owner" | "staff" | "viewer";

export interface Membership {
  business_id: string;
  business_slug: string;
  business_name: string;
  role: AdminRole;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  is_superadmin: boolean;
  active: boolean;
  last_login_at: string | null;
  memberships: Membership[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_at: string;
  user: AdminUser;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  timezone?: string;
  currency?: string;
  profile?: Record<string, unknown>;
  created_at?: string;
}

export type ChannelKind = "whatsapp" | "voice" | "sms" | "mock";
export type ConversationStatus =
  | "active"
  | "pending"
  | "human_escalated"
  | "resolved"
  | "abandoned";

export interface ConversationSummary {
  id: string;
  business_id: string;
  customer_id: string;
  channel: ChannelKind;
  status: ConversationStatus;
  ai_paused: boolean;
  taken_over_by: string | null;
  last_activity_at: string;
  last_message_preview?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool" | "staff";
  content: string;
  created_at: string;
  channel?: ChannelKind;
  meta?: Record<string, unknown>;
}

export interface KbItem {
  id: string;
  business_id: string;
  source: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  business_id: string;
  url: string;
  events: string[];
  active: boolean;
  last_status: number | null;
  last_error: string | null;
  last_delivery_at: string | null;
  failure_count: number;
  created_at: string;
}

export interface Broadcast {
  id: string;
  business_id: string;
  channel: ChannelKind;
  title: string;
  body: string;
  status: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
  total: number;
  sent: number;
  failed: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface UsageBucket {
  day: string;
  messages_in: number;
  messages_out: number;
  voice_minutes: number;
  tokens_in: number;
  tokens_out: number;
  cost_estimate: number;
}

export interface AuditEvent {
  id: string;
  created_at: string;
  actor_email: string | null;
  business_slug: string | null;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
}
