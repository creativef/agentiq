import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const fb = this.props.fallback || (
        <div style={{
          padding: "3rem",
          background: "#450a0a",
          borderRadius: "12px",
          border: "1px solid #7f1d1d",
          textAlign: "center",
          margin: "2rem",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ color: "#fca5a5", marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: "1rem", padding: "8px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      );
      return fb;
    }
    return this.props.children;
  }
}
