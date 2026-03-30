import { useEffect, useState } from "react";
import { getCompanies } from "../lib/api";

export default function Sidebar() {
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    getCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  return (
    <aside className="sidebar">
      <h2>Companies</h2>
      {companies.length === 0 ? (
        <div>No companies yet</div>
      ) : (
        companies.map((c) => <div key={c.id}>{c.name}</div>)
      )}
      <h3>Projects</h3>
      <div>Mission Control Project</div>
      <h3>Agents</h3>
      <div>Ops Agent</div>
    </aside>
  );
}
