import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CommandCenterDatabase } from "@/lib/hazinaCommandCenter.types";

export const HAZINA_ORG_SLUG =
  import.meta.env.VITE_HAZINA_ORG_SLUG?.trim() || "hazina-nomads";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

let commandCenterClient: SupabaseClient<CommandCenterDatabase> | null = null;

export function getCommandCenterEnv() {
  return {
    configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    orgSlug: HAZINA_ORG_SLUG,
    missing: [
      !SUPABASE_URL && "VITE_SUPABASE_URL",
      !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    ].filter((value): value is string => Boolean(value)),
  };
}

export function getCommandCenterClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!commandCenterClient) {
    commandCenterClient = createClient<CommandCenterDatabase>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
  }
  return commandCenterClient;
}

export const COMMAND_CENTER_MODULES = [
  {
    label: "Live Desk",
    tables: ["conversation_sessions", "conversation_messages", "takeover_events", "vip_clients"],
    description: "AI override, VIP context, takeover state, and guest message history.",
  },
  {
    label: "Sourcing Kanban",
    tables: ["sourcing_briefs", "sourcing_assets", "sourcing_quotes", "checkout_links"],
    description: "Reference-photo briefs, validation media, quotes, and payment links.",
  },
  {
    label: "Catalog Ops",
    tables: [
      "catalog_items",
      "catalog_collections",
      "catalog_collection_items",
      "inventory_movements",
      "operation_overrides",
    ],
    description: "Live price, stock, lead-time, collection, and operations controls.",
  },
  {
    label: "Prompt Vault",
    tables: ["system_prompts"],
    description: "Versioned LangGraph instructions, guardrails, and tool policy.",
  },
  {
    label: "Config Vault",
    tables: ["global_configurations"],
    description: "No-code business variables for copy, commissions, fees, and lead times.",
  },
  {
    label: "Gatekeepers",
    tables: ["gatekeepers", "gatekeeper_links", "gatekeeper_attributions", "commission_entries"],
    description: "Referral links, partner performance, attribution, and payout ledger.",
  },
  {
    label: "Analytics",
    tables: ["analytics_events", "analytics_snapshots"],
    description: "GMV, handoff mix, sourcing funnel, AI takeover, and lead-time reporting.",
  },
] as const;
