import { Hono } from "hono";
import { cors } from 'hono/cors'
import auth from "./routes/auth";
import { calendar } from "./routes/calendar";
import { chat } from "./routes/chat";
import { files } from "./routes/files";
import { journal } from "./routes/journal";
import { realtime } from "./routes/realtime";
import { openclaw } from "./routes/openclaw";
import { data } from "./routes/data";

export const app = new Hono();

app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))

app.get("/health", (c) => c.json({ ok: true }));

// Public
app.route("/api", auth);

// Protected routes will go here later
// app.route("/api/data", data); // Wrap with authMiddleware later

