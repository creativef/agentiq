import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  projectId: string | null;
}

export default function DashboardPage() {
  const { company, companies, setCompany, project, projects, setProject } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<{ totalAgents: number; activeAgents: number; totalTasks: number; completedTasks: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshDashboard = () => {
    if (!company) { setError(null); setLoading(false); return; }
    setError(null);
    setLoading(true);
    Promise.all([
      fetch(`/api/companies/${company.id}/dashboard`, { credentials: "include" }),
      fetch(`/api/companies/${company.id}/agents`, { credentials: "include" }),
    ])
      .then(async ([dashRes, agentsRes]) => {
        const dashData = dashRes.ok ? await dashRes.json() : null;
        const agentsData = agentsRes.ok ? await agentsRes.json() : null;

        if (dashData?.stats) setStats(dashData.stats);
        if (agentsData?.agents) setAgents(agentsData.agents);
        if (dashData?.timeline) setEvents(dashData.timeline);
        else setEvents([]);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || "Failed to connect to server");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshDashboard();
  }, [company, project]);

  if (!company) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Dashboard</h1>
        <p style={{ color: "#888" }}>You need to create a company first.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
          <h2 style={{ color: "#fca5a5", margin: "0 0 0.5rem 0" }}>Connection Error</h2>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{error}</p>
          <button
            onClick={refreshDashboard}
            style={{ marginTop: "1rem", padding: "8px 24px", background: "#dc2626", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            ↻ Retry
          </button>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Total Agents", value: stats?.totalAgents ?? 0, icon: "\u{1F916}" },
    { label: "Active Agents", value: stats?.activeAgents ?? 0, icon: "\u{26A1}" },
    { label: "Total Tasks", value: stats?.totalTasks ?? 0, icon: "\u{1F4CB}" },
    { label: "Completed", value: stats?.completedTasks ?? 0, icon: "\u{2705}" },
  ];

  // Filter agents by project
  const filteredAgents = project ? agents.filter(a => a.projectId === project.id) : agents;
  const projectLabel = project ? project.name : "All Projects";

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          {companies.length > 1 && (
            <select
              value={company.id}
              onChange={e => {
                const c = companies.find(c => c.id === e.target.value);
                if (c) { setCompany(c); }
              }}
              style={{ background: "#374151", color: "white", border: "1px solid #4B5563", borderRadius: "4px", padding: "6px" }}
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {projects.length > 1 && (
            <select
              value={project?.id || ""}
              onChange={e => {
                const p = projects.find(p => p.id === e.target.value);
                if (p) setProject(p); else setProject(null);
              }}
              style={{ background: "#374151", color: "white", border: "1px solid #4B5563", borderRadius: "4px", padding: "6px" }}
            >
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Dashboard &mdash; {company.name} / {projectLabel}</h1>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{company.goal}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{kpi.icon}</span>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#3b82f6" }}>{kpi.value}</div>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{kpi.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Status Wall</h2>
          {filteredAgents.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No agents yet</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.5rem" }}>
              {filteredAgents.map(a => (
                <div key={a.id} style={{ padding: "0.75rem", borderRadius: "6px", border: `2px solid ${agentColor(a.status)}`, textAlign: "center" }}>
                  <div style={{ fontSize: "1.25rem" }}>&#129302;</div>
                  <div style={{ fontWeight: "bold", fontSize: "0.8rem", marginTop: "4px" }}>{a.name}</div>
                  <div style={{ fontSize: "0.7rem", color: agentColor(a.status), textTransform: "uppercase", fontWeight: "bold" }}>{a.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Activity</h2>
          {events.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No activity yet</p>
          ) : (
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {events.slice(0, 15).map(ev => (
                <div key={ev.id} style={{ padding: "0.5rem", borderBottom: "1px solid #374151", fontSize: "0.8rem" }}>
                  <span style={{ color: "#3b82f6" }}>&#9889; {ev.type}</span>
                  {ev.createdAt && <div style={{ color: "#6b7280", marginTop: "2px" }}>{new Date(ev.createdAt).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function agentColor(status: string): string {
  switch (status) {
    case "running": return "#22c55e";
    case "idle": return "#3b82f6";
    case "error": return "#ef4444";
    case "sleeping": return "#a855f7";
    default: return "#6b7280";
  }
}
