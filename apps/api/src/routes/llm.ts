import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { llmProviders, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { createLLMProvider, type LLMMessage } from "../llm/provider";

export const llmRouter = new Hono();
llmRouter.use(authMiddleware);

// GET /llm/providers - list all configured providers
llmRouter.get("/llm/providers", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: llmProviders.id,
      companyId: llmProviders.companyId,
      name: llmProviders.name,
      provider: llmProviders.provider,
      model: llmProviders.model,
      baseUrl: llmProviders.baseUrl,
      maxTokens: llmProviders.maxTokens,
      temperature: llmProviders.temperature,
      isActive: llmProviders.isActive,
      priority: llmProviders.priority,
      lastUsed: llmProviders.lastUsed,
      createdAt: llmProviders.createdAt,
    })
    .from(llmProviders)
    .innerJoin(companyMembers, sql`${llmProviders.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`);

  // Hide API key from response (masked)
  const masked = rows.map((r) => ({
    ...r,
    apiKey: null, // Never send keys to frontend
  }));

  return c.json({ providers: masked });
});

// POST /llm/providers - add a new LLM provider
llmRouter.post("/llm/providers", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  if (!body.companyId || !body.provider || !body.model) {
    return c.json({ error: "companyId, provider, and model are required" }, 400);
  }

  // Verify access
  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${body.companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // If this is set as active, deactivate all others
  if (body.isActive) {
    await db
      .update(llmProviders)
      .set({ isActive: false })
      .where(sql`${llmProviders.companyId} = ${body.companyId}`);
  }

  const newProvider = await db
    .insert(llmProviders)
    .values({
      companyId: body.companyId,
      name: body.name || `${body.provider} (${body.model})`,
      provider: body.provider, // openai, anthropic, openai-compatible, ollama, local
      model: body.model,
      baseUrl: body.baseUrl || null,
      apiKey: body.apiKey || null,
      maxTokens: body.maxTokens || 4000,
      temperature: body.temperature ?? 0.3,
      isActive: body.isActive ?? false,
      priority: body.priority || 0,
    })
    .returning();

  return c.json({ provider: newProvider[0] });
});

// PUT /llm/providers/:id
llmRouter.put("/llm/providers/:providerId", async (c) => {
  const user: UserPayload = c.get("user");
  const providerId = c.req.param("providerId");
  const body = await c.req.json();

  // Verify access
  const check = await db
    .select({ companyId: llmProviders.companyId })
    .from(llmProviders)
    .innerJoin(companyMembers, sql`${llmProviders.companyId} = ${companyMembers.companyId}`)
    .where(sql`${llmProviders.id} = ${providerId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  // If activating, deactivate others in same company
  if (body.isActive === true) {
    await db
      .update(llmProviders)
      .set({ isActive: false })
      .where(sql`${llmProviders.companyId} = ${check[0].companyId}`);
  }

  await db
    .update(llmProviders)
    .set({
      name: body.name,
      model: body.model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      isActive: body.isActive,
      priority: body.priority,
    })
    .where(sql`${llmProviders.id} = ${providerId}`);

  return c.json({ ok: true });
});

// DELETE /llm/providers/:id
llmRouter.delete("/llm/providers/:providerId", async (c) => {
  const user: UserPayload = c.get("user");
  const providerId = c.req.param("providerId");

  const check = await db
    .select()
    .from(llmProviders)
    .innerJoin(companyMembers, sql`${llmProviders.companyId} = ${companyMembers.companyId}`)
    .where(sql`${llmProviders.id} = ${providerId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  await db.delete(llmProviders).where(sql`${llmProviders.id} = ${providerId}`);
  return c.json({ ok: true });
});

// POST /llm/test - test a provider connection
llmRouter.post("/llm/test", async (c) => {
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const rl = rateLimitMiddleware(ip);
  if (!rl.allowed) {
    return c.json({ success: false, error: `Too many requests. Try again in ${rl.retryAfter}s` }, 429);
  }

  const body = await c.req.json();

  if (!body.provider || !body.model) {
    return c.json({ error: "provider and model required" }, 400);
  }

  try {
    const provider = createLLMProvider({
      id: "test",
      provider: body.provider,
      model: body.model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });

    const messages: LLMMessage[] = [
      { role: "system", content: "You are a test. Reply with exactly: CONNECTION OK" },
      { role: "user", content: "Test connection" },
    ];

    const start = Date.now();
    const result = await provider.chat(messages);
    const latency = Date.now() - start;

    const success = result.content.includes("CONNECTION OK");

    return c.json({
      success,
      latency,
      content: result.content,
      usage: result.usage,
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /llm/active/:companyId - get the active provider for a company
llmRouter.get("/llm/active/:companyId", async (c) => {
  const companyId = c.req.param("companyId");
  const active = await db
    .select()
    .from(llmProviders)
    .where(sql`${llmProviders.companyId} = ${companyId} AND ${llmProviders.isActive} = true`)
    .limit(1);

  return c.json({ provider: active[0] || null });
});
