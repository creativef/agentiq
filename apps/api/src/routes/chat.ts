import { Hono } from "hono";

export const chat = new Hono();

// GET /chat - list messages (stub until chat_messages table is added)
chat.get("/chat", async (c) => {
  return c.json({ messages: [] });
});

// POST /chat - send a message (stub until chat_messages table is added)
chat.post("/chat", async (c) => {
  return c.json({ ok: true, message: "Chat storage not yet implemented" });
});
