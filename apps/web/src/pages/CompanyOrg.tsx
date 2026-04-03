import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Person {
  id: string;
  name: string;
  role: string;
  status: string;
}

export default function CompanyOrg() {
  const { company } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/companies/${company.id}/agents`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setPeople(d.agents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  const founders = people.filter(p => p.role === "FOUNDER");
  const ceos = people.filter(p => p.role === "CEO");
  const managers = people.filter(p => p.role === "MANAGER");
  const agents = people.filter(p => p.role === "AGENT");

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  const renderPerson = (p: Person) => (
    <div key={p.id} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: p.role === "FOUNDER" ? "2px solid #f59e0b" : "1px solid #374151", textAlign: "center", minWidth: "150px" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: p.role === "FOUNDER" ? "#f59e0b" : "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "1.5rem" }}>&#128101;</div>
      <div style={{ fontWeight: "bold", marginTop: "8px" }}>{p.name}</div>
      <div style={{ fontSize: "0.8rem", color: p.role === "FOUNDER" ? "#f59e0b" : "#3b82f6" }}>
        {p.role === "FOUNDER" ? "Founder" : p.role === "CEO" ? "CEO" : p.role === "MANAGER" ? "Manager" : "Agent"}
      </div>
      <div style={{ fontSize: "0.7rem", color: "#22c55e", textTransform: "capitalize", marginTop: "2px" }}>{p.status}</div>
    </div>
  );

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Org Chart{ company ? ` — ${company.name}` : "" }</h1>

      {people.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>&#127970;</div>
          <p>No organization members yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
          {/* Founder level */}
          {founders.length > 0 && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", textAlign: "center" }}>Founder</div>
              <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
                {founders.map(renderPerson)}
              </div>
            </div>
          )}

          {/* Arrow */}
          {(founders.length > 0 || ceos.length > 0) && (
            <div style={{ fontSize: "1.5rem", color: "#6b7280" }}>&#10095;</div>
          )}

          {/* CEO level */}
          {ceos.length > 0 && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", textAlign: "center" }}>Chief Executive</div>
              <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
                {ceos.map(renderPerson)}
              </div>
            </div>
          )}

          {/* Arrow */}
          {(ceos.length > 0 || founders.length > 0) && managers.length > 0 && (
            <div style={{ fontSize: "1.5rem", color: "#6b7280" }}>&#10095;</div>
          )}

          {/* Manager level */}
          {managers.length > 0 && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", textAlign: "center" }}>Managers</div>
              <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
                {managers.map(renderPerson)}
              </div>
            </div>
          )}

          {/* Arrow */}
          {(managers.length > 0 || ceos.length > 0) && agents.length > 0 && (
            <div style={{ fontSize: "1.5rem", color: "#6b7280" }}>&#10095;</div>
          )}

          {/* Agent level */}
          {agents.length > 0 && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", textAlign: "center" }}>Agents</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
                {agents.map(renderPerson)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
