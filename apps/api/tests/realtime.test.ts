import { expect, it } from "vitest";
import { app } from "../src/index";

it("streams /events", async () => {
  const res = await app.request("/events");
  expect(res.status).toBe(200);
});
