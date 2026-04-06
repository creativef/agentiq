import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companyMembers, companies, agents, users, chatMessages, llmProviders } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { createLLMProvider, type LLMMessage } from "../llm/provider";

export const chatRouter = new Hono();
chatRouter.use(authMiddleware);

// GET /chat — list messages (per-agent only)
chatRouter.get("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const targetAgentId = c.req.query("agentId") || null;
  if (!targetAgentId) return c.json({ error: "agentId required" }, 400);

  const baseWhere = sql`(
    (${companyMembers.userId} = ${user.userId}) 
    AND (${chatMessages.companyId} = ${companyMembers.companyId})
    AND (${chatMessages.agentId} = ${targetAgentId})
  )`;

  const rows = await db
    .select({
      id: chatMessages.id,
      content: chatMessages.content,
      role: chatMessages.role,
      agentId: chatMessages.agentId,
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
    .limit(50);

  return c.json({ messages: rows });
});

// POST /chat — conversational LLM reply (per-agent only)
chatRouter.post("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const ip = c.req.header("x-forwarded-for") || "unknown";

  const rl = rateLimitMiddleware(ip);
  if (!rl.allowed) {
    return c.json({ error: `Too fast. Wait ${rl.retryAfter}s` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  if (!body.content || !body.companyId || !body.agentId) {
    return c.json({ error: "Missing content, companyId, or agentId" }, 400);
  }

  // Verify access
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${body.companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Verify agent
  const agentCheck = await db.select({ id: agents.id, name: agents.name, role: agents.role })
    .from(agents)
    .where(sql`${agents.id} = ${body.agentId} AND ${agents.companyId} = ${body.companyId}`)
    .limit(1);
  if (agentCheck.length === 0) return c.json({ error: "Target agent not found in this company" }, 404);

  // Save user message
  const msg = await db.insert(chatMessages).values({
    companyId: body.companyId,
    agentId: body.agentId,
    userId: user.userId,
    content: body.content,
    role: "user",
  }).returning();

  // Load active LLM provider
  const providerRow = await db.select().from(llmProviders)
    .where(sql`${llmProviders.companyId} = ${body.companyId} AND ${llmProviders.isActive} = true`)
    .limit(1);
  if (providerRow.length === 0) {
    return c.json({ error: "No active LLM provider for this company" }, 400);
  }
  const provider = createLLMProvider(providerRow[0]);

  // Build conversation context (last 20 messages)
  const historyRows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(sql`${chatMessages.companyId} = ${body.companyId} AND ${chatMessages.agentId} = ${body.agentId}`)
    .orderBy(chatMessages.createdAt)
    .limit(20);

  const systemPrompt = `You are ${agentCheck[0].name} (${agentCheck[0].role}). This is a direct chat with a human. Be concise and helpful. Do not execute tasks. If the user asks you to do work, ask them to click "Assign Task" instead.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyRows.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const response = await provider.chat(messages);
  const reply = await db.insert(chatMessages).values({
    companyId: body.companyId,
    agentId: body.agentId,
    userId: null,
    content: response.content,
    role: "agent",
  }).returning();

  return c.json({ message: msg[0], reply: reply[0] });
});
