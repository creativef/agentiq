import { Hono } from "hono";

export const calendar = new Hono();

calendar.post("/meetings", (c) => c.json({ ok: true }));
