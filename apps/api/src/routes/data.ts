import { Hono } from "hono";
import { db } from "../db/client";
import { companies, events } from "../db/schema";

export const data = new Hono();

data.get("/companies", async (c) => {
  const rows = await db.select().from(companies);
  return c.json(rows);
});

data.get("/events", async (c) => {
  const rows = await db.select().from(events).limit(50);
  return c.json(rows);
});
