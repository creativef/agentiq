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

  const ceos = people.filter(p => p.role === "CEO");
  const managers = people.filter(p => p.role === "MANAGER");
  const agents = people.filter(p => p.role === "AGENT");

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  const renderPerson = (p: Person) => (
    <div key={p.id} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", textAlign: "center", minWidth: "150px" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "1.5rem" }}>&#128101;</div>
      <div style={{ fontWeight: "bold", marginTop: "8px" }}>{p.name}</div>
      <div style={{ fontSize: "0.8rem", color: "#3b82f6" }}>{p.role}</div>
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
          {/* CEO level */}
          {ceos.length > 0 && (
            <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
              {ceos.map(renderPerson)}
            </div>
          )}

          {/* Arrow */}
          {(ceos.length > 0 || managers.length > 0) && (
            <div style={{ width: "1px", height: "32px", background: "#4B5563" }} />
          )}

          {/* Manager level */}
          {managers.length > 0 && (
            <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
              {managers.map(renderPerson)}
            </div>
          )}

          {/* Divider */}
          {(managers.length > 0 || ceos.length > 0) && agents.length > 0 && (
            <div style={{ width: "1px", height: "32px", background: "#4B5563" }} />
          )}

          {/* Agent level */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
            {agents.map(renderPerson)}
          </div>
        </div>
      )}
    </div>
  );
}
