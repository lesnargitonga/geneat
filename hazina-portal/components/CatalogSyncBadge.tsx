"use client";

import { useEffect, useState } from "react";

type CatalogPayload = {
  collections?: unknown[];
  treasures?: unknown[];
  backend?: {
    livePhotoKeys?: number;
  };
};

export function CatalogSyncBadge() {
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6_000);
    fetch("/api/catalog", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("catalog unavailable"))))
      .then((body) => setPayload(body))
      .catch(() => setFailed(true))
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  if (failed) {
    return (
      <span className="chip border border-border text-bronze">
        Catalog API retrying
      </span>
    );
  }

  if (!payload) {
    return <span className="chip border border-border text-ink-mute">Syncing catalog</span>;
  }

  return (
    <span className="chip border border-border text-sage">
      {payload.collections?.length || 0} collections · {payload.treasures?.length || 0} treasures ·{" "}
      {payload.backend?.livePhotoKeys || 0} live media keys
    </span>
  );
}
