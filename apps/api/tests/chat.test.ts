import { expect, it } from "vitest";
import { app } from "../src/index";

it("creates chat message", async () => {
  const res = await app.request("/chat", { method: "POST" });
  expect(res.status).toBe(200);
});
