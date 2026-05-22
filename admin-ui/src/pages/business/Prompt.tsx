import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ErrorBox, Spinner } from "@/components/ui";
import { useBusiness } from "./_ctx";

export default function BusinessPrompt() {
  const b = useBusiness();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["profile", b.slug],
    queryFn: () => api<Record<string, unknown>>(`/admin/businesses/${b.slug}/profile`),
  });

  const [voice, setVoice] = useState("");
  const [greeting, setGreeting] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (q.data) {
      setVoice((q.data.brand_voice as string) || "");
      setGreeting((q.data.greeting_template as string) || "");
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/businesses/${b.slug}/prompt`, {
        method: "PATCH",
        body: {
          brand_voice: voice || null,
          greeting_template: greeting || null,
        },
      }),
    onSuccess: () => {
      setOk(true);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["profile", b.slug] });
      setTimeout(() => setOk(false), 2000);
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Save failed"),
  });

  if (q.isLoading)
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Loading…
      </div>
    );
  if (q.isError) return <ErrorBox error={q.error} />;

  return (
    <div className="max-w-3xl">
      <div className="space-y-5">
        <div>
          <label className="label">Brand voice</label>
          <textarea
            className="input min-h-[160px] resize-y"
            placeholder="e.g. Warm, witty, concise. Reflects local Kenyan culture and uses Swahili greetings naturally."
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          />
          <p className="text-xs text-muted mt-1">
            Injected into the system prompt for every turn on this tenant.
          </p>
        </div>
        <div>
          <label className="label">Greeting template</label>
          <textarea
            className="input min-h-[100px] resize-y"
            placeholder="Karibu {brand_name}! How can I help today?"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
          />
          <p className="text-xs text-muted mt-1">
            Used for cold opens. <code>{"{brand_name}"}</code> is substituted.
          </p>
        </div>
        {err && (
          <div className="text-sm text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2">
          {ok && <span className="chip-ok self-center">Saved</span>}
          <button
            className="btn-primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
