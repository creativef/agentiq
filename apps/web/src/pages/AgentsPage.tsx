import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface AgentItem {
  id: string;
  name: string;
  role: string;
  status: string;
  lastHeartbeat: string | null;
  costMonthly: number;
  budgetLimit: number | null;
  heartbeatInterval: number | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  running: "#22c55e",
  idle: "#3b82f6",
  error: "#ef4444",
  sleeping: "#a855f7",
};

export default function AgentsPage() {
  const { company } = useAuth();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "AGENT", budgetLimit: "", heartbeatInterval: "3600" });

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/agents`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAgents(d.agents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const res = await fetch(`/api/companies/${company.id}/agents`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        role: form.role,
        budgetLimit: form.budgetLimit ? Number(form.budgetLimit) : null,
        heartbeatInterval: Number(form.heartbeatInterval),
      }),
    });
    if (res.ok) {
      setAgents([...agents, ...(await res.json()).agents || []]);
      setShowForm(false);
      setForm({ name: "", role: "AGENT", budgetLimit: "", heartbeatInterval: "3600" });
      // Reload to get the new agent
      window.location.reload();
    }
  };

  const handleStatus = async (agentId: string, newStatus: string) => {
    await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setAgents(agents.map(a => a.id === agentId ? { ...a, status: newStatus } : a));
  };

  const handleDelete = async (agentId: string) => {
    await fetch(`/api/agents/${agentId}`, { method: "DELETE", credentials: "include" });
    setAgents(agents.filter(a => a.id !== agentId));
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Agents{ company ? ` — ${company.name} ` : ""}</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>
          + Add Agent
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
            <input autoFocus required placeholder="Agent name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}>
              <option value="AGENT">Agent</option>
              <option value="CEO">CEO</option>
              <option value="MANAGER">Manager</option>
            </select>
            <input type="number" placeholder="Budget limit ($)" value={form.budgetLimit} onChange={e => setForm({...form, budgetLimit: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <select value={form.heartbeatInterval} onChange={e => setForm({...form, heartbeatInterval: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}>
              <option value="60">Every minute</option>
              <option value="300">Every 5 min</option>
              <option value="3600">Every hour</option>
              <option value="86400">Daily</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="submit" style={{ padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "6px 16px", background: "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      )}

      {agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>&#129302;</div>
          <p>No agents yet. Click &quot;Add Agent&quot; to create your first one.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {agents.map(a => (
            <div key={a.id} style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: `1px solid #374151`, borderLeft: `4px solid ${statusColors[a.status] || "#6b7280"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{a.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{a.role}</div>
                </div>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", background: `${statusColors[a.status]}22`, color: statusColors[a.status] || "#6b7280", textTransform: "uppercase" }}>
                  {a.status}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#9ca3af" }}>
                <div>Budget{ a.budgetLimit ? `: $${a.budgetLimit}` : ": unlimited" }</div>
                <div>Cost{ a.costMonthly > 0 ? `: $${a.costMonthly}` : ": $0" }</div>
                <div>Heartbeat{ a.heartbeatInterval ? `: ${a.heartbeatInterval}s` : ": off" }</div>
                <div>Last beat{ a.lastHeartbeat ? new Date(a.lastHeartbeat).toLocaleString(): ": never" }</div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={() => handleStatus(a.id, "running")} style={{ padding: "4px 10px", background: "#225822", border: "none", color: "#4ade80", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Start</button>
                <button onClick={() => handleStatus(a.id, "idle")} style={{ padding: "4px 10px", background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Pause</button>
                <button onClick={() => handleStatus(a.id, "sleeping")} style={{ padding: "4px 10px", background: "#374151", border: "none", color: "#9ca3af", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Sleep</button>
                <button onClick={() => handleDelete(a.id)} style={{ padding: "4px 10px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", marginLeft: "auto" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
