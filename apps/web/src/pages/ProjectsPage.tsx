import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface ProjectData {
  id: string;
  name: string;
  createdAt: string | null;
  stats?: { agents: number; tasks: number; events: number };
}

export default function ProjectsPage() {
  const { company, project, setProject, refreshProjects } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/projects`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const projs = d?.projects || [];
        setProjects(projs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  // Fetch stats for each project
  useEffect(() => {
    if (projects.length === 0) return;
    projects.forEach(async (p) => {
      try {
        const r = await fetch(`/api/projects/${p.id}/stats`, { credentials: "include" });
        if (r.ok) {
          const stats = await r.json();
          setProjects(prev => prev.map(pr => pr.id === p.id ? { ...pr, stats } : pr));
        }
      } catch {}
    });
  }, [projects.length]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !formName.trim()) return;
    const res = await fetch(`/api/companies/${company.id}/projects`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setProjects([...projects, data.project]);
      if (!project) {
        setProject(data.project);
        refreshProjects();
      }
      setFormName("");
      setShowForm(false);
    }
  };

  const handleDelete = async (projId: string) => {
    if (!confirm("Delete this project? Agents and tasks in this project will not be deleted.")) return;
    await fetch(`/api/projects/${projId}`, { method: "DELETE", credentials: "include" });
    setProjects(projects.filter(p => p.id !== projId));
    if (project?.id === projId) setProject(null);
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  if (!company) return <p style={{ padding: "2rem", color: "#888" }}>Select a company first.</p>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Projects
          <span className="tooltip-trigger">
            ?
            <span className="tooltip-bubble">Organize your work into projects. Each project can have its own agents and tasks.</span>
          </span>
        </h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>+ New Project</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input autoFocus placeholder="Project name" value={formName} onChange={e => setFormName(e.target.value)} style={{ flex: 1, padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <button type="submit" style={{ padding: "8px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Create</button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📁</div>
          <p>No projects yet. Create a project to organize your agents and tasks.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {projects.map(p => (
            <div key={p.id} style={{
              background: "#1f2937", borderRadius: "8px", padding: "1rem", border: p.id === project?.id ? "1px solid #3b82f6" : "1px solid #374151"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{p.name}</div>
                  {p.createdAt && (
                    <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "2px" }}>
                      Created {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {p.id === project?.id && (
                  <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "bold", background: "#1e3a5f", color: "#60a5fa" }}>Active</span>
                )}
              </div>

              {p.stats && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#9ca3af" }}>
                  <div>🤖 {(p.stats as any).agents || 0} agents</div>
                  <div>📋 {(p.stats as any).tasks || 0} tasks</div>
                  <div>⚡ {(p.stats as any).events || 0} events</div>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                {p.id !== project?.id && (
                  <button onClick={() => setProject(p)} style={{ padding: "4px 10px", background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Select</button>
                )}
                <button onClick={() => handleDelete(p.id)} style={{ padding: "4px 10px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", marginLeft: "auto" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
