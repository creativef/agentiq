import { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
      }}
      onClick={onClose}
    >
      <div
        className={sizeMap[size] || sizeMap.md}
        style={{
          width: "90%",
          background: "#1f2937",
          borderRadius: "12px",
          border: "1px solid #374151",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid #374151" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0 }}>{title}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "1.2rem", cursor: "pointer", padding: "4px 8px", borderRadius: "4px" }}>✕</button>
          </div>
        )}
        <div style={{ overflow: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
