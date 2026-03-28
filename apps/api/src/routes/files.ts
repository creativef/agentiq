import { Hono } from "hono";

export const files = new Hono();

files.post("/files", (c) => c.json({ ok: true }));
