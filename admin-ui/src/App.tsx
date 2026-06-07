import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import LoginPage from "@/pages/Login";
import AppShell from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import BusinessesPage from "@/pages/Businesses";
import BusinessDetail from "@/pages/BusinessDetail";
import ConversationViewer from "@/pages/ConversationViewer";
import AuditPage from "@/pages/Audit";
import LiveStream from "@/pages/LiveStream";
import HazinaCommandCenter from "@/pages/HazinaCommandCenter";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="h-full grid place-items-center text-muted">Loading…</div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="businesses" element={<BusinessesPage />} />
        <Route path="businesses/:slug/*" element={<BusinessDetail />} />
        <Route path="conversations/:id" element={<ConversationViewer />} />
        <Route path="live" element={<LiveStream />} />
        <Route path="hazina" element={<HazinaCommandCenter />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
