import { expect, it } from "vitest";
import { app } from "../src/index";

it("creates meeting", async () => {
  const res = await app.request("/meetings", { method: "POST" });
  expect(res.status).toBe(200);
});
