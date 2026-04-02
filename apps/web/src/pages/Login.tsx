import { useState, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, pass);
      } else {
        await register(email, pass, company);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#111" }}>
      <form onSubmit={handleSubmit} style={{ padding: "2rem", background: "#222", borderRadius: "8px", width: "320px", color: "white" }}>
        <h2 style={{ textAlign: "center" }}>Mission Control</h2>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={{ width: "100%", padding: "8px", marginBottom: "8px", background: "#333", border: "none", color: "white" }} />
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" required style={{ width: "100%", padding: "8px", marginBottom: "8px", background: "#333", border: "none", color: "white" }} />
        
        {mode === "register" && (
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company Name (optional)" style={{ width: "100%", padding: "8px", marginBottom: "8px", background: "#333", border: "none", color: "white" }} />
        )}

        <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>
          {loading ? "..." : (mode === "login" ? "Login" : "Register")}
        </button>

        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", cursor: "pointer" }} onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New? Create account" : "Back to login"}
        </p>
      </form>
    </div>
  );
}
