import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Connector {
  id: string;
  companyId: string;
  platform: string;
  displayName?: string;
  webhookSecret: string | null;
  apiKey: string | null;
  apiUrl: string | null;
  enabled: boolean;
  config: Record<string, any> | null;
  createdAt: string | null;
  companyName?: string;
}

interface PlatformInfo {
  platform: string;
  displayName: string;
  description: string;
  icon: string;
  configFields: { key: string; label: string; type: string; placeholder: string; required: boolean }[];
}

export default function ConnectorsPage() {
  const { company } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    Promise.all([
      fetch("/api/connectors", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/connectors/platforms", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([conn, plat]) => {
      setConnectors(conn?.connectors || []);
      setPlatforms(plat?.platforms || []);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setStatus("saving");

    const res = await fetch("/api/connectors", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        platform: selectedPlatform,
        ...formData,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setConnectors([...connectors, data.connector]);
      setShowForm(false);
      setSelectedPlatform("");
      setFormData({});
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      const err = await res.json();
      console.error("Connector error:", err.error);
      setStatus("error");
    }
  };

  const handleToggle = async (conn: Connector) => {
    if (!company) return;
    const res = await fetch(`/api/connectors/${conn.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !conn.enabled }),
    });
    if (res.ok) {
      setConnectors(connectors.map(c => c.id === conn.id ? { ...c, enabled: !c.enabled } : c));
    }
  };

  const handleDelete = async (connId: string) => {
    if (!confirm("Remove this connector?")) return;
    const res = await fetch(`/api/connectors/${connId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setConnectors(connectors.filter(c => c.id !== connId));
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  const selectedPlat = platforms.find(p => p.platform === selectedPlatform);
  const myConnectors = company ? connectors.filter(c => c.companyId === company.id) : [];

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Agent Integrations</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}
        >
          + Connect Platform
        </button>
      </div>

      {status === "saved" && (
        <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: "8px", padding: "12px", color: "#86efac", marginBottom: "1rem" }}>
          Connector saved successfully!
        </div>
      )}

      {showForm && (
        <div style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Connect a Platform</h2>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>Platform</div>
            <select
              value={selectedPlatform}
              onChange={e => { setSelectedPlatform(e.target.value); setFormData({}); }}
              style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}
            >
              <option value="">Select a platform...</option>
              {platforms.filter(p => !myConnectors.find(c => c.platform === p.platform)).map(p => (
                <option key={p.platform} value={p.platform}>{p.icon} {p.displayName}</option>
              ))}
            </select>
          </label>

          {selectedPlat && (
            <form onSubmit={handleConnect}>
              {selectedPlat.configFields.map(field => (
                <label key={field.key} style={{ display: "block", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>{field.label}</div>
                  <input
                    type={field.type === "password" ? "password" : field.type}
                    placeholder={field.placeholder}
                    required={field.required}
                    value={formData[field.key] || ""}
                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                    style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
                  />
                </label>
              ))}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button type="submit" style={{ padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Connect</button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: "6px 16px", background: "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Connected platforms */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {myConnectors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔌</div>
            <p>No agent platforms connected yet. Connect Hermes, OpenClaw, or other platforms to integrate their agents.</p>
          </div>
        ) : (
          myConnectors.map(conn => (
            <div key={conn.id} style={{
              background: "#1f2937",
              borderRadius: "8px",
              padding: "1rem",
              border: "1px solid #374151",
              opacity: conn.enabled ? 1 : 0.5,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                    {platforms.find(p => p.platform === conn.platform)?.icon}{" "}
                    {platforms.find(p => p.platform === conn.platform)?.displayName || conn.platform}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "4px" }}>
                    {conn.apiUrl ? `API: ${conn.apiUrl}` : "Connected via webhook"}
                    {conn.webhookSecret ? " · Secret configured" : " · No secret"}
                  </div>
                  {conn.createdAt && (
                    <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "4px" }}>
                      Connected {new Date(conn.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    background: conn.enabled ? "#052e16" : "#450a0a",
                    color: conn.enabled ? "#4ade80" : "#f87171",
                  }}>
                    {conn.enabled ? "Active" : "Disabled"}
                  </span>
                  <button
                    onClick={() => handleToggle(conn)}
                    style={{ padding: "4px 10px", background: "#374151", border: "none", color: "#9ca3af", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    {conn.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    style={{ padding: "4px 10px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Webhook URL */}
              <div style={{ marginTop: "0.75rem", padding: "8px", background: "#111827", borderRadius: "4px", fontSize: "0.75rem", fontFamily: "monospace", color: "#9ca3af" }}>
                Webhook URL: <span style={{ color: "#3b82f6" }}>POST /api/connectors/{conn.platform}/webhook</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
