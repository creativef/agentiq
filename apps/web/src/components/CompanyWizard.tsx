import { useState } from "react";

/** Agent role templates for the wizard */
export const agentTemplates = [
  { key: "founder", name: "Founder", role: "FOUNDER", icon: "🚀", description: "Vision, mission, and overall direction. Always included.", alwaysSelected: true },
  { key: "ceo", name: "CEO", role: "CEO", icon: "👔", description: "Strategy, oversees all operations, makes key decisions" },
  { key: "manager", name: "Project Manager", role: "MANAGER", icon: "📋", description: "Task coordination, timelines, standups" },
  { key: "developer", name: "Developer", role: "AGENT", icon: "💻", description: "Code, build, deploy features" },
  { key: "researcher", name: "Researcher", role: "AGENT", icon: "🔍", description: "Market intelligence, data analysis" },
  { key: "writer", name: "Content Writer", role: "AGENT", icon: "📝", description: "Blog posts, documentation, copy" },
  { key: "qa", name: "QA Tester", role: "AGENT", icon: "🧪", description: "Bug finding, testing workflows" },
  { key: "analyst", name: "Analyst", role: "AGENT", icon: "📊", description: "Metrics, reports, optimization" },
  { key: "designer", name: "Designer", role: "AGENT", icon: "🎨", description: "UI/UX, visual assets" },
];

export const industryOptions = [
  { value: "", label: "Select an industry (optional)" },
  { value: "technology", label: "🖥️ Technology & Software" },
  { value: "finance", label: "💰 Finance & Banking" },
  { value: "ecommerce", label: "🛒 E-Commerce & Retail" },
  { value: "healthcare", label: "🏥 Healthcare" },
  { value: "education", label: "📚 Education" },
  { value: "media", label: "📺 Media & Entertainment" },
  { value: "consulting", label: "💼 Consulting" },
  { value: "realestate", label: "🏠 Real Estate" },
  { value: "manufacturing", label: "🏭 Manufacturing" },
  { value: "other", label: "🔧 Other" },
];

interface CustomAgent {
  name: string;
  role: string;
}

type WizardStep = 1 | 2 | 3 | 4;

interface CompanyWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function CompanyWizard({ onComplete, onCancel }: CompanyWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 2
  const [projectName, setProjectName] = useState("");
  const [extraProjectNames, setExtraProjectNames] = useState<string[]>([]);

  // Step 3
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["founder"]);
  const [customAgent, setCustomAgent] = useState<CustomAgent>({ name: "", role: "AGENT" });
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);

  // Helpers
  const toggleAgent = (key: string) => {
    const tmpl = agentTemplates.find(t => t.key === key);
    if (tmpl?.alwaysSelected) return;
    setSelectedAgents(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const addCustomAgent = () => {
    if (customAgent.name.trim()) {
      setCustomAgents(prev => [...prev, { ...customAgent, name: customAgent.name.trim() }]);
      setCustomAgent({ name: "", role: "AGENT" });
    }
  };

  const removeCustomAgent = (idx: number) => {
    setCustomAgents(prev => prev.filter((_, i) => i !== idx));
  };

  const allProjects = [projectName.trim() || companyName.trim() || "General Operations", ...extraProjectNames.filter(Boolean)];

  // Role → default skill keys mapping
  const roleDefaultSkills: Record<string, string[]> = {
    FOUNDER: ["strategic_planning"],
    CEO: ["strategic_planning"],
    MANAGER: ["project_management"],
    AGENT: ["research_analysis"],
  };

  // Submit
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Build agent list from templates + custom WITH reporting hierarchy
      const templateAgents = selectedAgents
        .map(key => {
          const tmpl = agentTemplates.find(t => t.key === key);
          if (!tmpl) return null;
          const count = selectedAgents.filter(k => k === key).length;
          const suffix = count > 1 ? ` ${count}` : "";
          return { name: tmpl.name + suffix, role: tmpl.role, templateKey: tmpl.key };
        })
        .filter(Boolean);

      const allAgents = [
        ...templateAgents,
        ...customAgents.map(ca => ({ name: ca.name, role: ca.role, templateKey: "custom" })),
      ];

      // Resolve reporting chain
      const hasRole = (role: string) => allAgents.some(a => a.role === role);
      let reportsToMap = new Map();

      // Set up reporting based on roles
      for (const agent of allAgents) {
        if (agent.role === "FOUNDER") {
          reportsToMap.set(agent.templateKey, null);
        } else if (agent.role === "CEO") {
          reportsToMap.set(agent.templateKey, hasRole("FOUNDER") ? "FOUNDER" : null);
        } else if (agent.role === "MANAGER") {
          reportsToMap.set(agent.templateKey, hasRole("CEO") ? "CEO" : hasRole("FOUNDER") ? "FOUNDER" : null);
        } else {
          reportsToMap.set(agent.templateKey,
            hasRole("MANAGER") ? "MANAGER" : hasRole("CEO") ? "CEO" : hasRole("FOUNDER") ? "FOUNDER" : null);
        }
      }

      // Assign default skills based on role
      const agentsPayload = allAgents.map(a => ({
        name: a.name,
        role: a.role,
        reportsToRole: reportsToMap.get(a.templateKey),
        templateKey: a.templateKey,
        defaultSkills: roleDefaultSkills[a.role] || ["research_analysis"],
      }));

      const body = {
        name: companyName.trim(),
        description: companyDescription.trim() || null,
        industry: industry || null,
        projects: allProjects,
        agents: agentsPayload,
      };

      const res = await fetch("/api/companies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert("Failed to create company: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      alert("Failed to create company. Please try again.");
    }
    setSubmitting(false);
  };

  // Steps UI
  const steps = [
    { num: 1, label: "Company" },
    { num: 2, label: "Projects" },
    { num: 3, label: "Team" },
    { num: 4, label: "Review" },
  ];

  const canProceed = {
    1: companyName.trim().length > 0,
    2: true,
    3: true,
    4: true,
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Step indicator */}
      <div style={{ display: "flex", padding: "1rem 1.5rem", borderBottom: "1px solid #374151", gap: "0.5rem" }}>
        {steps.map(s => (
          <div key={s.num} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8rem", fontWeight: "bold",
              background: step >= s.num ? "#3b82f6" : "#374151",
              color: "white",
            }}>
              {step > s.num ? "✓" : s.num}
            </div>
            <span style={{ fontSize: "0.85rem", color: step >= s.num ? "#e5e7eb" : "#6b7280" }}>{s.label}</span>
            {s.num < 4 && <div style={{ width: "20px", height: "1px", background: "#4B5563" }} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ padding: "1.5rem" }}>
        {/* STEP 1: Company Details */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Company Details</h3>
            <label style={{ display: "block", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>Company Name <span style={{ color: "#ef4444" }}>*</span></div>
              <input
                autoFocus
                value={companyName}
                onChange={e => {
                  setCompanyName(e.target.value);
                  if (!projectName) setProjectName(e.target.value + " Project");
                }}
                placeholder="Enter your company name"
                style={{ width: "100%", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", boxSizing: "border-box" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>
                Description / Mission
                <span className="tooltip-trigger" style={{ marginLeft: "6px", fontSize: "8px" }}>
                  ?
                  <span className="tooltip-bubble">A short description of what your company does. This is visible on the dashboard.</span>
                </span>
              </div>
              <textarea
                value={companyDescription}
                onChange={e => setCompanyDescription(e.target.value)}
                placeholder="e.g., We build AI-powered analytics tools for small businesses"
                style={{ width: "100%", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", minHeight: "80px", boxSizing: "border-box", resize: "vertical" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>Industry / Domain</div>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                style={{ width: "100%", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", boxSizing: "border-box" }}
              >
                {industryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* STEP 2: Projects */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
              Projects
              <span className="tooltip-trigger" style={{ marginLeft: "6px", fontSize: "8px" }}>
                ?
                <span className="tooltip-bubble">Projects organize your work. Each project has its own agents, tasks, and events.</span>
              </span>
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "1rem" }}>
              Every company starts with at least one project. You can add more later.
            </p>

            <label style={{ display: "block", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "4px" }}>Main Project</div>
              <input
                autoFocus
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder={companyName ? `${companyName} Operations` : "e.g., Main Operations"}
                style={{ width: "100%", padding: "10px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white", boxSizing: "border-box" }}
              />
            </label>

            {extraProjectNames.map((name, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  value={name}
                  onChange={e => {
                    const updated = [...extraProjectNames];
                    updated[idx] = e.target.value;
                    setExtraProjectNames(updated);
                  }}
                  placeholder={`Additional project ${idx + 2}`}
                  style={{ flex: 1, padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white" }}
                />
                <button onClick={() => setExtraProjectNames(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
              </div>
            ))}

            <button
              onClick={() => setExtraProjectNames(prev => [...prev, ""])}
              style={{ padding: "6px 16px", background: "none", border: "1px dashed #4B5563", borderRadius: "6px", color: "#9ca3af", cursor: "pointer", fontSize: "0.85rem" }}
            >
              + Add another project
            </button>
          </div>
        )}

        {/* STEP 3: Team & Roles */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Team & Roles</h3>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "1rem" }}>
              Select the roles your company needs. Each selected role creates an agent in your first project.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
              {agentTemplates.map(tmpl => {
                const selected = selectedAgents.includes(tmpl.key);
                const disabled = tmpl.alwaysSelected;
                return (
                  <div
                    key={tmpl.key}
                    onClick={() => toggleAgent(tmpl.key)}
                    style={{
                      background: selected ? "#1e3a5f" : "#374151",
                      borderRadius: "8px",
                      padding: "0.75rem",
                      cursor: disabled ? "default" : "pointer",
                      border: selected ? "1px solid #3b82f6" : "1px solid transparent",
                      opacity: disabled ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.2rem" }}>{tmpl.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.85rem" }}>{tmpl.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{tmpl.description}</div>
                      </div>
                      {selected && <span style={{ color: "#22c55e" }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom agent */}
            <div style={{ marginTop: "1rem", padding: "1rem", background: "#111827", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "0.5rem" }}>Add custom agent</div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  placeholder="Agent name"
                  value={customAgent.name}
                  onChange={e => setCustomAgent(prev => ({ ...prev, name: e.target.value }))}
                  style={{ flex: 1, padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white" }}
                />
                <select
                  value={customAgent.role}
                  onChange={e => setCustomAgent(prev => ({ ...prev, role: e.target.value }))}
                  style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "6px", color: "white" }}
                >
                  <option value="AGENT">Agent</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CEO">CEO</option>
                </select>
                <button onClick={addCustomAgent} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "6px", cursor: "pointer" }}>Add</button>
              </div>
              {customAgents.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {customAgents.map((ca, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#374151", borderRadius: "6px", padding: "4px 8px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#e5e7eb" }}>{ca.name} <span style={{ color: "#9ca3af" }}>({ca.role})</span></span>
                      <button onClick={() => removeCustomAgent(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.9rem" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#9ca3af" }}>
              {selectedAgents.length + customAgents.length} agent{selectedAgents.length + customAgents.length !== 1 ? "s" : ""} will be created
            </div>
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Review & Create</h3>

            <div style={{ background: "#374151", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", marginBottom: "4px" }}>Company</div>
              <div style={{ fontWeight: "bold" }}>{companyName.trim()}</div>
              {companyDescription && <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "4px" }}>{companyDescription}</div>}
              {industry && <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" }}>
                {industryOptions.find(o => o.value === industry)?.label}
              </div>}
            </div>

            <div style={{ background: "#374151", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", marginBottom: "6px" }}>Projects ({allProjects.length})</div>
              {allProjects.map((p, i) => (
                <div key={i} style={{ fontSize: "0.85rem", color: "#e5e7eb", marginBottom: "2px" }}>• {p}</div>
              ))}
            </div>

            <div style={{ background: "#374151", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", marginBottom: "6px" }}>Agents ({selectedAgents.length + customAgents.length})</div>
              {selectedAgents.map(key => {
                const tmpl = agentTemplates.find(t => t.key === key);
                return tmpl ? <div key={key} style={{ fontSize: "0.85rem", color: "#e5e7eb", marginBottom: "2px" }}>{tmpl.icon} {tmpl.name} <span style={{ color: "#9ca3af" }}>({tmpl.role})</span></div> : null;
              })}
              {customAgents.map((ca, idx) => (
                <div key={idx} style={{ fontSize: "0.85rem", color: "#e5e7eb", marginBottom: "2px" }}>🤖 {ca.name} <span style={{ color: "#9ca3af" }}>({ca.role})</span></div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #374151" }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(s => (s - 1) as WizardStep)}
              style={{ padding: "8px 20px", background: "#374151", border: "none", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              ← Back
            </button>
          ) : (
            <button onClick={onCancel} style={{ padding: "8px 20px", background: "none", border: "1px solid #4B5563", color: "#9ca3af", borderRadius: "6px", cursor: "pointer" }}>
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(s => (s + 1) as WizardStep)}
              disabled={!canProceed[step]}
              style={{
                padding: "8px 24px", background: canProceed[step] ? "#3b82f6" : "#374151",
                color: canProceed[step] ? "white" : "#6b7280",
                border: "none", borderRadius: "6px", cursor: canProceed[step] ? "pointer" : "not-allowed", fontWeight: "bold",
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: "8px 32px", background: "#22c55e", border: "none", color: "white",
                borderRadius: "6px", cursor: submitting ? "wait" : "pointer", fontWeight: "bold", fontSize: "1rem",
              }}
            >
              {submitting ? "Creating..." : "🚀 Create Company"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
