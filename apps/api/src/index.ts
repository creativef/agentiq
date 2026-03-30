import { Hono } from "hono";
import { calendar } from "./routes/calendar";
import { chat } from "./routes/chat";
import { files } from "./routes/files";
import { journal } from "./routes/journal";
import { realtime } from "./routes/realtime";
import { openclaw } from "./routes/openclaw";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/", realtime);
app.route("/", chat);
app.route("/", journal);
app.route("/", calendar);
app.route("/", files);
app.route("/", openclaw);
