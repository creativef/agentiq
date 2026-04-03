import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { connectors as connectorsTable, events, companyMembers, companies, agents } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { connectorRegistry, getConnector, listAvailablePlatforms } from "../connectors";

export const connectorsRouter = new Hono();
connectorsRouter.use(authMiddleware);

// ============================================================
// FRONTEND-FACING: Connector management
// ============================================================

// GET /connectors/platforms — list all supported platforms
connectorsRouter.get("/connectors/platforms", async (c) => {
  return c.json({ platforms: listAvailablePlatforms() });
});

// GET /connectors — list configured connectors for current user
connectorsRouter.get("/connectors", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: connectorsTable.id,
      companyId: connectorsTable.companyId,
      platform: connectorsTable.platform,
      apiKey: connectorsTable.apiKey,
      apiUrl: connectorsTable.apiUrl,
      enabled: connectorsTable.enabled,
      config: connectorsTable.config,
      createdAt: connectorsTable.createdAt,
      companyName: companies.name,
    })
    .from(connectorsTable)
    .innerJoin(companyMembers, sql`${connectorsTable.companyId} = ${companyMembers.companyId}`)
    .innerJoin(companies, sql`${connectorsTable.companyId} = ${companies.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(connectorsTable.platform);
  return c.json({ connectors: rows });
});

// POST /connectors — configure a connector
connectorsRouter.post("/connectors", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();
  const { companyId, platform, webhookSecret, apiKey, apiUrl, config } = body;

  const connDef = getConnector(platform);
  if (!connDef) return c.json({ error: `Unknown platform: ${platform}` }, 400);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Upsert
  const existing = await db
    .select({ id: connectorsTable.id, webhookSecret: connectorsTable.webhookSecret, apiKey: connectorsTable.apiKey, apiUrl: connectorsTable.apiUrl, config: connectorsTable.config })
    .from(connectorsTable)
    .where(sql`${connectorsTable.companyId} = ${companyId} AND ${connectorsTable.platform} = ${platform}`)
    .limit(1);

  let result;
  if (existing.length > 0) {
    result = await db.update(connectorsTable).set({
      webhookSecret: webhookSecret ?? existing[0].webhookSecret,
      apiKey: apiKey ?? existing[0].apiKey,
      apiUrl: apiUrl ?? existing[0].apiUrl,
      config: config ?? existing[0].config,
      enabled: true,
    }).where(sql`${connectorsTable.id} = ${existing[0].id}`).returning();
  } else {
    result = await db.insert(connectorsTable).values({
      companyId,
      platform,
      webhookSecret: webhookSecret ?? null,
      apiKey: apiKey ?? null,
      apiUrl: apiUrl ?? null,
      config: config ?? null,
    }).returning();
  }

  return c.json({ connector: result[0] });
});

// PUT /connectors/:connectorId
connectorsRouter.put("/connectors/:connectorId", async (c) => {
  const connectorId = c.req.param("connectorId");
  const user: UserPayload = c.get("user");
  const body = await c.req.json();

  const check = await db
    .select({ companyId: connectorsTable.companyId })
    .from(connectorsTable)
    .where(sql`${connectorsTable.id} = ${connectorId}`)
    .limit(1);
  if (check.length === 0) return c.json({ error: "Connector not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.update(connectorsTable).set({
    webhookSecret: body.webhookSecret,
    apiKey: body.apiKey,
    apiUrl: body.apiUrl,
    enabled: body.enabled,
    config: body.config,
  }).where(sql`${connectorsTable.id} = ${connectorId}`);

  return c.json({ ok: true });
});

// DELETE /connectors/:connectorId
connectorsRouter.delete("/connectors/:connectorId", async (c) => {
  const connectorId = c.req.param("connectorId");
  const user: UserPayload = c.get("user");

  const check = await db
    .select({ companyId: connectorsTable.companyId })
    .from(connectorsTable)
    .where(sql`${connectorsTable.id} = ${connectorId}`)
    .limit(1);
  if (check.length === 0) return c.json({ error: "Connector not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(connectorsTable).where(sql`${connectorsTable.id} = ${connectorId}`);
  return c.json({ ok: true });
});

// ============================================================
// WEBHOOK: POST /connectors/:platform/webhook
// Universal endpoint — any registered platform can send events
// ============================================================
connectorsRouter.post("/connectors/:platform/webhook", async (c) => {
  const platform = c.req.param("platform");
  const connDef = getConnector(platform);
  if (!connDef) return c.json({ error: `Unknown platform: ${platform}` }, 400);

  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON" }, 400);

  const headers = Object.fromEntries(c.req.raw.headers.entries());
  const companyId = raw.companyId ?? null;

  // Look up connector config for secret verification
  let secret = "";
  if (companyId) {
    const conn = await db
      .select({ webhookSecret: connectorsTable.webhookSecret })
      .from(connectorsTable)
      .where(sql`${connectorsTable.companyId} = ${companyId} AND ${connectorsTable.platform} = ${platform}`)
      .limit(1);
    secret = conn[0]?.webhookSecret ?? "";
  }

  if (secret && !connDef.validateWebhook(raw, headers, secret)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const normalized = connDef.normalizeEvent(raw);

  await db.insert(events).values({
    id: crypto.randomUUID(),
    companyId,
    projectId: raw.projectId ?? null,
    agentId: normalized.agentId ?? null,
    platform,
    type: normalized.type,
    payload: JSON.stringify(normalized.payload),
    createdAt: new Date(),
  });

  // Auto-register agent on first event
  if (normalized.agentId && companyId) {
    const exists = await db
      .select()
      .from(agents)
      .where(sql`${agents.companyId} = ${companyId} AND ${agents.externalId} = ${normalized.agentId}`)
      .limit(1);
    if (exists.length === 0) {
      await db.insert(agents).values({
        companyId,
        platform,
        externalId: normalized.agentId,
        name: `Agent ${normalized.agentId}`,
        role: "AGENT",
        status: "idle",
      });
    }
  }

  return c.json({ ok: true });
});
