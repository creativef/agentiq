import { Hono } from "hono";

export const chat = new Hono();

chat.post("/chat", (c) => c.json({ ok: true }));
