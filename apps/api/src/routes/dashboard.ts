import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, companyMembers, agents, tasks, events, projects, goals } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

const dashboard = new Hono();
dashboard.use(authMiddleware);

dashboard.get("/companies", async (c) => {
  const user: UserPayload = c.get("user");
  const result = await db
    .select({ id: companies.id, name: companies.name, goal: companies.goal, role: companyMembers.role, createdAt: companies.createdAt })
    .from(companies).innerJoin(companyMembers, sql`${companies.id} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`);
  return c.json({ companies: result });
});

dashboard.post("/api/companies", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();
  const newComp = await db.insert(companies).values({ name: body.name, goal: body.goal || "Default Goal" }).returning();
  const companyId = newComp[0].id;
  await db.insert(companyMembers).values({ companyId, userId: user.userId, role: "OWNER" });
  const proj = await db.insert(projects).values({ companyId, name: "General Operations" }).returning();
  await db.insert(agents).values({ companyId, projectId: proj[0].id, name: "Ops Agent", role: "AGENT", status: "idle" }).returning();
  const result = await db.select({ id: companies.id, name: companies.name, goal: companies.goal, role: companyMembers.role }).from(companies).innerJoin(companyMembers, sql`${companies.id} = ${companyMembers.companyId}`).where(sql`${companies.id} = ${companyId}`).limit(1);
  return c.json({ company: result[0] });
});

dashboard.get("/api/companies/:companyId/dashboard", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");
  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const agentsList = await db.select({ id: agents.id, name: agents.name, role: agents.role, status: agents.status, lastHeartbeat: agents.lastHeartbeat }).from(agents).where(sql`${agents.companyId} = ${companyId}`);
  const taskStats = await db.select({ status: tasks.status, count: sql<number>`count(*)` }).from(tasks).where(sql`${tasks.projectId} IN (SELECT id FROM projects WHERE company_id = ${companyId})`).groupBy(tasks.status);
  const recentEvents = await db.select({ id: events.id, type: events.type, payload: events.payload, createdAt: events.createdAt }).from(events).where(sql`${events.companyId} = ${companyId}`).orderBy(sql`${events.createdAt} DESC`).limit(50);
  const goalList = await db.select({ id: goals.id, title: goals.title, progress: goals.progress }).from(goals).where(sql`${goals.companyId} = ${companyId}`);
  const totalTasks = taskStats.reduce((sum, t) => sum + t.count, 0);
  const completedTasks = taskStats.find(t => t.status === "done")?.count || 0;

  return c.json({
    company: { id: companyId },
    agents: agentsList,
    stats: { totalAgents: agentsList.length, activeAgents: agentsList.filter(a => a.status === "running").length, totalTasks, completedTasks, goalProgress: goalList.length > 0 ? goalList.reduce((sum, g) => sum + (g.progress || 0), 0) / goalList.length : 0 },
    timeline: recentEvents,
  });
});

export { dashboard };
