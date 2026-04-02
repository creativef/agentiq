import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";

const nav = [
  { path: "/dashboard", label: "Dashboard", icon: "🏠" },
  { path: "/tasks", label: "Tasks", icon: "⏱" },
  { path: "/agents", label: "Agents", icon: "🤖" },
  { path: "/calendar", label: "Calendar", icon: "📅" },
  { path: "/files", label: "Files", icon: "📁" },
  { path: "/chat", label: "Chat", icon: "💬" },
  { path: "/org", label: "Org Chart", icon: "🏢" },
  { path: "/company", label: "Company", icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div style={{ display: "flex", height: "100vh", background: "#111827", color: "white" }}>
      {/* Sidebar */}
      <aside style={{ width: "240px", background: "#1F2937", padding: "1rem", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem", color: "#3B82F6" }}>Mission Control</h2>
        <nav>
          {nav.map(item => (
            <Link key={item.path} to={item.path} style={{ display: "block", padding: "8px", margin: "4px 0", textDecoration: "none", color: "inherit", background: location.pathname === item.path ? "#374151" : "transparent", borderRadius: "4px" }}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
           <div style={{ fontSize: "0.8rem", color: "#9CA3AF", marginBottom: "8px" }}>{user?.email}</div>
           <button onClick={logout} style={{ width: "100%", padding: "6px", background: "#374151", border: "none", color: "white", cursor: "pointer", borderRadius: "4px" }}>Logout</button>
        </div>
      </aside>
      
      {/* Main */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {children || <Outlet />}
      </main>
    </div>
  );
}
