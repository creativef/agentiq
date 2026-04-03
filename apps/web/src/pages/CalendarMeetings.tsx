import { useState, useEffect, FormEvent } from "react";

export default function CalendarMeetings() {
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [form, setForm] = useState({ title: "", date: "", time: "", agenda: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calendar", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setEvents(d?.events || []))
      .catch(console.error)
      .finally(() => setLoading(false));
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

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) return;
    const res = await fetch("/api/calendar", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ title: "", date: "", time: "", agenda: "" });
      window.location.reload();
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Calendar & Meetings</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>+ Add Event</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            <input autoFocus required placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
          </div>
          <textarea placeholder="Agenda" value={form.agenda} onChange={e => setForm({...form, agenda: e.target.value})} style={{ width: "100%", marginTop: "0.5rem", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", minHeight: "60px", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" style={{ padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Save</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "6px 16px", background: "#374151", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ background: "#1f2937", borderRadius: "8px", padding: "1rem", border: "1px solid #374151" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <button onClick={prev} style={{ background: "#374151", border: "none", color: "white", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>&lt;&lt;</button>
          <span style={{ fontWeight: "bold" }}>{monthName}</span>
          <button onClick={next} style={{ background: "#374151", border: "none", color: "white", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>&gt;&gt;</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            // Check if there are events on this day
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter((ev: any) => ev.date === dateStr);
            return (
              <div key={day} style={{
                padding: "8px",
                background: isToday ? "#3b82f6" : dayEvents.length > 0 ? "#1e3a5f" : "#374151",
                borderRadius: "4px",
                textAlign: "center",
                fontWeight: isToday ? "bold" : "normal",
                color: isToday ? "white" : "inherit",
                minHeight: "36px",
              }}>
                {day}
                {dayEvents.length > 0 && (
                  <div style={{ fontSize: "0.6rem", color: "#60a5fa", marginTop: "2px" }}>{dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
