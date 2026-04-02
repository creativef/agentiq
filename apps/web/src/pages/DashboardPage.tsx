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
  const { company } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const { company: _company, companies, setCompany } = useAuth();

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/companies/${company.id}/dashboard`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setAgents(data.agents || []);
        setEvents(data.timeline || []);
      })
      .catch(() => console.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [company]);

  if (!company) {
    return (
      <div className="page" style={{ padding: "2rem" }}>
        <h1>Dashboard</h1>
        <p style={{ color: "#888" }}>You need to create a company first.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="page" style={{ padding: "2rem", color: "#888" }}>Loading...</div>;
  }

  const kpis: { label: string; value: number | string; icon: string }[] = [
    { label: "Total Agents", value: stats?.totalAgents || 0, icon: "🤖" },
    { label: "Active Agents", value: stats?.activeAgents || 0, icon: "⚡" },
    { label: "Total Tasks", value: stats?.totalTasks || 0, icon: "📋" },
    { label: "Completed", value: stats?.completedTasks || 0, icon: "✅" },
  ];

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
        Dashboard — {company.name}
      </h1>
      <p style={{ color: "#9ca3af", fontSize: "0.9rem", marginBottom: "1.5rem" }}>{company.goal}</p>

      {/* KPI Tiles */}
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
        {/* Status Wall */}
        <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Status Wall</h2>
          {agents.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No agents yet</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {agents.map(a => (
                <div key={a.id} style={{ 
                  padding: "0.75rem", 
                  borderRadius: "6px", 
                  border: `2px solid ${getAgentColor(a.status)}`,
                  textAlign: "center",
                  background: `${getAgentBg(a.status)}`
                }}>
                  <div style={{ fontSize: "1.5rem" }}>🤖</div>
                  <div style={{ fontWeight: "bold", fontSize: "0.8rem", marginTop: "4px" }}>{a.name}</div>
                  <div style={{ 
                    fontSize: "0.7rem", 
                    color: getAgentColor(a.status),
                    textTransform: "uppercase", 
                    fontWeight: "bold" 
                  }}>{a.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Activity Timeline</h2>
          {events.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No activity yet</p>
          ) : (
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {events.slice(0, 10).map(ev => (
                <div key={ev.id} style={{ padding: "0.5rem", borderBottom: "1px solid #374151", fontSize: "0.85rem" }}>
                  <span style={{ color: "#3b82f6" }}>⚡ {ev.type}</span>
                  <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: "0.75rem" }}>
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "N/A"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getAgentColor(status: string): string {
  switch (status) {
    case "running": return "#22c55e";
    case "idle": return "#3b82f6";
    case "error": return "#ef4444";
    case "sleeping": return "#a855f7";
    default: return "#6b7280";
  }
}

function getAgentBackground(status: string): string {
  switch (status) {
    case "running": return "rgba(34, 197, 94, 0.1)";
    case "idle": return "rgba(59, 130, 246, 0.1)";
    case "error": return "rgba(239, 68, 68, 0.1)";
    case "sleeping": return "rgba(168, 85, 247, 0.1)";
    default: return "rgba(107, 114, 128, 0.1)";
  }
}
