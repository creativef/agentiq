import { Hono } from "hono";
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import auth from "./routes/auth";
import { dashboard } from "./routes/dashboard";
import { agentsRouter } from "./routes/agents";
import { tasksRouter } from "./routes/tasks";
import { calendarRouter } from "./routes/calendar";
import { agentLogsRouter } from "./routes/agentLogs";
import { chatRouter } from "./routes/chat";
import { filesRouter } from "./routes/files";
import { journal } from "./routes/journal";
import { realtime } from "./routes/realtime";
import { data } from "./routes/data";
import { connectorsRouter } from "./routes/connectors";
import { goalsRouter } from "./routes/goals";
import { projectsRouter } from "./routes/projects";
import { auditMiddleware } from "./middleware/audit-log";
import { skillsRouter } from "./routes/skills";

export const app = new Hono();

app.use('*', logger())
// Audit logging for mutations (POST/PUT/DELETE)
app.use('/api/*', auditMiddleware);

app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))

app.get("/health", (c) => c.json({ ok: true }));

// Public
app.route("/api", auth);
app.route("/api", dashboard);
app.route("/api", agentsRouter);
app.route("/api", tasksRouter);
app.route("/api", calendarRouter);
app.route("/api", agentLogsRouter);
app.route("/api", chatRouter);
app.route("/api", filesRouter);
app.route("/api", journal);
app.route("/api", realtime);
app.route("/api", data);
app.route("/api", connectorsRouter);
app.route("/api", goalsRouter);
app.route("/api", skillsRouter);
app.route("/api", projectsRouter);

app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

app.onError((err, c) => {
  console.error("SERVER ERROR:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});
