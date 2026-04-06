import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tasks, agents, projects, companyMembers, companies } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { executeTaskById } from "../task-execution";

// ============================================================
// REAL EXECUTION ENGINE
// ============================================================

// ============================================================
// ROUTERS
// ============================================================

export const tasksRouter = new Hono();
tasksRouter.use(authMiddleware);

// GET /tasks
tasksRouter.get("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const projectId = c.req.query("projectId") || null;
  const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);

  const baseQuery = db
    .select({
      id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status,
      priority: tasks.priority, agentId: tasks.agentId, projectId: tasks.projectId, createdAt: tasks.createdAt,
      execStatus: tasks.execStatus, approvalStatus: tasks.approvalStatus, approverRole: tasks.approverRole,
      result: tasks.result, assignedBy: tasks.assignedBy,
    })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .innerJoin(companies, sql`${projects.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`${companyMembers.companyId} = ${companies.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .limit(limit)
    .orderBy(tasks.createdAt);

  let rows = await baseQuery;
  if (projectId) rows = rows.filter((t) => t.projectId === projectId);

  const statusOrder = { pending_approval: 0, scheduled: 1, ready: 2, executing: 3, idle: 4, completed: 5, failed: 6 };
  rows.sort((a, b) => (statusOrder[a.execStatus as keyof typeof statusOrder] ?? 99) - (statusOrder[b.execStatus as keyof typeof statusOrder] ?? 99));

  const agentIds = rows.map((t) => t.agentId).filter(Boolean);
  if (agentIds.length > 0) {
    const agentList = await db.select({ id: agents.id, name: agents.name }).from(agents).where(sql`${agents.id} IN ${agentIds}`);
    const agentMap = new Map(agentList.map((a) => [a.id, a.name]));
    rows = rows.map((t) => ({ ...t, agentName: agentMap.get(t.agentId!) || null }));
  } else {
    rows = rows.map((t) => ({ ...t, agentName: null }));
  }

  return c.json({ tasks: rows });
});

// GET /tasks/approvals
tasksRouter.get("/tasks/approvals", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, agentId: tasks.agentId, projectId: tasks.projectId, approverRole: tasks.approverRole, createdAt: tasks.createdAt })
    .from(tasks)
    .leftJoin(agents, sql`${tasks.agentId} = ${agents.id}`)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .leftJoin(companyMembers, sql`${projects.companyId} = ${companyMembers.companyId}`)
    .where(sql`${tasks.approvalStatus} = 'pending' AND ${companyMembers.userId} = ${user.userId}`);
  return c.json({ approvals: rows });
});

// POST /tasks
tasksRouter.post("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();
  let execStatus = "idle";
  let approvalStatus: string | null = null;
  let taskStatus = "backlog";

  if (body.scheduledAt) { execStatus = "scheduled"; taskStatus = "ready"; }
  if (body.requiresApproval || body.approverRole) { approvalStatus = "pending"; execStatus = "pending_approval"; }

  const newTask = await db.insert(tasks).values({
    projectId: body.projectId, agentId: body.agentId || null, title: body.title,
    description: body.description || null, status: taskStatus, priority: body.priority || "medium",
    execStatus, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    approverRole: body.approverRole || null, approvalStatus, assignedBy: user.userId,
    scratchpad: body.scratchpad || null,
  }).returning();

  if (!approvalStatus && !body.scheduledAt) {
    await db.update(tasks).set({ execStatus: "ready" }).where(sql`${tasks.id} = ${newTask[0].id}`);
  }
  return c.json({ task: newTask[0] });
});

// POST /tasks/:taskId/approve
tasksRouter.post("/tasks/:taskId/approve", async (c) => {
  const taskId = c.req.param("taskId");
  await db.update(tasks).set({ approvalStatus: "approved", execStatus: "ready" }).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// POST /tasks/:taskId/reject
tasksRouter.post("/tasks/:taskId/reject", async (c) => {
  const taskId = c.req.param("taskId");
  await db.update(tasks).set({ approvalStatus: "rejected", execStatus: "failed", status: "blocked" }).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// POST /tasks/:taskId/execute
tasksRouter.post("/tasks/:taskId/execute", async (c) => {
  const taskId = c.req.param("taskId");
  const taskCheck = await db.select().from(tasks).where(sql`${tasks.id} = ${taskId}`).limit(1);
  if (taskCheck.length === 0) return c.json({ error: "Task not found" }, 404);

  try {
    const result = await executeTaskById(taskId);
    return c.json({ success: result.success, steps: result.steps, result: result.result });
  } catch (e: any) {
    return c.json({ success: false, result: `Crashed: ${e.message}` }, 500);
  }
});

// PUT /tasks/:taskId
tasksRouter.put("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const updates: any = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.agentId !== undefined) updates.agentId = body.agentId || null;
  if (body.scheduledAt !== undefined) updates.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.execStatus !== undefined) updates.execStatus = body.execStatus;

  await db.update(tasks).set(updates).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// DELETE /tasks/:taskId
tasksRouter.delete("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  await db.delete(tasks).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});
