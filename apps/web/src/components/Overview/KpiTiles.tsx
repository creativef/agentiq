export default function KpiTiles() {
  return (
    <div className="kpi-grid">
      <div className="card">
        <div className="label">Live Agents</div>
        <div className="value">12</div>
      </div>
      <div className="card">
        <div className="label">Active Tasks</div>
        <div className="value">34</div>
      </div>
      <div className="card">
        <div className="label">SLA Health</div>
        <div className="value">98%</div>
      </div>
      <div className="card">
        <div className="label">Spend Rate</div>
        <div className="value">$1.2k/hr</div>
      </div>
    </div>
  );
}
