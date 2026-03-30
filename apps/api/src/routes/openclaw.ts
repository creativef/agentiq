import { Hono } from "hono";
import { db } from "../db/client";
import { events } from "../db/schema";

export const openclaw = new Hono();

openclaw.post("/connectors/openclaw", async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  await db.insert(events).values({
    id: crypto.randomUUID(),
    type: payload.type ?? "unknown",
    createdAt: new Date(),
  });
  return c.json({ ok: true });
});
