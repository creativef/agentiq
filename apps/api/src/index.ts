import { Hono } from "hono";
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import auth from "./routes/auth";
import { calendar } from "./routes/calendar";
import { chat } from "./routes/chat";
import { files } from "./routes/files";
import { journal } from "./routes/journal";
import { realtime } from "./routes/realtime";
import { openclaw } from "./routes/openclaw";
import { data } from "./routes/data";

export const app = new Hono();

app.use('*', logger())
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))

app.get("/health", (c) => c.json({ ok: true }));

// Public
app.route("/api", auth);

// Protected routes
app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

app.onError((err, c) => {
  console.error("SERVER ERROR:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});
