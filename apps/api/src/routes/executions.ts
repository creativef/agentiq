import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { executionRuns, executionEvents, tasks, agents, companyMembers, projects } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { enqueueExecution, recordExecutionEvent, recordExecutionResult } from "../execution/dispatcher";

export const executionsRouter = new Hono();

executionsRouter.post("/executions", authMiddleware, async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  if (!body.taskId) return c.json({ error: "taskId is required" }, 400);

  const taskRow = await db.select({ id: tasks.id, projectId: tasks.projectId, agentId: tasks.agentId })
    .from(tasks).where(sql`${tasks.id} = ${body.taskId}`).limit(1);
  if (taskRow.length === 0) return c.json({ error: "Task not found" }, 404);

  const projectRow = await db.select({ companyId: projects.companyId })
    .from(projects).where(sql`${projects.id} = ${taskRow[0].projectId}`).limit(1);
  if (projectRow.length === 0) return c.json({ error: "Project not found" }, 404);

  const access = await db.select().from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${projectRow[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const run = await enqueueExecution({
    taskId: body.taskId,
    agentId: taskRow[0].agentId,
    companyId: projectRow[0].companyId,
    payload: body.payload || null,
  });

  return c.json({ run });
});

function verifyHermesToken(c: any): boolean {
  const required = process.env.HERMES_INGEST_TOKEN;
  if (!required) return true;
  const auth = c.req.header("Authorization") || "";
  return auth === `Bearer ${required}`;
}

executionsRouter.post("/executions/:runId/events", async (c) => {
  if (!verifyHermesToken(c)) return c.json({ error: "Unauthorized" }, 401);
  const runId = c.req.param("runId");
  const body = await c.req.json().catch(() => ({}));
  if (!body.message) return c.json({ error: "message is required" }, 400);

  await recordExecutionEvent({
    runId,
    level: body.level || "info",
    message: body.message,
    meta: body.meta || null,
  });

  return c.json({ ok: true });
});

executionsRouter.post("/executions/:runId/result", async (c) => {
  if (!verifyHermesToken(c)) return c.json({ error: "Unauthorized" }, 401);
  const runId = c.req.param("runId");
  const body = await c.req.json().catch(() => ({}));
  const status = body.status === "completed" ? "completed" : "failed";

  await recordExecutionResult({
    runId,
    status,
    result: body.result || null,
    error: body.error || null,
  });

  return c.json({ ok: true });
});
