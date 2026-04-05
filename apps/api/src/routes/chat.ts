import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { chatMessages, companyMembers, companies, agents, users, tasks } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { logAgentActivity } from "../utils/agentLogger";

export const chatRouter = new Hono();
chatRouter.use(authMiddleware);

// GET /chat — list messages with pagination
chatRouter.get("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const targetAgentId = c.req.query("agentId") || null;
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");

  const companyId = c.req.query("companyId");

  const baseWhere = sql`
    ${companyMembers.companyId} = ${companies.id}
    AND ${companyMembers.userId} = ${user.userId}
    ${targetAgentId ? sql`AND (${chatMessages.agentId} = ${targetAgentId} OR ${chatMessages.agentId} IS NULL)` : sql`AND ${chatMessages.agentId} IS NULL`}
    ${companyId ? sql`AND ${chatMessages.companyId} = ${companyId}` : sql``}
  `;

  const rows = await db
    .select({
      id: chatMessages.id,
      content: chatMessages.content,
      role: chatMessages.role,
      agentId: chatMessages.agentId,
      userId: chatMessages.userId,
      createdAt: chatMessages.createdAt,
      agentName: agents.name,
      userEmail: users.email,
    })
    .from(chatMessages)
    .leftJoin(agents, sql`${chatMessages.agentId} = ${agents.id}`)
    .leftJoin(companies, sql`${chatMessages.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, baseWhere)
    .leftJoin(users, sql`${chatMessages.userId} = ${users.id}`)
    .orderBy(chatMessages.createdAt)
    .limit(limit)
    .offset(offset);

  const count = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatMessages)
    .leftJoin(companies, sql`${chatMessages.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`
      ${companyMembers.companyId} = ${companies.id}
      AND ${companyMembers.userId} = ${user.userId}
      ${targetAgentId ? sql`AND (${chatMessages.agentId} = ${targetAgentId} OR ${chatMessages.agentId} IS NULL)` : sql`AND ${chatMessages.agentId} IS NULL`}
    `)
    .limit(1);

  const total = count[0]?.count || 0;
  const hasMore = (offset + limit) < total;

  return c.json({ messages: rows, hasMore, total });
});

// POST /chat — send a message
chatRouter.post("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  if (!body.content || !body.companyId) {
    return c.json({ error: "content and companyId required" }, 400);
  }

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${body.companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Priority 4: Rate limiting
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const rl = rateLimitMiddleware(ip);
  if (!rl.allowed) {
    return c.json({ success: false, error: `Too many messages. Try again in ${rl.retryAfter}s` }, 429);
  }

  const msg = await db.insert(chatMessages).values({
    companyId: body.companyId,
    agentId: body.agentId || null,
    userId: user.userId,
    content: body.content,
    role: "user",
  }).returning();

  // Priority 1: Chat-to-Task Integration
  // If it's a DM to an agent, auto-create a task for that agent
  if (body.agentId) {
    try {
      const preview = body.content.length > 50
        ? `${body.content.substring(0, 50)}...`
        : body.content;

      const newTask = await db.insert(tasks).values({
        title: `Chat: ${preview}`,
        description: `Message from chat: "${body.content}"`,
        status: "backlog",
        execStatus: "ready",
        agentId: body.agentId,
        projectId: body.projectId || null,
        assignedBy: user.userId,
      }).returning();

      // Log it so the CEO sees the interaction in activity feed
      await db.execute(sql.raw(`
        INSERT INTO agent_logs (agent_id, task_id, level, message)
        VALUES ('${body.agentId}'::uuid, '${newTask[0].id}'::uuid, 'info', 'New chat message received.')
      `));

      return c.json({ message: msg[0], taskId: newTask[0].id, taskCreated: true });
    } catch (e) {
      console.error("Chat→Task creation failed:", e);
    }
  }

  return c.json({ message: msg[0], taskCreated: false });
});

// DELETE /chat/:messageId
chatRouter.delete("/chat/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const user: UserPayload = c.get("user");

  const msgCheck = await db
    .select({ companyId: chatMessages.companyId })
    .from(chatMessages)
    .leftJoin(companies, sql`${chatMessages.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`
      ${companyMembers.companyId} = ${companies.id}
      AND ${companyMembers.userId} = ${user.userId}
    `)
    .where(sql`${chatMessages.id} = ${messageId}`)
    .limit(1);

  if (msgCheck.length === 0) return c.json({ error: "Not found or unauthorized" }, 404);

  await db.delete(chatMessages).where(sql`${chatMessages.id} = ${messageId}`);
  return c.json({ ok: true });
});
