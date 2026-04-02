import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface Stats {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
}

export default function DashboardPage() {
  const { company, companies, setCompany } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/companies/${company.id}/dashboard`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setAgents(data.agents || []);
        setEvents(data.timeline || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

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

  const kpis = [
    { label: "Total Agents", value: stats?.totalAgents ?? 0, icon: "\uD83E\uDD16" },
    { label: "Active Agents", value: stats?.activeAgents ?? 0, icon: "\u26A1" },
    { label: "Total Tasks", value: stats?.totalTasks ?? 0, icon: "\uD83D\uDCCB" },
    { label: "Completed", value: stats?.completedTasks ?? 0, icon: "\u2705" },
  ];

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          {companies.length > 1 && (
            <select
              value={company.id}
              onChange={e => {
                const c = companies.find(c => c.id === e.target.value);
                if (c) { setCompany(c); localStorage.setItem("activeCompanyId", c.id); }
              }}
              style={{ background: "#374151", color: "white", border: "1px solid #4B5563", borderRadius: "4px", padding: "6px" }}
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Dashboard &mdash; {company.name}</h1>
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
          {agents.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No agents yet</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.5rem" }}>
              {agents.map(a => (
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
