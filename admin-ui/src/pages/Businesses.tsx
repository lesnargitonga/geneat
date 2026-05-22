import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import type { Business } from "@/lib/types";
import {
  Empty,
  ErrorBox,
  PageHeader,
  Spinner,
} from "@/components/ui";

export default function BusinessesPage() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["businesses"],
    queryFn: () => api<Business[]>("/admin/businesses"),
  });

  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Every tenant on the platform."
        actions={
          user?.is_superadmin && (
            <button className="btn-primary" onClick={() => setOpen(true)}>
              + New tenant
            </button>
          )
        }
      />

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : q.data?.length === 0 ? (
        <Empty>No tenants yet.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted bg-surface2">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Slug</th>
                <th className="text-left px-5 py-3">Timezone</th>
                <th className="text-left px-5 py-3">Currency</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data!.map((b) => (
                <tr key={b.id} className="hover:bg-surface2 transition">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/businesses/${b.slug}`}>{b.name}</Link>
                  </td>
                  <td className="px-5 py-3 text-muted font-mono text-xs">
                    {b.slug}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {b.timezone || "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {b.currency || "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/businesses/${b.slug}`}
                      className="text-brand hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <NewBusinessDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewBusinessDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api<Business>("/admin/businesses", {
        method: "POST",
        body: { name, slug: slug || undefined },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["businesses"] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Failed to create"),
  });
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card-pad w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">New tenant</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Slug (optional)</label>
            <input
              className="input font-mono"
              placeholder="auto-generated from name"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          {err && (
            <div className="text-sm text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!name || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
