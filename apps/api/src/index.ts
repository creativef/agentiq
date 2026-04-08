import { Hono } from "hono";
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import auth from "./routes/auth";
import { dashboard } from "./routes/dashboard";
import { agentsRouter } from "./routes/agents";
import { tasksRouter } from "./routes/tasks";
import { calendarRouter } from "./routes/calendar";
import { agentLogsRouter } from "./routes/agentLogs";
import { llmRouter } from "./routes/llm";
import { briefRouter } from "./routes/briefs";
import { chatRouter } from "./routes/chat";
import { filesRouter } from "./routes/files";
import { journal } from "./routes/journal";
import { realtime } from "./routes/realtime";
import { data } from "./routes/data";
import { connectorsRouter } from "./routes/connectors";
import { goalsRouter } from "./routes/goals";
import { projectsRouter } from "./routes/projects";
import { executionsRouter } from "./routes/executions";
import { auditMiddleware } from "./middleware/audit-log";
// DEPRECATED: Hermes manages skills, not AgentIQ
// import { skillsRouter } from "./routes/skills";

export const app = new Hono();

app.use('*', logger())
// Audit logging for mutations (POST/PUT/DELETE)
app.use('/api/*', auditMiddleware);

app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))



app.get("/health", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "healthy", database: "connected", timestamp: Date.now() });
  } catch (e) {
    return c.json({ status: "error", database: "disconnected" }, 503);
  }
});

// Public
app.route("/api", auth);
app.route("/api", dashboard);
app.route("/api", agentsRouter);
app.route("/api", tasksRouter);
app.route("/api", calendarRouter);
app.route("/api", agentLogsRouter);
app.route("/api", llmRouter);
app.route("/api", briefRouter);
app.route("/api", chatRouter);
app.route("/api", filesRouter);
app.route("/api", journal);
app.route("/api", realtime);
app.route("/api", data);
app.route("/api", connectorsRouter);
app.route("/api", goalsRouter);
// DEPRECATED: Hermes manages skills, not AgentIQ
// app.route("/api", skillsRouter);
app.route("/api", projectsRouter);
app.route("/api", executionsRouter);

app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

app.onError((err, c) => {
  console.error("SERVER ERROR:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});
