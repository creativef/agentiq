import { expect, it } from "vitest";
import { app } from "../src/index";

it("ingests gateway event", async () => {
  const res = await app.request("/connectors/openclaw", { method: "POST" });
  expect(res.status).toBe(200);
});
