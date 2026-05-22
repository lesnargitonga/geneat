import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import {
  ChannelChip,
  ErrorBox,
  Spinner,
  StatusChip,
} from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { ConversationSummary, Message } from "@/lib/types";
import { useAuth } from "@/auth/AuthContext";

interface FullConversation {
  conversation: ConversationSummary & {
    customer_phone?: string;
    customer_name?: string;
    business_slug: string;
  };
  messages: Message[];
}

export default function ConversationViewer() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api<FullConversation>(`/admin/conversations/${id}`),
    enabled: !!id,
    refetchInterval: 4_000,
  });

  const takeover = useMutation({
    mutationFn: () =>
      api(`/admin/conversations/${id}/takeover`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", id] }),
  });
  const release = useMutation({
    mutationFn: () =>
      api(`/admin/conversations/${id}/release`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", id] }),
  });
  const resolve = useMutation({
    mutationFn: () =>
      api(`/admin/conversations/${id}/resolve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", id] }),
  });

  const [draft, setDraft] = useState("");
  const [sendErr, setSendErr] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      api(`/admin/conversations/${id}/messages`, {
        method: "POST",
        body: { content: draft },
      }),
    onSuccess: () => {
      setDraft("");
      setSendErr(null);
      qc.invalidateQueries({ queryKey: ["conversation", id] });
    },
    onError: (e) => setSendErr(e instanceof ApiError ? e.detail : "Send failed"),
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [q.data?.messages.length]);

  if (q.isLoading)
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Loading…
      </div>
    );
  if (q.isError) return <ErrorBox error={q.error} />;
  if (!q.data) return null;

  const conv = q.data.conversation;
  const paused = conv.ai_paused;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-border">
        <Link
          to={`/businesses/${conv.business_slug}`}
          className="text-sm text-muted hover:text-text"
        >
          ← {conv.business_slug}
        </Link>
        <ChannelChip channel={conv.channel} />
        <StatusChip status={conv.status} />
        {paused && <span className="chip-warn">AI paused</span>}
        <div className="text-sm text-muted">
          {conv.customer_name || conv.customer_phone || "Customer"}
        </div>
        <div className="ml-auto flex gap-2">
          {!paused ? (
            <button
              className="btn-primary"
              disabled={takeover.isPending}
              onClick={() => takeover.mutate()}
            >
              {takeover.isPending ? "…" : "Take over"}
            </button>
          ) : (
            <button
              className="btn-ghost"
              disabled={release.isPending}
              onClick={() => release.mutate()}
            >
              {release.isPending ? "…" : "Release to AI"}
            </button>
          )}
          {conv.status === "human_escalated" && (
            <button
              className="btn-ghost"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              Resolve
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto scrollbar-thin py-4 space-y-3">
        {q.data.messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border pt-3">
        {!paused && (
          <div className="text-xs text-muted mb-2">
            Sending will automatically pause the AI and mark you ({user?.email})
            as the live operator.
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            className="input min-h-[60px] resize-none flex-1"
            placeholder="Type a reply to the customer…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
                send.mutate();
              }
            }}
          />
          <button
            className="btn-primary self-stretch px-6"
            disabled={!draft.trim() || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </div>
        {sendErr && (
          <div className="text-sm text-err mt-2 bg-err/10 border border-err/30 rounded-lg px-3 py-2">
            {sendErr}
          </div>
        )}
        <div className="text-[11px] text-muted mt-1.5">
          ⌘/Ctrl + Enter to send · Channel: {conv.channel}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: Message }) {
  const isUser = m.role === "user";
  const isStaff = m.role === "staff";
  const isAssistant = m.role === "assistant";
  const isTool = m.role === "tool";
  const isSystem = m.role === "system";

  if (isSystem || isTool) {
    return (
      <div className="text-xs text-muted text-center my-3 px-3">
        <span className="chip-muted">
          {m.role}
          {isTool && " · " + (m.meta?.tool_name as string)}
        </span>{" "}
        <span className="ml-2">{m.content.slice(0, 280)}</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex gap-2.5 max-w-[80%]",
        isUser ? "" : "ml-auto flex-row-reverse"
      )}
    >
      <div
        className={clsx(
          "size-7 rounded-full grid place-items-center text-xs font-bold shrink-0",
          isUser
            ? "bg-surface2 text-text border border-border"
            : isStaff
            ? "bg-warn/20 text-warn"
            : "bg-brand/20 text-brand"
        )}
      >
        {isUser ? "U" : isStaff ? "🧑" : "A"}
      </div>
      <div>
        <div
          className={clsx(
            "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
            isUser
              ? "bg-surface2 border border-border rounded-tl-sm"
              : isStaff
              ? "bg-warn/10 border border-warn/30 rounded-tr-sm"
              : "bg-brand/10 border border-brand/30 rounded-tr-sm"
          )}
        >
          {m.content}
        </div>
        <div
          className={clsx(
            "text-[11px] text-muted mt-1",
            isUser ? "text-left" : "text-right"
          )}
          title={formatDateTime(m.created_at)}
        >
          {isStaff ? "staff · " : isAssistant ? "AI · " : ""}
          {formatRelative(m.created_at)}
        </div>
      </div>
    </div>
  );
}
