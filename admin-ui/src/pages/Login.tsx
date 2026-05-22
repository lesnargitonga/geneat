import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/", { replace: true });
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? e.status === 401
            ? "Invalid email or password."
            : e.detail
          : "Login failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto size-12 rounded-2xl bg-gradient-to-br from-brand to-accent grid place-items-center text-white text-xl font-bold shadow-glow">
            Ω
          </div>
          <h1 className="mt-3 text-xl font-semibold">Omni Admin</h1>
          <p className="text-sm text-muted">Sign in to your control plane</p>
        </div>
        <form onSubmit={submit} className="card-pad space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              autoFocus
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && (
            <div className="text-sm text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-[11px] text-muted text-center mt-4">
          Protected area · all access is audited
        </p>
      </div>
    </div>
  );
}
