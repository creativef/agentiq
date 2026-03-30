import { useEffect, useState } from "react";
import { getEvents } from "../../lib/api";

export default function CompanyPanel() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    getEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  const last = events[0];

  return (
    <aside className="card company-panel">
      <h2>Company Goal</h2>
      <div className="progress">OKR Progress</div>
      <h3>Org Snapshot</h3>
      <div className="label">Headcount</div>
      <div className="label">Last Event</div>
      {last ? <div>{last.type}</div> : <div>No events yet</div>}
    </aside>
  );
}
