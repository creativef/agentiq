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
  platform: string | null;
  projectId: string | null;
  reportsTo: string | null;
}

const statusColors: Record<string, string> = {
  running: "#22c55e",
  idle: "#3b82f6",
  error: "#ef4444",
  sleeping: "#a855f7",
};

export default function AgentsPage() {
  const { company, project } = useAuth();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AgentItem | null>(null);
  const [form, setForm] = useState({ name: "", role: "AGENT", budgetLimit: "", heartbeatInterval: "3600" });
  const [editForm, setEditForm] = useState({ name: "", status: "", budgetLimit: "", heartbeatInterval: "", reportsTo: "" });
  const [agentSkills, setAgentSkills] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const fetchAgents = () => {
    if (!company) return;
    const url = project
      ? `/api/companies/${company.id}/agents?projectId=${project.id}`
      : `/api/companies/${company.id}/agents`;
    fetch(url, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAgents(d.agents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
  }, [company, project]);

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
      setForm({ name: "", role: "AGENT", budgetLimit: "", heartbeatInterval: "3600" });
      fetchAgents();
      setShowForm(false);
    }
  };

  const handleEdit = async (agent: AgentItem) => {
    setEditing(agent);
    setEditForm({
      name: agent.name,
      status: agent.status,
      budgetLimit: agent.budgetLimit ? String(agent.budgetLimit) : "",
      heartbeatInterval: agent.heartbeatInterval ? String(agent.heartbeatInterval) : "3600",
      reportsTo: agent.reportsTo || "",
    });
    // Load skills for this agent
    fetch(`/api/agents/${agent.id}/skills`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAgentSkills(d?.skills || []))
      .catch(() => setAgentSkills([]));
    setShowSkillPicker(false);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    await fetch(`/api/agents/${editing.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        status: editForm.status || undefined,
        budgetLimit: editForm.budgetLimit ? Number(editForm.budgetLimit) : null,
        heartbeatInterval: Number(editForm.heartbeatInterval),
        reportsTo: editForm.reportsTo || null,
      }),
    });
    setEditing(null);
    fetchAgents();
  };

  const loadAvailableSkills = () => {
    fetch("/api/skills", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAvailableSkills(d?.skills || []))
      .catch(() => setAvailableSkills([]));
  };

  const assignSkill = async (skillId: string) => {
    if (!editing) return;
    await fetch(`/api/agents/${editing.id}/skills`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
    fetch(`/api/agents/${editing.id}/skills`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAgentSkills(d.skills || []));
  };

  const removeSkill = async (agentSkillId: string) => {
    if (!editing) return;
    await fetch(`/api/agents/${editing.id}/skills/${agentSkillId}`, { method: "DELETE", credentials: "include" });
    setAgentSkills(agentSkills.filter(s => s.id !== agentSkillId));
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

  // Sort: founders (role=FOUNDER) at top, then CEO, then by name
  const sorted = [...agents].sort((a, b) => {
    if (a.role === "FOUNDER" && b.role !== "FOUNDER") return -1;
    if (a.role !== "FOUNDER" && b.role === "FOUNDER") return 1;
    if (a.role === "CEO" && b.role !== "CEO") return -1;
    if (a.role !== "CEO" && b.role === "CEO") return 1;
    return a.name.localeCompare(b.name);
  });

  const roleLabel = (role: string) => {
    if (role === "FOUNDER") return "Founder";
    if (role === "CEO") return "CEO";
    if (role === "MANAGER") return "Manager";
    return role;
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Agents
          <span className="tooltip-trigger">
            ?
            <span className="tooltip-bubble">AI agents are autonomous workers that execute tasks for your company. Each agent has a role, status, and budget. Founder is always at the top.</span>
          </span>
        </h1>
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
              <option value="FOUNDER">Founder</option>
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

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>&#129302;</div>
          <p>No agents yet. Click &quot;Add Agent&quot; to create your first one.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {sorted.map(a => (
            <div key={a.id} style={{
              background: "#1f2937", borderRadius: "8px", padding: "1rem", border: a.role === "FOUNDER" ? "1px solid #f59e0b" : "1px solid #374151",
              borderLeft: `4px solid ${a.role === "FOUNDER" ? "#f59e0b" : statusColors[a.status] || "#6b7280"}`
            }}>
              {editing?.id === a.id ? (
                <div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "4px" }}>Edit Agent</div>
                    <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: "100%", padding: "6px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", marginBottom: "4px", boxSizing: "border-box" }} />
                    <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} style={{ width: "100%", padding: "6px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", marginBottom: "4px" }}>
                      <option value="idle">Idle</option>
                      <option value="running">Running</option>
                      <option value="sleeping">Sleeping</option>
                      <option value="error">Error</option>
                    </select>
                    <input type="number" placeholder="Budget limit" value={editForm.budgetLimit} onChange={e => setEditForm({...editForm, budgetLimit: e.target.value})} style={{ width: "100%", padding: "6px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", marginBottom: "4px", boxSizing: "border-box" }} />
                    <select value={editForm.heartbeatInterval} onChange={e => setEditForm({...editForm, heartbeatInterval: e.target.value})} style={{ width: "100%", padding: "6px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", marginBottom: "4px" }}>
                      <option value="60">Every minute</option>
                      <option value="300">Every 5 min</option>
                      <option value="3600">Every hour</option>
                      <option value="86400">Daily</option>
                    </select>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "4px" }}>Reports to</div>
                    <select value={editForm.reportsTo} onChange={e => setEditForm({...editForm, reportsTo: e.target.value})} style={{ width: "100%", padding: "6px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", marginBottom: "4px" }}>
                      <option value="">— No one (top-level) —</option>
                      {agents
                        .filter(a => a.id !== editing?.id)
                        .map(a => (
                          <option key={a.id} value={a.id}>{a.role === "FOUNDER" ? "🚀 " : a.role === "CEO" ? "👔 " : ""}{a.name} ({a.role})</option>
                        ))}
                    </select>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "4px" }}>Skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "4px" }}>
                      {agentSkills.map(s => (
                        <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#2563eb", borderRadius: "12px", padding: "2px 8px", fontSize: "0.7rem", color: "white" }}>
                          {s.icon} {s.name}
                          <button onClick={() => removeSkill(s.id)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "0.8rem", padding: "0 2px" }}>×</button>
                        </span>
                      ))}
                      {!showSkillPicker && (
                        <button onClick={() => { loadAvailableSkills(); setShowSkillPicker(true); }} style={{ background: "none", border: "1px dashed #4B5563", borderRadius: "12px", padding: "2px 8px", fontSize: "0.7rem", color: "#9ca3af", cursor: "pointer" }}>+ Skill</button>
                      )}
                    </div>
                    {showSkillPicker && (
                      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: "6px", padding: "8px", maxHeight: "200px", overflow: "auto" }}>
                        <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "4px" }}>Available skills:</div>
                        {availableSkills
                          .filter(s => !agentSkills.find(as => as.skillId === s.id))
                          .map(s => (
                            <button key={s.id} onClick={() => assignSkill(s.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "4px 8px", background: s.role === "CEO" ? "#1e3a5f" : "#374151", border: "none", borderRadius: "4px", color: "#e5e7eb", fontSize: "0.75rem", cursor: "pointer", marginBottom: "2px" }}>
                              {s.icon} {s.name} <span style={{ color: "#6b7280" }}>({s.category})</span>
                            </button>
                          ))}
                        <button onClick={() => setShowSkillPicker(false)} style={{ marginTop: "4px", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.75rem" }}>Close</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={handleSaveEdit} style={{ padding: "4px 10px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Save</button>
                    <button onClick={() => setEditing(null)} style={{ padding: "4px 10px", background: "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                        {a.name}
                        {a.role === "FOUNDER" && (
                          <span className="tooltip-trigger" style={{ fontSize: "8px", marginLeft: "6px" }}>
                            ★
                            <span className="tooltip-bubble">This person is the Founder of your company. It should be listed first in the org chart.</span>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                        {roleLabel(a.role)}{a.platform ? ` · ${a.platform}` : ""}
                        {a.reportsTo && (
                          <span style={{ color: "#f59e0b" }}> · ↓</span>
                        )}
                      </div>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", background: `${statusColors[a.status] || "#6b7280"}22`, color: statusColors[a.status] || "#6b7280", textTransform: "uppercase" }}>
                      {a.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#9ca3af" }}>
                    <div>
                      Budget
                      <span className="tooltip-trigger">
                        ?
                        <span className="tooltip-bubble">Maximum spending limit for this agent</span>
                      </span>
                      {a.budgetLimit ? `: $${a.budgetLimit}` : ": unlimited"}
                    </div>
                    <div>
                      Cost
                      <span className="tooltip-trigger">
                        ?
                        <span className="tooltip-bubble">Monthly running cost in USD</span>
                      </span>
                      {a.costMonthly > 0 ? `: $${a.costMonthly}` : ": $0"}
                    </div>
                    <div>
                      Heartbeat
                      <span className="tooltip-trigger">
                        ?
                        <span className="tooltip-bubble">How often the agent checks in (in seconds)</span>
                      </span>
                      {a.heartbeatInterval ? `: ${a.heartbeatInterval}s` : ": off"}
                    </div>
                    <div>
                      Last beat
                      <span className="tooltip-trigger">
                        ?
                        <span className="tooltip-bubble">Last time the agent responded to a ping</span>
                      </span>
                      {a.lastHeartbeat ? new Date(a.lastHeartbeat).toLocaleString(): ": never"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <button onClick={() => handleStatus(a.id, "running")} style={{ padding: "4px 10px", background: "#225822", border: "none", color: "#4ade80", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Start</button>
                    <button onClick={() => handleStatus(a.id, "idle")} style={{ padding: "4px 10px", background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Pause</button>
                    <button onClick={() => handleStatus(a.id, "sleeping")} style={{ padding: "4px 10px", background: "#374151", border: "none", color: "#9ca3af", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Sleep</button>
                    <button onClick={() => handleEdit(a)} style={{ padding: "4px 10px", background: "#374151", border: "none", color: "#e5e7eb", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
                    <button onClick={() => handleDelete(a.id)} style={{ padding: "4px 10px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", marginLeft: "auto" }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
