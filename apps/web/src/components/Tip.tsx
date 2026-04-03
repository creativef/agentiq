import { ReactNode } from "react";

interface TipProps {
  children: ReactNode;
  text: string;
}

/**
 * Usage:
 *   <Tip text="This is what it does">Label ?</Tip>
 */
export default function Tip({ children, text }: TipProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
      {children}
      <span className="tooltip-trigger">
        ?
        <span className="tooltip-bubble">{text}</span>
      </span>
    </span>
  );
}
