import { useState, useEffect, FormEvent } from "react";

type Tab = "chat" | "journal";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
}

export default function ChatJournal() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/chat", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/journal", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([chat, journal]) => {
      setMessages(chat?.messages || []);
      setJournalEntries(journal?.entries || []);
      setLoading(false);
    });
  }, []);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const res = await fetch("/api/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages([...messages, { id: data.id ?? Date.now().toString(), role: "user", content: input, createdAt: new Date().toISOString() }]);
      setInput("");
    }
  };

  const handleJournal = async () => {
    if (!input.trim()) return;
    await fetch("/api/journal", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
    });
    setJournalEntries([{ id: Date.now().toString(), content: input, createdAt: new Date().toISOString() }, ...journalEntries]);
    setInput("");
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Chat & Journal</h1>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button onClick={() => setTab("chat")} style={{ padding: "6px 16px", background: tab === "chat" ? "#3b82f6" : "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Chat</button>
        <button onClick={() => setTab("journal")} style={{ padding: "6px 16px", background: tab === "journal" ? "#3b82f6" : "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Journal</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "#111827", borderRadius: "8px", border: "1px solid #1f2937", marginBottom: "1rem", padding: "1rem" }}>
        {tab === "chat" ? (
          messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>No messages yet. Start a conversation.</div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: "0.75rem", padding: "0.75rem", background: "#1f2937", borderRadius: "6px", maxWidth: msg.role === "user" ? "60%" : "100%", marginLeft: msg.role === "user" ? "auto" : "0" }}>
                <div style={{ fontSize: "0.75rem", color: msg.role === "user" ? "#3b82f6" : "#22c55e", fontWeight: "bold", marginBottom: "4px" }}>
                  {msg.role === "user" ? "You" : "Agent"}
                </div>
                <div style={{ fontSize: "0.9rem" }}>{msg.content}</div>
              </div>
            ))
          )
        ) : (
          journalEntries.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>No journal entries yet.</div>
          ) : (
            journalEntries.map(entry => (
              <div key={entry.id} style={{ marginBottom: "0.75rem", padding: "0.75rem", background: "#1f2937", borderRadius: "6px", borderLeft: "4px solid #a855f7" }}>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "4px" }}>{new Date(entry.createdAt).toLocaleString()}</div>
                <div style={{ fontSize: "0.9rem" }}>{entry.content}</div>
              </div>
            ))
          )
        )}
      </div>

      <form onSubmit={tab === "chat" ? handleSend : handleJournal} style={{ display: "flex", gap: "0.5rem" }}>
        <input autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder={tab === "chat" ? "Type a message..." : "Write a journal entry..."} style={{ flex: 1, padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
        <button type="submit" style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>
          {tab === "chat" ? "Send" : "Save"}
        </button>
      </form>
    </div>
  );
}
