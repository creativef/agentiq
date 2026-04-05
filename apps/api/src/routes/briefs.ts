import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companyBriefs, companyMembers, agents, tasks, projects } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const briefRouter = new Hono();
briefRouter.use(authMiddleware);

// GET /companies/:id/brief
briefRouter.get("/companies/:companyId/brief", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const briefs = await db
    .select()
    .from(companyBriefs)
    .where(sql`${companyBriefs.companyId} = ${companyId}`)
    .orderBy(companyBriefs.createdAt);

  return c.json({ briefs });
});

// POST /companies/:id/brief
briefRouter.post("/companies/:companyId/brief", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.param("companyId");
  const body = await c.req.json();

  if (!body.vision || body.vision.trim().length === 0) {
    return c.json({ error: "vision is required" }, 400);
  }

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const brief = await db
    .insert(companyBriefs)
    .values({
      companyId,
      vision: body.vision.trim(),
      marketContext: body.marketContext || null,
      constraints: body.constraints || null,
      priorities: body.priorities ? JSON.stringify(body.priorities) : null,
      reportingCadence: body.reportingCadence || "daily",
      createdBy: user.userId,
      status: "active",
    })
    .returning();

  // BRIEF-TO-TASK: Find CEO agent and create a Strategy Task
  try {
    const ceoAgent = await db.select({ id: agents.id, projectId: agents.projectId })
      .from(agents)
      .where(sql`${agents.companyId} = ${companyId} AND UPPER(${agents.role}) = 'CEO'`)
      .limit(1);

    if (ceoAgent.length > 0) {
      // Find a valid project ID
      let targetProjectId = ceoAgent[0].projectId;
      if (!targetProjectId) {
        const proj = await db.select({ id: projects.id })
          .from(projects)
          .where(sql`${projects.companyId} = ${companyId}`)
          .limit(1);
        if (proj.length > 0) targetProjectId = proj[0].id;
      }

      if (targetProjectId) {
        await db.insert(tasks).values({
          projectId: targetProjectId,
          agentId: ceoAgent[0].id,
          title: "📋 Analyze Brief & Initialize Strategy",
          description: `The Founders have provided a new company brief:\\n\\n**Vision:** ${body.vision}\\n${body.marketContext ? `**Market Context:** ${body.marketContext}\\n` : ""}${body.constraints ? `**Constraints:** ${body.constraints}\\n` : ""}${body.priorities ? `**Priorities:** ${body.priorities}\\n` : ""}\\n\\nPlease analyze this brief, create necessary goals, hire any agents needed, and begin executing on this strategy.`,
          status: "ready",
          execStatus: "ready",
          priority: "high",
          assignedBy: user.userId,
        });
        console.log(`[Brief-to-Task] Created strategy task for CEO agent ${ceoAgent[0].id}`);
      }
    } else {
      console.log(`[Brief-to-Task] No CEO agent found to assign strategy task`);
    }
  } catch (e: any) {
    console.error("[Brief-to-Task] Failed to create strategy task:", e.message);
  }

  return c.json({ brief: brief[0], taskCreated: true });
});

// PUT /companies/:id/brief/:briefId
briefRouter.put("/companies/:companyId/brief/:briefId", async (c) => {
  const user: UserPayload = c.get("user");
  const briefId = c.req.param("briefId");
  const body = await c.req.json();

  const check = await db
    .select()
    .from(companyBriefs)
    .innerJoin(companyMembers, sql`${companyBriefs.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyBriefs.id} = ${briefId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  await db
    .update(companyBriefs)
    .set({
      vision: body.vision,
      marketContext: body.marketContext,
      constraints: body.constraints,
      priorities: body.priorities ? JSON.stringify(body.priorities) : null,
      reportingCadence: body.reportingCadence,
      status: body.status,
      updatedAt: new Date(),
    })
    .where(sql`${companyBriefs.id} = ${briefId}`);

  return c.json({ ok: true });
});
