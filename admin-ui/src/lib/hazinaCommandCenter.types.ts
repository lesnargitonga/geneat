export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CommandCenterRole =
  | "viewer"
  | "staff"
  | "ops_manager"
  | "admin"
  | "owner"
  | "platform_admin";

export type CatalogStatus = "active" | "draft" | "paused" | "retired";
export type PromptStatus = "draft" | "active" | "archived";
export type SourcingStatus =
  | "visual_brief_submitted"
  | "field_validation"
  | "quoted"
  | "procured"
  | "dispatched"
  | "closed_lost"
  | "cancelled";
export type ManifestStatus =
  | "draft"
  | "awaiting_payment"
  | "confirmed"
  | "sourcing"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "export_quoted"
  | "cancelled"
  | "failed";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

type OrgScoped = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at?: string;
};

export type CommandCenterDatabase = {
  public: {
    Tables: {
      organizations: Table<{
        id: string;
        slug: string;
        name: string;
        triad: string;
        timezone: string;
        default_currency: string;
        metadata: Json;
        created_at: string;
        updated_at: string;
      }>;
      global_configurations: Table<
        OrgScoped & {
          config_key: string;
          label: string | null;
          description: string | null;
          value_type: "string" | "number" | "boolean" | "json" | "secret_ref";
          value_json: Json | null;
          value_text: string | null;
          is_secret: boolean;
          is_public: boolean;
          tags: string[];
          updated_by: string | null;
        }
      >;
      system_prompts: Table<
        OrgScoped & {
          prompt_key: string;
          scope:
            | "master"
            | "voice"
            | "guardrails"
            | "tool_policy"
            | "vertical_playbook"
            | "fallback"
            | "experiment";
          title: string;
          body: string;
          guardrails: Json;
          tool_policy: Json;
          version: number;
          status: PromptStatus;
          active: boolean;
          checksum: string | null;
          edited_by: string | null;
          approved_by: string | null;
          activated_at: string | null;
        }
      >;
      catalog_items: Table<
        OrgScoped & {
          sku: string;
          name: string;
          pillar: "bespoke_curation" | "seamless_logistics" | "global_export";
          category: string;
          status: CatalogStatus;
          description: string | null;
          story_card_copy: string | null;
          image_url: string | null;
          price_usd: number;
          price_kes: number;
          internal_cost_usd: number | null;
          internal_cost_kes: number | null;
          stock_count: number;
          stock_enabled: boolean;
          lead_time_hours: number;
          is_engravable: boolean;
          is_exportable: boolean;
          tags: string[];
          metadata: Json;
          created_by: string | null;
          updated_by: string | null;
        }
      >;
      catalog_collections: Table<
        OrgScoped & {
          sku: string;
          name: string;
          target: string | null;
          status: CatalogStatus;
          price_usd: number;
          price_kes: number;
          lead_time_hours: number;
          hero_image_url: string | null;
          contents_summary: string | null;
          metadata: Json;
        }
      >;
      conversation_sessions: Table<
        OrgScoped & {
          client_id: string | null;
          channel: "whatsapp" | "portal_chat" | "instagram" | "email" | "phone" | "manual";
          provider_thread_id: string | null;
          langgraph_thread_id: string | null;
          status:
            | "active"
            | "waiting_guest"
            | "ai_paused"
            | "human_takeover"
            | "resolved"
            | "archived";
          takeover_state: "ai_active" | "human_requested" | "human_active" | "released";
          takeover_by: string | null;
          takeover_reason: string | null;
          ai_enabled: boolean;
          active_workflow: string | null;
          workflow_state: Json;
          last_message_at: string | null;
        }
      >;
      sourcing_briefs: Table<
        OrgScoped & {
          client_id: string | null;
          session_id: string | null;
          status: SourcingStatus;
          title: string;
          guest_request: string;
          pillar: "bespoke_curation" | "seamless_logistics" | "global_export";
          requested_deadline: string | null;
          fulfillment:
            | "metropolitan"
            | "highlands"
            | "savannah"
            | "coastal"
            | "departure_handoff"
            | "global_export"
            | null;
          delivery_location: string | null;
          field_team_notes: string | null;
          estimated_price_usd: number | null;
          estimated_price_kes: number | null;
          actual_cost_usd: number | null;
          actual_cost_kes: number | null;
          markup_multiplier: number | null;
          assigned_to: string | null;
          created_by: string | null;
        }
      >;
      concierge_orders: Table<
        OrgScoped & {
          client_id: string | null;
          session_id: string | null;
          order_ref: string;
          status: ManifestStatus;
          payment_status:
            | "not_requested"
            | "pending"
            | "paid"
            | "failed"
            | "expired"
            | "refunded"
            | "cancelled";
          payment_provider: "intasend" | "paystack" | "manual_invoice" | "cash" | "other" | null;
          currency: string;
          amount_usd: number | null;
          amount_kes: number | null;
          fulfillment:
            | "metropolitan"
            | "highlands"
            | "savannah"
            | "coastal"
            | "departure_handoff"
            | "global_export"
            | null;
          delivery_location: string | null;
          promised_at: string | null;
          delivered_at: string | null;
          items: Json;
          metadata: Json;
        }
      >;
      gatekeepers: Table<
        OrgScoped & {
          kind:
            | "safari_driver"
            | "luxury_host"
            | "airport_hostess"
            | "hotel_concierge"
            | "travel_agent"
            | "guide"
            | "other";
          status: "prospect" | "active" | "paused" | "blocked";
          display_name: string;
          company_name: string | null;
          phone: string | null;
          email: string | null;
          default_commission_rate: number;
          notes: string | null;
          metadata: Json;
        }
      >;
      analytics_snapshots: Table<
        OrgScoped & {
          period_start: string;
          period_end: string;
          gmv_usd: number;
          gmv_kes: number;
          average_order_value_usd: number;
          active_manifests: number;
          ai_takeover_rate: number;
          fulfillment_split: Json;
          sourcing_funnel: Json;
          lead_time_report: Json;
          created_at: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      current_admin_role: {
        Args: { p_org_id: string };
        Returns: CommandCenterRole | null;
      };
      can_view_org: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      can_operate_org: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      can_manage_org: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      admin_role: CommandCenterRole;
      catalog_status: CatalogStatus;
      manifest_status: ManifestStatus;
      prompt_status: PromptStatus;
      sourcing_status: SourcingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
