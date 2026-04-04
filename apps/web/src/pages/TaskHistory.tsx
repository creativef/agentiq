import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  agentId: string | null;
  agentName: string | null;
  projectId: string | null;
  createdAt: string;
  execStatus: string;
  approvalStatus: string | null;
  result: string | null;
  assignedBy: string | null;
}

const statusColors: Record<string, string> = {
  done: "#22c55e",
  completed: "#22c55e",
  failed: "#ef4444",
  blocked: "#f59e0b",
  "in_progress": "#3b82f6",
  ready: "#60a5fa",
  pending_approval: "#a855f7",
  idle: "#6b7280",
};

const statusLabels: Record<string, string> = {
  done: "✅ Done",
  completed: "✅ Completed",
  failed: "❌ Failed",
  blocked: "⚠️ Blocked",
  in_progress: "▶️ In Progress",
  ready: "Ready",
  pending_approval: "⏳ Pending Approval",
  idle: "Idle",
  backlog: "Backlog",
};

export default function TaskHistory() {
  const { company, project } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all"); // all, completed, failed, pending
  const [search, setSearch] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/tasks${project ? `?projectId=${project.id}` : ""}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company, project]);

  const handleReRun = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/execute`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh the task list to show updated result
        const data = await res.json();
        await fetch(`/api/tasks${project ? `?projectId=${project.id}` : ""}`, { credentials: "include" })
          .then(r => r.json())
          .then(d => setTasks(d.tasks || []));
      }
    } catch (e) {
      console.error("Re-run failed:", e);
    }
  }, [project]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by status group
    if (filter === "completed") {
      result = result.filter(t => t.status === "done" || t.execStatus === "completed");
    } else if (filter === "failed") {
      result = result.filter(t => t.status === "blocked" || t.status === "failed" || t.execStatus === "failed");
    } else if (filter === "pending") {
      result = result.filter(t => t.execStatus === "pending_approval" || t.execStatus === "scheduled");
    } else if (filter === "active") {
      result = result.filter(t => t.status !== "done" && t.status !== "blocked" && t.execStatus !== "completed" && t.execStatus !== "failed");
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.result && t.result.toLowerCase().includes(q)) ||
        (t.agentName && t.agentName.toLowerCase().includes(q))
      );
    }

    // Group by agent
    const grouped = result.reduce((acc, task) => {
      const key = task.agentName || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    // Sort within groups by date descending
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return grouped;
  }, [tasks, filter, search]);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  const totalTasks = tasks.length;
  const completedCount = tasks.filter(t => t.status === "done" || t.execStatus === "completed").length;
  const failedCount = tasks.filter(t => t.status === "blocked" || t.execStatus === "failed").length;
  const pendingCount = tasks.filter(t => t.execStatus === "pending_approval" || t.execStatus === "scheduled").length;

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Task History</h1>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <div style={{ background: "#1f2937", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #374151" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{totalTasks}</div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Total</div>
        </div>
        <div style={{ background: "#1f2937", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #374151" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#22c55e" }}>{completedCount}</div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Completed</div>
        </div>
        <div style={{ background: "#1f2937", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #374151" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ef4444" }}>{failedCount}</div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Failed</div>
        </div>
        <div style={{ background: "#1f2937", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #374151" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#f59e0b" }}>{pendingCount}</div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Pending</div>
        </div>
      </div>

      {/* Filters and search */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {["all", "active", "completed", "failed", "pending"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 12px",
              background: filter === f ? "#3b82f6" : "#374151",
              border: "none",
              color: filter === f ? "white" : "#9ca3af",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
              textTransform: "capitalize",
            }}
          >
            {f}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          style={{
            flex: "1 1 200px",
            padding: "6px 12px",
            background: "#374151",
            border: "1px solid #4B5563",
            borderRadius: "6px",
            color: "white",
            fontSize: "0.85rem",
          }}
        />
      </div>

      {/* Task groups by agent */}
      {Object.keys(filteredTasks).length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          {search ? "No tasks match your search." : "No tasks yet."}
        </div>
      ) : (
        Object.entries(filteredTasks).map(([agentName, agentTasks]) => (
          <div key={agentName} style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "0.75rem", borderBottom: "1px solid #374151", paddingBottom: "0.5rem" }}>
              {agentName} <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>({agentTasks.length})</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {agentTasks.map(task => {
                const isExpanded = expandedTask === task.id;
                const statusColor = statusColors[task.status] || statusColors[task.execStatus] || "#6b7280";
                const statusLabel = statusLabels[task.status] || statusLabels[task.execStatus] || task.status;
                
                return (
                    <div key={task.id}
                      style={{
                        background: "#1f2937",
                        borderRadius: "8px",
                        border: `1px solid #374151`,
                        borderLeft: `4px solid ${statusColor}`,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", fontSize: "0.95rem", marginBottom: "2px" }}>{task.title}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                            {new Date(task.createdAt).toLocaleDateString()} at {new Date(task.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{
                            padding: "2px 8px",
                            background: `${statusColor}22`,
                            color: statusColor,
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                          }}>
                            {statusLabel}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedTask(isExpanded ? null : task.id); }}
                            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.8rem", padding: "4px" }}
                          >{isExpanded ? "▲" : "▼"}</button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: "0 1rem 0.75rem", borderTop: "1px solid #374151", marginTop: "0.5rem", paddingTop: "0.75rem" }}>
                          {task.description && (
                            <div style={{ marginBottom: "0.5rem" }}>
                              <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "2px" }}>Description:</div>
                              <div style={{ fontSize: "0.85rem", color: "#e5e7eb" }}>{task.description}</div>
                            </div>
                          )}
                          {task.result && (
                            <div style={{ marginBottom: "0.5rem" }}>
                              <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "2px" }}>Execution Report:</div>
                              <div style={{ fontSize: "0.85rem", color: "#a3e635", background: "#052e16", padding: "0.75rem", borderRadius: "6px", whiteSpace: "pre-wrap", fontFamily: "JetBrains Mono, ui-monospace, monospace", maxHeight: "300px", overflow: "auto", lineHeight: "1.5" }}>
                                {task.result}
                              </div>
                            </div>
                          )}
                          {task.approvalStatus && (
                            <div style={{ fontSize: "0.75rem", color: task.approvalStatus === "approved" ? "#22c55e" : task.approvalStatus === "rejected" ? "#ef4444" : "#f59e0b" }}>
                              Approval: {task.approvalStatus} {task.approverRole ? `(by ${task.approverRole})` : ""}
                            </div>
                          )}
                          {(task.status === "done" || task.execStatus === "completed") && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleReRun(task.id); }}
                              style={{ 
                                marginTop: "0.5rem", 
                                padding: "0.75rem 2rem", 
                                background: "#a855f7", 
                                border: "none", 
                                color: "white", 
                                borderRadius: "6px", 
                                fontWeight: "bold",
                                cursor: "pointer", 
                                width: "100%", 
                                fontSize: "0.9rem" 
                              }}
                            >
                              ⚡ Re-Execute (Upgrade Report)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
