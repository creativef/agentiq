import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  agentName: string | null;
  agentId: string | null;
  projectId: string | null;
}

interface Agent {
  id: string;
  name: string;
  role: string;
}

const columns = [
  { key: "backlog", label: "Backlog", color: "#6b7280" },
  { key: "ready", label: "Ready", color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
  { key: "blocked", label: "Blocked", color: "#ef4444" },
];

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
};

export default function TaskBoard() {
  const { company, project } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", agentId: "" });

  // Load agents for assignment dropdown
  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/agents`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAgents(d.agents || []))
      .catch(console.error);
  }, [company]);

  useEffect(() => {
    const url = project
      ? `/api/tasks?projectId=${project.id}`
      : "/api/tasks";
    fetch(url, { credentials: "include" })
      .then(r => r.json())
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company, project]);

  const handleStatus = useCallback(async (taskId: string, status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  }, []);

  const handleDelete = useCallback(async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE", credentials: "include" });
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status: "backlog",
        agentId: form.agentId || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(prev => [...prev, { ...data.task }]);
      setShowForm(false);
      setForm({ title: "", description: "", priority: "medium", agentId: "" });
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    dragItem.current = taskId;
    setDraggedId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = dragItem.current;
    if (taskId) {
      await handleStatus(taskId, newStatus);
      setDraggedId(null);
      dragItem.current = null;
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem", height: "calc(100vh - 80px)", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Task Board</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>+ Add Task</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <input autoFocus required placeholder="Task title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <select value={form.agentId} onChange={e => setForm({...form, agentId: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}>
              <option value="">— No Agent —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.role === "FOUNDER" ? "🚀 " : a.role === "CEO" ? "👔 " : ""}{a.name}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ width: "100%", marginTop: "0.5rem", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", minHeight: "60px", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" style={{ padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "6px 16px", background: "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: "0.75rem", height: "100%", minHeight: "400px" }}>
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key || (!t.status && col.key === "backlog"));
          return (
            <div key={col.key} onDragOver={handleDragOver} onDrop={e => handleDrop(e, col.key)} style={{ background: "#111827", borderRadius: "8px", padding: "0.75rem", border: "1px solid #1f2937", minHeight: "200px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{col.label}</span>
                <span style={{ background: col.color, color: "#000", fontSize: "0.75rem", fontWeight: "bold", padding: "2px 8px", borderRadius: "12px" }}>{colTasks.length}</span>
              </div>
              {colTasks.map(task => (
                <div key={task.id} draggable onDragStart={e => handleDragStart(e, task.id)} style={{ background: "#1f2937", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #374151", cursor: "grab", opacity: draggedId === task.id ? 0.5 : 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "4px" }}>{task.title}</div>
                  {task.description && <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "4px" }}>{task.description}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: `${priorityColors[task.priority]}33`, color: priorityColors[task.priority] || "#6b7280", borderRadius: "4px" }}>{task.priority}</span>
                    {task.agentName && <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{task.agentName}</span>}
                    <button onClick={e => { e.stopPropagation(); handleDelete(task.id); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem" }}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
