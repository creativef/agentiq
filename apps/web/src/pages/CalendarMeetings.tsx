import { useState, useEffect } from "react";

export default function CalendarMeetings() {
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [form, setForm] = useState({ title: "", date: "", time: "", agenda: "" });

  useEffect(() => {
    fetch("/api/calendar", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setEvents(d?.events || []))
      .catch(() => {});
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const prev = () => setCurrentMonth(new Date(year, month - 1));
  const next = () => setCurrentMonth(new Date(year, month + 1));

  const today = new Date();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Calendar & Meetings</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>+ Add Event</button>
      </div>

      {showForm && (
        <form onSubmit={e => e.preventDefault()} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            <input autoFocus placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
          </div>
          <textarea placeholder="Agenda" value={form.agenda} onChange={e => setForm({...form, agenda: e.target.value})} style={{ width: "100%", marginTop: "0.5rem", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", minHeight: "60px", boxSizing: "border-box" }} />
          <button type="submit" style={{ marginTop: "0.5rem", padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Save</button>
        </form>
      )}

      <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
        {/* Month navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <button onClick={prev} style={{ background: "#374151", border: "none", color: "white", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>{"<<"}</button>
          <span style={{ fontWeight: "bold" }}>{monthName}</span>
          <button onClick={next} style={{ background: "#374151", border: "none", color: "white", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>{">>"}</button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return (
              <div key={day} style={{ padding: "8px", background: isToday ? "#3b82f6" : "#374151", borderRadius: "4px", textAlign: "center", fontWeight: isToday ? "bold" : "normal", color: isToday ? "white" : "inherit" }}>
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
