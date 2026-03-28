import { Hono } from "hono";
import { realtime } from "./routes/realtime";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/", realtime);
