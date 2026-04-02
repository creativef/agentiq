import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, companyMembers, agents, tasks, projects, events } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

const agentsRouter = new Hono();
agentsRouter.use(authMiddleware);

// GET /agents - list all agents for current user's companies
agentsRouter.get("/agents", async (c) => {
  const user: UserPayload = c.get("user");
  const result = await db
    .select({
      id: agents.id,
      name: agents.name,
      role: agents.role,
      status: agents.status,
      lastHeartbeat: agents.lastHeartbeat,
      costMonthly: agents.costMonthly,
      budgetLimit: agents.budgetLimit,
      companyName: companies.name,
      projectName: projects.name,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .innerJoin(companies, sql`${agents.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`${companyMembers.companyId} = ${companies.id}`)
    .leftJoin(projects, sql`${agents.projectId} = ${projects.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(companies.name, agents.name);
  return c.json({ agents: result });
});

// GET /companies/:companyId/agents
agentsRouter.get("/companies/:companyId/agents", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const agentsList = await db
    .select({
      id: agents.id,
      name: agents.name,
      role: agents.role,
      status: agents.status,
      lastHeartbeat: agents.lastHeartbeat,
      costMonthly: agents.costMonthly,
      budgetLimit: agents.budgetLimit,
      projectId: agents.projectId,
      createdAt: agents.createdAt,
      heartbeatInterval: agents.heartbeatInterval,
    })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId}`)
    .orderBy(agents.name);
  return c.json({ agents: agentsList });
});

// POST /companies/:companyId/agents - create agent
agentsRouter.post("/companies/:companyId/agents", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const body = await c.req.json();
  // Get first project for company if none provided
  const projResult = await db.select().from(projects).where(sql`${projects.companyId} = ${companyId}`).limit(1);
  const projectId = body.projectId || projResult[0]?.id || null;

  const newAgent = await db.insert(agents).values({
    companyId,
    projectId,
    name: body.name || "Agent",
    role: body.role || "AGENT",
    status: "idle",
    budgetLimit: body.budgetLimit || null,
    heartbeatInterval: body.heartbeatInterval || 3600,
  }).returning();

  return c.json({ agent: newAgent[0] });
});

// PUT /agents/:agentId
agentsRouter.put("/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const body = await c.req.json();
  // TODO: verify user has access to agent's company
  
  await db.update(agents).set({
    name: body.name,
    status: body.status,
    budgetLimit: body.budgetLimit,
    heartbeatInterval: body.heartbeatInterval,
  }).where(sql`${agents.id} = ${agentId}`);

  return c.json({ ok: true });
});

// DELETE /agents/:agentId
agentsRouter.delete("/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  await db.delete(agents).where(sql`${agents.id} = ${agentId}`);
  return c.json({ ok: true });
});

export { agentsRouter };
