import { expect, it } from "vitest";
import { app } from "../src/index";

it("responds to /health", async () => {
  const res = await app.request("/health");
  expect(res.status).toBe(200);
});
