-- Hazina Nomads Command Center - Phase 1 database architecture
-- Supabase/PostgreSQL schema for AI override, sourcing, catalog ops,
-- affiliate tracking, analytics, live prompt control, and no-code config.

create extension if not exists pgcrypto;

do $$ begin
  create type admin_role as enum ('viewer', 'staff', 'ops_manager', 'admin', 'owner', 'platform_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type brand_pillar as enum ('bespoke_curation', 'seamless_logistics', 'global_export');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_channel as enum ('whatsapp', 'portal_chat', 'instagram', 'email', 'phone', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_status as enum ('active', 'waiting_guest', 'ai_paused', 'human_takeover', 'resolved', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_sender as enum ('guest', 'ai', 'human_admin', 'system', 'provider');
exception when duplicate_object then null; end $$;

do $$ begin
  create type takeover_state as enum ('ai_active', 'human_requested', 'human_active', 'released');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sourcing_status as enum ('visual_brief_submitted', 'field_validation', 'quoted', 'procured', 'dispatched', 'closed_lost', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_kind as enum ('guest_reference', 'field_validation', 'procurement_receipt', 'dispatch_proof', 'quality_control');
exception when duplicate_object then null; end $$;

do $$ begin
  create type catalog_status as enum ('active', 'draft', 'paused', 'retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inventory_reason as enum ('manual_adjustment', 'procurement', 'order_reserved', 'order_released', 'damaged', 'stocktake');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fulfillment_channel as enum ('metropolitan', 'highlands', 'savannah', 'coastal', 'departure_handoff', 'global_export');
exception when duplicate_object then null; end $$;

do $$ begin
  create type manifest_status as enum ('draft', 'awaiting_payment', 'confirmed', 'sourcing', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'export_quoted', 'cancelled', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_provider as enum ('intasend', 'paystack', 'manual_invoice', 'cash', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('not_requested', 'pending', 'paid', 'failed', 'expired', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checkout_status as enum ('draft', 'sent', 'opened', 'paid', 'expired', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gatekeeper_kind as enum ('safari_driver', 'luxury_host', 'airport_hostess', 'hotel_concierge', 'travel_agent', 'guide', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gatekeeper_status as enum ('prospect', 'active', 'paused', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type commission_status as enum ('pending', 'approved', 'paid', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prompt_scope as enum ('master', 'voice', 'guardrails', 'tool_policy', 'vertical_playbook', 'fallback', 'experiment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prompt_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type config_value_type as enum ('string', 'number', 'boolean', 'json', 'secret_ref');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  triad text not null default 'Bespoke Curation · Seamless Logistics · Global Export',
  timezone text not null default 'Africa/Nairobi',
  default_currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role admin_role not null default 'viewer',
  title text,
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function current_admin_role(p_org_id uuid)
returns admin_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from organization_memberships
  where organization_id = p_org_id
    and user_id = auth.uid()
    and active = true
  order by case role
    when 'platform_admin' then 6
    when 'owner' then 5
    when 'admin' then 4
    when 'ops_manager' then 3
    when 'staff' then 2
    when 'viewer' then 1
  end desc
  limit 1;
$$;

create or replace function can_view_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where organization_id = p_org_id
      and user_id = auth.uid()
      and active = true
  );
$$;

create or replace function can_operate_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_admin_role(p_org_id) in ('staff', 'ops_manager', 'admin', 'owner', 'platform_admin'), false);
$$;

create or replace function can_manage_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_admin_role(p_org_id) in ('admin', 'owner', 'platform_admin'), false);
$$;

create table if not exists vip_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  external_customer_id text,
  display_name text,
  phone_e164 text,
  email text,
  whatsapp_wa_id text,
  vip_tier text not null default 'standard',
  home_country text,
  preferred_currency text not null default 'USD',
  preferences jsonb not null default '{}'::jsonb,
  risk_notes text,
  lifetime_gmv_usd numeric(14,2) not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, whatsapp_wa_id),
  unique (organization_id, phone_e164)
);

create table if not exists conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references vip_clients(id) on delete set null,
  channel conversation_channel not null default 'whatsapp',
  provider_thread_id text,
  langgraph_thread_id text,
  status conversation_status not null default 'active',
  takeover_state takeover_state not null default 'ai_active',
  takeover_by uuid references auth.users(id) on delete set null,
  takeover_reason text,
  ai_enabled boolean not null default true,
  active_workflow text,
  workflow_state jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, provider_thread_id)
);

create table if not exists conversation_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id uuid not null references conversation_sessions(id) on delete cascade,
  sender message_sender not null,
  body text,
  media_urls text[] not null default '{}',
  provider_message_id text,
  tool_calls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists takeover_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id uuid not null references conversation_sessions(id) on delete cascade,
  from_state takeover_state,
  to_state takeover_state not null,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  pillar brand_pillar not null default 'bespoke_curation',
  category text not null default 'treasure',
  status catalog_status not null default 'active',
  description text,
  story_card_copy text,
  image_url text,
  price_usd numeric(12,2) not null check (price_usd >= 0),
  price_kes numeric(12,2) not null check (price_kes >= 0),
  internal_cost_usd numeric(12,2) check (internal_cost_usd is null or internal_cost_usd >= 0),
  internal_cost_kes numeric(12,2) check (internal_cost_kes is null or internal_cost_kes >= 0),
  stock_count integer not null default 0 check (stock_count >= 0),
  stock_enabled boolean not null default true,
  lead_time_hours integer not null default 24 check (lead_time_hours >= 0),
  is_engravable boolean not null default false,
  is_exportable boolean not null default true,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists catalog_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  target text,
  status catalog_status not null default 'active',
  price_usd numeric(12,2) not null check (price_usd >= 0),
  price_kes numeric(12,2) not null check (price_kes >= 0),
  lead_time_hours integer not null default 24 check (lead_time_hours >= 0),
  hero_image_url text,
  contents_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists catalog_collection_items (
  collection_id uuid not null references catalog_collections(id) on delete cascade,
  item_id uuid not null references catalog_items(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0,
  primary key (collection_id, item_id)
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id uuid not null references catalog_items(id) on delete cascade,
  delta integer not null,
  reason inventory_reason not null,
  note text,
  related_order_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists global_configurations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  config_key text not null,
  label text,
  description text,
  value_type config_value_type not null default 'json',
  value_json jsonb,
  value_text text,
  is_secret boolean not null default false,
  is_public boolean not null default false,
  tags text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, config_key),
  check (value_json is not null or value_text is not null)
);

create table if not exists operation_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  pillar brand_pillar not null,
  fulfillment fulfillment_channel,
  title text not null,
  lead_time_hours integer check (lead_time_hours is null or lead_time_hours >= 0),
  surcharge_usd numeric(12,2) check (surcharge_usd is null or surcharge_usd >= 0),
  surcharge_kes numeric(12,2) check (surcharge_kes is null or surcharge_kes >= 0),
  active boolean not null default true,
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists system_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prompt_key text not null,
  scope prompt_scope not null default 'master',
  title text not null,
  body text not null,
  guardrails jsonb not null default '{}'::jsonb,
  tool_policy jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  status prompt_status not null default 'draft',
  active boolean not null default false,
  checksum text generated always as (encode(digest(body, 'sha256'), 'hex')) stored,
  edited_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, prompt_key, version)
);

create unique index if not exists one_active_system_prompt_per_key
  on system_prompts (organization_id, prompt_key)
  where active = true;

create table if not exists sourcing_briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references vip_clients(id) on delete set null,
  session_id uuid references conversation_sessions(id) on delete set null,
  status sourcing_status not null default 'visual_brief_submitted',
  title text not null,
  guest_request text not null,
  pillar brand_pillar not null default 'bespoke_curation',
  requested_deadline timestamptz,
  fulfillment fulfillment_channel,
  delivery_location text,
  field_team_notes text,
  estimated_price_usd numeric(12,2),
  estimated_price_kes numeric(12,2),
  actual_cost_usd numeric(12,2),
  actual_cost_kes numeric(12,2),
  markup_multiplier numeric(8,4),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sourcing_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brief_id uuid not null references sourcing_briefs(id) on delete cascade,
  kind asset_kind not null,
  storage_path text not null,
  public_url text,
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sourcing_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brief_id uuid not null references sourcing_briefs(id) on delete cascade,
  quote_ref text not null,
  cost_usd numeric(12,2) not null default 0,
  cost_kes numeric(12,2) not null default 0,
  markup_usd numeric(12,2) not null default 0,
  markup_kes numeric(12,2) not null default 0,
  price_usd numeric(12,2) not null,
  price_kes numeric(12,2) not null,
  expires_at timestamptz,
  approved_by_client boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, quote_ref)
);

create table if not exists checkout_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references vip_clients(id) on delete set null,
  session_id uuid references conversation_sessions(id) on delete set null,
  brief_id uuid references sourcing_briefs(id) on delete set null,
  quote_id uuid references sourcing_quotes(id) on delete set null,
  provider payment_provider not null,
  status checkout_status not null default 'draft',
  currency text not null default 'USD',
  amount numeric(12,2) not null check (amount >= 0),
  provider_ref text,
  url text,
  sent_to_whatsapp_at timestamptz,
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists concierge_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references vip_clients(id) on delete set null,
  session_id uuid references conversation_sessions(id) on delete set null,
  order_ref text not null,
  status manifest_status not null default 'draft',
  payment_status payment_status not null default 'not_requested',
  payment_provider payment_provider,
  currency text not null default 'USD',
  amount_usd numeric(12,2),
  amount_kes numeric(12,2),
  fulfillment fulfillment_channel,
  delivery_location text,
  promised_at timestamptz,
  delivered_at timestamptz,
  items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_ref)
);

create table if not exists logistics_manifests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid references concierge_orders(id) on delete cascade,
  brief_id uuid references sourcing_briefs(id) on delete set null,
  fulfillment fulfillment_channel not null,
  status manifest_status not null default 'draft',
  courier_name text,
  courier_phone text,
  pickup_location text,
  dropoff_location text,
  promised_at timestamptz,
  actual_pickup_at timestamptz,
  actual_delivery_at timestamptz,
  tracking_code text,
  proof_asset_id uuid references sourcing_assets(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manifest_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  manifest_id uuid not null references logistics_manifests(id) on delete cascade,
  status manifest_status not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists gatekeepers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind gatekeeper_kind not null,
  status gatekeeper_status not null default 'active',
  display_name text not null,
  company_name text,
  phone text,
  email text,
  default_commission_rate numeric(7,4) not null default 0.15 check (default_commission_rate >= 0),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gatekeeper_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gatekeeper_id uuid not null references gatekeepers(id) on delete cascade,
  tracking_code text not null,
  short_url text,
  scans_count integer not null default 0 check (scans_count >= 0),
  closed_briefs_count integer not null default 0 check (closed_briefs_count >= 0),
  gmv_usd numeric(14,2) not null default 0,
  gmv_kes numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tracking_code)
);

create table if not exists gatekeeper_attributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gatekeeper_id uuid references gatekeepers(id) on delete set null,
  link_id uuid references gatekeeper_links(id) on delete set null,
  client_id uuid references vip_clients(id) on delete set null,
  session_id uuid references conversation_sessions(id) on delete set null,
  order_id uuid references concierge_orders(id) on delete set null,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists commission_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gatekeeper_id uuid not null references gatekeepers(id) on delete cascade,
  order_id uuid references concierge_orders(id) on delete set null,
  status commission_status not null default 'pending',
  base_amount_kes numeric(14,2) not null default 0,
  commission_rate numeric(7,4) not null default 0.15,
  commission_amount_kes numeric(14,2) not null default 0,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_name text not null,
  client_id uuid references vip_clients(id) on delete set null,
  session_id uuid references conversation_sessions(id) on delete set null,
  order_id uuid references concierge_orders(id) on delete set null,
  fulfillment fulfillment_channel,
  amount_usd numeric(14,2),
  amount_kes numeric(14,2),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gmv_usd numeric(14,2) not null default 0,
  gmv_kes numeric(14,2) not null default 0,
  average_order_value_usd numeric(14,2) not null default 0,
  active_manifests integer not null default 0,
  ai_takeover_rate numeric(8,4) not null default 0,
  fulfillment_split jsonb not null default '{}'::jsonb,
  sourcing_funnel jsonb not null default '{}'::jsonb,
  lead_time_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, period_start, period_end)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  severity audit_severity not null default 'info',
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_org_status on conversation_sessions (organization_id, status, last_message_at desc);
create index if not exists idx_messages_session_created on conversation_messages (session_id, created_at);
create index if not exists idx_sourcing_org_status on sourcing_briefs (organization_id, status, updated_at desc);
create index if not exists idx_catalog_items_org_status on catalog_items (organization_id, status, sku);
create index if not exists idx_orders_org_ref on concierge_orders (organization_id, order_ref);
create index if not exists idx_manifests_org_status on logistics_manifests (organization_id, status, promised_at);
create index if not exists idx_gatekeeper_links_org_code on gatekeeper_links (organization_id, tracking_code);
create index if not exists idx_analytics_events_org_time on analytics_events (organization_id, occurred_at desc);

do $$ declare
  t text;
begin
  foreach t in array array[
    'organizations',
    'admin_profiles',
    'organization_memberships',
    'vip_clients',
    'conversation_sessions',
    'conversation_messages',
    'takeover_events',
    'catalog_items',
    'catalog_collections',
    'catalog_collection_items',
    'inventory_movements',
    'global_configurations',
    'operation_overrides',
    'system_prompts',
    'sourcing_briefs',
    'sourcing_assets',
    'sourcing_quotes',
    'checkout_links',
    'concierge_orders',
    'logistics_manifests',
    'manifest_events',
    'gatekeepers',
    'gatekeeper_links',
    'gatekeeper_attributions',
    'commission_entries',
    'analytics_events',
    'analytics_snapshots',
    'audit_events'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

do $$ declare
  t text;
begin
  foreach t in array array[
    'organizations',
    'admin_profiles',
    'organization_memberships',
    'vip_clients',
    'conversation_sessions',
    'conversation_messages',
    'takeover_events',
    'catalog_items',
    'catalog_collections',
    'inventory_movements',
    'global_configurations',
    'operation_overrides',
    'system_prompts',
    'sourcing_briefs',
    'sourcing_assets',
    'sourcing_quotes',
    'checkout_links',
    'concierge_orders',
    'logistics_manifests',
    'manifest_events',
    'gatekeepers',
    'gatekeeper_links',
    'gatekeeper_attributions',
    'commission_entries'
  ] loop
    execute format('drop trigger if exists trg_%I_touch_updated_at on %I', t, t);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      execute format(
        'create trigger trg_%I_touch_updated_at before update on %I for each row execute function touch_updated_at()',
        t,
        t
      );
    end if;
  end loop;
end $$;

-- RLS policies
drop policy if exists organizations_select_member on organizations;
create policy organizations_select_member on organizations
  for select to authenticated
  using (can_view_org(id));

drop policy if exists organizations_update_manager on organizations;
create policy organizations_update_manager on organizations
  for update to authenticated
  using (can_manage_org(id))
  with check (can_manage_org(id));

drop policy if exists admin_profiles_select_self_or_member on admin_profiles;
create policy admin_profiles_select_self_or_member on admin_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from organization_memberships m1
      join organization_memberships m2 on m2.organization_id = m1.organization_id
      where m1.user_id = auth.uid()
        and m2.user_id = admin_profiles.user_id
        and m1.active = true
        and m2.active = true
    )
  );

drop policy if exists admin_profiles_upsert_self on admin_profiles;
create policy admin_profiles_upsert_self on admin_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists memberships_select_member on organization_memberships;
create policy memberships_select_member on organization_memberships
  for select to authenticated
  using (can_view_org(organization_id));

drop policy if exists memberships_manage_admin on organization_memberships;
create policy memberships_manage_admin on organization_memberships
  for all to authenticated
  using (can_manage_org(organization_id))
  with check (can_manage_org(organization_id));

drop policy if exists collection_items_select_member on catalog_collection_items;
create policy collection_items_select_member on catalog_collection_items
  for select to authenticated
  using (
    exists (
      select 1
      from catalog_collections c
      where c.id = catalog_collection_items.collection_id
        and can_view_org(c.organization_id)
    )
  );

drop policy if exists collection_items_manage_admin on catalog_collection_items;
create policy collection_items_manage_admin on catalog_collection_items
  for all to authenticated
  using (
    exists (
      select 1
      from catalog_collections c
      where c.id = catalog_collection_items.collection_id
        and can_manage_org(c.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from catalog_collections c
      where c.id = catalog_collection_items.collection_id
        and can_manage_org(c.organization_id)
    )
  );

-- Generic org-scoped read policies.
do $$ declare
  t text;
begin
  foreach t in array array[
    'vip_clients',
    'conversation_sessions',
    'conversation_messages',
    'takeover_events',
    'catalog_items',
    'catalog_collections',
    'inventory_movements',
    'global_configurations',
    'operation_overrides',
    'system_prompts',
    'sourcing_briefs',
    'sourcing_assets',
    'sourcing_quotes',
    'checkout_links',
    'concierge_orders',
    'logistics_manifests',
    'manifest_events',
    'gatekeepers',
    'gatekeeper_links',
    'gatekeeper_attributions',
    'commission_entries',
    'analytics_events',
    'analytics_snapshots',
    'audit_events'
  ] loop
    execute format('drop policy if exists %I_select_member on %I', t, t);
    execute format(
      'create policy %I_select_member on %I for select to authenticated using (can_view_org(organization_id))',
      t,
      t
    );
  end loop;
end $$;

-- Operational write policies: staff and above can run the desk, sourcing, logistics, and messages.
do $$ declare
  t text;
begin
  foreach t in array array[
    'vip_clients',
    'conversation_sessions',
    'conversation_messages',
    'takeover_events',
    'sourcing_briefs',
    'sourcing_assets',
    'sourcing_quotes',
    'checkout_links',
    'concierge_orders',
    'logistics_manifests',
    'manifest_events',
    'analytics_events'
  ] loop
    execute format('drop policy if exists %I_operate_write on %I', t, t);
    execute format(
      'create policy %I_operate_write on %I for all to authenticated using (can_operate_org(organization_id)) with check (can_operate_org(organization_id))',
      t,
      t
    );
  end loop;
end $$;

-- Management write policies: admin and above can mutate business truth, prompts, config, catalog, affiliates, and commissions.
do $$ declare
  t text;
begin
  foreach t in array array[
    'catalog_items',
    'catalog_collections',
    'inventory_movements',
    'global_configurations',
    'operation_overrides',
    'system_prompts',
    'gatekeepers',
    'gatekeeper_links',
    'gatekeeper_attributions',
    'commission_entries',
    'analytics_snapshots',
    'audit_events'
  ] loop
    execute format('drop policy if exists %I_manage_write on %I', t, t);
    execute format(
      'create policy %I_manage_write on %I for all to authenticated using (can_manage_org(organization_id)) with check (can_manage_org(organization_id))',
      t,
      t
    );
  end loop;
end $$;

-- Seed the Hazina org and the dynamic brand truth expected by LangGraph + Next.js.
insert into organizations (slug, name)
values ('hazina-nomads', 'Hazina Nomads')
on conflict (slug) do update
set name = excluded.name,
    triad = 'Bespoke Curation · Seamless Logistics · Global Export',
    updated_at = now();

insert into global_configurations (organization_id, config_key, label, value_type, value_json, is_public)
select id, 'hazina.triad', 'Hazina Triad', 'json',
       '{"pillars":["Bespoke Curation","Seamless Logistics","Global Export"]}'::jsonb,
       true
from organizations
where slug = 'hazina-nomads'
on conflict (organization_id, config_key) do update
set value_json = excluded.value_json,
    updated_at = now();

insert into global_configurations (organization_id, config_key, label, value_type, value_json, is_public)
select id, 'operations.default_lead_times', 'Default lead times', 'json',
       '{"bespoke_curation_hours":24,"departure_handoff_hours":4,"global_export_quote_required":true}'::jsonb,
       false
from organizations
where slug = 'hazina-nomads'
on conflict (organization_id, config_key) do update
set value_json = excluded.value_json,
    updated_at = now();

insert into global_configurations (organization_id, config_key, label, value_type, value_json, is_public)
select id, 'affiliate.default_commission_rate', 'Default affiliate commission rate', 'number',
       '0.15'::jsonb,
       false
from organizations
where slug = 'hazina-nomads'
on conflict (organization_id, config_key) do update
set value_json = excluded.value_json,
    updated_at = now();

insert into system_prompts (organization_id, prompt_key, scope, title, body, status, active, version)
select id,
       'hazina.master',
       'master',
       'Hazina Master Concierge Prompt',
       'You are a private sourcing concierge for Hazina Nomads. Operate from the Hazina Triad: Bespoke Curation, Seamless Logistics, and Global Export. Recommend only from authoritative catalog context; open visual sourcing briefs for unlisted reference-image requests; confirm exact handoff channel, location, timing, and payment preference before promising dispatch.',
       'active',
       true,
       1
from organizations
where slug = 'hazina-nomads'
on conflict (organization_id, prompt_key, version) do update
set body = excluded.body,
    status = excluded.status,
    active = excluded.active,
    updated_at = now();

-- Supabase Storage bucket for private reference/validation/proof images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hazina-command-center',
  'hazina-command-center',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists command_center_storage_select on storage.objects;
create policy command_center_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hazina-command-center'
    and exists (
      select 1
      from organization_memberships m
      join organizations o on o.id = m.organization_id
      where o.slug = split_part(name, '/', 1)
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists command_center_storage_write on storage.objects;
create policy command_center_storage_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hazina-command-center'
    and exists (
      select 1
      from organization_memberships m
      join organizations o on o.id = m.organization_id
      where o.slug = split_part(name, '/', 1)
        and m.user_id = auth.uid()
        and m.active = true
        and m.role in ('staff', 'ops_manager', 'admin', 'owner', 'platform_admin')
    )
  )
  with check (
    bucket_id = 'hazina-command-center'
    and exists (
      select 1
      from organization_memberships m
      join organizations o on o.id = m.organization_id
      where o.slug = split_part(name, '/', 1)
        and m.user_id = auth.uid()
        and m.active = true
        and m.role in ('staff', 'ops_manager', 'admin', 'owner', 'platform_admin')
    )
  );
