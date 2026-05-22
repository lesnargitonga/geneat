import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { ConversationSummary } from "@/lib/types";
import {
  ChannelChip,
  Empty,
  ErrorBox,
  Spinner,
  StatusChip,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { useBusiness } from "./_ctx";
import { useState } from "react";

const STATUSES = [
  "all",
  "active",
  "pending",
  "human_escalated",
  "resolved",
  "abandoned",
] as const;

export default function BusinessConversations() {
  const b = useBusiness();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const q = useQuery({
    queryKey: ["conversations", b.slug, status],
    queryFn: () =>
      api<ConversationSummary[]>(
        `/admin/businesses/${b.slug}/conversations${
          status === "all" ? "" : `?status_filter=${status}`
        }`
      ),
    refetchInterval: 10_000,
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={
              status === s
                ? "chip-warn cursor-pointer"
                : "chip-muted cursor-pointer hover:border-brand/60"
            }
          >
            {s}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.length ? (
        <Empty>No conversations match.</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {q.data.map((c) => (
            <Link
              key={c.id}
              to={`/conversations/${c.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface2 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  {c.last_message_preview || (
                    <span className="text-muted italic">No preview</span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {formatRelative(c.last_activity_at)}
                </div>
              </div>
              {c.ai_paused && <span className="chip-warn">AI paused</span>}
              <ChannelChip channel={c.channel} />
              <StatusChip status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
