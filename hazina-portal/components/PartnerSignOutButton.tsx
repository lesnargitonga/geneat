"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartnerSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/partners/logout", { method: "POST" });
      router.push("/partners/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="font-mono text-sm uppercase tracking-[0.1em] text-ink-mute hover:text-obsidian disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
