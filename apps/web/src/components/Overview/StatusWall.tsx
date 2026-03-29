export default function StatusWall() {
  return (
    <div className="status-wall">
      <h2>Status Wall</h2>
      <div className="status-grid">
        <div className="card">Ops Agent · Active</div>
        <div className="card">Planner · Idle</div>
        <div className="card">Research · Active</div>
        <div className="card">QA · Busy</div>
      </div>
    </div>
  );
}
