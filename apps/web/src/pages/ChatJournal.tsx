import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Agent {
  id: string;
  name: string;
  role: string;
  projectId?: string | null;
}

interface Message {
  id: string;
  content: string;
  role: string;
  agentId: string | null;
  userId: string | null;
  createdAt: string;
  agentName: string | null;
  userEmail: string | null;
}

export default function ChatJournal() {
  const { company } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const lastFetch = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  // Fetch Agents for the "Compose To" dropdown
  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/agents`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list = d?.agents || [];
        setAgents(list);
        if (list.length > 0 && !selectedAgentId) {
          setSelectedAgentId(list[0].id);
        }
      })
      .catch(console.error);
  }, [company]);

  // Fetch Messages
  const fetchMessages = useCallback(() => {
    if (!company || !selectedAgentId) return;
    const url = `/api/chat?agentId=${selectedAgentId}`;
    
    fetch(url, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMessages(d?.messages || []))
      .catch(console.error);
  }, [company, selectedAgentId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Priority 2: Auto-refresh (Polling)
  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);


  // Detect if user is at bottom of chat
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  // Only auto-scroll if user was already at the bottom
  useEffect(() => {
    if (isAtBottom.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const formatStatus = (data: any) => {
    const lines = [
      `Agent: ${data.agent?.name || "Unknown"} (${data.agent?.role || ""})`,
      `Last heartbeat: ${data.agent?.lastHeartbeat || "unknown"}`,
      `Open tasks: ${data.openTasks ?? 0}`,
      `Current task: ${data.currentTask ? `${data.currentTask.title} [${data.currentTask.execStatus}]` : "none"}`,
      `Last log: ${data.lastLog ? `${data.lastLog.level}: ${data.lastLog.message}` : "none"}`,
    ];
    return lines.join("\n");
  };

  const handleStatus = async () => {
    if (!selectedAgentId) return;
    const res = await fetch(`/api/agents/${selectedAgentId}/status`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    const systemMsg: Message = {
      id: `status-${Date.now()}`,
      content: formatStatus(data),
      role: "system",
      agentId: selectedAgentId,
      userId: null,
      createdAt: new Date().toISOString(),
      agentName: "Status",
      userEmail: null,
    };
    setMessages((prev) => [...prev, systemMsg]);
  };

  const handleAssignTask = async () => {
    if (!selectedAgentId || !company || !input.trim()) return;
    const agent = agents.find(a => a.id === selectedAgentId);
    let projectId = agent?.projectId || null;

    if (!projectId) {
      const projRes = await fetch(`/api/companies/${company.id}/projects`, { credentials: "include" });
      const projData = projRes.ok ? await projRes.json() : { projects: [] };
      if (projData.projects?.length > 0) {
        projectId = projData.projects[0].id;
      } else {
        const createRes = await fetch(`/api/companies/${company.id}/projects`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Chat Operations" }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          projectId = created.project?.id;
        }
      }
    }

    if (!projectId) return;

    const taskRes = await fetch("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        agentId: selectedAgentId,
        title: `Task: ${input.trim().slice(0, 60)}`,
        description: input.trim(),
        priority: "medium",
        requiresApproval: false,
      }),
    });
    if (!taskRes.ok) return;
    const taskData = await taskRes.json();
    const taskId = taskData?.task?.id;
    if (taskId) {
      await fetch(`/api/tasks/${taskId}/execute`, { method: "POST", credentials: "include" });
      const systemMsg: Message = {
        id: `task-${Date.now()}`,
        content: `Assigned task to agent. Task ID: ${taskId}`,
        role: "system",
        agentId: selectedAgentId,
        userId: null,
        createdAt: new Date().toISOString(),
        agentName: "Task",
        userEmail: null,
      };
      setMessages((prev) => [...prev, systemMsg]);
      setInput("");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !company || sending || !selectedAgentId) return;
    
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          content: input.trim(),
          agentId: selectedAgentId,
        }),
      });
      if (res.ok) {
        setInput("");
        lastFetch.current = Date.now();
        fetchMessages();
      }
    } finally {
      setSending(false);
    }
  };

  // Determine current chat context
  const chatLabel = agents.find(a => a.id === selectedAgentId)?.name || "Select Agent";

  const roleIcon = (msg: Message) => {
    if (msg.role === "user") return "👤 You";
    return msg.agentName ? `🤖 ${msg.agentName}` : "System";
  };

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Chat</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Compose to:</span>
          <select
            value={selectedAgentId || ""}
            onChange={e => setSelectedAgentId(e.target.value || null)}
            style={{
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "white",
              padding: "6px 12px",
              fontSize: "0.85rem",
            }}
          >
            <option value="">Select agent</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.role === "FOUNDER" ? "🚀 " : a.role === "CEO" ? "👔 " : ""}{a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

  {/* Messages Area */}
      <div onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem", background: "#1f2937", borderRadius: "8px", padding: "1rem" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
            No messages yet in {chatLabel}.
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "2px", marginLeft: msg.role === "user" ? "8px" : "0" }}>
                {roleIcon(msg)}
                <span style={{ marginLeft: "8px" }}>{new Date(msg.createdAt).toLocaleTimeString()}</span>
              </div>
              <div
                style={{
                  background: msg.role === "user" ? "#3b82f6" : "#374151",
                  color: "white",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  borderBottomRightRadius: msg.role === "user" ? "4px" : "12px",
                  borderBottomLeftRadius: msg.role === "user" ? "12px" : "4px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: "1.4",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${chatLabel}...`}
          disabled={sending || !company || !selectedAgentId}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            color: "white",
            fontSize: "0.95rem",
          }}
        />
        <button
          type="button"
          onClick={handleStatus}
          disabled={!selectedAgentId}
          style={{
            padding: "0.75rem 1rem",
            background: "#374151",
            border: "none",
            color: "white",
            borderRadius: "8px",
            cursor: !selectedAgentId ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          Status
        </button>
        <button
          type="button"
          onClick={handleAssignTask}
          disabled={!selectedAgentId || !input.trim()}
          style={{
            padding: "0.75rem 1rem",
            background: "#10b981",
            border: "none",
            color: "white",
            borderRadius: "8px",
            cursor: !selectedAgentId || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          Assign Task
        </button>
        <button
          type="submit"
          disabled={sending || !company || !input.trim() || !selectedAgentId}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#3b82f6",
            border: "none",
            color: "white",
            borderRadius: "8px",
            cursor: sending ? "wait" : "pointer",
            fontWeight: "bold",
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
