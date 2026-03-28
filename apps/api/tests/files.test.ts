import { expect, it } from "vitest";
import { app } from "../src/index";

it("uploads file", async () => {
  const res = await app.request("/files", { method: "POST" });
  expect(res.status).toBe(200);
});
