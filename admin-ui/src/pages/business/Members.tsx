import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Empty, ErrorBox, Spinner } from "@/components/ui";
import { useBusiness } from "./_ctx";
import type { AdminRole } from "@/lib/types";

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
}

const ROLES: AdminRole[] = ["owner", "staff", "viewer"];

export default function BusinessMembers() {
  const b = useBusiness();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["members", b.slug],
    queryFn: () => api<Member[]>(`/admin/businesses/${b.slug}/members`),
  });

  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (user_id: string) =>
      api(`/admin/businesses/${b.slug}/members/${user_id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", b.slug] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted">{q.data?.length ?? 0} members</div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Add member
        </button>
      </div>

      {q.isLoading ? (
        <div className="card-pad flex items-center gap-2 text-muted">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.length ? (
        <Empty>No members yet — add an owner.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted bg-surface2">
              <tr>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-5 py-3">Role</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data.map((m) => (
                <tr key={m.user_id} className="hover:bg-surface2">
                  <td className="px-5 py-3">
                    <div className="font-medium">{m.full_name || m.email}</div>
                    <div className="text-xs text-muted">{m.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="chip-muted">{m.role}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      className="btn-danger text-xs"
                      disabled={del.isPending}
                      onClick={() => {
                        if (confirm("Remove this member?"))
                          del.mutate(m.user_id);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <AddMemberDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const b = useBusiness();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("staff");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api(`/admin/businesses/${b.slug}/members`, {
        method: "POST",
        body: { email: email.trim(), role },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", b.slug] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.detail : "Failed to add"),
  });
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card-pad w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Add member</h2>
        <div className="space-y-3">
          <div>
            <label className="label">User email</label>
            <input
              autoFocus
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted mt-1">
              User must already exist in the platform.
            </p>
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {err && (
            <div className="text-sm text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!email || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
