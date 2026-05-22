import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { tokenStore } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";

interface BusEvent {
  type: string;
  ts: string;
  business_slug?: string;
  conversation_id?: string;
  payload?: Record<string, unknown>;
}

const EVENT_TYPES = [
  "message.created",
  "conversation.takeover",
  "conversation.released",
  "conversation.interleaved",
  "escalation.opened",
  "payment.completed",
  "broadcast.progress",
];

export default function LiveStream() {
  const [events, setEvents] = useState<BusEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const evtRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const tok = tokenStore.access;
    if (!tok) return;
    const url = `/admin/stream?token=${encodeURIComponent(tok)}`;
    const es = new EventSource(url);
    evtRef.current = es;
    es.onopen = () => {
      setConnected(true);
      setErr(null);
    };
    es.onerror = () => {
      setConnected(false);
      setErr("Stream disconnected — retrying…");
    };
    const handleMessage = (m: MessageEvent) => {
      try {
        const obj = JSON.parse(m.data) as BusEvent;
        setEvents((prev) => [
          { ...obj, ts: obj.ts || new Date().toISOString() },
          ...prev,
        ].slice(0, 500));
      } catch {
        /* ignore */
      }
    };
    es.onmessage = handleMessage;
    EVENT_TYPES.forEach((type) => es.addEventListener(type, handleMessage));
    return () => {
      EVENT_TYPES.forEach((type) => es.removeEventListener(type, handleMessage));
      es.close();
      evtRef.current = null;
    };
  }, []);

  const shown = filter
    ? events.filter(
        (e) =>
          e.type.includes(filter) ||
          (e.business_slug || "").includes(filter) ||
          JSON.stringify(e.payload || {}).includes(filter)
      )
    : events;

  return (
    <div>
      <PageHeader
        title="Live event stream"
        subtitle="Real-time view of the platform event bus."
        actions={
          <span className={connected ? "chip-ok" : "chip-err"}>
            {connected ? "● live" : "● offline"}
          </span>
        }
      />

      <input
        className="input mb-4 max-w-md"
        placeholder="Filter by type, slug, or payload substring…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {err && (
        <div className="text-sm text-warn bg-warn/10 border border-warn/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted bg-surface2 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2.5 w-32">When</th>
              <th className="text-left px-4 py-2.5 w-56">Event</th>
              <th className="text-left px-4 py-2.5 w-40">Tenant</th>
              <th className="text-left px-4 py-2.5">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted">
                  Waiting for events…
                </td>
              </tr>
            ) : (
              shown.map((e, i) => (
                <tr key={i} className="hover:bg-surface2">
                  <td
                    className="px-4 py-2.5 text-xs text-muted"
                    title={formatDateTime(e.ts)}
                  >
                    {formatRelative(e.ts)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <span className="chip-muted">{e.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted font-mono">
                    {e.business_slug || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted truncate max-w-md">
                    {e.conversation_id && (
                      <Link
                        to={`/conversations/${e.conversation_id}`}
                        className="text-brand mr-2"
                      >
                        ↗
                      </Link>
                    )}
                    {JSON.stringify(e.payload || {})}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
