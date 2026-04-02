import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";

const nav = [
  { path: "/dashboard", label: "Dashboard", icon: "&#127968;" },
  { path: "/tasks", label: "Tasks", icon: "&#128337;" },
  { path: "/agents", label: "Agents", icon: "&#129302;" },
  { path: "/calendar", label: "Calendar", icon: "&#128197;" },
  { path: "/files", label: "Files", icon: "&#128193;" },
  { path: "/chat", label: "Chat", icon: "&#128172;" },
  { path: "/org", label: "Org Chart", icon: "&#127970;" },
  { path: "/company", label: "Company", icon: "&#9881;" },
];

export default function DashboardLayout() {
  const { user, company, companies, setCompany, logout } = useAuth();
  const location = useLocation();
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    const res = await fetch("/api/companies", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ name: newCompanyName }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.company) {
      window.location.reload();
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#111827", color: "white" }}>
      {/* Sidebar */}
      <aside style={{ width: "240px", background: "#1F2937", padding: "1rem", display: "flex", flexDirection: "column", borderRight: "1px solid #374151" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem", color: "#3B82F6" }}>Mission Control</h2>

        {/* Company Switcher */}
        {companies.length > 1 ? (
          <select
            value={company?.id || ""}
            onChange={e => {
              const c = companies.find(c => c.id === e.target.value);
              if (c) { setCompany(c); localStorage.setItem("activeCompanyId", c.id); }
            }}
            style={{ width: "100%", background: "#374151", color: "white", border: "1px solid #4B5563", borderRadius: "4px", padding: "6px", marginBottom: "1rem" }}
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : company && (
          <div
            style={{ padding: "6px", marginBottom: "1rem", fontWeight: "bold", color: "#9CA3AF", fontSize: "0.9rem" }}
          >
            {company.name}
          </div>
        )}

        <button
          onClick={() => setShowCreateCompany(!showCreateCompany)}
          style={{ width: "100%", padding: "6px", marginBottom: "1rem", background: "#374151", border: "none", color: "#93c5fd", cursor: "pointer", borderRadius: "4px", fontSize: "0.85rem" }}
        >
          + New Company
        </button>

        {showCreateCompany && (
          <form onSubmit={handleCreateCompany} style={{ marginBottom: "1rem" }}>
            <input
              autoFocus
              placeholder="Company name"
              value={newCompanyName}
              onChange={e => setNewCompanyName(e.target.value)}
              style={{ width: "100%", padding: "6px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", marginBottom: "4px" }}
            />
            <button
              type="submit"
              style={{ width: "100%", padding: "4px", background: "#3B82F6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}
            >
              Create
            </button>
          </form>
        )}

        <nav style={{ flex: 1 }}>
          {nav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "8px",
                margin: "2px 0",
                textDecoration: "none",
                color: "inherit",
                background: location.pathname === item.path ? "#374151" : "transparent",
                borderRadius: "4px",
                fontSize: "0.9rem",
              }}
            >
              <span dangerouslySetInnerHTML={{ __html: item.icon }} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <div style={{ fontSize: "0.8rem", color: "#9CA3AF", marginBottom: "8px" }}>{user?.email}</div>
          <button
            onClick={logout}
            style={{ width: "100%", padding: "6px", background: "#374151", border: "none", color: "white", cursor: "pointer", borderRadius: "4px", fontSize: "0.85rem" }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
