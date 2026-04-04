import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { calendarEvents, companyMembers, agents } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const calendarRouter = new Hono();
calendarRouter.use(authMiddleware);

// GET /calendar - list events for user's companies, optionally scoped by month
calendarRouter.get("/calendar", async (c) => {
  const user: UserPayload = c.get("user");
  const month = c.req.query("month"); // optional: YYYY-MM

  // Build base where clause - only events from user's companies
  const baseWhere = sql`calendar_events.company_id IN (
    SELECT company_id FROM company_members WHERE user_id = ${user.userId}
  )`;

  let query = db
    .select({
      id: calendarEvents.id,
      companyId: calendarEvents.companyId,
      projectId: calendarEvents.projectId,
      agentId: calendarEvents.agentId,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      allDay: calendarEvents.allDay,
      type: calendarEvents.type,
      createdAt: calendarEvents.createdAt,
    })
    .from(calendarEvents)
    .where(baseWhere)
    .orderBy(calendarEvents.startTime);

  if (month) {
    const startDt = `${month}-01`;
    const endMonth = new Date(new Date(startDt).getFullYear(), new Date(startDt).getMonth() + 1, 1).toISOString().slice(0, 10);
    query = query.where(sql`${calendarEvents.startTime} >= ${startDt} AND ${calendarEvents.startTime} < ${endMonth}`);
  }

  const events = await query;

  // Enrich with agent names
  const agentIds = events.map(e => e.agentId).filter(Boolean);
  if (agentIds.length > 0) {
    const agentRows = await db.select({ id: agents.id, name: agents.name }).from(agents).where(sql`${agents.id} IN ${agentIds}`);
    const agentMap = new Map(agentRows.map(a => [a.id, a.name]));
    const enriched = events.map(e => ({
      ...e,
      agentName: e.agentId ? agentMap.get(e.agentId) || null : null,
    }));
    return c.json({ events: enriched });
  }

  return c.json({ events: events.map(e => ({ ...e, agentName: null })) });
});

// POST /calendar - create event
calendarRouter.post("/calendar", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  if (!body.companyId || !body.title || !body.startTime) {
    return c.json({ error: "companyId, title, and startTime are required" }, 400);
  }

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${body.companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const event = await db.insert(calendarEvents).values({
    companyId: body.companyId,
    projectId: body.projectId || null,
    agentId: body.agentId || null,
    title: body.title,
    description: body.description || null,
    startTime: new Date(body.startTime),
    endTime: body.endTime ? new Date(body.endTime) : null,
    allDay: body.allDay || false,
    type: body.type || "meeting",
  }).returning();

  return c.json({ event: event[0] });
});

// PUT /calendar/:id - update event
calendarRouter.put("/calendar/:eventId", async (c) => {
  const eventId = c.req.param("eventId");
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const check = await db.select({ companyId: calendarEvents.companyId }).from(calendarEvents).where(sql`${calendarEvents.id} = ${eventId}`).limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const updates: any = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.startTime) updates.startTime = new Date(body.startTime);
  if (body.endTime) updates.endTime = new Date(body.endTime);
  if (body.allDay !== undefined) updates.allDay = body.allDay;
  if (body.type !== undefined) updates.type = body.type;
  if (body.agentId !== undefined) updates.agentId = body.agentId || null;

  await db.update(calendarEvents).set(updates).where(sql`${calendarEvents.id} = ${eventId}`);
  return c.json({ ok: true });
});

// DELETE /calendar/:id - delete event
calendarRouter.delete("/calendar/:eventId", async (c) => {
  const eventId = c.req.param("eventId");
  const user: UserPayload = c.get("user");

  const check = await db.select({ companyId: calendarEvents.companyId }).from(calendarEvents).where(sql`${calendarEvents.id} = ${eventId}`).limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(calendarEvents).where(sql`${calendarEvents.id} = ${eventId}`);
  return c.json({ ok: true });
});
