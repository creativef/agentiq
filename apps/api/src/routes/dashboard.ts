import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, companyMembers, agents, tasks, events, projects, goals } from "../db/schema";
import { authMiddleware, JWT_SECRET } from "../middleware/auth";
import { getCookie } from "hono/cookie";
import { verify } from "hono/utils/jwt/jwt";
import { UserPayload } from "../middleware/auth";
import postgres from "postgres";

const dashboard = new Hono();
dashboard.use(authMiddleware);

// Get all companies for current user
dashboard.get("/api/companies", async (c) => {
  const user: UserPayload = c.get("user");
  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
      goal: companies.goal,
      role: companyMembers.role,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .innerJoin(companyMembers, sql`${companies.id} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`);
  
  return c.json({ companies: result });
});

// Create new company
dashboard.post("/api/companies", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();
  
  const newComp = await db.insert(companies).values({ 
    name: body.name, 
    goal: body.goal || "Default Goal" 
  }).returning();
  
  const companyId = newComp[0].id;
  
  // Link member
  await db.insert(companyMembers).values({ companyId, userId: user.userId, role: "OWNER" });
  
  // Seed default project & agent
  const proj = await db.insert(projects).values({ companyId, name: "General Operations" }).returning();
  const projId = proj[0].id;
  
  await db.insert(agents).values({ 
    companyId, 
    projectId: projId, 
    name: "Ops Agent", 
    role: "AGENT",
    status: "idle" 
  }).returning();
  
  // Get the company with member info
  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
      goal: companies.goal,
      role: companyMembers.role,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .innerJoin(companyMembers, sql`${companies.id} = ${companyMembers.companyId}`)
    .where(sql`${companies.id} = ${companyId}`)
    .limit(1);
  
  return c.json({ company: result[0] });
});

// Dashboard overview for a specific company
dashboard.get("/api/companies/:companyId/dashboard", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");
  
  // Verify user has access
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  
  if (access.length === 0) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  // Get agents count and status
  const agentsList = await db
    .select({
      id: agents.id,
      name: agents.name,
      role: agents.role,
      status: agents.status,
      lastHeartbeat: agents.lastHeartbeat,
    })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId}`);
  
  // Get task stats
  const taskStats = await db
    .select({
      status: tasks.status,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(sql`${tasks.projectId} IN (SELECT id FROM projects WHERE company_id = ${companyId})`)
    .groupBy(tasks.status);
  
  // Get recent events (timeline)
  const recentEvents = await db
    .select({
      id: events.id,
      type: events.type,
      payload: events.payload,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(sql`${events.companyId} = ${companyId}`)
    .orderBy(sql`${events.createdAt} DESC`)
    .limit(50);
  
  // Get goals
  const goals = await db
    .select({
      id: goals.id,
      title: goals.title,
      progress: goals.progress,
    })
    .from(goals)
    .where(sql`${goals.companyId} = ${companyId}`);
  
  const totalTasks = taskStats.reduce((sum, t) => sum + t.count, 0);
  const completedTasks = taskStats.find(t => t.status === "done")?.count || 0;
  
  return c.json({
    company: { id: companyId },
    agents: agentsList,
    stats: {
      totalAgents: agentsList.length,
      activeAgents: agentsList.filter(a => a.status === "running").length,
      totalTasks,
      completedTasks,
      goalProgress: goals.length > 0 ? goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length : 0,
    },
    timeline: recentEvents,
  });
});

export { dashboard };
