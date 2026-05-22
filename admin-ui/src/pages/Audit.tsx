import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

interface AuditPage {
  items: AuditEvent[];
  next_cursor: string | null;
}

export default function AuditPage() {
  const q = useInfiniteQuery({
    queryKey: ["audit"],
    queryFn: ({ pageParam }) =>
      api<AuditPage>(
        `/admin/audit${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`
      ),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every admin action, signed and immutable."
      />

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted bg-surface2">
              <tr>
                <th className="text-left px-4 py-2.5 w-44">When</th>
                <th className="text-left px-4 py-2.5 w-56">Actor</th>
                <th className="text-left px-4 py-2.5 w-40">Tenant</th>
                <th className="text-left px-4 py-2.5 w-56">Action</th>
                <th className="text-left px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data?.pages.flatMap((p) =>
                p.items.map((it) => (
                  <tr key={it.id} className="hover:bg-surface2">
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {formatDateTime(it.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {it.actor_email || (
                        <span className="text-muted italic">system</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted font-mono">
                      {it.business_slug || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">
                      <span className="chip-muted">{it.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted font-mono truncate max-w-md">
                      {it.resource && (
                        <span className="text-text mr-2">{it.resource}</span>
                      )}
                      {it.details ? JSON.stringify(it.details) : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {q.hasNextPage && (
        <div className="text-center mt-4">
          <button
            className="btn-ghost"
            disabled={q.isFetchingNextPage}
            onClick={() => q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
