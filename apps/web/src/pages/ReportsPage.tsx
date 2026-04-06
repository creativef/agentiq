import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface CEOReportEvent {
  id: string;
  type: string;
  meta?: string | null;
  description?: string | null;
  createdAt?: string | null;
}

interface ActivityLog {
  id: string;
  agentId: string;
  agentName?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  level: string;
  message: string;
  createdAt?: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  execStatus: string;
  priority: string;
  agentId?: string | null;
  agentName?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
}

export default function ReportsPage() {
  const { company, project } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ceoEvents, setCeoEvents] = useState<CEOReportEvent[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const refresh = () => {
    if (!company) { setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);

    const dashReq = fetch(`/api/companies/${company.id}/dashboard`, { credentials: "include" });
    const activityReq = fetch(`/api/companies/${company.id}/activity?limit=200`, { credentials: "include" });
    const tasksUrl = project ? `/api/tasks?projectId=${project.id}` : "/api/tasks";
    const tasksReq = fetch(tasksUrl, { credentials: "include" });

    Promise.all([dashReq, activityReq, tasksReq])
      .then(async ([dashRes, actRes, tasksRes]) => {
        const dashData = dashRes.ok ? await dashRes.json() : null;
        const actData = actRes.ok ? await actRes.json() : null;
        const tasksData = tasksRes.ok ? await tasksRes.json() : null;

        const timeline = Array.isArray(dashData?.timeline) ? dashData.timeline : [];
        const ceo = timeline.filter((ev: CEOReportEvent) => ev.type === "ceo_report");
        setCeoEvents(ceo);
        setActivity(Array.isArray(actData?.logs) ? actData.logs : []);
        setTasks(Array.isArray(tasksData?.tasks) ? tasksData.tasks : []);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || "Failed to load reports");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [company, project]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskRow[]> = {
      pending_approval: [],
      scheduled: [],
      ready: [],
      executing: [],
      completed: [],
      failed: [],
      other: [],
    };
    for (const t of tasks) {
      const key = groups[t.execStatus] ? t.execStatus : "other";
      groups[key].push(t);
    }
    return groups;
  }, [tasks]);

  if (!company) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Reports</h1>
        <p style={{ color: "#9ca3af" }}>Create a company to view reports.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "2rem", color: "#9ca3af" }}>Loading reports...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
          <h2 style={{ color: "#fca5a5", margin: "0 0 0.5rem 0" }}>Failed to load reports</h2>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{error}</p>
          <button
            onClick={refresh}
            style={{ marginTop: "1rem", padding: "8px 24px", background: "#dc2626", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            ↻ Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Reports — {company.name}</h1>
          <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{project ? `Project: ${project.name}` : "All Projects"}</div>
        </div>
        <button
          onClick={refresh}
          style={{ padding: "8px 14px", background: "#1f2937", border: "1px solid #374151", color: "white", borderRadius: "6px", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* CEO Report Timeline */}
        <section style={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px", padding: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.75rem" }}>CEO Reports</h2>
          {ceoEvents.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No CEO reports yet.</div>
          ) : (
            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {ceoEvents.map(ev => {
                let metrics: any = null;
                try { metrics = ev.meta ? JSON.parse(ev.meta) : null; } catch {}
                const taskMetrics = metrics?.tasks || {};
                const agentMetrics = metrics?.agents || {};
                return (
                  <div key={ev.id} style={{ borderBottom: "1px solid #374151", padding: "0.75rem 0" }}>
                    <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ""}</div>
                    <div style={{ margin: "0.5rem 0", whiteSpace: "pre-wrap" }}>{ev.description || "CEO report generated."}</div>
                    {metrics && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", fontSize: "0.8rem" }}>
                        <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: "6px", padding: "0.5rem" }}>
                          <div style={{ color: "#9ca3af" }}>Agents</div>
                          <div>Total: {agentMetrics.total ?? 0}</div>
                          <div>Active: {agentMetrics.active ?? 0}</div>
                          <div>Errors: {agentMetrics.errors ?? 0}</div>
                        </div>
                        <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: "6px", padding: "0.5rem" }}>
                          <div style={{ color: "#9ca3af" }}>Tasks</div>
                          <div>Completed: {taskMetrics.completed ?? 0}</div>
                          <div>Failed: {taskMetrics.failed ?? 0}</div>
                          <div>Pending: {taskMetrics.pending ?? 0}</div>
                          <div>In Progress: {taskMetrics.inProgress ?? 0}</div>
                          <div>Blocked: {taskMetrics.blocked ?? 0}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Agent Activity Stream */}
        <section style={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px", padding: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.75rem" }}>Agent Activity</h2>
          {activity.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No activity yet.</div>
          ) : (
            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {activity.map(log => (
                <div key={log.id} style={{ borderBottom: "1px solid #374151", padding: "0.5rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.85rem" }}>
                      <span style={{ color: "#3b82f6" }}>{log.agentName || log.agentId}</span>
                      {log.taskTitle && <span style={{ color: "#9ca3af" }}> · {log.taskTitle}</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</div>
                  </div>
                  <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Task Status Board */}
        <section style={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px", padding: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.75rem" }}>Task Status</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
            {Object.entries(groupedTasks).map(([status, list]) => (
              <div key={status} style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: "6px", padding: "0.5rem", minHeight: "120px" }}>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.25rem" }}>{status.replace("_", " ")}</div>
                <div style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.5rem" }}>{list.length}</div>
                <div style={{ maxHeight: "140px", overflowY: "auto" }}>
                  {list.slice(0, 6).map(t => (
                    <div key={t.id} style={{ fontSize: "0.75rem", padding: "2px 0", color: "#e5e7eb" }}>
                      • {t.title} {t.agentName ? `(${t.agentName})` : ""}
                    </div>
                  ))}
                  {list.length > 6 && (
                    <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>+ {list.length - 6} more</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
