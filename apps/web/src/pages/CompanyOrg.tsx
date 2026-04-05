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

interface PositionedNode extends AgentNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 180;
const CARD_HEIGHT = 100;
const H_GAP = 40;
const V_GAP = 80;

const roleIcon = (role: string) => {
  if (role === "FOUNDER") return "🚀";
  if (role === "CEO") return "👔";
  if (role === "MANAGER") return "📋";
  return "🤖";
};

const roleColor = (role: string) => {
  if (role === "FOUNDER") return { border: "#f59e0b", bg: "#451a03", text: "#f59e0b" };
  if (role === "CEO") return { border: "#3b82f6", bg: "#1e3a5f", text: "#60a5fa" };
  if (role === "MANAGER") return { border: "#a855f7", bg: "#2e1065", text: "#a855f7" };
  return { border: "#374151", bg: "#1f2937", text: "#9ca3af" };
};

// Calculate tree layout (Reingold-Tilford inspired)
function layoutTree(nodes: AgentNode[], parentX: number, parentY: number): PositionedNode[] {
  const positioned: PositionedNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const childCount = node.children.length;
    const totalWidth = childCount * CARD_WIDTH + (childCount - 1) * H_GAP;
    const x = parentX;
    const y = parentY;

    positioned.push({ ...node, x, y, width: CARD_WIDTH, height: CARD_HEIGHT });

    if (childCount > 0) {
      let startX = x - totalWidth / 2 + CARD_WIDTH / 2;
      for (const child of node.children) {
        const childWidth = getSubtreeWidth(child);
        const childX = startX + childWidth / 2;
        const childNodes = layoutTree([child], childX, y + CARD_HEIGHT + V_GAP);
        positioned.push(...childNodes);
        startX += childWidth + H_GAP;
      }
    }
  }

  return positioned;
}

function getSubtreeWidth(node: AgentNode): number {
  if (node.children.length === 0) return CARD_WIDTH;
  let total = 0;
  for (let i = 0; i < node.children.length; i++) {
    total += getSubtreeWidth(node.children[i]);
    if (i < node.children.length - 1) total += H_GAP;
  }
  return Math.max(total, CARD_WIDTH);
}

// Flatten the tree into a list for top-down layout
function computeLayout(tree: AgentNode[]): PositionedNode[] {
  if (tree.length === 0) return [];

  // Find all roots (no reportsTo or FOUNDER/CEO level)
  const allNodes = collectNodes(tree);
  const roots = tree;

  // Layout each root tree
  const positioned: PositionedNode[] = [];
  let offsetX = 0;

  for (const root of roots) {
    const subtree = layoutTree([root], 0, 0);
    // Shift right
    for (const n of subtree) {
      positioned.push({ ...n, x: n.x + offsetX });
    }
    const maxX = Math.max(...subtree.map(n => n.x + CARD_WIDTH));
    offsetX = maxX + H_GAP * 3;
  }

  return positioned;
}

function collectNodes(nodes: AgentNode[]): AgentNode[] {
  const result: AgentNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...collectNodes(node.children));
  }
  return result;
}

export default function CompanyOrg() {
  const { company } = useAuth();
  const [tree, setTree] = useState<AgentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/tree`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setTree(d.tree || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  const positioned = useMemo(() => computeLayout(tree), [tree]);

  // Center the chart on load
  useEffect(() => {
    if (positioned.length === 0) return;
    const maxX = Math.max(...positioned.map(n => n.x + CARD_WIDTH));
    const maxY = Math.max(...positioned.map(n => n.y + CARD_HEIGHT));
    const containerW = svgRef.current?.clientWidth || window.innerWidth;
    const containerH = svgRef.current?.clientHeight || window.innerHeight;
    setPan({ x: containerW / 2 - (maxX / 2) * zoom, y: 60 });
  }, [positioned]);

  // Connector lines
  const connectors = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    function drawConnectors(nodes: AgentNode[], parentX: number, parentY: number) {
      for (const node of nodes) {
        const posNode = positioned.find(p => p.id === node.id);
        if (!posNode) continue;

        const childBaseX = posNode.x + CARD_WIDTH / 2;
        const childTopY = posNode.y;

        if (parentX !== undefined) {
          lines.push({
            x1: parentX,
            y1: parentY + CARD_HEIGHT,
            x2: childBaseX,
            y2: childTopY,
          });
        }

        // Draw children connectors
        if (node.children.length > 0) {
          const childPositions = node.children
            .map(c => positioned.find(p => p.id === c.id))
            .filter(Boolean) as PositionedNode[];

          if (childPositions.length > 0) {
            // Parent to children hub
            const hubY = parentY !== undefined ? parentY + CARD_HEIGHT + V_GAP / 2 : childTopY - V_GAP / 2;

            for (const childPos of childPositions) {
              const childCenterX = childPos.x + CARD_WIDTH / 2;
              lines.push({
                x1: childCenterX,
                y1: hubY,
                x2: childCenterX,
                y2: childPos.y,
              });
            }

            // Horizontal line between children
            if (childPositions.length > 1) {
              lines.push({
                x1: childPositions[0].x + CARD_WIDTH / 2,
                y1: hubY,
                x2: childPositions[childPositions.length - 1].x + CARD_WIDTH / 2,
                y2: hubY,
              });
            }

            // Recursive
            drawConnectors(node.children, posNode.x + CARD_WIDTH / 2, posNode.y);
          }
        }
      }
    }

    drawConnectors(tree, 0, 0);
    return lines;
  }, [positioned, tree]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.1 : -0.1;
    setZoom(z => Math.max(0.3, Math.min(2.5, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  // Zoom controls
  const zoomIn = () => setZoom(z => Math.min(2.5, z + 0.2));
  const zoomOut = () => setZoom(z => Math.max(0.3, z - 0.2));
  const resetView = () => {
    const maxX = Math.max(...positioned.map(n => n.x + CARD_WIDTH), 800);
    const containerW = svgRef.current?.clientWidth || 1200;
    setZoom(1);
    setPan({ x: containerW / 2 - maxX / 2, y: 60 });
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;
  if (!company) return <p style={{ padding: "2rem", color: "#888" }}>No company selected.</p>;

  const maxX = Math.max(...positioned.map(n => n.x + CARD_WIDTH), 800);
  const maxY = Math.max(...positioned.map(n => n.y + CARD_HEIGHT), 400);

  const selectedNode = positioned.find(n => n.id === selectedId);

  return (
    <div style={{ padding: "1.5rem", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>
          Organization Chart — {company.name}
        </h1>
        {/* Zoom Controls */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button onClick={zoomOut} style={{ padding: "6px 12px", background: "#374151", border: "1px solid #4B5563", color: "white", borderRadius: "4px", cursor: "pointer", fontSize: "1rem" }}>−</button>
          <span style={{ padding: "6px 12px", background: "#1f2937", borderRadius: "4px", color: "#e5e7eb", fontSize: "0.85rem", minWidth: "55px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} style={{ padding: "6px 12px", background: "#374151", border: "1px solid #4B5563", color: "white", borderRadius: "4px", cursor: "pointer", fontSize: "1rem" }}>+</button>
          <button onClick={resetView} style={{ padding: "6px 12px", background: "#374151", border: "1px solid #4B5563", color: "#9ca3af", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", marginLeft: "4px" }}>Reset</button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
          <p>No agents in this company yet.</p>
        </div>
      ) : (
        <div
          ref={svgRef}
          style={{
            flex: 1,
            overflow: "hidden",
            background: "#111827",
            borderRadius: "12px",
            border: "1px solid #1f2937",
            cursor: dragging ? "grabbing" : "grab",
            position: "relative",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={{
            position: "absolute",
            top: pan.y,
            left: pan.x,
            transformOrigin: "0 0",
            transform: `scale(${zoom})`,
            pointerEvents: "none",
          }}>
            {/* SVG Connectors */}
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: maxX + 400,
                height: maxY + 200,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              {connectors.map((line, i) => (
                <path
                  key={i}
                  d={`M ${line.x1} ${line.y1} C ${line.x1} ${line.y1 + V_GAP / 2}, ${line.x2} ${line.y2 - V_GAP / 2}, ${line.x2} ${line.y2}`}
                  fill="none"
                  stroke="#4B5563"
                  strokeWidth={2}
                />
              ))}
            </svg>

            {/* Node Cards */}
            {positioned.map(node => {
              const rc = roleColor(node.role);
              const isSelected = node.id === selectedId;
              return (
                <div
                  key={node.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }}
                  style={{
                    position: "absolute",
                    left: node.x,
                    top: node.y,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    background: isSelected ? "#1e293b" : rc.bg,
                    padding: "12px",
                    borderRadius: "12px",
                    border: `2px solid ${isSelected ? "#60a5fa" : rc.border}`,
                    textAlign: "center",
                    cursor: "pointer",
                    boxShadow: isSelected ? `0 0 20px ${rc.border}40` : "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    pointerEvents: "auto",
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "2px" }}>{roleIcon(node.role)}</div>
                  <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</div>
                  <div style={{ fontSize: "0.7rem", color: rc.text, fontWeight: "bold", marginTop: "1px" }}>{node.role}</div>
                  <div style={{ fontSize: "0.65rem", color: "#22c55e", textTransform: "capitalize", marginTop: "2px" }}>{node.status.replace("_", " ")}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Agent Detail Panel */}
      {selectedNode && (
        <div style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ fontSize: "2rem", width: "48px", height: "48px", background: "#374151", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {roleIcon(selectedNode.role)}
            </div>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "1rem", color: "#e5e7eb" }}>
                {selectedNode.name}
              </div>
              <div style={{ fontSize: "0.8rem", color: roleColor(selectedNode.role).text }}>
                {selectedNode.role} • {selectedNode.status.replace("_", " ")}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedId(null)}
            style={{ padding: "4px 12px", background: "#374151", border: "none", color: "#9ca3af", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
