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
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, pass);
        setSuccess("Logged in!");
      } else {
        await register(email, pass, company);
        setSuccess("Registered and logged in!");
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
        
        {error && <div style={{ padding: "8px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "4px", marginBottom: "8px", color: "#fca5a5" }}>
          {error}
        </div>}
        
        {success && <div style={{ padding: "8px", background: "#052e16", border: "1px solid #166534", borderRadius: "4px", marginBottom: "8px", color: "#86efac" }}>
          {success}
        </div>}
        
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={{ width: "100%", padding: "8px", marginBottom: "8px", background: "#333", border: "1px solid #555", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
        />
        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder="Password"
          required
          style={{ width: "100%", padding: "8px", marginBottom: "8px", background: "#333", border: "1px solid #555", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
        />
        
        {mode === "register" && (
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Company Name (optional)"
            style={{ width: "100%", padding: "8px", marginBottom: "8px", background: "#333", border: "1px solid #555", borderRadius: "4px", color: "white", boxSizing: "border-box" }}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "10px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: loading ? "wait" : "pointer", fontWeight: "bold" }}
        >
          {loading ? "Please wait..." : (mode === "login" ? "Login" : "Register")}
        </button>

        <p
          style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", cursor: "pointer", color: "#93c5fd" }}
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }}
        >
          {mode === "login" ? "New? Create account" : "Back to login"}
        </p>
      </form>
    </div>
  );
}
