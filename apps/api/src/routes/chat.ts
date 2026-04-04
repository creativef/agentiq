import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { chatMessages, companyMembers, companies, agents } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const chatRouter = new Hono();
chatRouter.use(authMiddleware);

// GET /chat — list messages for the current user's companies
// GET /chat — list messages for the current user's companies
chatRouter.get("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const targetAgentId = c.req.query("agentId") || null; // Filter by DM
  const limit = parseInt(c.req.query("limit") || "50");

  const baseWhere = targetAgentId
    ? sql`(
        (${companyMembers.userId} = ${user.userId}) 
        AND (${chatMessages.companyId} = ${companyMembers.companyId})
        AND (${chatMessages.agentId} = ${targetAgentId} OR ${chatMessages.agentId} IS NULL)
      )`
    : sql`(
        (${companyMembers.userId} = ${user.userId}) 
        AND (${chatMessages.companyId} = ${companyMembers.companyId})
        AND (${chatMessages.agentId} IS NULL)
      )`;

  const rows = await db
    .select({
      id: chatMessages.id,
      content: chatMessages.content,
      role: chatMessages.role,
      agentId: chatMessages.agentId,
      userId: chatMessages.userId,
      createdAt: chatMessages.createdAt,
      agentName: agents.name,
      userEmail: sql<string>`users.email`,
    })
    .from(chatMessages)
    .leftJoin(agents, sql`${chatMessages.agentId} = ${agents.id}`)
    .leftJoin(companies, sql`${chatMessages.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, baseWhere)
    .leftJoin(sql`users`, sql`${chatMessages.userId} = ${sql`users`}.id`)
    .orderBy(chatMessages.createdAt)
    .limit(limit);

  return c.json({ messages: rows, targetAgentId });
});

// POST /chat — send a message
chatRouter.post("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  if (!body.content || !body.companyId) {
    return c.json({ error: "content and companyId required" }, 400);
  }

  // Verify access
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${body.companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // If agentId is provided, we route it as a DM.
  // If 'agentId' is 'ALL', we leave it null for a broadcast message.
  const targetAgentId = body.agentId === "ALL" ? null : (body.agentId || null);

  const msg = await db.insert(chatMessages).values({
    companyId: body.companyId,
    agentId: targetAgentId,
    userId: user.userId,
    content: body.content,
    role: "user",
  }).returning();

  return c.json({ message: msg[0] });
});

// DELETE /chat/:messageId
chatRouter.delete("/chat/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const user: UserPayload = c.get("user");

  // Ensure the user owns or has access to the company of this message
  const msgCheck = await db
    .select({ companyId: chatMessages.companyId })
    .from(chatMessages)
    .leftJoin(companies, sql`${chatMessages.companyId} = ${companies.id}`)
    .leftJoin(companyMembers, sql`${companyMembers.companyId} = ${companies.id}`)
    .where(sql`${chatMessages.id} = ${messageId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);

  if (msgCheck.length === 0) return c.json({ error: "Not found or unauthorized" }, 404);

  await db.delete(chatMessages).where(sql`${chatMessages.id} = ${messageId}`);
  return c.json({ ok: true });
});
