import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { calendarEvents, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const calendar = new Hono();
calendar.use(authMiddleware);

// GET /calendar - list events for user's companies
calendar.get("/calendar", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      date: calendarEvents.date,
      time: calendarEvents.time,
      agenda: calendarEvents.agenda,
      createdAt: calendarEvents.createdAt,
    })
    .from(calendarEvents)
    .innerJoin(companyMembers, sql`${calendarEvents.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(calendarEvents.date);
  return c.json({ events: rows });
});

// POST /calendar - create calendar event
calendar.post("/calendar", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  const userCompanies = await db
    .select({ id: companyMembers.companyId })
    .from(companyMembers)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (userCompanies.length === 0) return c.json({ error: "No company" }, 400);

  const newEvent = await db.insert(calendarEvents).values({
    companyId: userCompanies[0].id,
    title: body.title || "Untitled",
    date: body.date || new Date().toISOString().split("T")[0],
    time: body.time || null,
    agenda: body.agenda || null,
  }).returning();

  return c.json({ event: newEvent[0] });
});

// DELETE /calendar/:id
calendar.delete("/calendar/:eventId", async (c) => {
  const eventId = c.req.param("eventId");
  const user: UserPayload = c.get("user");

  const eventCheck = await db
    .select({ companyId: calendarEvents.companyId })
    .from(calendarEvents)
    .where(sql`${calendarEvents.id} = ${eventId}`)
    .limit(1);
  if (eventCheck.length === 0) return c.json({ error: "Event not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${eventCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(calendarEvents).where(sql`${calendarEvents.id} = ${eventId}`);
  return c.json({ ok: true });
});
