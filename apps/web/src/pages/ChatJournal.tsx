import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  role: string;
  agentName: string | null;
  userEmail: string | null;
  createdAt: string;
}

export default function ChatJournal() {
  const { company } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(() => {
    if (!company) return;
    fetch("/api/chat", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMessages(d?.messages || []))
      .catch(console.error);
  }, [company]);

  useEffect(() => { fetchMessages(); }, [company, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !company || sending) return;
    
    setSending(true);
    try {
      await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          content: input.trim(),
          role: "user",
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

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Team Chat</h1>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem", background: "#1f2937", borderRadius: "8px", padding: "1rem" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map(msg => {
            const isUser = msg.role === "user";
            const sender = isUser 
              ? (msg.userEmail || "You") 
              : (msg.agentName || "System");
            
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  display: "flex",
                  alignItems: "flex-end",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: "4px", marginRight: isUser ? "4px" : "0" }}>
                  {!isUser && <span>🤖 {sender}</span>}
                  {isUser && <span>{sender}</span>}
                  <span style={{ marginLeft: "8px", opacity: 0.5 }}>
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div
                  style={{
                    background: isUser ? "#3b82f6" : "#374151",
                    color: "white",
                    padding: "0.75rem 1rem",
                    borderRadius: "12px",
                    borderBottomRightRadius: isUser ? "4px" : "12px",
                    borderBottomLeftRadius: isUser ? "12px" : "4px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: "1.4",
                    fontSize: "0.9rem",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
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
            fontSize: "0.95rem",
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
