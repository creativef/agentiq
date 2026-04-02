import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tasks, agents, projects, companyMembers, companies } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

const tasksRouter = new Hono();
tasksRouter.use(authMiddleware);

// GET /tasks - all tasks for current user's companies
tasksRouter.get("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const result = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      agentName: agents.name,
      projectName: projects.name,
      companyId: projects.companyId,
      agentId: tasks.agentId,
      projectId: tasks.projectId,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(agents, sql`${tasks.agentId} = ${agents.id}`)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .innerJoin(companies, sql`${projects.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`${companyMembers.companyId} = ${companies.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(tasks.createdAt);
  return c.json({ tasks: result });
});

// POST /tasks
tasksRouter.post("/tasks", async (c) => {
  const body = await c.req.json();
  const newTask = await db.insert(tasks).values({
    projectId: body.projectId,
    agentId: body.agentId || null,
    title: body.title,
    description: body.description || null,
    status: body.status || "backlog",
    priority: body.priority || "medium",
  }).returning();
  return c.json({ task: newTask[0] });
});

// PUT /tasks/:id
tasksRouter.put("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  await db.update(tasks).set({
    status: body.status,
    priority: body.priority,
    title: body.title,
    description: body.description,
    agentId: body.agentId,
  }).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// DELETE /tasks/:id
tasksRouter.delete("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  await db.delete(tasks).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

export { tasksRouter };
