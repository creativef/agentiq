import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { journalEntries, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const journal = new Hono();
journal.use(authMiddleware);

// GET /journal - list entries for user's companies
journal.get("/journal", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: journalEntries.id,
      content: journalEntries.content,
      createdAt: journalEntries.createdAt,
    })
    .from(journalEntries)
    .innerJoin(companyMembers, sql`${journalEntries.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(journalEntries.createdAt);
  return c.json({ entries: rows });
});

// POST /journal - create entry
journal.post("/journal", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  const userCompanies = await db
    .select({ id: companyMembers.companyId })
    .from(companyMembers)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (userCompanies.length === 0) return c.json({ error: "No company" }, 400);

  const newEntry = await db.insert(journalEntries).values({
    companyId: userCompanies[0].id,
    userId: user.userId,
    content: body.content || "",
  }).returning();

  return c.json({ entry: newEntry[0] });
});

// DELETE /journal/:id
journal.delete("/journal/:entryId", async (c) => {
  const entryId = c.req.param("entryId");
  const user: UserPayload = c.get("user");

  const entryCheck = await db
    .select({ companyId: journalEntries.companyId })
    .from(journalEntries)
    .where(sql`${journalEntries.id} = ${entryId}`)
    .limit(1);
  if (entryCheck.length === 0) return c.json({ error: "Entry not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${entryCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(journalEntries).where(sql`${journalEntries.id} = ${entryId}`);
  return c.json({ ok: true });
});
