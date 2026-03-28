import { Hono } from "hono";

export const realtime = new Hono();

realtime.get("/events", (c) => c.text(""));
