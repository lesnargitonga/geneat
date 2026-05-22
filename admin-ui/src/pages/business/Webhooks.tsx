import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Empty, ErrorBox, Spinner } from "@/components/ui";
import { useBusiness } from "./_ctx";
import { formatRelative } from "@/lib/format";
import type { WebhookEndpoint } from "@/lib/types";

const EVENTS = [
  "message.created",
  "conversation.takeover",
  "conversation.released",
  "escalation.opened",
  "payment.completed",
  "broadcast.progress",
];

export default function BusinessWebhooks() {
  const b = useBusiness();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["webhooks", b.slug],
    queryFn: () =>
      api<WebhookEndpoint[]>(`/admin/businesses/${b.slug}/webhooks`),
  });

  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<{ id: string; secret: string } | null>(
    null
  );

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/businesses/${b.slug}/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", b.slug] }),
  });
  const rotate = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; secret: string }>(
        `/admin/businesses/${b.slug}/webhooks/${id}/rotate`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      setReveal(data);
      qc.invalidateQueries({ queryKey: ["webhooks", b.slug] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted">
          {q.data?.length ?? 0} endpoints
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Add endpoint
        </button>
      </div>

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.length ? (
        <Empty>No webhook endpoints configured.</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {q.data.map((w) => (
            <div key={w.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm break-all">{w.url}</div>
                  <div className="text-xs text-muted mt-1 flex gap-2 flex-wrap">
                    {w.events.map((e) => (
                      <span key={e} className="chip-muted">
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-muted mt-2">
                    Last:{" "}
                    {w.last_delivery_at
                      ? `${w.last_status ?? "?"} · ${formatRelative(
                          w.last_delivery_at
                        )}`
                      : "never"}
                    {w.failure_count > 0 && (
                      <span className="text-err ml-2">
                        · {w.failure_count} failures
                      </span>
                    )}
                  </div>
                  {w.last_error && (
                    <div className="text-xs text-err mt-1 truncate">
                      {w.last_error}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-ghost text-xs"
                    disabled={rotate.isPending}
                    onClick={() => rotate.mutate(w.id)}
                  >
                    Rotate secret
                  </button>
                  <button
                    className="btn-danger text-xs"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm("Delete this endpoint?")) del.mutate(w.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <AddWebhookDialog onClose={() => setOpen(false)} onCreated={setReveal} />}
      {reveal && (
        <RevealSecretDialog
          secret={reveal.secret}
          onClose={() => setReveal(null)}
        />
      )}
    </div>
  );
}

function AddWebhookDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (x: { id: string; secret: string }) => void;
}) {
  const b = useBusiness();
  const qc = useQueryClient();
  const [url, setUrl] = useState("https://");
  const [events, setEvents] = useState<string[]>(["message.created"]);
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api<WebhookEndpoint & { secret: string }>(
        `/admin/businesses/${b.slug}/webhooks`,
        {
          method: "POST",
          body: { url, events },
        }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["webhooks", b.slug] });
      onCreated({ id: data.id, secret: data.secret });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Failed to add"),
  });

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card-pad w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Add webhook endpoint</h2>
        <div className="space-y-3">
          <div>
            <label className="label">URL</label>
            <input
              className="input font-mono text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Events</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EVENTS.map((ev) => (
                <label
                  key={ev}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-surface2 text-xs cursor-pointer hover:border-brand/40"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={(e) =>
                      setEvents((prev) =>
                        e.target.checked
                          ? [...prev, ev]
                          : prev.filter((x) => x !== ev)
                      )
                    }
                  />
                  <span className="font-mono">{ev}</span>
                </label>
              ))}
            </div>
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
            disabled={!url || events.length === 0 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RevealSecretDialog({
  secret,
  onClose,
}: {
  secret: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card-pad w-full max-w-lg">
        <h2 className="text-lg font-semibold">Webhook signing secret</h2>
        <p className="text-sm text-muted mt-1 mb-3">
          Copy now — this is the only time it'll be shown. Use it to verify the
          HMAC-SHA256 signature header on every delivery.
        </p>
        <div className="font-mono text-sm bg-surface2 border border-border rounded-lg px-3 py-2 break-all select-all">
          {secret}
        </div>
        <div className="flex justify-end mt-4">
          <button
            className="btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(secret).catch(() => {});
              onClose();
            }}
          >
            Copy & close
          </button>
        </div>
      </div>
    </div>
  );
}
