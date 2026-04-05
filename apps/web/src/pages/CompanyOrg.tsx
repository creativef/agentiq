import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reportsTo: string | null;
  children: AgentNode[];
}

interface Pos { x: number; y: number }

const CARD_W = 210;
const CARD_H = 120;
const H_GAP = 30;
const V_GAP = 80;

const ICONS: Record<string, string> = { FOUNDER: "🚀", CEO: "👔", MANAGER: "📋" };
const ROLE_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  FOUNDER: { border: "#f59e0b", bg: "rgba(69, 26, 3, 0.95)", text: "#fbbf24", glow: "rgba(245, 158, 11, 0.35)" },
  CEO: { border: "#3b82f6", bg: "rgba(30, 58, 95, 0.95)", text: "#60a5fa", glow: "rgba(59, 130, 246, 0.35)" },
  MANAGER: { border: "#a855f7", bg: "rgba(46, 16, 101, 0.95)", text: "#c084fc", glow: "rgba(168, 85, 247, 0.35)" },
};

export default function CompanyOrg() {
  const { company } = useAuth();
  const [tree, setTree] = useState<AgentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [dragNode, setDragNode] = useState<string | null>(null);
  const dragOff = useRef<Pos>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<Pos>({ x: 0, y: 0 });

  // Fetch
  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/tree`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const nodes: AgentNode[] = d?.tree || [];
        setTree(nodes);
        // Compute initial positions
        const flat = flattenTree(nodes);
        const hasSaved = flat.some((n: any) => n.xPos != null && n.yPos != null);
        if (hasSaved) {
          const saved: Record<string, Pos> = {};
          flat.forEach((n: any) => {
            if (n.xPos != null && n.yPos != null) saved[n.id] = { x: n.xPos, y: n.yPos };
          });
          autoArrangeRemaining(nodes, saved);
          setPositions(saved);
        } else {
          setPositions(calculateAutoLayout(nodes));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  // Flatten tree + add all props to a Record for quick lookup
  const allAgents = useMemo(() => {
    const m: Record<string, AgentNode> = {};
    (function walk(nodes: AgentNode[]) {
      for (const n of nodes) { m[n.id] = n; walk(n.children); }
    })(tree);
    return m;
  }, [tree]);

  // Calculate auto-layout (pure, no mutation)
  const calculateAutoLayout = useCallback((nodes: AgentNode[]): Record<string, Pos> => {
    const result: Record<string, Pos> = {};
    
    function subtreeWidth(ns: AgentNode[]): number {
      if (ns.length === 0) return 0;
      let total = 0;
      for (let i = 0; i < ns.length; i++) {
        total += Math.max(CARD_W, subtreeWidth(ns[i].children));
        if (i < ns.length - 1) total += H_GAP;
      }
      return total;
    }

    function layout(ns: AgentNode[], startX: number, y: number) {
      const totalW = subtreeWidth(ns);
      let x = startX;
      for (const n of ns) {
        const w = Math.max(CARD_W, subtreeWidth(n.children));
        const cx = x + w / 2 - CARD_W / 2;
        result[n.id] = { x: cx, y };
        if (n.children.length > 0) {
          layout(n.children, x, y + CARD_H + V_GAP);
        }
        x += w + H_GAP;
      }
    }

    layout(nodes, 0, 40);
    
    // Shift everything to be centered around 0
    const xs = Object.values(result).map(p => p.x);
    const ys = Object.values(result).map(p => p.y);
    if (xs.length === 0) return result;
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const shiftX = -minX + 100;
    const shiftY = -minY + 60;
    
    for (const id in result) {
      result[id].x += shiftX;
      result[id].y += shiftY;
    }
    return result;
  }, []);

  // Auto-arrange any nodes without positions
  const autoArrangeRemaining = useCallback((nodes: AgentNode[], posMap: Record<string, Pos>) => {
    const layout = calculateAutoLayout(nodes);
    for (const id in layout) {
      if (!posMap[id]) posMap[id] = layout[id];
    }
  }, [calculateAutoLayout]);

  // ─── Drag handlers ───
  const onCardDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOff.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragNode(id);
  }, []);

  const onCanvasMove = useCallback((e: React.MouseEvent) => {
    if (dragNode && canvasRef.current) {
      const pos = positions[dragNode];
      if (!pos) return;
      const newX = e.clientX - dragOff.current.x - canvasRef.current.getBoundingClientRect().left;
      const newY = e.clientY - dragOff.current.y - canvasRef.current.getBoundingClientRect().top;
      setPositions(prev => ({ ...prev, [dragNode]: { x: newX, y: newY } }));
    } else if (isPanning) {
      setPan({ x: e.clientX - panOrigin.current.x, y: e.clientY - panOrigin.current.y });
    }
  }, [dragNode, positions, isPanning]);

  const onCanvasUp = useCallback(async () => {
    if (dragNode && company) {
      const pos = positions[dragNode];
      if (pos) {
        try {
          await fetch(`/api/agents/${dragNode}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xPos: Math.round(pos.x), yPos: Math.round(pos.y) }),
          });
        } catch (e) { console.error(e); }
      }
    }
    setDragNode(null);
    setIsPanning(false);
  }, [dragNode, positions, company]);

  const onCanvasDown = useCallback((e: React.MouseEvent) => {
    if (dragNode) return;
    setIsPanning(true);
    panOrigin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [dragNode, pan]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.25, Math.min(3, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  }, []);

  // Auto-center on mount
  useEffect(() => {
    const posVals = Object.values(positions);
    if (posVals.length === 0) return;
    const cw = canvasRef.current?.clientWidth || 1000;
    const ch = canvasRef.current?.clientHeight || 600;
    const xs = posVals.map(p => p.x);
    const ys = posVals.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs) + CARD_W;
    const maxY = Math.max(...ys) + CARD_H;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    setPan({ x: cw / 2 - (contentW / 2 + minX), y: ch / 2 - (contentH / 2 + minY) - 50 });
  }, [positions]);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;
  if (!company) return <p style={{ padding: "2rem", color: "#888" }}>No company selected.</p>;

  return (
    <div style={{ padding: "1.5rem", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>Organization Chart</h1>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "4px 0 0" }}>Drag tiles to rearrage. Scroll to zoom.</p>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.2))} style={btnStyle}>−</button>
          <span style={{ padding: "6px 10px", background: "#1f2937", borderRadius: "4px", color: "#e5e7eb", fontSize: "0.85rem", minWidth: "50px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={btnStyle}>+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 50, y: 50 }); }} style={{ ...btnStyle, marginLeft: "6px", fontSize: "0.7rem", color: "#9ca3af" }}>Reset</button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div><p>No agents yet.</p>
        </div>
      ) : (
        <div
          ref={canvasRef}
          style={{
            flex: 1, overflow: "hidden", background: "#0f172a", borderRadius: "12px",
            border: "1px solid #1e293b", cursor: dragNode ? "grabbing" : isPanning ? "grabbing" : "grab",
            position: "relative",
          }}
          onMouseDown={onCanvasDown}
          onMouseMove={onCanvasMove}
          onMouseUp={onCanvasUp}
          onMouseLeave={onCanvasUp}
          onWheel={onWheel}
        >
          <div style={{
            position: "absolute", top: pan.y, left: pan.x,
            transform: `scale(${zoom})`, transformOrigin: "0 0",
            width: "100%", height: "100%", pointerEvents: "none",
          }}>
            {/* Connector Lines */}
            <svg style={{ position: "absolute", top: 0, left: 0, width: "5000px", height: "5000px", overflow: "visible", pointerEvents: "none" }}>
              {Object.entries(allAgents).map(([id, node]) => {
                if (!node.reportsTo) return null;
                const parentPos = positions[node.reportsTo];
                const childPos = positions[id];
                if (!parentPos || !childPos) return null;
                const x1 = parentPos.x + CARD_W / 2;
                const y1 = parentPos.y + CARD_H;
                const x2 = childPos.x + CARD_W / 2;
                const y2 = childPos.y;
                const midY = y2 - V_GAP / 2;
                return (
                  <path key={id} d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none" stroke="#334155" strokeWidth={2} />
                );
              })}
            </svg>

            {/* Agent Cards */}
            {Object.entries(positions).map(([id, pos]) => {
              const node = allAgents[id];
              if (!node) return null;
              const rc = ROLE_COLORS[node.role] || ROLE_COLORS.MANAGER;
              const isDragging = dragNode === id;
              return (
                <div
                  key={id}
                  onMouseDown={e => onCardDown(e, id)}
                  style={{
                    position: "absolute", left: pos.x, top: pos.y,
                    width: CARD_W, minHeight: CARD_H,
                    background: rc.bg, borderRadius: "14px", border: `2px solid ${rc.border}`,
                    boxShadow: isDragging ? `0 8px 32px ${rc.glow}, 0 0 0 2px ${rc.border}` : `0 4px 20px ${rc.glow}`,
                    padding: "14px 16px",
                    cursor: "grab", userSelect: "none", pointerEvents: "auto",
                    zIndex: isDragging ? 1000 : 1,
                    transition: isDragging ? "none" : "box-shadow 0.25s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: rc.text, letterSpacing: "0.05em" }}>{node.role}</span>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: node.status === "running" || node.status === "idle" ? "#22c55e" : "#6b7280" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "1.6rem" }}>{ICONS[node.role] || "🤖"}</span>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "capitalize" }}>{node.status.replace("_", " ")}</div>
                    </div>
                  </div>
                  {node.reportsTo && (
                    <div style={{ fontSize: "0.65rem", color: "#475569", borderTop: "1px solid #1e293b", paddingTop: "4px" }}>
                      ↓ Reports to: {allAgents[node.reportsTo]?.name || "Unknown"}
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

function flattenTree(nodes: AgentNode[]): AgentNode[] {
  const r: AgentNode[] = [];
  (function walk(ns: AgentNode[]) {
    for (const n of ns) { r.push(n); walk(n.children); }
  })(nodes);
  return r;
}

const btnStyle = { padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "6px", cursor: "pointer", fontSize: "1rem", lineHeight: 1 };
