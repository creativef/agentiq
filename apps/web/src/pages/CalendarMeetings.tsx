import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  allDay: boolean;
  type: string;
  agentName: string | null;
}

export default function CalendarMeetings() {
  const { company, project } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    endTime: "",
    description: "",
    type: "meeting",
    allDay: false,
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const fetchEvents = () => {
    if (!company) return;
    fetch(`/api/calendar?month=${monthKey}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setEvents(d?.events || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, [company, monthKey]);
  useEffect(() => {
    if (!form.date) {
      const today = new Date();
      setForm(prev => ({
        ...prev,
        date: today.toISOString().slice(0, 10),
      }));
    }
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !form.title || !form.date) return;
    const start = new Date(`${form.date}T${form.time || '12:00:00'}`);
    const end = form.endTime
      ? new Date(`${form.date}T${form.endTime}`)
      : form.allDay
        ? null
        : new Date(start.getTime() + 3600000); // default 1hr
    const res = await fetch("/api/calendar", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        projectId: project?.id || null,
        title: form.title,
        description: form.description || null,
        startTime: start.toISOString(),
        endTime: end?.toISOString() || null,
        allDay: form.allDay,
        type: form.type,
      }),
    });
    if (res.ok) {
      setForm({ title: "", date: "", time: "", endTime: "", description: "", type: "meeting", allDay: false });
      setShowForm(false);
      fetchEvents();
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/calendar/${eventId}`, { method: "DELETE", credentials: "include" });
    fetchEvents();
  };

  const prev = () => setCurrentMonth(new Date(year, month - 1));
  const next = () => setCurrentMonth(new Date(year, month + 1));

  const today = new Date();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Calendar</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>+ Add Event</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px", border: "1px solid #374151", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem" }}>
            <input autoFocus required placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }} />
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{ padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white" }}>
              <option value="meeting">Meeting</option>
              <option value="reminder">Reminder</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={form.allDay} onChange={e => setForm({...form, allDay: e.target.checked})} /> All day
            </label>
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ width: "100%", marginTop: "0.5rem", padding: "8px", background: "#374151", border: "1px solid #4B5563", borderRadius: "4px", color: "white", minHeight: "50px", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" style={{ padding: "6px 16px", background: "#22c55e", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Create</button>
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
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter(ev => ev.startTime?.startsWith(dateStr));
            return (
              <div key={day} style={{
                padding: "6px",
                background: isToday ? "#3b82f6" : "#374151",
                borderRadius: "4px",
                textAlign: "center",
                fontWeight: isToday ? "bold" : "normal",
                color: isToday ? "white" : "inherit",
                minHeight: "50px",
                position: "relative",
              }}>
                {day}
                {dayEvents.length > 0 && (
                  <>
                    <div style={{ fontSize: "0.6rem", color: "#60a5fa", marginTop: "2px" }}>{dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}</div>
                    <div style={{ fontSize: "0.55rem", color: "#d1d5db", marginTop: "2px" }}>
                      {dayEvents.map(ev => (
                        <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 2px" }}>
                          <span title={ev.title}>{ev.allDay ? '📅' : '🕐'} {ev.title.substring(0, 10)}</span>
                          <button onClick={() => handleDelete(ev.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.55rem", padding: "0 2px" }}>×</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
