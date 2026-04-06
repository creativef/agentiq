import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface AgentNode {
  id: string;
  name: string;
  role: string;
  reportsTo: string | null;
  altReportsTo: string[] | null;
  children: AgentNode[];
}

const FOUNDER_STYLE: any = { 
  background: "rgba(69, 26, 3, 0.98)", 
  border: "2px solid #f59e0b", 
  color: "#fff", 
  boxShadow: "0 0 20px rgba(245, 158, 11, 0.3)",
  borderRadius: "12px",
  padding: "16px",
  minWidth: "220px",
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "14px",
};

const CEO_STYLE: any = { 
  background: "rgba(30, 58, 95, 0.98)", 
  border: "2px solid #3b82f6", 
  color: "#fff", 
  boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
  borderRadius: "12px",
  padding: "16px",
  minWidth: "220px",
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "14px",
};

const MANAGER_STYLE: any = { 
  background: "rgba(46, 16, 101, 0.98)", 
  border: "2px solid #a855f7", 
  color: "#fff", 
  boxShadow: "0 0 15px rgba(168, 85, 247, 0.25)",
  borderRadius: "12px",
  padding: "16px",
  minWidth: "200px",
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "14px",
};

const AGENT_STYLE: any = { 
  background: "rgba(31, 41, 55, 0.98)", 
  border: "2px solid #374151", 
  color: "#e5e7eb", 
  borderRadius: "12px",
  padding: "16px",
  minWidth: "200px",
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "14px",
};

const roleIcon = (role: string) => {
  if (role === "FOUNDER") return "🚀 ";
  if (role === "CEO") return "👔 ";
  if (role === "MANAGER") return "📋 ";
  return "🤖 ";
};

export default function CompanyOrg() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleNodeDragStop = useCallback(async (_: any, node: any) => {
    if (!company) return;
    try {
      await fetch(`/api/agents/${node.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xPos: Math.round(node.position.x), yPos: Math.round(node.position.y) }),
      });
    } catch {}
  }, [company]);

  // Fetch tree
  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/tree`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const agents: AgentNode[] = d?.tree || [];
        const newNodes: any[] = [];
        const newEdges: any[] = [];
        
        // Build nodes and edges
        function traverse(nodes: AgentNode[], depth: number, parentId: string | null = null) {
          nodes.forEach((node, i) => {
            // Calculate nice layout positions
            const totalSiblings = nodes.length;
            const xPos = (i - (totalSiblings - 1) / 2) * 300 + (parentId ? (depth % 2 === 0 ? 150 : -150) : 0);
            
            const y = depth * 180 - 100;
            const style = node.role === "FOUNDER" ? FOUNDER_STYLE : 
                         node.role === "CEO" ? CEO_STYLE : 
                         node.role === "MANAGER" ? MANAGER_STYLE : AGENT_STYLE;

            const storedX = (node as any).xPos;
            const storedY = (node as any).yPos;
            const position = (storedX !== null && storedX !== undefined && storedY !== null && storedY !== undefined)
              ? { x: storedX, y: storedY }
              : { x: xPos + (depth * 150), y };

            newNodes.push({
              id: node.id,
              position,
              type: "default",
              data: { label: `${roleIcon(node.role)}${node.name}`, subLabel: node.role },
              style: style,
              draggable: true,
            });

            // Connectors
            if (parentId) {
              newEdges.push({
                id: `e-${parentId}-${node.id}`,
                source: parentId,
                target: node.id,
                animated: false,
                style: { stroke: node.altReportsTo?.includes(parentId) ? "#a855f7" : "#374155", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#4B5563" },
              });
            }

            // Children
            if (node.children && node.children.length > 0) {
              traverse(node.children, depth + 1, node.id);
            }
            
            // Alt-reports (dashed lines)
            if (node.altReportsTo && node.altReportsTo.length > 0) {
              node.altReportsTo.forEach(altManagerId => {
                if (altManagerId !== parentId && altManagerId !== node.reportsTo) {
                  newEdges.push({
                    id: `alt-${altManagerId}-${node.id}`,
                    source: altManagerId,
                    target: node.id,
                    animated: false,
                    style: { stroke: "#6b7280", strokeWidth: 2, strokeDasharray: "5 5" },
                    markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#6b7280" },
                  });
                }
              });
            }
          });
        }

        traverse(agents, 0);
        
        setNodes(newNodes);
        setEdges(newEdges);
        setLoading(false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;
  if (!company) return <p style={{ padding: "2rem", color: "#888" }}>No company selected.</p>;

  return (
    <div style={{ padding: "0.25rem", height: "calc(100vh - 10px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>Organization Chart — {company.name}</h1>
      </div>
      <div style={{ flex: 1, background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", position: "relative", minHeight: "80vh" }}>
        <ReactFlow 
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: "#0f172a" }}
        >
          <Background color="#1e293b" gap={40} size={1.5} />
          <Controls style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }} />
        </ReactFlow>
      </div>
    </div>
  );
}
