import { useState, useRef, useEffect, ReactNode } from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const posStyles: Record<string, React.CSSProperties> = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
  };

  return (
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: "absolute",
            ...posStyles[position],
            background: "#1f2937",
            color: "#e5e7eb",
            fontSize: "0.75rem",
            lineHeight: "1.4",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #374151",
            zIndex: 200,
            whiteSpace: "normal",
            maxWidth: "280px",
            minWidth: "150px",
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
