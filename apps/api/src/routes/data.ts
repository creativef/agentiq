import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, companyMembers, events } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const data = new Hono();
data.use(authMiddleware);

data.get("/companies", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({ id: companies.id, name: companies.name, goal: companies.goal })
    .from(companies)
    .innerJoin(companyMembers, sql`${companies.id} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`);
  return c.json(rows);
});

data.get("/events", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({ id: events.id, type: events.type, meta: events.meta, createdAt: events.createdAt })
    .from(events)
    .innerJoin(companyMembers, sql`${events.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(sql`${events.createdAt} DESC`)
    .limit(50);
  return c.json(rows);
});
