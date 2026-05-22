import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ErrorBox, Spinner } from "@/components/ui";
import { useBusiness } from "./_ctx";

interface Profile {
  timezone?: string;
  currency?: string;
  currency_symbol?: string;
  escalation_phone?: string;
  fallback_reply?: string;
  business_hours?: Record<string, unknown>;
  holidays?: string[];
  pricing?: Record<string, number>;
  [k: string]: unknown;
}

interface ProfileResponse {
  profile: Profile;
}

export default function BusinessProfile() {
  const b = useBusiness();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["profile", b.slug],
    queryFn: () => api<ProfileResponse>(`/admin/businesses/${b.slug}/profile`),
  });

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setText(JSON.stringify(q.data.profile || {}, null, 2));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(text);
      return api(`/admin/businesses/${b.slug}/profile`, {
        method: "PUT",
        body: { profile: parsed },
      });
    },
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["profile", b.slug] });
      qc.invalidateQueries({ queryKey: ["business", b.slug] });
    },
    onError: (e) => {
      setErr(
        e instanceof SyntaxError
          ? "Invalid JSON"
          : e instanceof ApiError
          ? e.detail
          : "Save failed"
      );
    },
  });

  if (q.isLoading)
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Loading…
      </div>
    );
  if (q.isError) return <ErrorBox error={q.error} />;

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Tenant runtime config (timezone, currency, business hours, escalation
        phone, fallback reply, holidays, pricing). Stored in{" "}
        <code className="text-text">Business.profile</code> JSONB.
      </p>
      <textarea
        spellCheck={false}
        className="input font-mono text-xs h-[480px] resize-y leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {err && (
        <div className="text-sm text-err mt-2 bg-err/10 border border-err/30 rounded-lg px-3 py-2">
          {err}
        </div>
      )}
      <div className="flex justify-end mt-3 gap-2">
        <button
          className="btn-ghost"
          onClick={() => q.data && setText(JSON.stringify(q.data.profile || {}, null, 2))}
        >
          Reset
        </button>
        <button
          className="btn-primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
