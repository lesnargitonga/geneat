import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import clsx from "clsx";

const nav = [
  { to: "/", label: "Dashboard", end: true, icon: "◎" },
  { to: "/live", label: "Live", icon: "◉" },
  { to: "/hazina", label: "Hazina", icon: "HN" },
  { to: "/businesses", label: "Businesses", icon: "▤" },
  { to: "/audit", label: "Audit", icon: "⌘" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();
  return (
    <div className="h-full grid grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-surface/60 backdrop-blur flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-brand to-accent grid place-items-center text-white font-bold">
              Ω
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">
                Omni Admin
              </div>
              <div className="text-[11px] text-muted leading-tight">
                Control plane
              </div>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                isActive ? "nav-link-active" : "nav-link"
              }
            >
              <span className="text-brand text-base">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-2 py-2 text-xs">
            <div className="font-medium text-text truncate">
              {user?.full_name || user?.email}
            </div>
            <div className="text-muted mt-0.5 flex items-center gap-1.5">
              <span
                className={clsx(
                  user?.is_superadmin ? "chip-warn" : "chip-muted"
                )}
              >
                {user?.role}
              </span>
            </div>
          </div>
          <button
            className="btn-ghost w-full mt-2"
            onClick={() => {
              logout();
              nav2("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="overflow-auto scrollbar-thin">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
