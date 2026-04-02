import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function OpsDashboard() {
  const { company, companies } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [company]);

  return <div style={{ padding: "1.5rem" }}><h1>Operations Dashboard</h1><p>Using the main Dashboard page now.</p></div>;
}
