import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { chatMessages, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const chat = new Hono();
chat.use(authMiddleware);

// GET /chat - list messages for user's companies
chat.get("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(companyMembers, sql`${chatMessages.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(chatMessages.createdAt);
  return c.json({ messages: rows });
});

// POST /chat - send message
chat.post("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  const userCompanies = await db
    .select({ id: companyMembers.companyId })
    .from(companyMembers)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (userCompanies.length === 0) return c.json({ error: "No company" }, 400);

  const newMsg = await db.insert(chatMessages).values({
    companyId: userCompanies[0].id,
    userId: user.userId,
    role: "user",
    content: body.content || "",
  }).returning();

  return c.json({ message: newMsg[0] });
});

// DELETE /chat/:id
chat.delete("/chat/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const user: UserPayload = c.get("user");

  const msgCheck = await db
    .select({ companyId: chatMessages.companyId })
    .from(chatMessages)
    .where(sql`${chatMessages.id} = ${messageId}`)
    .limit(1);
  if (msgCheck.length === 0) return c.json({ error: "Message not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${msgCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(chatMessages).where(sql`${chatMessages.id} = ${messageId}`);
  return c.json({ ok: true });
});
