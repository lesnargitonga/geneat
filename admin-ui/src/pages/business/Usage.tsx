import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, Spinner, Stat } from "@/components/ui";
import { useBusiness } from "./_ctx";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { UsageBucket } from "@/lib/types";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function BusinessUsage() {
  const b = useBusiness();
  const [days, setDays] = useState(7);
  const q = useQuery({
    queryKey: ["usage", b.slug, days],
    queryFn: () =>
      api<{ buckets: UsageBucket[]; total_cost: number; currency: string }>(
        `/admin/businesses/${b.slug}/usage?days=${days}`
      ),
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={
              days === r.days
                ? "chip-warn cursor-pointer"
                : "chip-muted cursor-pointer hover:border-brand/60"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : !q.data ? null : (
        <>
          <Totals data={q.data} />
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted bg-surface2">
                <tr>
                  <th className="text-left px-5 py-3">Day</th>
                  <th className="text-right px-5 py-3">Msgs in</th>
                  <th className="text-right px-5 py-3">Msgs out</th>
                  <th className="text-right px-5 py-3">Voice min</th>
                  <th className="text-right px-5 py-3">Tokens in</th>
                  <th className="text-right px-5 py-3">Tokens out</th>
                  <th className="text-right px-5 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data.buckets.map((row) => (
                  <tr key={row.day} className="hover:bg-surface2">
                    <td className="px-5 py-2.5 font-mono text-xs">{row.day}</td>
                    <td className="px-5 py-2.5 text-right">
                      {formatNumber(row.messages_in)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {formatNumber(row.messages_out)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {row.voice_minutes.toFixed(1)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {formatNumber(row.tokens_in)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {formatNumber(row.tokens_out)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {formatCurrency(row.cost_estimate, q.data.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Totals({
  data,
}: {
  data: { buckets: UsageBucket[]; total_cost: number; currency: string };
}) {
  const sum = (k: keyof UsageBucket) =>
    data.buckets.reduce((a, r) => a + Number(r[k] || 0), 0);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Stat label="Messages in" value={formatNumber(sum("messages_in"))} />
      <Stat label="Messages out" value={formatNumber(sum("messages_out"))} />
      <Stat label="Voice minutes" value={sum("voice_minutes").toFixed(1)} />
      <Stat
        label="Est. cost"
        value={formatCurrency(data.total_cost, data.currency)}
        tone="warn"
      />
    </div>
  );
}
