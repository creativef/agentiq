import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reportsTo: string | null;
  xPos: number | null;
  yPos: number | null;
  children: AgentNode[];
}

const CARD_W = 200;
const CARD_H = 110;
const ROLE_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  FOUNDER: { border: "#f59e0b", bg: "rgba(69, 26, 3, 0.95)", text: "#fbbf24", glow: "rgba(245, 158, 11, 0.3)" },
  CEO: { border: "#3b82f6", bg: "rgba(30, 58, 95, 0.95)", text: "#60a5fa", glow: "rgba(59, 130, 246, 0.3)" },
  MANAGER: { border: "#a855f7", bg: "rgba(46, 16, 101, 0.95)", text: "#c084fc", glow: "rgba(168, 85, 247, 0.3)" },
  AGENT: { border: "#374151", bg: "rgba(31, 41, 55, 0.95)", text: "#9ca3af", glow: "transparent" },
};

const roleIcon = (r: string) => {
  if (r === "FOUNDER") return "🚀";
  if (r === "CEO") return "👔";
  if (r === "MANAGER") return "📋";
  return "🤖";
};

export default function CompanyOrg() {
  const { company } = useAuth();
  const [tree, setTree] = useState<AgentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  // ─── Fetch tree ───
  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/tree`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setTree(d?.tree || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  // ─── Flatten for rendering positions ───
  const allNodes = useMemo(() => {
    const flat: AgentNode[] = [];
    const walk = (nodes: AgentNode[]) => { for (const n of nodes) { flat.push(n); walk(n.children); } };
    walk(tree);
    return flat;
  }, [tree]);

  // ─── Drag handling ───
  const handleDragStart = useCallback((e: React.MouseEvent, node: AgentNode) => {
    e.preventDefault();
    e.stopPropagation();
    const currentX = node.xPos ?? 0;
    const currentY = node.yPos ?? 0;
    setDragging({ id: node.id, offsetX: e.clientX - currentX, offsetY: e.clientY - currentY });
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const newX = e.clientX - dragging.offsetX;
    const newY = e.clientY - dragging.offsetY;
    setTree(prev =>
      updateNodePos(prev, dragging.id, newX, newY)
    );
  }, [dragging]);

  const handleDragEnd = useCallback(async () => {
    if (!dragging) return;
    const node = findNode(tree, dragging.id);
    if (node && company) {
      try {
        await fetch(`/api/agents/${dragging.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xPos: Math.round(node.xPos ?? 0), yPos: Math.round(node.yPos ?? 0) }),
        });
      } catch (e) { console.error("Failed to save position:", e); }
    }
    setDragging(null);
  }, [dragging, tree, company]);

  // ─── Zoom / Pan ───
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.25, Math.min(3, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    setPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [dragging, pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    if (dragging) handleDragMove(e);
  }, [panning, dragging, handleDragMove]);

  const handleCanvasMouseUp = useCallback(() => { setPanning(false); handleDragEnd(); }, [handleDragEnd]);

  // ─── Auto-center on load ───
  useEffect(() => {
    if (allNodes.length === 0) return;
    const hasPositions = allNodes.some(n => n.xPos !== null && n.yPos !== null);
    if (!hasPositions && tree.length > 0) {
      // Auto-layout first time
      const centerX = window.innerWidth / 2 - CARD_W / 2;
      let yOffset = 60;
      const setAutoLayout = (nodes: AgentNode[], depth: number, parentX: number) => {
        let xOff = 0;
        for (const n of nodes) {
          const w = subtreeWidth(n);
          const cx = parentX + w / 2;
          n.xPos = (cx - CARD_W / 2) as number;
          n.yPos = yOffset;
          if (n.children.length > 0) {
            const childY = yOffset + CARD_H + 60;
            const oldY = yOffset;
            yOffset = childY;
            setAutoLayout(n.children, depth + 1, cx);
            yOffset = oldY + CARD_H + 80;
          }
        }
      };
      setAutoLayout(tree, 0, 0);
    }
  }, [tree, allNodes]);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;
  if (!company) return <p style={{ padding: "2rem", color: "#888" }}>No company selected.</p>;

  const hasPositions = allNodes.some(n => n.xPos !== null);
  const maxX = hasPositions ? Math.max(...allNodes.map(n => (n.xPos ?? 0) + CARD_W)) : 900;
  const maxY = hasPositions ? Math.max(...allNodes.map(n => (n.yPos ?? 0) + CARD_H)) : 600;

  return (
    <div style={{ padding: "1.5rem", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>Organization Chart</h1>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "4px 0 0" }}>
            Drag tiles to rearrange. Scroll to zoom.
          </p>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.2))} style={btnStyle}>−</button>
          <span style={{ padding: "6px 10px", background: "#1f2937", borderRadius: "4px", color: "#e5e7eb", fontSize: "0.85rem", minWidth: "50px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={btnStyle}>+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...btnStyle, marginLeft: "4px", fontSize: "0.7rem", color: "#9ca3af" }}>Reset</button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
          <p>No agents yet.</p>
        </div>
      ) : (
        <div
          ref={svgRef}
          style={{
            flex: 1, overflow: "hidden", background: "#0f172a", borderRadius: "12px",
            border: "1px solid #1e293b", cursor: dragging ? "grabbing" : panning ? "grabbing" : "grab",
            position: "relative",
          }}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <div style={{ position: "absolute", top: pan.y, left: pan.x, pointerEvents: "none" }}>
            {/* SVG Connector Lines */}
            <svg
              style={{
                position: "absolute", top: 0, left: 0,
                width: maxX + 600, height: maxY + 400, overflow: "visible", pointerEvents: "none",
              }}
            >
              {allNodes.map(node => {
                const parentPos = node.reportsTo ? allNodes.find(n => n.id === node.reportsTo) : null;
                if (!parentPos || node.xPos === null || node.yPos === null) return null;
                const x1 = (parentPos.xPos ?? 0) + CARD_W / 2;
                const y1 = (parentPos.yPos ?? 0) + CARD_H;
                const x2 = node.xPos + CARD_W / 2;
                const y2 = node.yPos;
                const my = y2 - 35;
                return (
                  <g key={node.id}>
                    <path d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                      fill="none" stroke="#334155" strokeWidth={2} />
                    <circle cx={x2} cy={y2 - 4} r={3} fill="#334155" />
                  </g>
                );
              })}
            </svg>

            {/* Agent Cards — rendered in role order so Founders paint first */}
            {[...allNodes].sort((a, b) => {
              const order = { FOUNDER: 0, CEO: 1, MANAGER: 2, AGENT: 3 };
              return (order[a.role as keyof typeof order] ?? 99) - (order[b.role as keyof typeof order] ?? 99);
            }).map(node => {
              const rc = ROLE_COLORS[node.role] || ROLE_COLORS.AGENT;
              const x = node.xPos ?? 200;
              const y = node.yPos ?? 200;
              return (
                <div
                  key={node.id}
                  onMouseDown={e => handleDragStart(e, node)}
                  style={{
                    position: "absolute", left: x, top: y,
                    width: CARD_W, minHeight: CARD_H,
                    background: rc.bg, borderRadius: "14px",
                    border: `2px solid ${rc.border}`,
                    boxShadow: `0 4px 24px ${rc.glow}, 0 0 0 1px ${rc.border}40`,
                    padding: "12px 14px",
                    cursor: "grab",
                    userSelect: "none",
                    pointerEvents: "auto",
                    backdropFilter: "blur(8px)",
                    transition: dragging?.id === node.id ? "none" : "box-shadow 0.3s",
                  }}
                >
                  {/* Top bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: rc.text, letterSpacing: "0.05em" }}>{node.role}</span>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: node.status === "running" ? "#22c55e" : "#6b7280" }} />
                  </div>

                  {/* Icon + Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "1.5rem" }}>{roleIcon(node.role)}</span>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "capitalize" }}>{node.status.replace("_", " ")}</div>
                    </div>
                  </div>

                  {/* Reports-to line */}
                  {node.reportsTo && (
                    <div style={{ fontSize: "0.65rem", color: "#475569", borderTop: "1px solid #1e293b", paddingTop: "4px", marginTop: "4px" }}>
                      ↓ Reports to
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───
const btnStyle = { padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "6px", cursor: "pointer", fontSize: "1rem", lineHeight: 1 };

function findNode(nodes: AgentNode[], id: string): AgentNode | null {
  for (const n of nodes) { if (n.id === id) return n; const f = findNode(n.children, id); if (f) return f; }
  return null;
}

function updateNodePos(nodes: AgentNode[], id: string, x: number, y: number): AgentNode[] {
  return nodes.map(n => n.id === id ? { ...n, xPos: Math.max(0, Math.round(x)), yPos: Math.max(0, Math.round(y)) } : n);
}

function subtreeWidth(node: AgentNode): number {
  if (node.children.length === 0) return CARD_W + 40;
  const childWidth = node.children.reduce((sum, c) => sum + subtreeWidth(c) + 30, -30);
  return Math.max(CARD_W + 40, childWidth);
}
