import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { connectors as connectorsTable, events, companyMembers, companies, agents } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { getConnector, listAvailablePlatforms } from "../connectors";

export const connectorsRouter = new Hono();
connectorsRouter.use(authMiddleware);

// GET /connectors/platforms
connectorsRouter.get("/connectors/platforms", async (c) => {
  return c.json({ platforms: listAvailablePlatforms() });
});

// GET /connectors - list connectors for user's companies
connectorsRouter.get("/connectors", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({
      id: connectorsTable.id,
      companyId: connectorsTable.companyId,
      platform: connectorsTable.platform,
      config: connectorsTable.config,
      status: connectorsTable.status,
      createdAt: connectorsTable.createdAt,
      companyName: companies.name,
    })
    .from(connectorsTable)
    .innerJoin(companyMembers, sql`${connectorsTable.companyId} = ${companyMembers.companyId}`)
    .innerJoin(companies, sql`${connectorsTable.companyId} = ${companies.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(connectorsTable.createdAt);
  return c.json({ connectors: rows });
});

// POST /connectors/:platform/connect
connectorsRouter.post("/connectors/:platform/connect", async (c) => {
  const user: UserPayload = c.get("user");
  const platform = c.req.param("platform");
  const connDef = getConnector(platform);
  if (!connDef) return c.json({ error: `Unknown platform: ${platform}` }, 400);
  const body = await c.req.json().catch(() => ({}));
  const companyId = body.companyId;
  if (!companyId) return c.json({ error: "Missing companyId" }, 400);
  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);
  const webhookSecret = crypto.randomUUID();
  const [connector] = await db.insert(connectorsTable).values({ companyId, platform, config: JSON.stringify({ webhookSecret, apiUrl: body.apiUrl }), status: "connected" }).returning();
  return c.json({ connector, webhookSecret: connDef.requiresSetup ? webhookSecret : null, webhookUrl: `/api/connectors/${platform}/webhook` });
});

// DELETE /connectors/:connectorId
connectorsRouter.delete("/connectors/:connectorId", async (c) => {
  const connectorId = c.req.param("connectorId");
  const user: UserPayload = c.get("user");
  const check = await db.select({ companyId: connectorsTable.companyId }).from(connectorsTable).where(sql`${connectorsTable.id} = ${connectorId}`).limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);
  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);
  await db.delete(connectorsTable).where(sql`${connectorsTable.id} = ${connectorId}`);
  return c.json({ ok: true });
});

// WEBHOOK: POST /connectors/:platform/webhook
connectorsRouter.post("/connectors/:platform/webhook", async (c) => {
  const platform = c.req.param("platform");
  const connDef = getConnector(platform);
  if (!connDef) return c.json({ error: `Unknown platform: ${platform}` }, 400);
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON" }, 400);
  const companyId = raw.companyId ?? null;
  const normalized = connDef.normalizeEvent(raw);
  await db.insert(events).values({ companyId, type: normalized.type, actor: normalized.actor ?? null, description: normalized.description ?? null, meta: JSON.stringify(normalized.payload), createdAt: new Date() });
  return c.json({ ok: true });
});
