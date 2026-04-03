import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { projects, agents, tasks, events, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

const projectsRouter = new Hono();
projectsRouter.use(authMiddleware);

// GET /companies/:companyId/projects
projectsRouter.get("/companies/:companyId/projects", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const rows = await db.select({
    id: projects.id,
    name: projects.name,
    createdAt: projects.createdAt,
  }).from(projects).where(sql`${projects.companyId} = ${companyId}`);

  return c.json({ projects: rows });
});

// POST /companies/:companyId/projects
projectsRouter.post("/companies/:companyId/projects", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const body = await c.req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return c.json({ error: "Project name is required" }, 400);
  }

  const newProject = await db.insert(projects).values({
    companyId,
    name: body.name.trim(),
  }).returning();

  return c.json({ project: newProject[0] });
});

// PUT /projects/:projectId
projectsRouter.put("/projects/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const projCheck = await db.select({ companyId: projects.companyId }).from(projects).where(sql`${projects.id} = ${projectId}`).limit(1);
  if (projCheck.length === 0) return c.json({ error: "Project not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${projCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.update(projects).set({ name: body.name || undefined }).where(sql`${projects.id} = ${projectId}`);
  return c.json({ ok: true });
});

// DELETE /projects/:projectId
projectsRouter.delete("/projects/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const user: UserPayload = c.get("user");

  const projCheck = await db.select({ companyId: projects.companyId }).from(projects).where(sql`${projects.id} = ${projectId}`).limit(1);
  if (projCheck.length === 0) return c.json({ error: "Project not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${projCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(projects).where(sql`${projects.id} = ${projectId}`);
  return c.json({ ok: true });
});

// GET /projects/:projectId/stats
projectsRouter.get("/projects/:projectId/stats", async (c) => {
  const projectId = c.req.param("projectId");
  const user: UserPayload = c.get("user");

  const projCheck = await db.select({ companyId: projects.companyId }).from(projects).where(sql`${projects.id} = ${projectId}`).limit(1);
  if (projCheck.length === 0) return c.json({ error: "Not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${projCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const agentCount = await db.select({ count: sql<number>`count(*)` }).from(agents).where(sql`${agents.projectId} = ${projectId}`);
  const taskStats = await db.select({ status: tasks.status, count: sql<number>`count(*)` }).from(tasks).where(sql`${tasks.projectId} = ${projectId}`).groupBy(tasks.status);
  const eventCount = await db.select({ count: sql<number>`count(*)` }).from(events).where(sql`${events.projectId} = ${projectId}`);

  return c.json({
    agents: agentCount[0].count,
    tasks: taskStats.reduce((sum, t) => sum + t.count, 0),
    tasksByStatus: taskStats,
    events: eventCount[0].count,
  });
});

export { projectsRouter };
