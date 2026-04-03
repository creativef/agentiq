import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { goals, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const goalsRouter = new Hono();
goalsRouter.use(authMiddleware);

// GET /goals - list goals for current user's companies
goalsRouter.get("/goals", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: goals.id,
      companyId: goals.companyId,
      title: goals.title,
      description: goals.description,
      parentId: goals.parentId,
      progress: goals.progress,
      createdAt: goals.createdAt,
    })
    .from(goals)
    .innerJoin(companyMembers, sql`${goals.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(goals.createdAt);
  return c.json({ goals: rows });
});

// GET /companies/:companyId/goals
goalsRouter.get("/companies/:companyId/goals", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const rows = await db
    .select()
    .from(goals)
    .where(sql`${goals.companyId} = ${companyId}`)
    .orderBy(goals.createdAt);
  return c.json({ goals: rows });
});

// POST /companies/:companyId/goals
goalsRouter.post("/companies/:companyId/goals", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const body = await c.req.json().catch(() => ({}));
  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    return c.json({ error: "Goal title is required" }, 400);
  }

  const newGoal = await db.insert(goals).values({
    companyId,
    title: body.title.trim(),
    description: body.description ?? null,
    parentId: body.parentId ?? null,
    progress: body.progress ?? 0,
  }).returning();

  return c.json({ goal: newGoal[0] });
});

// PUT /goals/:goalId
goalsRouter.put("/goals/:goalId", async (c) => {
  const goalId = c.req.param("goalId");
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const goalCheck = await db.select({ companyId: goals.companyId }).from(goals).where(sql`${goals.id} = ${goalId}`).limit(1);
  if (goalCheck.length === 0) return c.json({ error: "Goal not found" }, 404);

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${goalCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.update(goals).set({
    title: body.title,
    description: body.description,
    parentId: body.parentId,
    progress: body.progress !== undefined ? body.progress : undefined,
  }).where(sql`${goals.id} = ${goalId}`);

  return c.json({ ok: true });
});

// DELETE /goals/:goalId
goalsRouter.delete("/goals/:goalId", async (c) => {
  const goalId = c.req.param("goalId");
  const user: UserPayload = c.get("user");

  const goalCheck = await db.select({ companyId: goals.companyId }).from(goals).where(sql`${goals.id} = ${goalId}`).limit(1);
  if (goalCheck.length === 0) return c.json({ error: "Goal not found" }, 404);

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${goalCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(goals).where(sql`${goals.id} = ${goalId}`);
  return c.json({ ok: true });
});
