import { useState, useEffect, useRef, useCallback } from "react";

interface LogEntry {
  id: string;
  agentId: string;
  taskId: string | null;
  taskTitle: string | null;
  level: "info" | "action" | "success" | "error";
  message: string;
  createdAt: string;
}

interface ActivityLogViewProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
}

const levelEmojis: Record<string, string> = {
  info: "💡",
  action: "⚙️",
  success: "✅",
  error: "❌",
};

const levelColors: Record<string, string> = {
  info: "#3b82f6",
  action: "#f59e0b",
  success: "#22c55e",
  error: "#ef4444",
};

export default function ActivityLogView({ agentId, isOpen, onClose }: ActivityLogViewProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/activity`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchLogs();
      
      // Poll for real-time feel
      const interval = setInterval(() => {
        if (autoRefresh) fetchLogs();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isOpen, agentId, fetchLogs, autoRefresh]);

  // Auto-scroll when logs update
  useEffect(() => {
    if (autoRefresh && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoRefresh]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111827",
          width: "800px",
          height: "70vh",
          borderRadius: "12px",
          border: "1px solid #374151",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #374151", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>📋</span>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold", color: "#e5e7eb" }}>Agent Activity Log</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "#9ca3af", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ accentColor: "#3b82f6" }}
              />
              Live Poll
            </label>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "1.5rem", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Log Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {loading && logs.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading activity history...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              No activity logs yet. Assign and execute a task to see real-time updates here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    background: "#1f2937",
                    borderRadius: "8px",
                    borderLeft: `4px solid ${levelColors[log.level] || "#6b7280"}`,
                  }}
                >
                  <div style={{ minWidth: "28px", textAlign: "center" }}>
                    <span style={{ fontSize: "1.2rem" }}>{levelEmojis[log.level] || "📝"}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#e5e7eb", fontSize: "0.9rem", marginBottom: "0.25rem", whiteSpace: "pre-wrap" }}>
                      {log.message}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
                      <span>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.level !== "info" && (
                        <span style={{ color: levelColors[log.level], fontWeight: "bold" }}>
                          {log.level.toUpperCase()}
                        </span>
                      )}
                      {log.taskTitle && (
                        <span style={{ color: "#3b82f6" }}>
                          Task: "{log.taskTitle}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
