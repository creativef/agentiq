import { Hono } from "hono";

export const journal = new Hono();

journal.get("/journal", (c) => c.json({ ok: true }));
