"use client";

import { useEffect, useState } from "react";

type ApiState = "checking" | "online" | "degraded";

export function ApiStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<ApiState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5_000);
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then((res) => setState(res.ok ? "online" : "degraded"))
      .catch(() => setState("degraded"))
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const label =
    state === "online" ? "API live" : state === "degraded" ? "API degraded" : "Checking API";

  return (
    <span
      title={label}
      className={`inline-flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-editorial ${
        state === "online"
          ? "text-sage"
          : state === "degraded"
            ? "text-bronze"
            : "text-ink-mute"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          state === "online"
            ? "bg-sage"
            : state === "degraded"
              ? "bg-bronze"
              : "bg-ink-mute/40"
        }`}
      />
      {!compact && label}
    </span>
  );
}
