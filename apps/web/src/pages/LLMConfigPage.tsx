import { useState, useEffect, FormEvent, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface LLMProvider {
  id: string;
  companyId: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
  priority: number;
  lastUsed: string | null;
  createdAt: string;
}

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI (GPT)", icon: "🔵", defaultUrl: "https://api.openai.com/v1" },
  { value: "anthropic", label: "Anthropic (Claude)", icon: "🟣", defaultUrl: "https://api.anthropic.com/v1" },
  { value: "openai-compatible", label: "Custom / OpenAI-Compatible", icon: "🟢", defaultUrl: "" },
  { value: "ollama", label: "Ollama (Local)", icon: "🦙", defaultUrl: "http://localhost:11434" },
  { value: "local", label: "vLLM / LM Studio / Local", icon: "💻", defaultUrl: "http://localhost:8000/v1" },
];

export default function LLMConfigPage() {
  const { company } = useAuth();
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency: number; error?: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    provider: "openai-compatible",
    model: "",
    baseUrl: "",
    apiKey: "",
    maxTokens: 4000,
    temperature: 0.3,
  });

  const fetchProviders = useCallback(() => {
    if (!company) return;
    fetch(`/api/llm/providers`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setProviders(d?.providers || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // Update default URL when provider changes
  useEffect(() => {
    const opt = PROVIDER_OPTIONS.find(p => p.value === form.provider);
    if (opt && opt.defaultUrl && (!form.baseUrl || form.baseUrl === "")) {
      setForm(prev => ({ ...prev, baseUrl: opt.defaultUrl }));
    }
  }, [form.provider]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;

    const body: any = {
      companyId: company.id,
      name: form.name || `${PROVIDER_OPTIONS.find(p => p.value === form.provider)?.label} (${form.model})`,
      provider: form.provider,
      model: form.model,
      baseUrl: form.baseUrl || null,
      apiKey: form.apiKey || null,
      maxTokens: form.maxTokens,
      temperature: form.temperature,
      isActive: providers.length === 0, // Auto-activate if first provider
    };

    const res = await fetch("/api/llm/providers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", provider: "openai-compatible", model: "", baseUrl: "", apiKey: "", maxTokens: 4000, temperature: 0.3 });
      fetchProviders();
    } else {
      const err = await res.json().catch(() => ({}));
      alert("Failed: " + (err.error || "Unknown error"));
    }
  };

  const handleToggleActive = async (id: string) => {
    await fetch(`/api/llm/providers/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    fetchProviders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    await fetch(`/api/llm/providers/${id}`, { method: "DELETE", credentials: "include" });
    fetchProviders();
  };

  const handleTest = async () => {
    if (!form.model) { alert("Enter a model name first"); return; }
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          model: form.model,
          apiKey: form.apiKey || undefined,
          baseUrl: form.baseUrl || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, latency: data.latency || 0, error: data.error });
    } catch (e: any) {
      setTestResult({ success: false, latency: 0, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>CEO Intelligence</h1>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af", margin: "4px 0 0" }}>
            ⚡ <strong>Hermes</strong> is your primary CEO brain (zero cost). Add extension providers below for fallback or specialized reasoning.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setTestResult(null); }}
          style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          {showForm ? "Cancel" : "+ Add Provider"}
        </button>
      </div>

      {/* Hermes Primary Banner */}
      <div style={{ background: "#1f2937", padding: "1.25rem", borderRadius: "8px", border: "1px solid #22c55e", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ fontSize: "2rem", width: "48px", height: "48px", background: "#052e16", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚡</div>
        <div>
          <strong style={{ fontSize: "1rem", color: "#e5e7eb" }}>Hermes Agent</strong>
          <span style={{ marginLeft: "8px", padding: "2px 8px", background: "#052e16", color: "#22c55e", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>PRIMARY</span>
          <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "2px" }}>Your main CEO brain. Already configured. No extra setup needed.</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "#1f2937", padding: "1.5rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem" }}>Add LLM Provider</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Provider Type</label>
              <select
                value={form.provider}
                onChange={e => setForm({ ...form, provider: e.target.value })}
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}
              >
                {PROVIDER_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Display Name</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., GPT-4o, Local Llama, Claude Backup"
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>API Base URL</label>
            <input
              value={form.baseUrl}
              onChange={e => setForm({ ...form, baseUrl: e.target.value })}
              placeholder={form.provider === "openai" ? "https://api.openai.com/v1" : "http://localhost:11434/v1"}
              style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Model Name</label>
              <input
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="e.g., gpt-4o, llama3.1:8b, claude-3-5-sonnet"
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>API Key (optional)</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-... (if required)"
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Temperature ({form.temperature})</label>
              <input
                type="range" min="0" max="1" step="0.1" value={form.temperature}
                onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#3b82f6" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Max Tokens</label>
              <input
                type="number" value={form.maxTokens}
                onChange={e => setForm({ ...form, maxTokens: parseInt(e.target.value) || 4000 })}
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Test & Save */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
            <button
              type="button" onClick={handleTest} disabled={testing}
              style={{ padding: "8px 16px", background: testing ? "#6b7280" : "#f59e0b", border: "none", color: "white", borderRadius: "4px", cursor: testing ? "wait" : "pointer", fontWeight: "bold" }}
            >
              {testing ? "Testing..." : "⚡ Test Connection"}
            </button>
            {testResult && (
              <span style={{ fontSize: "0.85rem", color: testResult.success ? "#22c55e" : "#ef4444" }}>
                {testResult.success ? `✅ Connected in ${testResult.latency}ms` : `❌ ${testResult.error || "Connection failed"}`}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" style={{ padding: "10px 24px", background: "#22c55e", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              Save Provider
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 24px", background: "#374151", border: "none", color: "white", borderRadius: "6px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Saved Providers */}
      <h3 style={{ fontSize: "0.95rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "0.75rem" }}>
        Extension Providers ({providers.length})
      </h3>

      {providers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
          No extension providers configured. Add one for fallback or specialized reasoning.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {providers.map(p => {
            const opt = PROVIDER_OPTIONS.find(o => o.value === p.provider);
            return (
              <div key={p.id} style={{
                background: "#1f2937", padding: "1rem 1.25rem", borderRadius: "8px",
                border: p.isActive ? "1px solid #22c55e" : "1px solid #374151",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "4px" }}>
                    <span style={{ fontSize: "1.1rem" }}>{opt?.icon || "🤖"}</span>
                    <strong style={{ fontSize: "0.95rem", color: "#e5e7eb" }}>{p.name}</strong>
                    {p.isActive && <span style={{ padding: "2px 8px", background: "#052e16", color: "#22c55e", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    {p.provider} • {p.model} • T={p.temperature} • {p.maxTokens} tokens
                    {p.baseUrl && ` • ${p.baseUrl}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {!p.isActive && (
                    <button onClick={() => handleToggleActive(p.id)} style={{ padding: "4px 12px", background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Activate</button>
                  )}
                  <button onClick={() => handleDelete(p.id)} style={{ padding: "4px 12px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
