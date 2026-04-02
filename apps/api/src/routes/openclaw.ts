import { Hono } from "hono";
import { db } from "../db/client";
import { events } from "../db/schema";
import { normalizeEvent } from "../connectors/openclaw";

export const openclaw = new Hono();

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET || "";

openclaw.post("/connectors/openclaw", async (c) => {
  // Reject requests missing the webhook secret
  const providedSecret = c.req.header("X-Webhook-Secret");
  if (!providedSecret || providedSecret !== WEBHOOK_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const normalized = normalizeEvent(raw);

  await db.insert(events).values({
    id: crypto.randomUUID(),
    companyId: raw.companyId ?? null,
    projectId: raw.projectId ?? null,
    agentId: raw.agentId ?? null,
    type: normalized.type,
    payload: JSON.stringify(normalized.payload),
    createdAt: new Date(),
  });
  return c.json({ ok: true });
});
