import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "err";
}) {
  const toneCls = {
    default: "text-text",
    ok: "text-ok",
    warn: "text-warn",
    err: "text-err",
  }[tone];
  return (
    <div className="card-pad">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={clsx("text-2xl font-semibold mt-1.5", toneCls)}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card-pad text-sm text-muted text-center py-12">
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "size-4 border-2 border-muted border-t-brand rounded-full animate-spin",
        className
      )}
    />
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="card-pad border-err/40 text-err text-sm">
      <div className="font-medium mb-0.5">Something went wrong</div>
      <div className="text-err/80 break-words">{msg}</div>
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "chip-ok",
    pending: "chip-warn",
    human_escalated: "chip-warn",
    resolved: "chip-muted",
    abandoned: "chip-muted",
    draft: "chip-muted",
    queued: "chip-warn",
    running: "chip-warn",
    completed: "chip-ok",
    failed: "chip-err",
    cancelled: "chip-muted",
  };
  return <span className={map[status] || "chip-muted"}>{status}</span>;
}

export function ChannelChip({ channel }: { channel: string }) {
  const ic: Record<string, string> = {
    whatsapp: "🟢",
    voice: "📞",
    sms: "✉",
    mock: "◆",
  };
  return (
    <span className="chip-muted">
      <span className="mr-1">{ic[channel] || "•"}</span>
      {channel}
    </span>
  );
}
