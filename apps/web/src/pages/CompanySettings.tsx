import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Member {
  id: string;
  email: string;
  role: string;
  createdAt: string | null;
}

export default function CompanySettings() {
  const { company } = useAuth();
  const [name, setName] = useState(company?.name || "");
  const [goal, setGoal] = useState(company?.goal || "");
  const [members, setMembers] = useState<Member[]>([]);
  const [saved, setSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    setName(company?.name || "");
    setGoal(company?.goal || "");
  }, [company]);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/members`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMembers(d?.members || []))
      .catch(console.error);
  }, [company]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, goal }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleInvite = async () => {
    // TODO: POST /api/companies/:id/members
    setInviteEmail("");
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>Company Settings</h1>

      {!company ? (
        <p style={{ color: "#888" }}>No company selected.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Company Info */}
          <form onSubmit={handleSave} style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Company Information</h2>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>Company Name</div>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }} />
            </label>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>Company Goal</div>
              <textarea value={goal} onChange={e => setGoal(e.target.value)} style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", minHeight: "80px", boxSizing: "border-box" }} />
            </label>
            <button type="submit" style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Save Changes</button>
          </form>

          {/* Members */}
          <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Owners & Founders</h2>
            {members.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No members yet.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1rem" }}>
                {members.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#374151", padding: "6px 12px", borderRadius: "8px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#4B5563", display: "flex", alignItems: "center", justifyContent: "center" }}>&#128100;</div>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{m.email}</div>
                      <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{m.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email to invite" style={{ flex: 1, padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
              <button onClick={handleInvite} style={{ padding: "8px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
