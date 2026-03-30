import { Hono } from "hono";

export const data = new Hono();

data.get("/companies", (c) => c.json([]));
