import { useQuery } from "@tanstack/react-query";
import { COMMAND_CENTER_MODULES, getCommandCenterClient, getCommandCenterEnv } from "@/lib/hazinaCommandCenter";
import type { CommandCenterDatabase } from "@/lib/hazinaCommandCenter.types";
import { ErrorBox, PageHeader, Spinner, Stat } from "@/components/ui";

type Client = NonNullable<ReturnType<typeof getCommandCenterClient>>;
type OrgRow = CommandCenterDatabase["public"]["Tables"]["organizations"]["Row"];
type ConfigRow = CommandCenterDatabase["public"]["Tables"]["global_configurations"]["Row"];
type PromptRow = CommandCenterDatabase["public"]["Tables"]["system_prompts"]["Row"];
type CountTable =
  | "catalog_items"
  | "catalog_collections"
  | "conversation_sessions"
  | "sourcing_briefs"
  | "concierge_orders"
  | "gatekeepers"
  | "analytics_snapshots";

type Snapshot =
  | {
      configured: false;
      missing: string[];
      orgSlug: string;
    }
  | {
      configured: true;
      org: Pick<OrgRow, "id" | "slug" | "name" | "triad" | "timezone" | "default_currency"> | null;
      configs: Pick<ConfigRow, "config_key" | "label" | "is_public" | "is_secret" | "value_json" | "value_text">[];
      prompt: Pick<PromptRow, "prompt_key" | "title" | "version" | "status" | "active" | "checksum"> | null;
      counts: Record<CountTable, number | null>;
    };

async function countRows(client: Client, table: CountTable, organizationId: string) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function loadSnapshot(): Promise<Snapshot> {
  const env = getCommandCenterEnv();
  const client = getCommandCenterClient();
  if (!client) {
    return {
      configured: false,
      missing: env.missing,
      orgSlug: env.orgSlug,
    };
  }

  const { data: org, error: orgError } = await client
    .from("organizations")
    .select("id, slug, name, triad, timezone, default_currency")
    .eq("slug", env.orgSlug)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) {
    return {
      configured: true,
      org: null,
      configs: [],
      prompt: null,
      counts: {
        catalog_items: null,
        catalog_collections: null,
        conversation_sessions: null,
        sourcing_briefs: null,
        concierge_orders: null,
        gatekeepers: null,
        analytics_snapshots: null,
      },
    };
  }

  const [configsResult, promptResult, counts] = await Promise.all([
    client
      .from("global_configurations")
      .select("config_key, label, is_public, is_secret, value_json, value_text")
      .eq("organization_id", org.id)
      .order("config_key"),
    client
      .from("system_prompts")
      .select("prompt_key, title, version, status, active, checksum")
      .eq("organization_id", org.id)
      .eq("prompt_key", "hazina.master")
      .eq("active", true)
      .maybeSingle(),
    Promise.all([
      countRows(client, "catalog_items", org.id),
      countRows(client, "catalog_collections", org.id),
      countRows(client, "conversation_sessions", org.id),
      countRows(client, "sourcing_briefs", org.id),
      countRows(client, "concierge_orders", org.id),
      countRows(client, "gatekeepers", org.id),
      countRows(client, "analytics_snapshots", org.id),
    ]),
  ]);

  if (configsResult.error) throw new Error(configsResult.error.message);
  if (promptResult.error) throw new Error(promptResult.error.message);

  return {
    configured: true,
    org,
    configs: configsResult.data ?? [],
    prompt: promptResult.data,
    counts: {
      catalog_items: counts[0],
      catalog_collections: counts[1],
      conversation_sessions: counts[2],
      sourcing_briefs: counts[3],
      concierge_orders: counts[4],
      gatekeepers: counts[5],
      analytics_snapshots: counts[6],
    },
  };
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}

function renderConfigValue(config: Pick<ConfigRow, "is_secret" | "value_json" | "value_text">) {
  if (config.is_secret) return "secret";
  if (config.value_text) return config.value_text;
  if (config.value_json === null) return "—";
  return JSON.stringify(config.value_json);
}

export default function HazinaCommandCenter() {
  const q = useQuery({
    queryKey: ["hazina-command-center"],
    queryFn: loadSnapshot,
    refetchInterval: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Loading…
      </div>
    );
  }
  if (q.isError) return <ErrorBox error={q.error} />;

  const snapshot = q.data!;

  if (!snapshot.configured) {
    return (
      <div>
        <PageHeader
          title="Hazina Command Center"
          subtitle={`Organization slug: ${snapshot.orgSlug}`}
        />
        <div className="card-pad max-w-2xl">
          <div className="text-sm font-medium">Supabase connection not configured</div>
          <div className="mt-2 text-sm text-muted">
            Missing: {snapshot.missing.join(", ")}
          </div>
          <div className="mt-4 grid gap-2 font-mono text-xs text-muted">
            <span>VITE_SUPABASE_URL=...</span>
            <span>VITE_SUPABASE_ANON_KEY=...</span>
            <span>VITE_HAZINA_ORG_SLUG=hazina-nomads</span>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot.org) {
    return (
      <div>
        <PageHeader title="Hazina Command Center" subtitle="hazina-nomads" />
        <div className="card-pad text-sm text-warn">
          Hazina organization is not visible to the current Supabase session.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Hazina Command Center"
        subtitle={
          <>
            <span className="font-mono">{snapshot.org.slug}</span>
            <span className="ml-2 text-muted">· {snapshot.org.triad}</span>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Stat label="Catalog items" value={formatCount(snapshot.counts.catalog_items)} />
        <Stat label="Collections" value={formatCount(snapshot.counts.catalog_collections)} />
        <Stat label="Live sessions" value={formatCount(snapshot.counts.conversation_sessions)} />
        <Stat label="Sourcing briefs" value={formatCount(snapshot.counts.sourcing_briefs)} />
        <Stat
          label="Master prompt"
          value={snapshot.prompt?.active ? `v${snapshot.prompt.version}` : "—"}
          tone={snapshot.prompt?.active ? "ok" : "warn"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.8fr] gap-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            Operating modules
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {COMMAND_CENTER_MODULES.map((module) => (
              <div key={module.label} className="card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{module.label}</h3>
                    <p className="mt-1 text-sm text-muted leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                  <span className="chip-muted">Phase 2</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {module.tables.map((table) => (
                    <span key={table} className="chip-muted font-mono">
                      {table}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Active prompt
            </h2>
            <div className="card-pad">
              {snapshot.prompt ? (
                <div>
                  <div className="font-medium">{snapshot.prompt.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="chip-ok">{snapshot.prompt.status}</span>
                    <span className="chip-muted">v{snapshot.prompt.version}</span>
                    {snapshot.prompt.checksum && (
                      <span className="chip-muted font-mono">
                        {snapshot.prompt.checksum.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted">No active Hazina master prompt visible.</div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Config vault
            </h2>
            <div className="card divide-y divide-border">
              {snapshot.configs.map((config) => (
                <div key={config.config_key} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-xs text-muted">{config.config_key}</div>
                    <span className={config.is_public ? "chip-ok" : "chip-muted"}>
                      {config.is_public ? "public" : "private"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm truncate">{config.label || config.config_key}</div>
                  <div className="mt-1 text-xs text-muted truncate">
                    {renderConfigValue(config)}
                  </div>
                </div>
              ))}
              {!snapshot.configs.length && (
                <div className="px-5 py-8 text-sm text-muted text-center">
                  No configuration rows visible.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
