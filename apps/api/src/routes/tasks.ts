import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tasks, agents, projects, companyMembers, companies } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const tasksRouter = new Hono();
tasksRouter.use(authMiddleware);

// GET /tasks
tasksRouter.get("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const projectId = c.req.query("projectId") || null;

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

  // Sort by execution status priority: pending_approval > scheduled > ready > running > others
  const statusOrder = { pending_approval: 0, scheduled: 1, ready: 2, executing: 3, idle: 4, completed: 5, failed: 6 };
  rows.sort((a, b) => (statusOrder[a.execStatus as keyof typeof statusOrder] ?? 99) - (statusOrder[b.execStatus as keyof typeof statusOrder] ?? 99));

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

// GET /tasks/approvals
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
    `);

  return c.json({ approvals: rows });
});

// POST /tasks
tasksRouter.post("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

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

  if (!approvalStatus && !body.scheduledAt) {
    execStatus = "ready";
    await db.update(tasks).set({ execStatus }).where(sql`${tasks.id} = ${newTask[0].id}`);
  }

  return c.json({ task: newTask[0] });
});

// POST /tasks/:id/approve - Approve a pending task
tasksRouter.post("/tasks/:taskId/approve", async (c) => {
  const taskId = c.req.param("taskId");
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
    status: "blocked",
  }).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// POST /tasks/:taskId/execute
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
    if (titleLower.includes("hire") || titleLower.includes("create agent") || titleLower.includes("found")) {
      const roleMatch = titleLower.match(/(?:hire|create|found)\s+(?:a|an|the)?\s*([\w\s]+)/i);
      if (roleMatch) {
        let roleName = roleMatch[1].trim().toUpperCase();
        if (roleName.includes("AGENT")) roleName = "AGENT";
        else if (roleName.includes("CEO")) roleName = "CEO";
        else if (roleName.includes("MANAGER")) roleName = "MANAGER";
        else if (roleName.includes("CTO")) roleName = "CTO";
        else if (roleName.includes("CFO")) roleName = "CFO";

        const agentName = `${roleName.charAt(0) + roleName.slice(1).toLowerCase()}`;
        
        // Safely fetch companyId
        const projCheck = await db.select({ companyId: projects.companyId })
          .from(projects)
          .where(sql`${projects.id} = ${task.projectId}`)
          .limit(1);
          
        if (projCheck.length === 0) throw new Error("Project ID is invalid, cannot determine Company.");

        // Create Agent dynamically
        const newAgent = await db.insert(agents).values({
          companyId: projCheck[0].companyId,
          projectId: task.projectId,
          name: agentName,
          role: roleName,
          status: "idle",
        }).returning();

        resultText = `✅ Success! Hired "${agentName}" as ${roleName}. They are now added to the Org Chat and ready for work.`;
      } else {
        resultText = "❌ Failed. I couldn't understand which role to hire. (e.g., 'Hire CTO')";
        success = false;
      }
    } else {
      resultText = `✅ Task completed. (Placeholder: Real agent execution logic would run here).`;
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

// DELETE /tasks/:id
tasksRouter.delete("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  await db.delete(tasks).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});
