# Hazina Command Center - Phase 1 Schema

Status: **approved for Phase 2 UI/API scaffolding**

Migration:

```text
supabase/migrations/202606040001_hazina_command_center.sql
```

This schema is built for a Supabase-backed Mission Control dashboard, not a
simple e-commerce admin. It keeps Hazina's operating truth dynamic:

- `system_prompts` holds live LangGraph instructions, voice, guardrails, and
  tool policy.
- `global_configurations` holds no-code business variables such as commission
  rates, lead times, welcome copy, logistics fees, and markup multipliers.
- `catalog_items` and `catalog_collections` hold the live catalog and stock
  controls that both the portal and LangGraph should read before quoting.

## Brand Boundary

The seeded organization is:

```text
hazina-nomads
Bespoke Curation · Seamless Logistics · Global Export
```

Operational locations such as metropolitan, highlands, savannah, coastal,
departure handoff, and global export are modeled under `fulfillment_channel`.
They are execution channels, not the headline brand promise.

## Module Map

| Module | Primary tables |
|---|---|
| Communications & AI Override Desk | `conversation_sessions`, `conversation_messages`, `takeover_events`, `vip_clients` |
| Bespoke Sourcing Kanban | `sourcing_briefs`, `sourcing_assets`, `sourcing_quotes`, `checkout_links` |
| Dynamic Catalog & Operations Control | `catalog_items`, `catalog_collections`, `catalog_collection_items`, `inventory_movements`, `operation_overrides`, `global_configurations` |
| Gatekeeper Ledger | `gatekeepers`, `gatekeeper_links`, `gatekeeper_attributions`, `commission_entries` |
| Intelligence & Analytics Hub | `analytics_events`, `analytics_snapshots`, order/logistics tables |
| AI Prompt & Logic Engine | `system_prompts` |
| System Variables Vault | `global_configurations` |

## Security Model

Every business table is organization-scoped and protected by Row Level Security.

Roles:

```text
viewer -> read-only
staff -> chat/sourcing/logistics operations
ops_manager -> operational control
admin -> prompt, catalog, config, affiliate management
owner -> full organization control
platform_admin -> cross-platform owner role
```

Helper functions:

- `can_view_org(org_id)`
- `can_operate_org(org_id)`
- `can_manage_org(org_id)`
- `current_admin_role(org_id)`

Supabase `service_role` can still be used by Edge Functions or trusted backend
jobs for server-side automation.

### First Owner Bootstrap

RLS intentionally blocks normal users from creating the first organization
membership. After creating the first Supabase Auth user, run this once with the
Supabase SQL editor or a trusted service-role script:

```sql
insert into organization_memberships (organization_id, user_id, role)
select id, '<supabase-auth-user-id>', 'owner'
from organizations
where slug = 'hazina-nomads';
```

## Storage

The migration creates a private Supabase Storage bucket:

```text
hazina-command-center
```

Expected object path prefix:

```text
hazina-nomads/<brief-or-order-id>/<file>
```

The storage policies allow authenticated organization members to read, and
staff+ roles to write validation photos, guest references, receipts, and proof
of dispatch.

## Dynamic Runtime Contract

The Next.js Command Center and LangGraph backend should read, not hardcode:

| Runtime need | Table |
|---|---|
| Master prompt | `system_prompts where prompt_key='hazina.master' and active=true` |
| Welcome message / offline responder | `global_configurations` |
| Lead time overrides | `operation_overrides`, `global_configurations` |
| Affiliate commission rate | `global_configurations`, override on `gatekeepers` |
| Catalog price/stock/cost | `catalog_items`, `catalog_collections` |
| Visual brief stage | `sourcing_briefs.status` |
| Payment link state | `checkout_links.status` |

## Approval Checklist

Approve Phase 1 if these are correct:

- Tables cover all 7 modules.
- `system_prompts`, `global_configurations`, and `catalog_items` are first-class
  dynamic truth tables.
- RLS role boundaries match how the business will operate.
- The sourcing Kanban stages are correct:
  `Visual Brief Submitted -> Field Validation -> Quoted -> Procured -> Dispatched`.
- The affiliate roles and metrics are enough for the first gatekeeper pilot.
- The analytics tables are acceptable as event/snapshot sources for Recharts or
  Tremor.

After approval, Phase 2 should add server actions/API routes and typed Supabase
clients before any heavy UI work.
