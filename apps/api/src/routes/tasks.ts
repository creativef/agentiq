import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tasks, agents, projects, companyMembers, companies, events as eventsTable } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const tasksRouter = new Hono();
tasksRouter.use(authMiddleware);

// GET /tasks - list tasks, with approvals filter
tasksRouter.get("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const projectId = c.req.query("projectId") || null;
  const status = c.req.query("status") || null;

  const baseQuery = db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      agentId: tasks.agentId,
      projectId: tasks.projectId,
      createdAt: tasks.createdAt,
      execStatus: tasks.execStatus,
      approvalStatus: tasks.approvalStatus,
      approverRole: tasks.approverRole,
      result: tasks.result,
    })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .innerJoin(companies, sql`${projects.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`${companyMembers.companyId} = ${companies.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`);

  let rows = await baseQuery;

  if (projectId) rows = rows.filter((t) => t.projectId === projectId);
  if (status) rows = rows.filter((t) => t.status === status);

  // Enrich with agent names
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

// GET /tasks/approvals - tasks pending approval for user
tasksRouter.get("/tasks/approvals", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      agentId: tasks.agentId,
      projectId: tasks.projectId,
      approverRole: tasks.approverRole,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(agents, sql`${tasks.agentId} = ${agents.id}`)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .leftJoin(companyMembers, sql`${projects.companyId} = ${companyMembers.companyId}`)
    .where(sql`
      ${tasks.approvalStatus} = 'pending' 
      AND ${companyMembers.userId} = ${user.userId}
      AND (tasks.approver_role = company_members.role OR tasks.approver_role IS NULL)
    `);

  return c.json({ approvals: rows });
});

// POST /tasks
tasksRouter.post("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  // Determine initial status
  let execStatus = "idle";
  let approvalStatus = null;
  let taskStatus = "backlog";

  if (body.scheduledAt) {
    execStatus = "scheduled";
    taskStatus = "ready";
  }
  if (body.requiresApproval || body.approverRole) {
    approvalStatus = "pending";
    execStatus = "pending_approval";
  }

  const newTask = await db
    .insert(tasks)
    .values({
      projectId: body.projectId,
      agentId: body.agentId || null,
      title: body.title,
      description: body.description || null,
      status: taskStatus,
      priority: body.priority || "medium",
      execStatus,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      approverRole: body.approverRole || null,
      approvalStatus,
      assignedBy: user.userId,
    })
    .returning();

  // If no approval needed and no schedule, mark ready to run
  if (!approvalStatus && !body.scheduledAt) {
    execStatus = "ready";
    await db.update(tasks).set({ execStatus }).where(sql`${tasks.id} = ${newTask[0].id}`);
  }

  return c.json({ task: newTask[0] });
});

// PUT /tasks/:id
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

// POST /tasks/:id/approve - Approve a pending task
tasksRouter.post("/tasks/:taskId/approve", async (c) => {
  const taskId = c.req.param("taskId");
  const user: UserPayload = c.get("user");

  // TODO Verify user has approver role (simple pass for now)
  await db.update(tasks).set({
    approvalStatus: "approved",
    execStatus: "ready",
  }).where(sql`${tasks.id} = ${taskId}`);

  return c.json({ ok: true });
});

// POST /tasks/:id/reject - Reject a pending task
tasksRouter.post("/tasks/:taskId/reject", async (c) => {
  const taskId = c.req.param("taskId");
  await db.update(tasks).set({
    approvalStatus: "rejected",
    execStatus: "failed",
  }).where(sql`${tasks.id} = ${taskId}`);

  return c.json({ ok: true });
});

// POST /tasks/:taskId/execute - Run the task via execution engine
tasksRouter.post("/tasks/:taskId/execute", async (c) => {
  const taskId = c.req.param("taskId");
  
  const taskCheck = await db.select().from(tasks).where(sql`${tasks.id} = ${taskId}`).limit(1);
  if (taskCheck.length === 0) return c.json({ error: "Task not found" }, 404);

  const task = taskCheck[0];

  // 1. Set to Executing
  await db.update(tasks).set({ execStatus: "executing" }).where(sql`${tasks.id} = ${taskId}`);

  let resultText = "";
  let success = true;

  try {
    // 2. Simple Execution Logic Heuristics
    const titleLower = task.title.toLowerCase();

    // Case: "Hire [Role]" or "Create [Role] Agent"
    if (titleLower.includes("hire") || titleLower.includes("create agent")) {
      const roleMatch = titleLower.match(/(?:hire|create)\s+(?:a|an|the)?\s*(\w+)/i);
      if (roleMatch) {
        const role = roleMatch[1].toUpperCase();
        const agentName = `${role.charAt(0) + role.slice(1)} Agent`;
        const newAgent = await db.insert(agents).values({
          companyId: await sql`SELECT company_id FROM projects WHERE id = ${task.projectId}`, // Suboptimal, simplify later
          projectId: task.projectId,
          name: agentName,
          role: role === "CEO" ? "CEO" : role === "CTO" ? "CTO" : "AGENT",
          status: "idle",
          createdAt: new Date(),
        }).returning();

        resultText = `Created new agent "${agentName}" (ID: ${newAgent[0].id}).`;
      } else {
        resultText = "Could not determine which agent role to create based on title.";
        success = false;
      }
    } else {
      // Default simulation
      resultText = `Task completed. (Placeholder: Real agent execution logic would hook in here).`;
    }

    // 3. Finish
    await db.update(tasks).set({
      execStatus: success ? "completed" : "failed",
      status: success ? "done" : "blocked",
      result: resultText,
    }).where(sql`${tasks.id} = ${taskId}`);

  } catch (e: any) {
    await db.update(tasks).set({
      execStatus: "failed",
      status: "blocked",
      result: `Execution Error: ${e.message}`,
    }).where(sql`${tasks.id} = ${taskId}`);
    success = false;
  }

  return c.json({ success, result: resultText });
});

// DELETE /tasks/:id
tasksRouter.delete("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  await db.delete(tasks).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});
