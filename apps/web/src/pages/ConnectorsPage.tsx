import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Connector {
  id: string;
  companyId: string;
  platform: string;
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
  requiresSetup: boolean;
  configFields: { key: string; label: string; type: string; placeholder: string }[];
}

export default function ConnectorsPage() {
  const { company } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectMsg, setConnectMsg] = useState("");
  const [connectError, setConnectError] = useState("");
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/connectors", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/connectors/platforms", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([conn, plat]) => {
      setConnectors(conn?.connectors || []);
      setPlatforms(plat?.platforms || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const myConnectors = company ? connectors.filter(c => c.companyId === company.id) : [];
  const myPlatformSet = new Set(myConnectors.map(c => c.platform));

  const handleConnect = async (platform: string) => {
    if (!company) return;
    const platDef = platforms.find(p => p.platform === platform);
    setConnecting(platform);
    setConnectError("");
    setConnectMsg("");

    const body: Record<string, any> = { companyId: company.id };
    if (showConfig === platform) {
      Object.assign(body, configForm);
    }

    const res = await fetch(`/api/connectors/${platform}/connect`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setConnectors([...connectors, data.connector]);
      setConnectMsg(data.message || `${platDef?.displayName} connected!`);
      setShowConfig(null);
      setConfigForm({});
    } else {
      const err = await res.json();
      setConnectError(err.error || "Connection failed");
    }
    setConnecting(null);
  };

  const handleToggle = async (conn: Connector) => {
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

  const handleRemove = async (connId: string) => {
    if (!confirm("Remove this agent platform? Events from this platform will stop being accepted.")) return;
    const res = await fetch(`/api/connectors/${connId}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setConnectors(connectors.filter(c => c.id !== connId));
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  const connectedPlatform = myConnectors[0]?.platform;

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Agent Platforms</h1>
      <p style={{ color: "#9ca3af", marginBottom: "1.5rem" }}>Connect your agent platforms. Hermes is built-in and ready to go.</p>

      {connectMsg && (
        <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: "8px", padding: "12px", color: "#86efac", marginBottom: "1rem" }}>
          {connectMsg}
        </div>
      )}
      {connectError && (
        <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "12px", color: "#fca5a5", marginBottom: "1rem" }}>
          {connectError}
        </div>
      )}

      {/* Available platforms */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {platforms.map(plat => {
          const isConnected = myPlatformSet.has(plat.platform);
          const isConnecting = connecting === plat.platform;
          const showFields = showConfig === plat.platform;

          return (
            <div key={plat.platform} style={{
              background: "#1f2937",
              borderRadius: "8px",
              padding: "1.25rem",
              border: isConnected ? "1px solid #22c55e" : "1px solid #374151",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "2rem" }}>{plat.icon}</span>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{plat.displayName}</div>
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{plat.description}</div>
                    </div>
                  </div>

                  {/* Status badge */}
                  {isConnected && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#052e16", border: "1px solid #166534", borderRadius: "12px", padding: "4px 12px", marginTop: "0.5rem" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                      <span style={{ fontSize: "0.75rem", color: "#4ade80" }}>Connected</span>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {!isConnected && (
                    <>
                      {plat.requiresSetup ? (
                        <>
                          <button
                            onClick={() => setShowConfig(showFields ? null : plat.platform)}
                            style={{ padding: "8px 16px", background: showFields ? "#4B5563" : "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}
                          >
                            Configure
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleConnect(plat.platform)}
                          disabled={isConnecting}
                          style={{ padding: "8px 20px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: isConnecting ? "wait" : "pointer", fontSize: "0.85rem", fontWeight: "bold" }}
                        >
                          {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Config form for external platforms */}
              {showFields && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "#111827", borderRadius: "8px" }}>
                  <form onSubmit={e => { e.preventDefault(); handleConnect(plat.platform); }}>
                    {plat.configFields.map(field => (
                      <label key={field.key} style={{ display: "block", marginBottom: "0.75rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>{field.label}</div>
                        <input
                          type={field.type === "password" ? "password" : field.type}
                          placeholder={field.placeholder}
                          value={configForm[field.key] || ""}
                          onChange={e => setConfigForm({ ...configForm, [field.key]: e.target.value })}
                          style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
                        />
                      </label>
                    ))}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button type="submit" disabled={isConnecting} style={{ padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: isConnecting ? "wait" : "pointer" }}>Connect</button>
                      <button type="button" onClick={() => setShowConfig(null)} style={{ padding: "6px 16px", background: "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Already connected - show status */}
              {isConnected && (() => {
                const conn = myConnectors.find(c => c.platform === plat.platform);
                return (
                  <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#111827", borderRadius: "6px", fontSize: "0.8rem" }}>
                    {plat.requiresSetup && (
                      <div style={{ marginBottom: "4px", color: "#9ca3af" }}>
                        Instance: {conn?.apiUrl || "Not configured"}
                      </div>
                    )}
                    <div style={{ fontFamily: "monospace", color: "#6b7280" }}>
                      Webhook: <span style={{ color: "#3b82f6" }}>POST /api/connectors/{plat.platform}/webhook</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button onClick={() => handleToggle(conn!)} style={{ padding: "4px 10px", background: "#374151", border: "none", color: "#9ca3af", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>
                        {conn?.enabled ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => handleRemove(conn!.id)} style={{ padding: "4px 10px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
