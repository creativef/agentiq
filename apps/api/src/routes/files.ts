import { Hono } from "hono";

export const files = new Hono();

files.get("/files", (c) => c.json({ files: [] }));
// TODO: Implement multipart file upload with storage layer
files.post("/files", (c) => c.json({ ok: true }));
