import { Hono } from "hono";

export const openclaw = new Hono();

openclaw.post("/connectors/openclaw", (c) => c.json({ ok: true }));
