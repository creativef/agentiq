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
  { value: "openai", label: "OpenAI", icon: "🔵", defaultModel: "gpt-4o" },
  { value: "anthropic", label: "Anthropic (Claude)", icon: "🟣", defaultModel: "claude-3-5-sonnet-20241022" },
  { value: "openai-compatible", label: "Self-Hosted (OpenAI-Compatible)", icon: "🟢", defaultModel: "llama3.1:70b" },
  { value: "ollama", label: "Ollama (Local)", icon: "🦙", defaultModel: "llama3.1:8b" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  "openai-compatible": ["llama3.1:70b", "mistral:large", "qwen2.5:72b"],
  ollama: ["llama3.1:8b", "llama3.1:70b", "mistral:7b", "qwen2.5:14b"],
};

export default function LLMConfigPage() {
  const { company } = useAuth();
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; latency: number } | null>(null);

  const [form, setForm] = useState({
    name: "",
    provider: "openai",
    model: "gpt-4o",
    baseUrl: "",
    apiKey: "",
    maxTokens: 4000,
    temperature: 0.3,
    isActive: false,
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

  // Update model suggestion when provider changes
  useEffect(() => {
    const opt = PROVIDER_OPTIONS.find(p => p.value === form.provider);
    if (opt && (form.model === "gpt-4o" || form.model === "claude-3-5-sonnet-20241022" || form.model === "llama3.1:8b")) {
      setForm(prev => ({ ...prev, model: opt.defaultModel }));
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
      maxTokens: form.maxTokens,
      temperature: form.temperature,
      isActive: form.isActive,
    };

    if (form.provider === "openai" || form.provider === "anthropic") {
      if (!form.apiKey) {
        alert("API Key is required for " + form.provider);
        return;
      }
      body.apiKey = form.apiKey;
    }

    if (form.provider === "openai-compatible" || form.provider === "ollama") {
      body.baseUrl = form.baseUrl || (form.provider === "ollama" ? "http://localhost:11434" : null);
      if (form.apiKey) body.apiKey = form.apiKey;
    }

    const res = await fetch("/api/llm/providers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", provider: "openai", model: "gpt-4o", baseUrl: "", apiKey: "", maxTokens: 4000, temperature: 0.3, isActive: false });
      fetchProviders();
    } else {
      const err = await res.json().catch(() => ({}));
      alert("Failed: " + (err.error || "Unknown error"));
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    if (currentActive) return; // Deactivate via another provider activation
    await fetch(`/api/llm/providers/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    fetchProviders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this LLM provider?")) return;
    await fetch(`/api/llm/providers/${id}`, { method: "DELETE", credentials: "include" });
    fetchProviders();
  };

  const handleTest = async () => {
    setTesting(form.provider);
    setTestResult(null);

    const body: any = {
      provider: form.provider,
      model: form.model,
      apiKey: form.apiKey || undefined,
      baseUrl: form.baseUrl || undefined,
    };

    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({ success: data.success, latency: data.latency || 0 });
      if (!data.success) {
        alert("Test failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      setTestResult({ success: false, latency: 0 });
      alert("Test failed: " + e.message);
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>CEO Intelligence</h1>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af", margin: "4px 0 0" }}>
            🟢 <strong>Hermes</strong> is your primary CEO brain. Add extension LLMs for specialized reasoning or fallback.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          {showForm ? "Cancel" : "+ Add Extension"}
        </button>
      </div>

      {/* Hermes Primary Brain Banner */}
      <div style={{ background: "#1f2937", padding: "1.25rem", borderRadius: "8px", border: "1px solid #22c55e", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ fontSize: "2rem", width: "48px", height: "48px", background: "#052e16", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ⚡
            </div>
            <div>
              <strong style={{ fontSize: "1rem", color: "#e5e7eb" }}>Hermes Agent</strong>
              <span style={{ marginLeft: "8px", padding: "2px 8px", background: "#052e16", color: "#22c55e", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>PRIMARY CEO</span>
              <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "2px" }}>
                Your main autonomous orchestrator. Zero additional cost. Manages company operations and delegates to agents.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extension LLMs */}
      <h3 style={{ fontSize: "0.95rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "0.75rem" }}>Extension LLMs <span style={{ fontWeight: "normal", color: "#6b7280", fontSize: "0.8rem" }}>(optional)</span></h3>
      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.75rem" }}>
        Add specialized or fallback LLMs for specific reasoning tasks, model comparison, or high-load scenarios.
      </p>

      {/* Provider List */}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "#1f2937", padding: "1.5rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem" }}>Add LLM Provider</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Provider Type *</label>
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
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Model Name *</label>
              <datalist id="model-suggestions">
                {(MODEL_SUGGESTIONS[form.provider] || []).map(m => <option key={m} value={m} />)}
              </datalist>
              <input
                list="model-suggestions"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder={PROVIDER_OPTIONS.find(p => p.value === form.provider)?.defaultModel}
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
              Name (optional)
            </label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Primary Brain, Backup Ollama"
              style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
            />
          </div>

          {/* API Key (for cloud providers) */}
          {(form.provider === "openai" || form.provider === "anthropic") && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
                API Key *
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Base URL (for self-hosted) */}
          {(form.provider === "openai-compatible" || form.provider === "ollama") && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
                Base URL {form.provider === "ollama" ? "(optional)" : "*"}
              </label>
              <input
                value={form.baseUrl}
                onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                placeholder={form.provider === "ollama" ? "http://localhost:11434" : "http://localhost:11434/v1"}
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Test Button */}
          <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing !== null}
              style={{ padding: "8px 16px", background: testing ? "#6b7280" : "#f59e0b", border: "none", color: "white", borderRadius: "4px", cursor: testing ? "wait" : "pointer", fontWeight: "bold" }}
            >
              {testing ? "Testing..." : "⚡ Test Connection"}
            </button>
            {testResult && (
              <span style={{ fontSize: "0.85rem", color: testResult.success ? "#22c55e" : "#ef4444" }}>
                {testResult.success ? `✅ Connected (${testResult.latency}ms)` : "❌ Connection failed"}
              </span>
            )}
          </div>

          {/* Temperature & Max Tokens */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>
                Temperature ({form.temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={form.temperature}
                onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#3b82f6" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#6b7280" }}>
                <span>Precise (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#e5e7eb", marginBottom: "4px" }}>Max Tokens</label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={e => setForm({ ...form, maxTokens: parseInt(e.target.value) || 4000 })}
                style={{ width: "100%", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#e5e7eb", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                style={{ accentColor: "#22c55e" }}
              />
              Activate immediately
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="submit" style={{ padding: "10px 24px", background: "#22c55e", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              Save Provider
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 24px", background: "#374151", border: "none", color: "white", borderRadius: "6px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Provider List */}
      {providers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          No AI brains configured. Add your first provider to enable autonomous decision-making.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {providers.map(p => (
            <div
              key={p.id}
              style={{
                background: "#1f2937",
                padding: "1rem 1.25rem",
                borderRadius: "8px",
                border: p.isActive ? "1px solid #22c55e" : "1px solid #374151",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "4px" }}>
                  <span style={{ fontSize: "1.1rem" }}>
                    {PROVIDER_OPTIONS.find(o => o.value === p.provider)?.icon || "🤖"}
                  </span>
                  <strong style={{ fontSize: "0.95rem", color: "#e5e7eb" }}>{p.name}</strong>
                  {p.isActive && (
                    <span style={{ padding: "2px 8px", background: "#052e16", color: "#22c55e", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>ACTIVE</span>
                  )}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  {p.provider} • {p.model} • T={p.temperature} • Max={p.maxTokens} tokens
                  {p.baseUrl && ` • ${p.baseUrl}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {!p.isActive && (
                  <button
                    onClick={() => handleToggleActive(p.id, p.isActive)}
                    style={{ padding: "4px 12px", background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{ padding: "4px 12px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
