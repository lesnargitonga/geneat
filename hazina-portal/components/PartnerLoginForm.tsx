"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function PartnerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/partners/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof body.detail === "string" ? body.detail : "Sign-in failed.");
        return;
      }
      const next = searchParams.get("next") || "/partners/dashboard";
      router.push(next.startsWith("/partners") ? next : "/partners/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-sm w-full">
      <label className="block">
        <span className="label-mono block mb-2">Partner email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-soft w-full"
        />
      </label>
      <label className="block">
        <span className="label-mono block mb-2">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-soft w-full"
        />
      </label>
      {error && <p className="text-sm text-bronze-dark">{error}</p>}
      <button type="submit" disabled={loading} className="btn-bronze w-full disabled:opacity-50">
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
