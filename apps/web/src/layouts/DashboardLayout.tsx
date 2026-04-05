import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import Modal from "../components/Modal";
import CompanyWizard from "../components/CompanyWizard";

const nav = [
  { path: "/dashboard", label: "Dashboard", icon: "\u{1F3E0}" },
  { path: "/tasks", label: "Tasks", icon: "\u{1F4CB}" },
  { path: "/history", label: "History", icon: "\u{1F4DC}" },
  { path: "/brief", label: "Brief", icon: "\u{1F4C4}" },
  { path: "/brain", label: "Intelligence", icon: "\u{1F9E0}" },
  { path: "/agents", label: "Agents", icon: "\u{1F916}" },
  { path: "/projects", label: "Projects", icon: "\u{1F4C1}" },
  { path: "/calendar", label: "Calendar", icon: "\u{1F4C5}" },
  { path: "/files", label: "Files", icon: "\u{1F4C1}" },
  { path: "/chat", label: "Chat", icon: "\u{1F4AC}" },
  { path: "/org", label: "Org Chart", icon: "\u{1F3E2}" },
  { path: "/integrations", label: "Integrations", icon: "\u{1F50C}" },
  { path: "/company", label: "Company", icon: "\u{2699}" },
];

export default function DashboardLayout() {
  const { user, company, companies, project, projects, setCompany, setProject, logout } = useAuth();
  const location = useLocation();
  const [showWizard, setShowWizard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const linkStyle = (path: string) => ({
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "8px", margin: "2px 0", textDecoration: "none",
    color: "inherit", borderRadius: "4px", fontSize: "0.9rem",
    background: location.pathname === path ? "#374151" : "transparent",
  });

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="sidebar-title">Mission Control</h2>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        {/* Company Switcher */}
        {companies.length > 1 ? (
          <select className="sidebar-select" value={company?.id || ""}
            onChange={e => {
              const c = companies.find(c => c.id === e.target.value);
              if (c) { setCompany(c); setSidebarOpen(false); }
            }}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : company && (
          <div className="sidebar-company">{company.name}</div>
        )}

        {/* Project Switcher */}
        {projects.length > 0 ? (
          <select className="sidebar-select" value={project?.id || ""}
            onChange={e => {
              const p = projects.find(p => p.id === e.target.value);
              if (p) setProject(p);
              else setProject(null);
              setSidebarOpen(false);
            }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : project && (
          <div className="sidebar-company" style={{ fontSize: "0.8rem", color: "#6b7280" }}>📁 {project.name}</div>
        )}

        <button className="sidebar-btn-secondary" onClick={() => setShowWizard(true)}>
          + New Company
        </button>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <Link key={item.path} to={item.path} className="sidebar-link" style={linkStyle(item.path)} onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">{user?.email}</div>
          <button className="sidebar-btn-secondary" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
        <Outlet />
      </main>

      {/* New Company Wizard Modal */}
      <Modal open={showWizard} onClose={() => setShowWizard(false)} title="Set Up Your Company" size="lg">
        <CompanyWizard
          onComplete={() => setShowWizard(false)}
          onCancel={() => setShowWizard(false)}
        />
      </Modal>
    </div>
  );
}
