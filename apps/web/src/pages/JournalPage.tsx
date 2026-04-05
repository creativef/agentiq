import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
}

export default function JournalPage() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");

  const fetchEntries = useCallback(() => {
    if (!company) return;
    fetch(`/api/journal`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(d => setEntries(d.entries || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !company) return;
    await fetch("/api/journal", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.trim(), companyId: company.id }),
    });
    setInput("");
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/journal/${id}`, { method: "DELETE", credentials: "include" });
    fetchEntries();
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Journal</h1>
      
      <form onSubmit={handlePost} style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Write a journal entry..."
          style={{ flex: 1, minHeight: "80px", padding: "12px", background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "white", resize: "vertical" }}
        />
        <button type="submit" style={{ padding: "0 20px", background: "#22c55e", border: "none", color: "white", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Post</button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
            <p>No journal entries yet. Write your first thought!</p>
          </div>
        ) : (
          entries.map(e => (
            <div key={e.id} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>{new Date(e.createdAt).toLocaleString()}</div>
              <div style={{ color: "#e5e7eb", whiteSpace: "pre-wrap" }}>{e.content}</div>
              <button onClick={() => handleDelete(e.id)} style={{ marginTop: "8px", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem" }}>Delete</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
