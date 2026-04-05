import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Brief {
  id: string;
  companyId: string;
  vision: string;
  marketContext: string | null;
  constraints: string | null;
  priorities: string | null;
  reportingCadence: string;
  status: string;
  createdAt: string;
}

export default function CompanyBriefsPage() {
  const { company } = useAuth();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    vision: "",
    marketContext: "",
    constraints: "",
    priorities: "",
    reportingCadence: "daily",
  });

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/brief`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setBriefs(d?.briefs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const res = await fetch(`/api/companies/${company.id}/brief`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, priorities: form.priorities.split("\n").filter(Boolean) }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ vision: "", marketContext: "", constraints: "", priorities: "", reportingCadence: "daily" });
      fetch(`/api/companies/${company.id}/brief`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => setBriefs(d?.briefs || []));
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Company Briefs</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ New Brief"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "#1f2937", padding: "1.5rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem" }}>Define Company Vision & Brief</h3>
          
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
              🎯 Vision & Mission *
            </label>
            <textarea
              required
              placeholder="e.g., Build the fastest AI-powered customer support platform in the industry."
              value={form.vision}
              onChange={e => setForm({...form, vision: e.target.value})}
              style={{ width: "100%", minHeight: "80px", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
              🌍 Market Context
            </label>
            <textarea
              placeholder="e.g., Competing in the enterprise SaaS space, targeting mid-market companies with 50-500 employees."
              value={form.marketContext}
              onChange={e => setForm({...form, marketContext: e.target.value})}
              style={{ width: "100%", minHeight: "60px", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
              🚧 Constraints & Boundaries
            </label>
            <textarea
              placeholder="e.g., $10k monthly budget. No data sharing with third parties. Must comply with GDPR."
              value={form.constraints}
              onChange={e => setForm({...form, constraints: e.target.value})}
              style={{ width: "100%", minHeight: "60px", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
              📋 Initial Priorities (one per line)
            </label>
            <textarea
              placeholder={"Build MVP\nHire founding team\nLaunch beta by Q3"}
              value={form.priorities}
              onChange={e => setForm({...form, priorities: e.target.value})}
              style={{ width: "100%", minHeight: "80px", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
              📊 Reporting Cadence
            </label>
            <select
              value={form.reportingCadence}
              onChange={e => setForm({...form, reportingCadence: e.target.value})}
              style={{ padding: "8px 12px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", width: "200px" }}
            >
              <option value="realtime">Real-time (every 30s)</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <button
            type="submit"
            style={{ padding: "10px 24px", background: "#22c55e", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
          >
            Create Brief
          </button>
        </form>
      )}

      {briefs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          No briefs yet. The CEO needs a brief to understand the company's vision and goals.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {briefs.map(b => (
            <div key={b.id} style={{ background: "#1f2937", padding: "1.5rem", borderRadius: "8px", border: b.status === "active" ? "1px solid #22c55e" : "1px solid #374151" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: "bold", margin: 0 }}>{b.vision}</h3>
                  <span style={{ fontSize: "0.75rem", padding: "2px 8px", background: b.status === "active" ? "#052e16" : "#374151", color: b.status === "active" ? "#22c55e" : "#9ca3af", borderRadius: "4px" }}>
                    {b.status}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "0.5rem" }}>
                    {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => setEditingId(editingId === b.id ? null : b.id)}
                  style={{ padding: "4px 12px", background: "#374151", border: "none", color: "#e5e7eb", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  {editingId === b.id ? "Close" : "Edit"}
                </button>
              </div>

              {b.marketContext && (
                <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#e5e7eb" }}>Market:</strong> {b.marketContext}
                </div>
              )}
              {b.constraints && (
                <div style={{ fontSize: "0.85rem", color: "#f87171", marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#e5e7eb" }}>Constraints:</strong> {b.constraints}
                </div>
              )}
              {b.priorities && (
                <div style={{ fontSize: "0.85rem", color: "#60a5fa", marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#e5e7eb" }}>Priorities:</strong> {b.priorities}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
