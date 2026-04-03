import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reportsTo: string | null;
  children: AgentNode[];
}

export default function CompanyOrg() {
  const { company } = useAuth();
  const [tree, setTree] = useState<AgentNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/tree`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setTree(d.tree || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  if (!company) return <p style={{ padding: "2rem", color: "#888" }}>No company selected.</p>;

  const roleIcon = (role: string) => {
    if (role === "FOUNDER") return "🚀";
    if (role === "CEO") return "👔";
    if (role === "MANAGER") return "📋";
    return "🤖";
  };

  const renderTree = (nodes: AgentNode[], depth: number) => {
    if (nodes.length === 0) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: depth === 0 ? "2rem" : "1rem" }}>
        {nodes.map(node => (
          <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              background: "#1f2937",
              padding: "0.75rem 1.25rem",
              borderRadius: "12px",
              border: node.role === "FOUNDER" ? "2px solid #f59e0b" : "1px solid #374151",
              textAlign: "center",
              minWidth: "120px",
            }}>
              <div style={{ fontSize: "1.5rem" }}>{roleIcon(node.role)}</div>
              <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{node.name}</div>
              <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{node.role}</div>
              <div style={{ fontSize: "0.65rem", color: "#22c55e", textTransform: "capitalize", marginTop: "2px" }}>{node.status}</div>
            </div>
            {node.children.length > 0 && (
              <>
                <div style={{ width: "1px", height: "16px", background: "#4B5563", margin: "0 auto" }} />
                <div style={{ display: "flex", gap: "1rem", alignItems: "start" }}>
                  {node.children.length > 1 && (
                    <div style={{
                      height: "1px",
                      background: "#4B5563",
                      width: `${node.children.length * 140}px`,
                      maxWidth: "80vw",
                    }} />
                  )}
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                  {renderTree(node.children, depth + 1)}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
        Organization Chart — {company.name}
      </h1>

      {tree.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
          <p>No agents in this company yet.</p>
        </div>
      ) : (
        <div style={{ overflow: "auto", paddingBottom: "2rem" }}>
          {renderTree(tree, 0)}
        </div>
      )}
    </div>
  );
}
