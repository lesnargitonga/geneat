import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import type { Business, ConversationSummary } from "@/lib/types";
import {
  ChannelChip,
  Empty,
  ErrorBox,
  PageHeader,
  Spinner,
  Stat,
  StatusChip,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function Dashboard() {
  const { user } = useAuth();

  const businesses = useQuery({
    queryKey: ["businesses"],
    queryFn: () => api<Business[]>("/admin/businesses"),
  });

  const escalations = useQuery({
    queryKey: ["escalations"],
    queryFn: () => api<ConversationSummary[]>("/admin/escalations"),
  });

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.full_name || user?.email}`}
        subtitle="High-level view across every tenant you manage."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat
          label="Tenants"
          value={businesses.data?.length ?? "—"}
          hint={user?.is_superadmin ? "global" : `${user?.memberships.length} membership(s)`}
        />
        <Stat
          label="Open escalations"
          value={escalations.data?.length ?? "—"}
          tone={(escalations.data?.length ?? 0) > 0 ? "warn" : "ok"}
        />
        <Stat label="Your role" value={user?.role || "—"} />
        <Stat
          label="Last login"
          value={formatRelative(user?.last_login_at)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            Tenants
          </h2>
          {businesses.isLoading ? (
            <div className="card-pad flex items-center gap-2 text-muted">
              <Spinner /> Loading…
            </div>
          ) : businesses.isError ? (
            <ErrorBox error={businesses.error} />
          ) : businesses.data?.length === 0 ? (
            <Empty>No tenants yet.</Empty>
          ) : (
            <div className="card divide-y divide-border">
              {businesses.data!.map((b) => (
                <Link
                  key={b.id}
                  to={`/businesses/${b.slug}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-surface2 transition"
                >
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted">{b.slug}</div>
                  </div>
                  <span className="text-muted text-sm">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            Escalation queue
          </h2>
          {escalations.isLoading ? (
            <div className="card-pad flex items-center gap-2 text-muted">
              <Spinner /> Loading…
            </div>
          ) : escalations.isError ? (
            <ErrorBox error={escalations.error} />
          ) : escalations.data?.length === 0 ? (
            <Empty>Nothing waiting for a human. 🎉</Empty>
          ) : (
            <div className="card divide-y divide-border">
              {escalations.data!.map((c) => (
                <Link
                  key={c.id}
                  to={`/conversations/${c.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface2 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">
                      {c.last_message_preview || <span className="text-muted">No preview</span>}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {formatRelative(c.last_activity_at)}
                    </div>
                  </div>
                  <ChannelChip channel={c.channel} />
                  <StatusChip status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
