import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Agent {
  id: string;
  name: string;
  role: string;
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
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null); // null = Team
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Fetch Agents for the "Compose To" dropdown
  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/agents`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAgents(d?.agents || []))
      .catch(console.error);
  }, [company]);

  // Fetch Messages
  const fetchMessages = useCallback(() => {
    if (!company) return;
    const url = selectedAgentId
      ? `/api/chat?agentId=${selectedAgentId}`
      : `/api/chat`; // "ALL" or Team view
    
    fetch(url, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMessages(d?.messages || []))
      .catch(console.error);
  }, [company, selectedAgentId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !company || sending) return;
    
    setSending(true);
    try {
      // selectedAgentId = 'ALL' means Team Chat, otherwise specific agent ID
      const agentIdToSend = selectedAgentId === "ALL" ? null : selectedAgentId;
      
      await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          content: input.trim(),
          agentId: agentIdToSend, // If null, it's a broadcast message
        }),
      });
      setInput("");
      fetchMessages();
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setSending(false);
    }
  };

  // Determine current chat context
  const chatLabel = selectedAgentId === "ALL" || !selectedAgentId
    ? "🏢 Whole Team"
    : agents.find(a => a.id === selectedAgentId)?.name || "Direct Message";

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
            value={selectedAgentId || "ALL"}
            onChange={e => setSelectedAgentId(e.target.value === "ALL" ? null : e.target.value)}
            style={{
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "white",
              padding: "6px 12px",
              fontSize: "0.85rem",
            }}
          >
            <option value="ALL">🏢 Whole Team</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.role === "FOUNDER" ? "🚀 " : a.role === "CEO" ? "👔 " : ""}{a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem", background: "#1f2937", borderRadius: "8px", padding: "1rem" }}>
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
      <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${chatLabel}...`}
          disabled={sending || !company}
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
          type="submit"
          disabled={sending || !company || !input.trim()}
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
