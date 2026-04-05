import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, companyMembers, agents, tasks, projects, events, agentSkills } from "../db/schema";
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
  const projectId = c.req.query("projectId") || null;
  const user: UserPayload = c.get("user");
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  let query = db
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
      platform: agents.platform,
      reportsTo: agents.reportsTo,
    })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId}`);

  if (projectId) {
    query = query.where(sql`${agents.projectId} = ${projectId}`);
  }

  query = query.orderBy(agents.name);
  const agentsList = await query;
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

  const result = await db.insert(agents).values({
    companyId,
    projectId,
    name: body.name || "Agent",
    role: body.role || "AGENT",
    status: "idle",
    budgetLimit: body.budgetLimit || null,
    heartbeatInterval: body.heartbeatInterval || 3600,
    reportsTo: body.reportsTo || null,
  }).returning();

  // Assign skills if provided
  if (body.skillIds && Array.isArray(body.skillIds) && body.skillIds.length > 0) {
    for (const skillId of body.skillIds) {
      try {
        await db.insert(agentSkills).values({
          agentId: result[0].id,
          skillId,
        });
      } catch {
        // Skip invalid skill IDs
      }
    }
  }

  return c.json({ agent: result[0] });
});

// PUT /agents/:agentId
agentsRouter.put("/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  // Verify user has access to agent's company
  const agentCheck = await db
    .select({ companyId: agents.companyId })
    .from(agents)
    .where(sql`${agents.id} = ${agentId}`)
    .limit(1);
  if (agentCheck.length === 0) {
    return c.json({ error: "Agent not found" }, 404);
  }
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);
  
  await db.update(agents).set({
    name: body.name,
    status: body.status,
    budgetLimit: body.budgetLimit,
    heartbeatInterval: body.heartbeatInterval,
    reportsTo: body.reportsTo !== undefined ? body.reportsTo : undefined,
  }).where(sql`${agents.id} = ${agentId}`);

  return c.json({ ok: true });
});

// DELETE /agents/:agentId
agentsRouter.delete("/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const user: UserPayload = c.get("user");

  // Verify user has access to agent's company
  const agentCheck = await db
    .select({ companyId: agents.companyId })
    .from(agents)
    .where(sql`${agents.id} = ${agentId}`)
    .limit(1);
  if (agentCheck.length === 0) {
    return c.json({ error: "Agent not found" }, 404);
  }
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(agents).where(sql`${agents.id} = ${agentId}`);
  return c.json({ ok: true });
});

// GET /companies/:companyId/tree — hierarchical org chart
agentsRouter.get("/companies/:companyId/tree", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      role: agents.role,
      status: agents.status,
      reportsTo: agents.reportsTo,
    })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId}`);

  // Build tree: group by reportsTo
  const agentMap = new Map();
  const roots = [];

  for (const a of allAgents) {
    agentMap.set(a.id, { ...a, children: [] });
  }
  for (const a of allAgents) {
    const node = agentMap.get(a.id);
    if (a.reportsTo && agentMap.has(a.reportsTo)) {
      agentMap.get(a.reportsTo).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return c.json({ tree: roots, all: agentMap });
});

export { agentsRouter };
