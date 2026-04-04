import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, companyMembers, agents, tasks, events, projects, goals, users, skills, agentSkills as agentSkillsTable } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

const dashboard = new Hono();
dashboard.use(authMiddleware);

// GET /companies - list all companies for current user
dashboard.get("/companies", async (c) => {
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

// POST /companies - create a new company (supports basic and wizard payload)
dashboard.post("/companies", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return c.json({ error: "Company name is required" }, 400);
  }
  if (body.name.length > 200) {
    return c.json({ error: "Company name too long (max 200 chars)" }, 400);
  }

  const name = body.name.trim();
  const goal = (body.goal || body.description) && typeof (body.goal || body.description) === "string"
    ? (body.goal || body.description)
    : "Building something amazing";

  // Support new wizard payload with projects[] and agents[]
  const projectNames: string[] = body.projects?.filter((p: string) => p.trim())
    .map((p: string) => p.trim()) || [];
  const agentDefs: { name: string; role: string }[] = body.agents || [];

  const newComp = await db.insert(companies).values({ name, goal }).returning();
  const companyId = newComp[0].id;

  await db.transaction(async (tx) => {
    // 1. Add Owner
    await tx.insert(companyMembers).values({ companyId, userId: user.userId, role: "OWNER" });

    // 2. Create projects
    const createdProjectIds: string[] = [];
    if (projectNames.length > 0) {
      for (const projName of projectNames) {
        const proj = await tx.insert(projects).values({ companyId, name: projName }).returning();
        createdProjectIds.push(proj[0].id);
      }
    } else {
      const proj = await tx.insert(projects).values({ companyId, name: "General Operations" }).returning();
      createdProjectIds.push(proj[0].id);
    }

    // 3. Create agents with reporting hierarchy (only if agents provided)
    const firstProjectId = createdProjectIds[0];
    if (agentDefs && agentDefs.length > 0) {
      const createdAgentsMap = new Map();
      // Pass 1: Insert base agent records
      for (const agentDef of agentDefs) {
        const agent = await tx.insert(agents).values({
          companyId,
          projectId: firstProjectId,
          name: agentDef.name || "Agent",
          role: agentDef.role || "AGENT",
          status: "idle",
        }).returning();
        createdAgentsMap.set(agentDef.name, agent[0].id); // Track for reportsTo
      }

      // Pass 2: Assign reportsTo if provided
      for (const agentDef of agentDefs) {
        if ((agentDef as any).reportsTo) {
          const managerId = createdAgentsMap.get((agentDef as any).reportsTo);
          const thisAgentId = createdAgentsMap.get(agentDef.name);
          if (managerId && thisAgentId) {
            await tx.update(agents).set({ reportsTo: managerId }).where(sql`${agents.id} = ${thisAgentId}`);
          }
        }
      }
    } else {
      // Fallback: Default Founder agent
      await tx.insert(agents).values({
        companyId,
        projectId: firstProjectId,
        name: "Founder",
        role: "FOUNDER",
        status: "idle",
      });
    }
  });

  return c.json({ company: { id: companyId, name, goal, role: "OWNER", projectCount: projectNames.length || 1 } });
});

// GET /companies/:id/dashboard - overview for a specific company
dashboard.get("/companies/:companyId/dashboard", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const agentsList = await db
    .select({ id: agents.id, name: agents.name, role: agents.role, status: agents.status, lastHeartbeat: agents.lastHeartbeat })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId}`);

  const taskStats = await db
    .select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks)
    .where(sql`${tasks.projectId} IN (SELECT id FROM projects WHERE company_id = ${companyId})`)
    .groupBy(tasks.status);

  const recentEvents = await db
    .select({ id: events.id, type: events.type, meta: events.meta, createdAt: events.createdAt })
    .from(events)
    .where(sql`${events.companyId} = ${companyId}`)
    .orderBy(sql`${events.createdAt} DESC`)
    .limit(50);

  const goalList = await db
    .select({ id: goals.id, title: goals.title, progress: goals.progress })
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
      goalProgress: goalList.length > 0 ? goalList.reduce((sum, g) => sum + (g.progress || 0), 0) / goalList.length : 0,
    },
    timeline: recentEvents,
  });
});

// PUT /companies/:id - update company info
dashboard.put("/companies/:companyId", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const body = await c.req.json();
  await db.update(companies)
    .set({
      name: body.name,
      goal: body.goal,
    })
    .where(sql`${companies.id} = ${companyId}`);

  return c.json({ ok: true });
});

// GET /companies/:id/members - list members with user info
dashboard.get("/companies/:companyId/members", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const members = await db
    .select({
      id: users.id,
      email: users.email,
      role: companyMembers.role,
      createdAt: companyMembers.createdAt,
    })
    .from(companyMembers)
    .innerJoin(users, sql`${companyMembers.userId} = ${users.id}`)
    .where(sql`${companyMembers.companyId} = ${companyId}`);

  return c.json({ members });
});

// POST /companies/:companyId/members — add a member to a company
dashboard.post("/companies/:companyId/members", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");

  // Verify requester is already a member
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const body = await c.req.json().catch(() => ({}));
  if (!body.email) return c.json({ error: "Email is required" }, 400);

  // Find existing user by email
  const existing = await db.select().from(users).where(sql`${users.email} = ${body.email}`).limit(1);
  if (existing.length === 0) {
    return c.json({ error: "User not found. They need to register first." }, 404);
  }

  // Check if already a member
  const alreadyMember = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${existing[0].id}`)
    .limit(1);
  if (alreadyMember.length > 0) return c.json({ error: "Already a member" }, 400);

  const result = await db.insert(companyMembers).values({
    companyId,
    userId: existing[0].id,
    role: body.role || "CEO",
  }).returning();

  return c.json({ member: { userId: existing[0].id, email: existing[0].email, role: body.role || "CEO" } });
});

export { dashboard };
