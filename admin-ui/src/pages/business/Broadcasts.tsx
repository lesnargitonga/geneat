import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  ChannelChip,
  Empty,
  ErrorBox,
  Spinner,
  StatusChip,
} from "@/components/ui";
import { useBusiness } from "./_ctx";
import { formatRelative } from "@/lib/format";
import type { Broadcast, ChannelKind } from "@/lib/types";

const CHANNELS: ChannelKind[] = ["whatsapp", "sms", "voice", "mock"];

export default function BusinessBroadcasts() {
  const b = useBusiness();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["broadcasts", b.slug],
    queryFn: () => api<Broadcast[]>(`/admin/businesses/${b.slug}/broadcasts`),
    refetchInterval: 5_000,
  });

  const [open, setOpen] = useState(false);

  const send = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/businesses/${b.slug}/broadcasts/${id}/send`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts", b.slug] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/businesses/${b.slug}/broadcasts/${id}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts", b.slug] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted">
          {q.data?.length ?? 0} broadcasts
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + New broadcast
        </button>
      </div>

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.length ? (
        <Empty>No broadcasts yet.</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {q.data.map((br) => (
            <div key={br.id} className="px-5 py-4 flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium">{br.title}</div>
                  <StatusChip status={br.status} />
                  <ChannelChip channel={br.channel} />
                </div>
                <div className="text-sm text-muted mt-1 line-clamp-2">
                  {br.body}
                </div>
                <div className="text-xs text-muted mt-2">
                  {br.sent}/{br.total} sent · {br.failed} failed ·{" "}
                  {formatRelative(br.created_at)}
                </div>
              </div>
              <div className="flex gap-2">
                {br.status === "draft" && (
                  <button
                    className="btn-primary text-xs"
                    disabled={send.isPending}
                    onClick={() => send.mutate(br.id)}
                  >
                    Send
                  </button>
                )}
                {(br.status === "queued" || br.status === "running") && (
                  <button
                    className="btn-danger text-xs"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(br.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <NewBroadcastDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewBroadcastDialog({ onClose }: { onClose: () => void }) {
  const b = useBusiness();
  const qc = useQueryClient();
  const [channel, setChannel] = useState<ChannelKind>("whatsapp");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => {
      const phones = audience
        .split(/[\n,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      return api(`/admin/businesses/${b.slug}/broadcasts`, {
        method: "POST",
        body: { channel, title, body, recipients: phones },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts", b.slug] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Failed to create"),
  });

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card-pad w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">New broadcast</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Channel</label>
              <select
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelKind)}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Message body</label>
            <textarea
              className="input min-h-[120px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              Recipients (phone numbers, one per line or comma-separated)
            </label>
            <textarea
              className="input min-h-[120px] font-mono text-xs"
              placeholder="+254700000001&#10;+254700000002"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
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
            disabled={!title || !body || !audience || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Creating…" : "Create draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
