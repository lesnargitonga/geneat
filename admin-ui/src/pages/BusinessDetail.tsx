import { NavLink, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Business } from "@/lib/types";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import BusinessConversations from "@/pages/business/Conversations";
import BusinessProfile from "@/pages/business/Profile";
import BusinessPrompt from "@/pages/business/Prompt";
import BusinessKb from "@/pages/business/Kb";
import BusinessBroadcasts from "@/pages/business/Broadcasts";
import BusinessWebhooks from "@/pages/business/Webhooks";
import BusinessUsage from "@/pages/business/Usage";
import BusinessMembers from "@/pages/business/Members";

const tabs = [
  { to: "", end: true, label: "Conversations" },
  { to: "profile", label: "Profile" },
  { to: "prompt", label: "Prompt" },
  { to: "kb", label: "Knowledge" },
  { to: "broadcasts", label: "Broadcasts" },
  { to: "webhooks", label: "Webhooks" },
  { to: "usage", label: "Usage" },
  { to: "members", label: "Members" },
];

function Layout() {
  const { slug } = useParams();
  const q = useQuery({
    queryKey: ["business", slug],
    queryFn: () => api<Business>(`/admin/businesses/${slug}`),
    enabled: !!slug,
  });

  if (q.isLoading)
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Loading…
      </div>
    );
  if (q.isError) return <ErrorBox error={q.error} />;
  const b = q.data!;

  return (
    <div>
      <PageHeader
        title={b.name}
        subtitle={
          <>
            <span className="font-mono">{b.slug}</span>
            {b.timezone && <span className="ml-2 text-muted">· {b.timezone}</span>}
            {b.currency && <span className="ml-2 text-muted">· {b.currency}</span>}
          </>
        }
      />
      <nav className="flex flex-wrap gap-1 border-b border-border mb-6">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              clsx(
                "px-3 py-2 -mb-px border-b-2 text-sm transition",
                isActive
                  ? "border-brand text-text"
                  : "border-transparent text-muted hover:text-text"
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ business: b }} />
    </div>
  );
}

export default function BusinessDetail() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<BusinessConversations />} />
        <Route path="profile" element={<BusinessProfile />} />
        <Route path="prompt" element={<BusinessPrompt />} />
        <Route path="kb" element={<BusinessKb />} />
        <Route path="broadcasts" element={<BusinessBroadcasts />} />
        <Route path="webhooks" element={<BusinessWebhooks />} />
        <Route path="usage" element={<BusinessUsage />} />
        <Route path="members" element={<BusinessMembers />} />
      </Route>
    </Routes>
  );
}
