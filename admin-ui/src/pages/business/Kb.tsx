import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Empty, ErrorBox, Spinner } from "@/components/ui";
import { useBusiness } from "./_ctx";
import { formatRelative } from "@/lib/format";
import type { KbItem } from "@/lib/types";

export default function BusinessKb() {
  const b = useBusiness();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["kb", b.slug],
    queryFn: () => api<KbItem[]>(`/admin/businesses/${b.slug}/kb`),
  });

  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reembed = useMutation({
    mutationFn: () =>
      api(`/admin/businesses/${b.slug}/kb/re-embed`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb", b.slug] }),
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Re-embed failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/businesses/${b.slug}/kb/items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb", b.slug] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="text-sm text-muted">
          {q.data?.length ?? 0} knowledge chunks
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            disabled={reembed.isPending}
            onClick={() => reembed.mutate()}
          >
            {reembed.isPending ? "Re-embedding…" : "Re-embed all"}
          </button>
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + Add item
          </button>
        </div>
      </div>

      {err && (
        <div className="text-sm text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.length ? (
        <Empty>No knowledge yet. Click "Add item" to ingest content.</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {q.data.map((item) => (
            <div key={item.id} className="px-5 py-3.5 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted mb-1 font-mono">
                  {item.source}
                </div>
                <div className="text-sm whitespace-pre-wrap line-clamp-3">
                  {item.content}
                </div>
                <div className="text-xs text-muted mt-1">
                  {formatRelative(item.created_at)}
                </div>
              </div>
              <button
                className="btn-danger text-xs"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm("Delete this knowledge item?")) del.mutate(item.id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {open && <AddKbDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddKbDialog({ onClose }: { onClose: () => void }) {
  const b = useBusiness();
  const qc = useQueryClient();
  const [source, setSource] = useState("manual");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api(`/admin/businesses/${b.slug}/kb/items`, {
        method: "POST",
        body: { items: [{ source, content }] },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb", b.slug] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Failed to add"),
  });
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card-pad w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Add knowledge</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Source label</label>
            <input
              className="input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              autoFocus
              className="input min-h-[260px] resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
            disabled={!content.trim() || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
